// ─────────────────────────────────────────────────────────
// Maple Widget — Chat Hook
// Core chat state management and API integration
// ─────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from '../types';
import { sendMessage } from '../api';

const HISTORY_KEY = 'maple_chat_history';

/** Load history from sessionStorage */
function loadHistory(): ChatMessage[] {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/** Save history to sessionStorage */
function saveHistory(history: ChatMessage[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silently fail if sessionStorage is full or unavailable
  }
}

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [isTyping, setIsTyping] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      setErrorAlert(null);

      // Add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      saveHistory(updatedMessages);

      // Show typing indicator
      setIsTyping(true);

      try {
        const response = await sendMessage({
          sessionId,
          message: text.trim(),
          history: messages, // Send history BEFORE this message (server adds it)
        });

        if (response.errorAlert) {
          setErrorAlert(response.errorAlert);
          setTimeout(() => setErrorAlert(null), 5000);
        }

        // Add assistant reply
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          text: response.reply,
          timestamp: new Date().toISOString(),
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        saveHistory(finalMessages);
      } catch (err) {
        console.error('[Maple] Failed to send message:', err);
        // Show a fallback message as if the assistant responded
        const fallbackMessage: ChatMessage = {
          role: 'assistant',
          text: "I'm having a little trouble connecting right now. Could you leave your name and phone number or email? Our team at Maplewood Family Dental will get back to you right away!",
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...updatedMessages, fallbackMessage];
        setMessages(finalMessages);
        saveHistory(finalMessages);
      } finally {
        setIsTyping(false);
      }
    },
    [messages, isTyping, sessionId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    saveHistory([]);
    setErrorAlert(null);
  }, []);

  return { messages, isTyping, errorAlert, send, clearChat };
}
