import twilio from 'twilio';
import { sendOtpEmail } from './email';
import { ClinicProfile } from '../types';

function sanitize(val?: string) {
  return val ? val.replace(/^["']|["']$/g, '').trim() : undefined;
}

const accountSid = sanitize(process.env.TWILIO_ACCOUNT_SID);
const authToken = sanitize(process.env.TWILIO_AUTH_TOKEN);
export const verifyServiceSid = sanitize(process.env.TWILIO_VERIFY_SERVICE_SID);

const isTwilioConfigured = !!(
  accountSid && 
  accountSid.startsWith('AC') && 
  authToken && 
  verifyServiceSid
);

let client: twilio.Twilio | null = null;
if (isTwilioConfigured) {
  client = twilio(accountSid, authToken);
}

// In-memory mock storage for development
const mockOtpStore = new Map<string, string>();

/**
 * Sends a 6-digit OTP to the specified phone number or email address.
 */
export async function sendVerificationOtp(contact: string, profile: ClinicProfile): Promise<void> {
  const isEmail = contact.includes('@');

  // If it's an email but no Resend key, or phone but no Twilio client, mock it.
  if ((isEmail && !process.env.RESEND_API_KEY) || (!isEmail && !client)) {
    console.log(`[OTP Mock] Sending OTP to ${contact}. Use code: 123456`);
    mockOtpStore.set(contact, '123456');
    return;
  }

  // Generate a random 6-digit code for email OTPs
  const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    if (isEmail) {
      await sendOtpEmail(contact, emailCode, profile);
      mockOtpStore.set(contact, emailCode); // Store for verification
      console.log(`[OTP] Email OTP sent to ${contact}`);
    } else {
      await client!.verify.v2.services(verifyServiceSid!)
        .verifications
        .create({ to: contact, channel: 'sms' });
      console.log(`[Twilio] OTP sent to ${contact}`);
    }
  } catch (error) {
    console.error(`[OTP] Error sending OTP to ${contact}:`, error);
    throw new Error('Failed to send verification code.');
  }
}

/**
 * Checks if the provided code matches the OTP sent to the contact.
 */
export async function checkVerificationOtp(contact: string, code: string): Promise<boolean> {
  const isEmail = contact.includes('@');

  if ((isEmail && !process.env.RESEND_API_KEY) || (!isEmail && !client)) {
    console.log(`[OTP Mock] Checking OTP for ${contact}. Expected: 123456, Got: ${code}`);
    return code === mockOtpStore.get(contact);
  }

  if (isEmail) {
    return code === mockOtpStore.get(contact);
  }

  try {
    const verificationCheck = await client!.verify.v2.services(verifyServiceSid!)
      .verificationChecks
      .create({ to: contact, code });
      
    return verificationCheck.status === 'approved';
  } catch (error) {
    console.error(`[Twilio] Error checking OTP for ${contact}:`, error);
    return false;
  }
}
