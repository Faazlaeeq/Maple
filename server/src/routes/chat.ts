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
import { getClinicProfile, saveLead, updateLeadNotification, saveConversation, getLead, getConversation } from '../services/firestore';

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

    // ── Trigger Verification ──
    if (geminiResponse.requiresVerification && geminiResponse.emailToVerify) {
      try {
        await sendVerificationOtp(geminiResponse.emailToVerify, profile);
      } catch (err: any) {
        console.error('[Chat] Failed to send OTP:', err);
        const reason = err.message || 'unknown error';
        geminiResponse.reply = `I'm sorry, but I couldn't send the verification code to that email address (${reason}). Could you please double-check your email or provide a different one?`;
        geminiResponse.requiresVerification = false;
      }
    }

    // ── Build updated transcript ──
    const now = new Date().toISOString();
    const updatedHistory: ChatMessage[] = [
      ...(history || []),
      { role: 'user', text: message, timestamp: now },
      { role: 'assistant', text: geminiResponse.reply, timestamp: now },
    ];

    // ── Save conversation log ──
    saveConversation(sessionId, updatedHistory).catch((err) => {
      console.error('[Chat] Failed to save conversation:', err);
    });

    // ── Handle lead capture ──
    let leadCaptured = false;

    if (
      geminiResponse.leadDetected &&
      geminiResponse.visitorName &&
      geminiResponse.contactValue
    ) {
      leadCaptured = true;

      const existingLead = await getLead(sessionId);
      
      if (!existingLead) {
        const lead: LeadRecord = {
          id: sessionId,
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

        try {
          const leadId = await saveLead(lead);
          const emailSent = await sendLeadNotification(lead, profile);
          await updateLeadNotification(leadId, emailSent);
        } catch (err) {
          console.error('[Chat] Lead processing failed:', err);
        }
      }
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

// ── Read-Only Chat View Route ──
router.get('/:sessionId/view', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const conversation = await getConversation(sessionId);
    
    if (!conversation) {
      res.status(404).send('Chat not found.');
      return;
    }
    
    const lead = await getLead(sessionId);
    const visitorName = lead?.visitorName || 'Visitor';

    const transcriptHtml = conversation.transcript.map((msg: any) => `
      <div style="margin-bottom: 12px; max-width: 80%; padding: 12px 16px; border-radius: 12px; ${
        msg.role === 'user' 
          ? 'background: #e3f2fd; color: #0d47a1; margin-left: auto; border-bottom-right-radius: 4px;' 
          : 'background: #f1f5f9; color: #334155; margin-right: auto; border-bottom-left-radius: 4px;'
      }">
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px; opacity: 0.7;">
          ${msg.role === 'user' ? '👤 ' + visitorName : '🤖 Maple AI'}
        </div>
        <div style="line-height: 1.5; font-size: 15px; white-space: pre-wrap;">${msg.text}</div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chat Transcript - ${visitorName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); overflow: hidden; }
          .header { background: #1e293b; color: white; padding: 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 18px; }
          .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
          .chat-box { padding: 20px; display: flex; flex-direction: column; background: #ffffff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Conversation with ${visitorName}</h1>
            <p>Session ID: ${sessionId}</p>
          </div>
          <div class="chat-box">
            ${transcriptHtml}
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('[Chat View] Error:', error);
    res.status(500).send('Internal server error.');
  }
});

export default router;
