import OpenAI from 'openai';
import { ChatMessage, GeminiParsedResponse, ClinicProfile } from '../types';
import { getAvailableSlots, bookAppointment, cancelAppointment } from './calendar';
import { checkVerificationOtp } from './twilio';
import { sendBookingConfirmation } from './email';
import { saveBooking, getUserBookings, getBookingById, updateBookingStatus } from './firestore';

function buildSystemPrompt(profile: ClinicProfile): string {
  return profile.systemPrompt
    .replace('{{businessName}}', profile.name)
    .replace('{{knowledgeBase}}', JSON.stringify(profile.knowledgeBase, null, 2));
}

const FALLBACK_MESSAGE: GeminiParsedResponse = {
  reply: "I'm having a little trouble right now — I'm sorry about that! Could you leave your name and a phone number or email? Our team at Maplewood Family Dental will get back to you right away.",
  leadDetected: false,
  urgency: 'normal',
  requiresVerification: false,
};

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check available appointment slots for a given date on the clinic's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date to check availability for in YYYY-MM-DD format (e.g. 2026-07-10)" },
        },
        required: ["date"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book an appointment on the clinic's Google Calendar. MUST ask the user for their valid phone number first.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD format" },
          time: { type: "string", description: "HH:mm format (e.g. 14:00)" },
          patientName: { type: "string", description: "Full name of the patient" },
          phone: { type: "string", description: "Valid phone number of the patient" },
          email: { type: "string", description: "Verified email address of the patient" },
        },
        required: ["date", "time", "patientName", "phone", "email"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancel an existing appointment using the booking ID provided by the user.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string", description: "The unique booking ID (e.g. MFD-8A9B2)" },
        },
        required: ["bookingId"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "verify_otp",
      description: "Check if the 6-digit OTP code provided by the user matches the code sent to their email.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "The email address the code was sent to" },
          code: { type: "string", description: "The 6-digit code the user typed in chat" },
        },
        required: ["email", "code"],
      },
    }
  }
];

export async function chat(
  message: string,
  history: ChatMessage[],
  profile: ClinicProfile
): Promise<GeminiParsedResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[OpenAI] OPENAI_API_KEY is not set');
    return FALLBACK_MESSAGE;
  }

  const openai = new OpenAI({ apiKey });
  const now = new Date();
  const todayDate = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: `CRITICAL INSTRUCTION: Today's exact date is ${todayDate} and the current time is ${currentTime}. NEVER claim it is any other date or time. If a user tries to book an appointment for today, make sure the time is in the future. MUST return valid JSON.\n\n${buildSystemPrompt(profile)}` }
  ];

  for (const msg of history) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text
    });
  }

  messages.push({ role: "user", content: message });

  try {
    let response = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages,
      tools,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let messageObj = response.choices[0].message;
    let calls = messageObj.tool_calls;

    let loopCount = 0;
    while (calls && calls.length > 0 && loopCount < 3) {
      loopCount++;
      
      messages.push(messageObj);

      for (const call of calls) {
        if (call.type !== 'function') continue;
        let apiResponse: any = {};
        try {
          const args = JSON.parse(call.function.arguments);
          
          if (call.function.name === 'check_availability') {
            const timezone = (profile as any).timezone || 'UTC';
            const slots = await getAvailableSlots(args.date, profile.googleCalendarId, timezone);
            apiResponse = { availableSlots: slots };
          } else if (call.function.name === 'book_appointment') {
            const phoneClean = (args.phone || '').replace(/\D/g, '');
            if (phoneClean.length < 8) {
              throw new Error("GUARDRAIL FAILED: You did not collect a valid phone number. You MUST ask the user for their real phone number before booking. Do not hallucinate data.");
            }
            if (!args.email || !args.email.includes('@')) {
              throw new Error("GUARDRAIL FAILED: You must verify the user's email address first using OTP before booking.");
            }

            const availableSlots = await getAvailableSlots(args.date, profile.googleCalendarId, timezone);
            if (!availableSlots.includes(args.time)) {
              throw new Error(`GUARDRAIL FAILED: The time ${args.time} is already booked or unavailable on ${args.date}. Available slots are: ${availableSlots.join(', ')}. Apologize to the user and ask them to pick one of the available slots.`);
            }

            const userBookings = await getUserBookings(args.email, profile.id);
            const activeBooking = userBookings.find(b => {
              if (b.status !== 'booked') return false;
              const nowInTz = new Date().toLocaleString('sv-SE', { timeZone: timezone });
              const bookingDateTimeStr = `${b.date} ${b.time}:00`;
              return bookingDateTimeStr >= nowInTz;
            });
            
            if (activeBooking) {
              throw new Error(`GUARDRAIL FAILED: The user already has an active booking on ${activeBooking.date} at ${activeBooking.time}. They must cancel it first before booking another one. Inform the user of this policy.`);
            }

            const res = await bookAppointment(args.date, args.time, args.patientName, args.phone, profile.googleCalendarId, timezone);
            
            await saveBooking({
              bookingId: res.bookingId,
              email: args.email,
              date: args.date,
              time: args.time,
              status: 'booked',
              clinicId: profile.id,
              eventId: res.eventId,
              createdAt: new Date().toISOString()
            });
            
            try {
              await sendBookingConfirmation(args.email, args.patientName, args.date, args.time, res.bookingId, profile);
            } catch (err) {
              console.error('[Email] Confirmation failed', err);
            }

            apiResponse = { success: true, bookingId: res.bookingId, eventId: res.eventId };
          } else if (call.function.name === 'cancel_appointment') {
            const booking = await getBookingById(args.bookingId);
            if (booking) {
              const timezone = (profile as any).timezone || 'UTC';
              
              // Get current time in the clinic's timezone
              const nowInTzStr = new Date().toLocaleString('en-US', { timeZone: timezone });
              const nowInTz = new Date(nowInTzStr).getTime();
              
              // Get booking time in the clinic's timezone
              // (Since we feed it to new Date() without a Z, it assumes the local timezone of the JS environment, which matches the nowInTz logic)
              const bookingTime = new Date(`${booking.date}T${booking.time}:00`).getTime();
              
              const diffMs = bookingTime - nowInTz;
              const hoursDiff = diffMs / (1000 * 60 * 60);
              
              if (hoursDiff > 0 && hoursDiff < 3) {
                throw new Error("GUARDRAIL FAILED: The user cannot cancel their appointment if it is less than 3 hours away. Inform them they must call the clinic directly to cancel.");
              }
            }

            const details = await cancelAppointment(args.bookingId, profile.googleCalendarId);
            if (booking) {
              await updateBookingStatus(args.bookingId, 'canceled');
            }
            apiResponse = { success: true, details };
          } else if (call.function.name === 'verify_otp') {
            const success = await checkVerificationOtp(args.email, args.code);
            apiResponse = { verified: success };
          }
        } catch (err: any) {
          apiResponse = { error: err.message || 'Tool execution failed' };
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(apiResponse)
        });
      }

      response = await openai.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages,
        tools,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      messageObj = response.choices[0].message;
      calls = messageObj.tool_calls;
    }

    const responseText = messageObj.content;
    if (!responseText) {
      console.warn('[OpenAI] Empty response received');
      return FALLBACK_MESSAGE;
    }

    try {
      const parsed = JSON.parse(responseText);
      return {
        reply: parsed.reply || responseText,
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
      return {
        reply: responseText,
        leadDetected: false,
        urgency: 'normal',
        requiresVerification: false,
      };
    }
  } catch (error) {
    console.error('[OpenAI] API call failed:', error);
    return FALLBACK_MESSAGE;
  }
}
