// ─────────────────────────────────────────────────────────
// Maple Widget — Typing Indicator
// Animated dots showing the assistant is "thinking"
// ─────────────────────────────────────────────────────────

import React from 'react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="maple-message maple-message--assistant">
      <div className="maple-message__avatar">🍁</div>
      <div className="maple-message__bubble maple-typing">
        <span className="maple-typing__dot" />
        <span className="maple-typing__dot" />
        <span className="maple-typing__dot" />
      </div>
    </div>
  );
};
