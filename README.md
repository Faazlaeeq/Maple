# 🍁 Maple — AI Front Desk Assistant

An embeddable AI chat assistant for small local service businesses. Maple captures visitor inquiries 24/7, answers FAQs from a knowledge base, and notifies the business owner in real-time when a lead is captured.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env` file:

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Service Accounts → Generate Key |
| `FIREBASE_PRIVATE_KEY` | Same JSON key file (copy the `private_key` value) |
| `RESEND_API_KEY` | [Resend Dashboard](https://resend.com) |
| `NOTIFICATION_EMAIL` | The business owner's email |
| `ADMIN_TOKEN` | Any strong random string (this is the admin password) |

> **Note:** The server runs fine without Firebase/Resend credentials — it falls back to in-memory storage and skips email notifications. This makes local development easy.

### 3. Run Development Servers

In two terminals:

```bash
# Terminal 1: Backend API
npm run dev:server
# → http://localhost:3001

# Terminal 2: Widget dev server
npm run dev:widget
# → http://localhost:5173 (opens test page)
```

### 4. Test the Widget

Open http://localhost:5173/test.html — you'll see a simulated dental practice website with the Maple chat widget in the bottom-right corner.

---

## Embed on Any Website

Paste this single line before `</body>` on any website:

```html
<script src="https://YOUR-DOMAIN/widget/maple-widget.js" data-maple-api="https://YOUR-DOMAIN"></script>
```

That's it. The widget:
- Creates its own DOM container
- Uses Shadow DOM for complete CSS isolation
- Loads asynchronously (never blocks the host page)
- Fails silently if it can't load

---

## Updating the Knowledge Base

The knowledge base is a single JSON file:

```
server/src/knowledge/maplewood.json
```

Edit this file to update:
- Business hours
- Services and pricing
- FAQs
- Team member info
- Insurance accepted
- Contact information

After editing, redeploy the server:

```bash
npm run build:server
vercel --prod
```

---

## Admin Dashboard

Access the admin panel at `/admin` on your deployed domain.

**Login:** Use the `ADMIN_TOKEN` value from your `.env` file.

Features:
- View all captured leads
- See full conversation transcripts
- Urgency indicators (🔴 Urgent / 🟢 Normal)
- Contact method badges
- Auto-refreshes every 15 seconds

---

## Architecture

```
Widget (React/Shadow DOM)  →  Backend API (Express)  →  Gemini AI
                                     ↓
                               Firestore (leads)
                                     ↓
                               Email (Resend)
```

- **Widget:** React app bundled as a single IIFE script via Vite library mode
- **Backend:** Stateless Express API — conversation history travels with each request
- **AI:** Gemini 2.5 Flash Lite with a structured JSON response format for reliable lead extraction
- **Storage:** Firebase Firestore (with in-memory fallback for development)
- **Notifications:** Resend email API — fires immediately on lead capture

---

## Project Structure

```
├── server/                 # Backend API
│   └── src/
│       ├── index.ts        # Express entry point
│       ├── routes/         # API endpoints
│       ├── services/       # Gemini, Firestore, Email
│       ├── middleware/      # Auth
│       ├── prompts/        # System prompt (versioned)
│       └── knowledge/      # Client knowledge base
│
├── widget/                 # Embeddable chat widget
│   └── src/
│       ├── main.tsx        # Shadow DOM entry point
│       ├── App.tsx         # Root component
│       ├── components/     # ChatBubble, ChatWindow, etc.
│       ├── hooks/          # useChat, useSession
│       └── styles/         # widget.css
│
├── admin/                  # Admin leads dashboard
│   └── index.html          # Self-contained SPA
│
└── vercel.json             # Deployment config
```

---

## Deployment

Deploy everything to Vercel:

```bash
npm run build
vercel --prod
```

Set environment variables in Vercel Dashboard → Settings → Environment Variables.

---

## License

Proprietary — OrbitMatrix
