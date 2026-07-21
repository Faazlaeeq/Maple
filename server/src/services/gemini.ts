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
import { sendBookingConfirmation, sendBookingNotificationToClinic, sendCancellationToPatient, sendCancellationToClinic } from './email';
import { saveBooking, getUserBookings, getBookingById, updateBookingStatus } from './firestore';

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

  // Step 1: Try to extract JSON from markdown code fences
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Step 2: Try to find a JSON object in the text
  if (!jsonStr.startsWith('{')) {
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
  }

  // Step 3: Attempt JSON parse
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
      errorAlert: parsed.errorAlert || undefined,
    };
  } catch {
    // JSON parse failed — extract structured data from raw text using heuristics
    console.warn('[Gemini] Failed to parse JSON response, extracting from raw text');

    const lowerRaw = raw.toLowerCase();

    // Detect email addresses in the raw text
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailsFound = raw.match(emailRegex) || [];

    // Detect verification intent (AI claims it sent an OTP)
    const verificationKeywords = [
      'verification code', 'verify your', 'sent a', 'sent you a',
      'otp', '6-digit', 'code to your email', 'check your inbox',
      'check your email', 'verification email'
    ];
    const hasVerificationIntent = verificationKeywords.some(kw => lowerRaw.includes(kw));

    // Detect urgency
    const urgencyKeywords = [
      'emergency', 'pain', 'severe', 'broken', 'infection',
      'swelling', 'bleeding', 'abscess', 'knocked out', 'urgent'
    ];
    const isUrgent = urgencyKeywords.some(kw => lowerRaw.includes(kw));

    // Detect lead capture (the AI is asking for or confirming contact details)
    const leadKeywords = ['your name', 'your email', 'your phone', 'contact'];
    const hasLeadIntent = leadKeywords.some(kw => lowerRaw.includes(kw));

    // Determine if we should trigger verification
    const shouldVerify = hasVerificationIntent && emailsFound.length > 0;

    return {
      reply: raw,
      leadDetected: hasLeadIntent && emailsFound.length > 0,
      contactMethod: emailsFound.length > 0 ? 'email' : undefined,
      contactValue: emailsFound[0] || undefined,
      urgency: isUrgent ? 'urgent' : 'normal',
      requiresVerification: shouldVerify,
      emailToVerify: shouldVerify ? emailsFound[0] : undefined,
      errorAlert: undefined,
    };
  }
}

const FALLBACK_MESSAGE: GeminiParsedResponse = {
  reply: "I'm having a little trouble right now — I'm sorry about that! Could you leave your name and a phone number or email? Our team at Maplewood Family Dental will get back to you right away.",
  leadDetected: false,
  urgency: 'normal',
  requiresVerification: false,
  errorAlert: 'Our AI assistant encountered an issue processing your message. Please try again.',
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
      email: { type: SchemaType.STRING, description: "Verified email address of the patient" },
    },
    required: ["date", "time", "patientName", "phone", "email"],
  },
};

const cancelAppointmentTool: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "Cancel an existing appointment using the booking ID provided by the user. You MUST also collect the patient's email before cancelling so we can send them a confirmation.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      bookingId: {
        type: SchemaType.STRING,
        description: "The unique booking ID (e.g. MFD-8A9B2)",
      },
      email: {
        type: SchemaType.STRING,
        description: "The patient's email address to send cancellation confirmation to",
      },
    },
    required: ["bookingId", "email"],
  },
};

