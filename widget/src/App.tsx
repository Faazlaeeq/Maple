// ─────────────────────────────────────────────────────────
// Maple Widget — App Component
// Root component that orchestrates bubble + window
// ─────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ChatBubble } from './components/ChatBubble';
import { ChatWindow } from './components/ChatWindow';
import { useSession } from './hooks/useSession';
import { useChat } from './hooks/useChat';

export const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const sessionId = useSession();
  const { messages, isTyping, send } = useChat(sessionId);

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <div className="maple-widget">
      {/* Chat window (animated in/out) */}
      {isOpen && (
        <ChatWindow
          messages={messages}
          isTyping={isTyping}
          onSend={send}
          onClose={toggle}
        />
      )}

      {/* Floating bubble */}
      <ChatBubble
        onClick={toggle}
        isOpen={isOpen}
        hasMessages={messages.length > 0}
      />
    </div>
  );
};
