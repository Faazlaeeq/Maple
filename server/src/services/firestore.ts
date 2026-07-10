// ─────────────────────────────────────────────────────────
// Maple — Firestore Service
// Handles all database operations for leads and conversations
// ─────────────────────────────────────────────────────────

import admin from 'firebase-admin';
import { LeadRecord, ClinicProfile } from '../types';
import fs from 'fs';
import path from 'path';

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
 * Get a specific lead by ID.
 */
export async function getLead(leadId: string): Promise<LeadRecord | null> {
  const firestore = getDb();

  if (firestore) {
    try {
      const doc = await firestore.collection('leads').doc(leadId).get();
      if (doc.exists) {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || data?.createdAt,
        } as LeadRecord;
      }
    } catch (error) {
      console.error('[Firestore] Failed to get lead:', error);
    }
  }

  return inMemoryLeads.find(l => l.id === leadId) || null;
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

/**
 * Get a saved conversation log.
 */
export async function getConversation(sessionId: string): Promise<{ transcript: { role: string; text: string; timestamp: string }[] } | null> {
  const firestore = getDb();

  if (firestore) {
    try {
      const doc = await firestore.collection('conversations').doc(sessionId).get();
      if (doc.exists) {
        return doc.data() as { transcript: { role: string; text: string; timestamp: string }[] };
      }
    } catch (error) {
      console.error('[Firestore] Failed to get conversation:', error);
    }
  }

  return null;
}

// ── OTP Persistence for Serverless ──
export async function saveOtp(email: string, code: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection('otps').doc(email).set({
      code,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('[Firestore] Failed to save OTP:', error);
  }
}

export async function getOtp(email: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection('otps').doc(email).get();
    if (doc.exists) {
      return doc.data()?.code || null;
    }
    return null;
  } catch (error) {
    console.error('[Firestore] Failed to get OTP:', error);
    return null;
  }
}

/**
 * Fetch a clinic profile from Firestore or fallback to local files for "maplewood".
 */
export async function getClinicProfile(clinicId: string): Promise<ClinicProfile | null> {
  const firestore = getDb();
  
  if (firestore) {
    try {
      const doc = await firestore.collection('clinics').doc(clinicId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as ClinicProfile;
      }
    } catch (error) {
      console.error('[Firestore] Failed to fetch clinic profile:', error);
    }
  }

  // In-memory fallback specifically for the "maplewood" demo
  if (clinicId === 'maplewood') {
    try {
      const knowledgeBase = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../knowledge/maplewood.json'), 'utf-8')
      );
      const systemPrompt = fs.readFileSync(
        path.join(__dirname, '../prompts/system-prompt.md'),
        'utf-8'
      );

      return {
        id: 'maplewood',
        name: 'Maplewood Family Dental',
        systemPrompt,
        knowledgeBase,
        googleCalendarId: process.env.GOOGLE_CALENDAR_ID || '',
        notificationEmail: process.env.NOTIFICATION_EMAIL || ''
      };
    } catch (error) {
      console.error('[Firestore] Failed to load local maplewood fallback:', error);
      return null;
    }
  }

  return null;
}
