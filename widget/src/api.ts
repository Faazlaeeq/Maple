// ─────────────────────────────────────────────────────────
// Maple Widget — API Client
// Communicates with the Maple backend
// ─────────────────────────────────────────────────────────

import { ChatRequest, ChatResponse } from './types';

/** Get the API base URL from the script tag's data attribute or default */
function getWidgetConfig(): { apiUrl: string, clinicId: string } {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const url = script.getAttribute('data-maple-api');
    if (url) {
      return {
        apiUrl: url,
        clinicId: script.getAttribute('data-clinic-id') || 'maplewood'
      };
    }
  }

  // Fallback for development/production
  return {
    apiUrl: import.meta.env.PROD ? 'https://maple-gray.vercel.app' : 'http://localhost:3001',
    clinicId: 'maplewood'
  };
}

const config = getWidgetConfig();

/**
 * Send a chat message to the backend.
 * Returns the assistant's reply and whether a lead was captured.
 */
export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const payload = {
    ...request,
    clinicId: config.clinicId
  };

  const response = await fetch(`${config.apiUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
