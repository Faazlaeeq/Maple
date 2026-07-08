// ─────────────────────────────────────────────────────────
// Maple Widget — Message List
// Renders the conversation thread with auto-scroll
// ─────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  onSend?: (text: string) => void;
}

const QUICK_ACTIONS = [
  "What are your hours?",
  "Do you take insurance?",
  "Book an appointment"
];

// Custom component to render the booking success widget
const BookingWidget = ({ id, date }: { id: string, date: string }) => (
  <div className="maple-booking-widget">
    <div className="maple-booking-widget__icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    </div>
    <div className="maple-booking-widget__content">
      <div className="maple-booking-widget__title">Your appointment is booked!</div>
      <div className="maple-booking-widget__date">{date}</div>
      <div className="maple-booking-widget__id">Booking ID: {id}</div>
    </div>
  </div>
);

// Helper to parse out the booking success tag from text
function renderMessageText(text: string) {
  const bookingRegex = /\[BOOKING_SUCCESS:\s*ID="([^"]+)"\s*DATE="([^"]+)"\]/g;
  let match;
  let lastIndex = 0;
  const elements = [];
  let key = 0;

  // We manually split the text to insert the React widget inline
  while ((match = bookingRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <ReactMarkdown key={key++} remarkPlugins={[remarkGfm]}>
          {text.substring(lastIndex, match.index)}
        </ReactMarkdown>
      );
    }
    
    // Add the widget
    elements.push(<BookingWidget key={key++} id={match[1]} date={match[2]} />);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(
      <ReactMarkdown key={key++} remarkPlugins={[remarkGfm]}>
        {text.substring(lastIndex)}
      </ReactMarkdown>
    );
  }

  return elements;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isTyping, onSend }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="maple-messages">
      {/* Welcome message if no conversation yet */}
      {messages.length === 0 && (
        <div className="maple-welcome">
          <div className="maple-welcome__icon">🍁</div>
          <h3 className="maple-welcome__title">Hi there!</h3>
          <p className="maple-welcome__text">
            I'm Maple, your virtual assistant for Maplewood Family Dental.
            Ask me about our services, hours, insurance, or anything else!
          </p>
          
          <div className="maple-quick-actions">
            {QUICK_ACTIONS.map((action, i) => (
              <button 
                key={i} 
                className="maple-quick-action"
                onClick={() => onSend && onSend(action)}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message thread */}
      {messages.map((msg, i) => (
        <div key={i} className={`maple-message maple-message--${msg.role}`}>
          {msg.role === 'assistant' && (
            <div className="maple-message__avatar">🍁</div>
          )}
          <div className="maple-message__bubble">
            {msg.role === 'user' ? (
              msg.text
            ) : (
              <div className="maple-markdown">
                {renderMessageText(msg.text)}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};
