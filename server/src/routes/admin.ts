// ─────────────────────────────────────────────────────────
// Maple — Admin Route
// GET /api/admin/leads — Authenticated leads viewer
// ─────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getLeads } from '../services/firestore';

const router = Router();

/** GET /api/admin/leads — returns all captured leads */
router.get('/leads', requireAuth, async (_req: Request, res: Response) => {
  try {
    const leads = await getLeads();
    res.json({
      count: leads.length,
      leads,
    });
  } catch (error) {
    console.error('[Admin] Failed to fetch leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

export default router;
