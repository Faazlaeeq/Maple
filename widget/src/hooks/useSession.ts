// ─────────────────────────────────────────────────────────
// Maple Widget — Session Hook
// Manages session ID persistence via sessionStorage
// ─────────────────────────────────────────────────────────

import { useState } from 'react';

const SESSION_KEY = 'maple_session_id';

/** Generate a simple unique session ID */
function generateSessionId(): string {
  return 'maple_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Hook that provides a persistent session ID across page navigations.
 * Uses sessionStorage so the conversation persists within a browser session
 * but resets when the tab/window is closed.
 */
export function useSession() {
  const [sessionId] = useState<string>(() => {
    try {
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;

      const newId = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, newId);
      return newId;
    } catch {
      // sessionStorage may be unavailable (private browsing, etc.)
      return generateSessionId();
    }
  });

  return sessionId;
}
