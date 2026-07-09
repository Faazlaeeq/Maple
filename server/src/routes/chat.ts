// ─────────────────────────────────────────────────────────
// Maple — Chat Route
// POST /api/chat — Core conversation endpoint
// ─────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, ChatResponse, LeadRecord, ChatMessage } from '../types';
import { chat as geminiChat } from '../services/gemini';
import { sendLeadNotification } from '../services/email';
import { sendVerificationOtp } from '../services/twilio';
import { getClinicProfile, saveLead, updateLeadNotification, saveConversation } from '../services/firestore';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { clinicId, sessionId, message, history } = req.body as ChatRequest;

    // ── Validate request ──
    if (!sessionId || !message || !clinicId) {
      res.status(400).json({ error: 'clinicId, sessionId and message are required' });
      return;
    }

    // ── Fetch Clinic Profile ──
    const profile = await getClinicProfile(clinicId);
    if (!profile) {
      res.status(404).json({ error: 'Clinic profile not found' });
      return;
    }

    // ── Call Gemini ──
    const geminiResponse = await geminiChat(message, history || [], profile);

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
      sendVerificationOtp(geminiResponse.emailToVerify, profile).catch((err) =>
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
        clientId: profile.id,
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
          const emailSent = await sendLeadNotification(lead, profile);
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
