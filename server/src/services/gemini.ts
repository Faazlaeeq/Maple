// ─────────────────────────────────────────────────────────
// Maple — Gemini AI Service
// Handles all interactions with the Gemini API and Tools
// ─────────────────────────────────────────────────────────

import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { ChatMessage, GeminiParsedResponse } from '../types';
import { getAvailableSlots, bookAppointment, cancelAppointment } from './calendar';
import { checkVerificationOtp } from './twilio';
import { sendBookingConfirmation } from './email';

// Load knowledge base and system prompt at startup
const knowledgeBase = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../knowledge/maplewood.json'), 'utf-8')
);

const systemPromptTemplate = fs.readFileSync(
  path.join(__dirname, '../prompts/system-prompt.md'),
  'utf-8'
);

function buildSystemPrompt(): string {
  return systemPromptTemplate
    .replace('{{businessName}}', knowledgeBase.businessName)
    .replace('{{knowledgeBase}}', JSON.stringify(knowledgeBase, null, 2));
}

function formatHistory(history: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  return history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));
}

function parseGeminiResponse(raw: string): GeminiParsedResponse {
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      reply: parsed.reply || raw,
      leadDetected: Boolean(parsed.leadDetected),
      visitorName: parsed.visitorName || undefined,
      contactMethod: parsed.contactMethod || undefined,
      contactValue: parsed.contactValue || undefined,
      urgency: parsed.urgency === 'urgent' ? 'urgent' : 'normal',
      summary: parsed.summary || undefined,
      requiresVerification: Boolean(parsed.requiresVerification),
      emailToVerify: parsed.emailToVerify || undefined,
    };
  } catch {
    console.warn('[Gemini] Failed to parse JSON response, using raw text');
    return {
      reply: raw,
      leadDetected: false,
      urgency: 'normal',
      requiresVerification: false,
    };
  }
}

const FALLBACK_MESSAGE: GeminiParsedResponse = {
  reply: "I'm having a little trouble right now — I'm sorry about that! Could you leave your name and a phone number or email? Our team at Maplewood Family Dental will get back to you right away.",
  leadDetected: false,
  urgency: 'normal',
  requiresVerification: false,
};

// Define Tools
const checkAvailabilityTool: FunctionDeclaration = {
  name: "check_availability",
  description: "Check available appointment slots for a given date on the clinic's Google Calendar.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to check availability for in YYYY-MM-DD format (e.g. 2026-07-10)",
      },
    },
    required: ["date"],
  },
};

const bookAppointmentTool: FunctionDeclaration = {
  name: "book_appointment",
  description: "Book an appointment on the clinic's Google Calendar. MUST verify the user's phone number first via OTP.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: { type: SchemaType.STRING, description: "YYYY-MM-DD format" },
      time: { type: SchemaType.STRING, description: "HH:mm format (e.g. 14:00)" },
      patientName: { type: SchemaType.STRING, description: "Full name of the patient" },
      email: { type: SchemaType.STRING, description: "Verified email address of the patient" },
    },
    required: ["date", "time", "patientName", "email"],
  },
};

const cancelAppointmentTool: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "Cancel an existing appointment using the booking ID provided by the user.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      bookingId: {
        type: SchemaType.STRING,
        description: "The unique booking ID (e.g. MFD-8A9B2)",
      },
    },
    required: ["bookingId"],
  },
};

const verifyOtpTool: FunctionDeclaration = {
  name: "verify_otp",
  description: "Check if the 6-digit OTP code provided by the user matches the code sent to their phone.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      email: { type: SchemaType.STRING, description: "The email address the code was sent to" },
      code: { type: SchemaType.STRING, description: "The 6-digit code the user typed in chat" },
    },
    required: ["email", "code"],
  },
};

const tools = [{
  functionDeclarations: [checkAvailabilityTool, bookAppointmentTool, cancelAppointmentTool, verifyOtpTool],
}];

export async function chat(
  message: string,
  history: ChatMessage[]
): Promise<GeminiParsedResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY is not set');
    return FALLBACK_MESSAGE;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // NOTE: When using tools, sometimes JSON responseMimeType conflicts with function call responses.
  // We will leave responseMimeType as JSON since the system prompt demands JSON output.
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
  systemInstruction: buildSystemPrompt(),
    tools: tools,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
    },
  });

  try {
    const chatSession = model.startChat({
      history: formatHistory(history),
    });

    let result = await chatSession.sendMessage(message);
    let calls = result.response.functionCalls();

    // Handle tool calls in a loop (up to 3 times to prevent infinite loops)
    let loopCount = 0;
    while (calls && calls.length > 0 && loopCount < 3) {
      loopCount++;
      const call = calls[0];
      let apiResponse: any = {};

      try {
        if (call.name === 'check_availability') {
          const slots = await getAvailableSlots(call.args.date as string);
          apiResponse = { availableSlots: slots };
        } else if (call.name === 'book_appointment') {
          const res = await bookAppointment(
            call.args.date as string,
            call.args.time as string,
            call.args.patientName as string,
            call.args.email as string
          );
          
          // Send confirmation email asynchronously
          sendBookingConfirmation(
            call.args.email as string, 
            call.args.patientName as string, 
            call.args.date as string, 
            call.args.time as string, 
            res.bookingId
          ).catch(err => console.error('[Email] Async confirmation failed', err));

          apiResponse = { success: true, bookingId: res.bookingId, eventId: res.eventId };
        } else if (call.name === 'cancel_appointment') {
          const success = await cancelAppointment(call.args.bookingId as string);
          apiResponse = { success };
        } else if (call.name === 'verify_otp') {
          const success = await checkVerificationOtp(call.args.email as string, call.args.code as string);
          apiResponse = { verified: success };
        }
      } catch (err: any) {
        apiResponse = { error: err.message || 'Tool execution failed' };
      }

      // Send the result back to Gemini
      result = await chatSession.sendMessage([{
        functionResponse: {
          name: call.name,
          response: apiResponse
        }
      }]);
      calls = result.response.functionCalls();
    }

    const responseText = result.response.text();
    if (!responseText) {
      console.warn('[Gemini] Empty response received');
      return FALLBACK_MESSAGE;
    }

    return parseGeminiResponse(responseText);
  } catch (error) {
    console.error('[Gemini] API call failed:', error);
    return FALLBACK_MESSAGE;
  }
}
