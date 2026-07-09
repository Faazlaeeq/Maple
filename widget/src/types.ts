// ─────────────────────────────────────────────────────────
// Maple Widget — TypeScript Types
// ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface ChatRequest {
  clinicId: string;
  sessionId: string;
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  leadCaptured: boolean;
}
