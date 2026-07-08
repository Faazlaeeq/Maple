// ─────────────────────────────────────────────────────────
// Maple Widget — Entry Point (Shadow DOM mount)
// This is the file that runs when the <script> tag loads.
// It creates a Shadow DOM container and renders the React app inside it.
// ─────────────────────────────────────────────────────────

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import widgetStyles from './styles/widget.css?inline';

/**
 * Initialize the Maple widget.
 * - Creates a host element at the end of <body>
 * - Attaches a Shadow DOM to isolate styles (per spec Section 4.5)
 * - Injects CSS and renders React inside the shadow root
 */
function init() {
  try {
    // Don't initialize twice
    if (document.getElementById('maple-widget-host')) return;

    // Create the host element
    const host = document.createElement('div');
    host.id = 'maple-widget-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;bottom:0;right:0;pointer-events:none;';
    document.body.appendChild(host);

    // Create Shadow DOM for CSS isolation
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles into shadow root
    const style = document.createElement('style');
    style.textContent = widgetStyles;
    shadow.appendChild(style);

    // Load Inter font into the main document (Shadow DOM inherits fonts from host)
    if (!document.querySelector('link[data-maple-font]')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      fontLink.setAttribute('data-maple-font', 'true');
      document.head.appendChild(fontLink);
    }

    // Create React mount point inside shadow
    const mountPoint = document.createElement('div');
    mountPoint.style.cssText = 'pointer-events:auto;';
    shadow.appendChild(mountPoint);

    // Render React app
    const root = createRoot(mountPoint);
    root.render(React.createElement(App));

    console.log('🍁 Maple widget initialized');
  } catch (error) {
    // Per spec: fail silently and invisibly — never throw on the host page
    console.error('[Maple] Widget initialization failed:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
