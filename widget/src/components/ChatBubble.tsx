// ─────────────────────────────────────────────────────────
// Maple Widget — Chat Bubble
// The floating trigger button with rotating proactive greetings
// ─────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { TypingIndicator } from './TypingIndicator';

interface ChatBubbleProps {
  onClick: () => void;
  isOpen: boolean;
  hasMessages: boolean;
}

const GREETINGS = [
  "👋 Hi! Need help with an appointment?",
  "Talk to me",
  "Have any question?",
  "Wanna book an appointment?"
];

export const ChatBubble: React.FC<ChatBubbleProps> = ({ onClick, isOpen, hasMessages }) => {
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  // Proactive greeting: show after 3-4 seconds on first load, once per session
  useEffect(() => {
    if (hasMessages || isOpen || greetingDismissed) return;

    try {
      if (sessionStorage.getItem('maple_greeting_shown')) return;
    } catch {}

    const timer = setTimeout(() => {
      setShowGreeting(true);
      try { sessionStorage.setItem('maple_greeting_shown', 'true'); } catch {}
    }, 3500);

    return () => clearTimeout(timer);
  }, [hasMessages, isOpen, greetingDismissed]);

  // Rotate greeting text every 8 seconds
  useEffect(() => {
    if (!showGreeting || isOpen || greetingDismissed) return;

    const interval = setInterval(() => {
      // Show typing indicator
      setIsTyping(true);
      
      // After 1.5s of typing, switch the text
      setTimeout(() => {
        setGreetingIndex(prev => (prev + 1) % GREETINGS.length);
        setIsTyping(false);
      }, 1500);

    }, 8000);

    return () => clearInterval(interval);
  }, [showGreeting, isOpen, greetingDismissed]);

  // Hide greeting when chat opens
  useEffect(() => {
    if (isOpen && showGreeting) {
      setShowGreeting(false);
      setGreetingDismissed(true);
    }
  }, [isOpen, showGreeting]);

  const handleDismissGreeting = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGreeting(false);
    setGreetingDismissed(true);
  };

  return (
    <div className="maple-bubble-wrapper">
      {/* Proactive greeting nudge */}
      {showGreeting && !isOpen && (
        <div className="maple-greeting" onClick={onClick}>
          <button
            className="maple-greeting__dismiss"
            onClick={handleDismissGreeting}
            aria-label="Dismiss"
          >
            ×
          </button>
          
          <div className="maple-greeting__content">
            {isTyping ? (
              <div className="maple-greeting__typing">
                <span className="maple-dot"></span>
                <span className="maple-dot"></span>
                <span className="maple-dot"></span>
              </div>
            ) : (
              <p className="maple-greeting__text">
                {GREETINGS[greetingIndex]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button
        className="maple-bubble"
        onClick={onClick}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
};
