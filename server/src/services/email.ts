// ─────────────────────────────────────────────────────────
// Maple — Email Notification Service
// Sends real-time lead notifications via Resend
// ─────────────────────────────────────────────────────────

import { Resend } from 'resend';
import { LeadRecord, ClinicProfile } from '../types';

/**
 * Send a lead notification email to the business owner.
 * Per spec: must not block or crash the conversation flow on failure.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendLeadNotification(lead: LeadRecord, profile: ClinicProfile): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const notificationEmail = profile.notificationEmail;

  if (!apiKey || !notificationEmail) {
    console.warn('[Email] Resend not configured — skipping notification');
    console.log('[Email] Would have notified:', notificationEmail, 'about lead:', lead.visitorName);
    return false;
  }

  const resend = new Resend(apiKey);

  const urgencyBadge = lead.urgency === 'urgent'
    ? '🔴 URGENT'
    : '🟢 Normal';

  const transcriptHtml = lead.transcript
    .map(
      (msg) =>
        `<div style="margin-bottom:8px;padding:8px 12px;border-radius:8px;${
          msg.role === 'user'
            ? 'background:#e3f2fd;text-align:left;'
            : 'background:#f5f5f5;text-align:left;'
        }">
          <strong style="color:${msg.role === 'user' ? '#1565c0' : '#616161'}">${
          msg.role === 'user' ? '👤 Visitor' : '🤖 Maple'
        }</strong><br/>
          ${msg.text}
        </div>`
    )
    .join('');

  try {
    const { data, error } = await resend.emails.send({
      from: `${profile.name} Assistant <assistant@orbitmatrix.org>`,
      to: notificationEmail,
      subject: `${urgencyBadge} New Lead: ${lead.visitorName} — ${lead.summary}`,
      html: `
        <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#4A90E2,#1E3A8A);color:white;padding:24px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:20px;">🍁 ${profile.name} — New Lead Captured</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${new Date(lead.createdAt).toLocaleString()}</p>
          </div>
          
          <div style="border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:8px 0;font-weight:bold;color:#334155;width:120px;">Name</td>
                <td style="padding:8px 0;">${lead.visitorName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:bold;color:#334155;">Contact</td>
                <td style="padding:8px 0;">${lead.contactMethod === 'email' ? '📧' : '📱'} ${lead.contactValue}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:bold;color:#334155;">Urgency</td>
                <td style="padding:8px 0;">${urgencyBadge}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:bold;color:#334155;">Summary</td>
                <td style="padding:8px 0;">${lead.summary}</td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;"/>

            <h3 style="color:#334155;margin:0 0 12px;">Conversation Transcript</h3>
            ${transcriptHtml}
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Resend API Error:', error);
      return false;
    }

    console.log(`[Email] Notification sent for lead: ${lead.id}`);
    return true;
  } catch (error) {
    // Per spec: notification failures must be logged but never crash the flow
    console.error('[Email] Failed to send notification:', error);
    return false;
  }
}

/**
 * Send a 6-digit OTP code to the given email address via Resend.
 */
export async function sendOtpEmail(email: string, code: string, profile: ClinicProfile): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] Resend not configured — skipping OTP email');
    return false;
  }

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: `${profile.name} Assistant <assistant@orbitmatrix.org>`,
      to: email,
      subject: `Your ${profile.name} Verification Code: ${code}`,
      html: `
        <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;text-align:center;">
          <div style="background:linear-gradient(135deg,#4A90E2,#1E3A8A);color:white;padding:24px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:20px;">🍁 ${profile.name}</h1>
          </div>
          <div style="border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
            <h2 style="color:#334155;margin:0 0 12px;">Your Verification Code</h2>
            <p style="font-size:32px;letter-spacing:4px;font-weight:bold;color:#4A90E2;margin:20px 0;">
              ${code}
            </p>
            <p style="color:#616161;font-size:14px;">Please enter this code in the chat to verify your identity.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Resend API Error for OTP:', error);
      throw new Error('Failed to send verification code to email.');
    }

    return true;
  } catch (error) {
    console.error('[Email] Failed to send OTP:', error);
    throw new Error('Failed to send verification code to email.');
  }
}

/**
 * Send a booking confirmation email to the patient.
 */
export async function sendBookingConfirmation(email: string, patientName: string, date: string, time: string, bookingId: string, profile: ClinicProfile): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] Resend not configured — skipping booking confirmation email');
    return false;
  }

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: `${profile.name} Assistant <onboarding@resend.dev>`,
      to: email,
      subject: `Appointment Confirmed: ${profile.name}`,
      html: `
        <div style="font-family:'Inter',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#4A90E2,#1E3A8A);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="margin:0;font-size:20px;">🍁 ${profile.name}</h1>
          </div>
          <div style="border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
            <h2 style="color:#334155;margin:0 0 16px;">Hi ${patientName},</h2>
            <p style="color:#616161;font-size:15px;line-height:1.6;">Your appointment has been successfully booked! Here are your details:</p>
            
            <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#1e3a8a;">Date:</strong> ${date}</p>
              <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#1e3a8a;">Time:</strong> ${time}</p>
              <p style="margin:0;font-size:14px;"><strong style="color:#1e3a8a;">Booking ID:</strong> ${bookingId}</p>
            </div>
            
            <p style="color:#616161;font-size:14px;line-height:1.6;">If you need to cancel or reschedule, please reply in the chat on our website and provide your Booking ID.</p>
            <p style="color:#616161;font-size:14px;margin-top:24px;">We look forward to seeing you!</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Resend API Error for Booking Confirmation:', error);
      return false;
    }

    console.log(`[Email] Booking confirmation sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send booking confirmation:', error);
    return false;
  }
}
