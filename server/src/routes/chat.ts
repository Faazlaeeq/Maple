// ─────────────────────────────────────────────────────────
// Maple — Chat Route
// POST /api/chat — Core conversation endpoint
// ─────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, ChatResponse, LeadRecord, ChatMessage } from '../types';
import { chat as geminiChat } from '../services/gemini';
import { saveLead, updateLeadNotification, saveConversation } from '../services/firestore';
import { sendLeadNotification } from '../services/email';
import { sendVerificationOtp } from '../services/twilio';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, history } = req.body as ChatRequest;

    // ── Validate request ──
    if (!sessionId || !message) {
      res.status(400).json({ error: 'sessionId and message are required' });
      return;
    }

    // ── Call Gemini ──
    const geminiResponse = await geminiChat(message, history || []);

    // ── Build updated transcript ──
    const now = new Date().toISOString();
    const updatedHistory: ChatMessage[] = [
      ...(history || []),
      { role: 'user', text: message, timestamp: now },
      { role: 'assistant', text: geminiResponse.reply, timestamp: now },
    ];

    // ── Save conversation log (async, don't block response) ──
    saveConversation(sessionId, updatedHistory).catch((err) =>
      console.error('[Chat] Failed to save conversation:', err)
    );

    // ── Trigger Verification ──
    if (geminiResponse.requiresVerification && geminiResponse.emailToVerify) {
      sendVerificationOtp(geminiResponse.emailToVerify).catch((err) =>
        console.error('[Chat] Failed to send OTP:', err)
      );
    }

    // ── Handle lead capture ──
    let leadCaptured = false;

    if (
      geminiResponse.leadDetected &&
      geminiResponse.visitorName &&
      geminiResponse.contactValue
    ) {
      leadCaptured = true;

      const lead: LeadRecord = {
        id: uuidv4(),
        clientId: process.env.CLIENT_ID || 'maplewood-dental',
        visitorName: geminiResponse.visitorName,
        contactMethod: geminiResponse.contactMethod || 'phone',
        contactValue: geminiResponse.contactValue,
        summary: geminiResponse.summary || 'Website inquiry',
        urgency: geminiResponse.urgency || 'normal',
        transcript: updatedHistory,
        createdAt: now,
        notificationSent: false,
      };

      // Save lead (don't block response)
      saveLead(lead)
        .then(async (leadId) => {
          // Send email notification immediately after save
          const emailSent = await sendLeadNotification(lead);
          await updateLeadNotification(leadId, emailSent);
        })
        .catch((err) => console.error('[Chat] Lead processing failed:', err));
    }

    // ── Return response ──
    const response: ChatResponse = {
      reply: geminiResponse.reply,
      leadCaptured,
    };

    res.json(response);
  } catch (error) {
    console.error('[Chat] Unhandled error:', error);
    res.status(500).json({
      reply: "I'm having a little trouble right now — could you leave your name and contact info? Our team will follow up with you right away!",
      leadCaptured: false,
    });
  }
});

export default router;
