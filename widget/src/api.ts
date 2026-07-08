// ─────────────────────────────────────────────────────────
// Maple Widget — API Client
// Communicates with the Maple backend
// ─────────────────────────────────────────────────────────

import { ChatRequest, ChatResponse } from './types';

/** Get the API base URL from the script tag's data attribute or default */
function getApiUrl(): string {
  // Look for the script tag that loaded us
  const scripts = document.querySelectorAll('script[data-maple-api]');
  for (const script of scripts) {
    const url = script.getAttribute('data-maple-api');
    if (url) return url;
  }

  // Fallback for development
  return 'http://localhost:3001';
}

const API_URL = getApiUrl();

/**
 * Send a chat message to the backend.
 * Returns the assistant's reply and whether a lead was captured.
 */
export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
