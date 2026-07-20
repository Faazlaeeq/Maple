// ─────────────────────────────────────────────────────────
// Maple — Shared TypeScript Types
// ─────────────────────────────────────────────────────────

/** A single message in a conversation */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO 8601
}

/** Incoming request to POST /api/chat */
export interface ChatRequest {
  clinicId: string;
  sessionId: string;
  message: string;
  history: ChatMessage[];
}

/** Response from POST /api/chat */
export interface ChatResponse {
  reply: string;
  leadCaptured: boolean;
  errorAlert?: string;
}

/** Contact method type */
export type ContactMethod = 'email' | 'phone';

/** Urgency level for leads */
export type Urgency = 'normal' | 'urgent';

/** A captured lead record */
export interface LeadRecord {
  id: string;
  clientId: string;
  visitorName: string;
  contactMethod: ContactMethod;
  contactValue: string;
  summary: string;
  urgency: Urgency;
  transcript: ChatMessage[];
  createdAt: string; // ISO 8601
  notificationSent: boolean;
}

/** Gemini response parsed structure */
export interface GeminiParsedResponse {
  reply: string;
  leadDetected: boolean;
  visitorName?: string;
  contactMethod?: ContactMethod;
  contactValue?: string;
  urgency?: Urgency;
  summary?: string;
  requiresVerification?: boolean;
  emailToVerify?: string;
  errorAlert?: string;
}

/** Clinic Profile (Multi-tenant) */
export interface ClinicProfile {
  id: string;
  name: string;
  systemPrompt: string;
  knowledgeBase: any;
  googleCalendarId: string;
  notificationEmail: string;
}
