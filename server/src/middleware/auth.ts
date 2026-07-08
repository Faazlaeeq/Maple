// ─────────────────────────────────────────────────────────
// Maple — Auth Middleware
// Basic token-based auth for admin endpoints (v1)
// ─────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that checks for a valid Bearer token.
 * Compares against ADMIN_TOKEN env variable.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    console.error('[Auth] ADMIN_TOKEN not configured');
    res.status(500).json({ error: 'Server authentication not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7); // Remove "Bearer "
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header or query token' });
    return;
  }

  if (token !== adminToken) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}
