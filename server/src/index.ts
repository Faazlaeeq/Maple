// ─────────────────────────────────────────────────────────
// Maple — Express Server Entry Point
// ─────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';

import chatRouter from './routes/chat';
import adminRouter from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({
  origin: '*', // Widget can be embedded anywhere
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'maple-api',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

// ── Start server ──
app.listen(PORT, () => {
  console.log(`\n🍁 Maple API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Chat:   POST http://localhost:${PORT}/api/chat`);
  console.log(`   Admin:  GET  http://localhost:${PORT}/api/admin/leads\n`);
});

export default app;

