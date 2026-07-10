// ─────────────────────────────────────────────────────────
// Maple — Gemini AI Service
// Handles all interactions with the Gemini API and Tools
// ─────────────────────────────────────────────────────────

import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { ChatMessage, GeminiParsedResponse, ClinicProfile } from '../types';
import { getAvailableSlots, bookAppointment, cancelAppointment } from './calendar';
import { checkVerificationOtp } from './twilio';
import { sendBookingConfirmation } from './email';

function buildSystemPrompt(profile: ClinicProfile): string {
  return profile.systemPrompt
    .replace('{{businessName}}', profile.name)
    .replace('{{knowledgeBase}}', JSON.stringify(profile.knowledgeBase, null, 2));
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
  description: "Book an appointment on the clinic's Google Calendar. MUST ask the user for their valid phone number first.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: { type: SchemaType.STRING, description: "YYYY-MM-DD format" },
      time: { type: SchemaType.STRING, description: "HH:mm format (e.g. 14:00)" },
      patientName: { type: SchemaType.STRING, description: "Full name of the patient" },
      phone: { type: SchemaType.STRING, description: "Valid phone number of the patient" },
    },
    required: ["date", "time", "patientName", "phone"],
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

const tools = [{
  functionDeclarations: [checkAvailabilityTool, bookAppointmentTool, cancelAppointmentTool],
}];

export async function chat(
  message: string,
  history: ChatMessage[],
  profile: ClinicProfile
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
  systemInstruction: buildSystemPrompt(profile),
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
        const args = call.args as Record<string, any>;
        
        if (call.name === 'check_availability') {
          const slots = await getAvailableSlots(args.date as string, profile.googleCalendarId);
          apiResponse = { availableSlots: slots };
        } else if (call.name === 'book_appointment') {
          const res = await bookAppointment(
            args.date as string,
            args.time as string,
            args.patientName as string,
            args.phone as string,
            profile.googleCalendarId
          );
          
          apiResponse = { success: true, bookingId: res.bookingId, eventId: res.eventId };
        } else if (call.name === 'cancel_appointment') {
          const success = await cancelAppointment(args.bookingId as string, profile.googleCalendarId);
          apiResponse = { success };
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