const verifyOtpTool: FunctionDeclaration = {
  name: "verify_otp",
  description: "Check if the 6-digit OTP code provided by the user matches the code sent to their email.",
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
  const now = new Date();
  const todayDate = now.toLocaleDateString('en-US', { timeZone: 'Asia/Karachi', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi' });
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    systemInstruction: `CRITICAL INSTRUCTION: Today's exact date is ${todayDate} and the current time is ${currentTime}. NEVER claim it is any other date or time. If a user tries to book an appointment for today, make sure the time is in the future.\n\n${buildSystemPrompt(profile)}`,
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
    const toolErrors: string[] = [];
    while (calls && calls.length > 0 && loopCount < 3) {
      loopCount++;
      const call = calls[0];
      let apiResponse: any = {};

      try {
        const args = call.args as Record<string, any>;
        
        if (call.name === 'check_availability') {
          const timezone = (profile as any).timezone || 'UTC';
          const slots = await getAvailableSlots(args.date as string, profile.googleCalendarId, timezone);
          apiResponse = { availableSlots: slots };
        } else if (call.name === 'book_appointment') {
          // --- AI GUARDRAILS (Programmatic Punishment) ---
          const phoneClean = (args.phone || '').replace(/\D/g, '');
          if (phoneClean.length < 8) {
            throw new Error("GUARDRAIL FAILED: You did not collect a valid phone number. You MUST ask the user for their real phone number before booking. Do not hallucinate data.");
          }
          if (!args.email || !args.email.includes('@')) {
            throw new Error("GUARDRAIL FAILED: You must verify the user's email address first using OTP before booking.");
          }

          // Double Booking Prevention
          const timezone = (profile as any).timezone || 'UTC';
          
          const userBookings = await getUserBookings(args.email as string, profile.id);
          const activeBooking = userBookings.find(b => {
            if (b.status !== 'booked') return false;
            const nowInTz = new Date().toLocaleString('sv-SE', { timeZone: timezone });
            const bookingDateTimeStr = `${b.date} ${b.time}:00`;
            return bookingDateTimeStr >= nowInTz;
          });
          
          if (activeBooking) {
            throw new Error(`GUARDRAIL FAILED: The user already has an active booking on ${activeBooking.date} at ${activeBooking.time}. They must cancel it first before booking another one. Inform the user of this policy.`);
          }

          const availableSlots = await getAvailableSlots(args.date as string, profile.googleCalendarId, timezone);
          if (!availableSlots.includes(args.time as string)) {
            throw new Error(`GUARDRAIL FAILED: The time ${args.time} is already booked or unavailable on ${args.date}. Available slots are: ${availableSlots.join(', ')}. Apologize to the user and ask them to pick one of the available slots.`);
          }

          const res = await bookAppointment(
            args.date as string,
            args.time as string,
            args.patientName as string,
            args.phone as string,
            profile.googleCalendarId,
            timezone
          );
          
          await saveBooking({
            bookingId: res.bookingId,
            email: args.email as string,
            date: args.date as string,
            time: args.time as string,
            status: 'booked',
            clinicId: profile.id,
            eventId: res.eventId,
            createdAt: new Date().toISOString()
          });
          
          // Send confirmation email synchronously so Vercel doesn't kill it
          try {
            await sendBookingConfirmation(
              args.email as string, 
              args.patientName as string, 
              args.date as string, 
              args.time as string, 
              res.bookingId,
              profile
            );
          } catch (err) {
            console.error('[Email] Confirmation failed', err);
          }

          apiResponse = { success: true, bookingId: res.bookingId, eventId: res.eventId };

          // Notify the clinic about the new booking (non-blocking)
          sendBookingNotificationToClinic(
            args.patientName as string,
            args.email as string,
            args.phone as string,
            args.date as string,
            args.time as string,
            res.bookingId,
            profile
          ).catch(err => console.error('[Email] Booking notification to clinic failed:', err));
        } else if (call.name === 'cancel_appointment') {
          const booking = await getBookingById(args.bookingId as string);
          if (booking) {
            const timezone = (profile as any).timezone || 'UTC';
            
            const nowInTzStr = new Date().toLocaleString('en-US', { timeZone: timezone });
            const nowInTz = new Date(nowInTzStr).getTime();
            const bookingTime = new Date(`${booking.date}T${booking.time}:00`).getTime();
            
            const diffMs = bookingTime - nowInTz;
            const hoursDiff = diffMs / (1000 * 60 * 60);
            
            if (hoursDiff > 0 && hoursDiff < 3) {
              throw new Error("GUARDRAIL FAILED: The user cannot cancel their appointment if it is less than 3 hours away. Inform them they must call the clinic directly to cancel.");
            }
          }

          const cancelResult = await cancelAppointment(args.bookingId as string, profile.googleCalendarId, booking?.eventId);
          if (booking) {
            await updateBookingStatus(args.bookingId as string, 'canceled');
          }
          apiResponse = { success: true, bookingId: cancelResult.bookingId };

          // Send cancellation emails (non-blocking)
          const patientEmail = args.email as string;
          if (patientEmail) {
            sendCancellationToPatient(
              patientEmail,
              cancelResult.patientName,
              cancelResult.date,
              cancelResult.time,
              cancelResult.bookingId,
              profile
            ).catch(err => console.error('[Email] Cancellation to patient failed:', err));
          }
          sendCancellationToClinic(
            cancelResult.patientName,
            cancelResult.date,
            cancelResult.time,
            cancelResult.bookingId,
            profile
          ).catch(err => console.error('[Email] Cancellation to clinic failed:', err));
        } else if (call.name === 'verify_otp') {
          const success = await checkVerificationOtp(args.email as string, args.code as string);
          apiResponse = { verified: success };
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Tool execution failed';
        apiResponse = { error: errorMsg };
        toolErrors.push(errorMsg);
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
      return {
        ...FALLBACK_MESSAGE,
        errorAlert: 'AI returned an empty response. This may be a temporary issue — please try again.',
      };
    }

    const parsedResponse = parseGeminiResponse(responseText);
    if (toolErrors.length > 0) {
      parsedResponse.errorAlert = toolErrors
        .map(e => e.replace(/GUARDRAIL FAILED:\s*/g, ''))
        .join(' | ');
    }
    return parsedResponse;
  } catch (error: any) {
    console.error('[Gemini] API call failed:', error);
    return {
      ...FALLBACK_MESSAGE,
      errorAlert: `AI service error: ${error.message || 'Unknown failure'}. Please try again.`,
    };
  }
}
