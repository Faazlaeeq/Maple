// ─────────────────────────────────────────────────────────
// Maple — Firestore Service
// Handles all database operations for leads and conversations
// ─────────────────────────────────────────────────────────

import admin from 'firebase-admin';
import { LeadRecord } from '../types';

let db: admin.firestore.Firestore | null = null;

/** Initialize Firebase Admin SDK (idempotent) */
function getDb(): admin.firestore.Firestore | null {
  if (db) return db;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[Firestore] Firebase credentials not configured — running in memory-only mode');
    return null;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Handle escaped newlines in env vars
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  db = admin.firestore();
  return db;
}

// ── In-memory fallback store (when Firebase isn't configured) ──
const inMemoryLeads: LeadRecord[] = [];

/**
 * Save a lead record to Firestore (or in-memory fallback).
 * Returns the lead ID.
 */
export async function saveLead(lead: LeadRecord): Promise<string> {
  const firestore = getDb();

  if (firestore) {
    try {
      await firestore.collection('leads').doc(lead.id).set({
        ...lead,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(lead.createdAt)),
      });
      console.log(`[Firestore] Lead saved: ${lead.id}`);
      return lead.id;
    } catch (error) {
      console.error('[Firestore] Failed to save lead:', error);
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  inMemoryLeads.push(lead);
  console.log(`[Memory] Lead saved: ${lead.id} (${inMemoryLeads.length} total in memory)`);
  return lead.id;
}

/**
 * Update a lead's notification status.
 */
export async function updateLeadNotification(leadId: string, sent: boolean): Promise<void> {
  const firestore = getDb();

  if (firestore) {
    try {
      await firestore.collection('leads').doc(leadId).update({
        notificationSent: sent,
      });
      return;
    } catch (error) {
      console.error('[Firestore] Failed to update notification status:', error);
    }
  }

  // In-memory fallback
  const lead = inMemoryLeads.find((l) => l.id === leadId);
  if (lead) lead.notificationSent = sent;
}

/**
 * Get all leads, sorted by most recent first.
 */
export async function getLeads(): Promise<LeadRecord[]> {
  const firestore = getDb();

  if (firestore) {
    try {
      const snapshot = await firestore
        .collection('leads')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        } as LeadRecord;
      });
    } catch (error) {
      console.error('[Firestore] Failed to fetch leads:', error);
    }
  }

  // In-memory fallback
  return [...inMemoryLeads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Save a conversation log (even non-converting sessions).
 */
export async function saveConversation(
  sessionId: string,
  transcript: { role: string; text: string; timestamp: string }[]
): Promise<void> {
  const firestore = getDb();

  if (firestore) {
    try {
      await firestore.collection('conversations').doc(sessionId).set(
        {
          sessionId,
          transcript,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[Firestore] Failed to save conversation:', error);
    }
  }
}
