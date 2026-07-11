// ─────────────────────────────────────────────────────────
// Maple Widget — API Client
// Communicates with the Maple backend
// ─────────────────────────────────────────────────────────

import { ChatRequest, ChatResponse } from './types';

/** Get the API base URL from the script tag's data attribute or default */
function getWidgetConfig(): { apiUrl: string, clinicId: string } {
  const scripts = document.querySelectorAll('script');
  let apiUrl = import.meta.env.PROD ? 'https://maple-gray.vercel.app' : 'http://localhost:3001';
  let clinicId = 'maplewood';

  for (const script of scripts) {
    if (script.src.includes('maple-widget.js') || script.hasAttribute('data-clinic-id')) {
      const urlAttr = script.getAttribute('data-maple-api');
      if (urlAttr) apiUrl = urlAttr;
      
      const clinicAttr = script.getAttribute('data-clinic-id');
      if (clinicAttr) clinicId = clinicAttr;
      break;
    }
  }

  return { apiUrl, clinicId };
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
