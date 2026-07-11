// ─────────────────────────────────────────────────────────
// Maple Widget — Chat Window
// The main chat panel that slides up from the bubble
// ─────────────────────────────────────────────────────────

import React from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatMessage } from '../types';

interface ChatWindowProps {
  messages: ChatMessage[];
  isTyping: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isTyping,
  onSend,
  onClose,
}) => {
  return (
    <div className="maple-window">
      {/* Header */}
      <div className="maple-window__header">
        <div className="maple-window__header-info">
          <div className="maple-window__avatar">🍁</div>
          <div>
            <div className="maple-window__title">Front Desk Assistant</div>
            <div className="maple-window__status">
              <span className="maple-window__status-dot" />
              Online now
            </div>
          </div>
        </div>
        <button
          className="maple-window__close"
          onClick={onClose}
          aria-label="Close chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <MessageList messages={messages} isTyping={isTyping} onSend={onSend} />

      {/* Input */}
      <MessageInput onSend={onSend} disabled={isTyping} />

      {/* Powered by */}
      <div className="maple-window__footer">
        Powered by <strong>Maple</strong>
      </div>
    </div>
  );
};
