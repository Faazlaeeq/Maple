import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { getDb } from '../src/services/firestore';

// Load env first
const dotenvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: dotenvPath });

async function seed() {
  console.log('Seeding Smiles R Us clinic to Firestore...');

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Env variables:', { projectId, clientEmail, hasPrivateKey: !!privateKey });
    process.exit(1);
  }

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  }
  const db = admin.firestore();

  try {
    // 1. Read the mock knowledge base
    const knowledgeBasePath = path.join(__dirname, '../src/knowledge/smilesrus.json');
    const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

    // 2. Read the system prompt
    const systemPromptPath = path.join(__dirname, '../src/prompts/system-prompt.md');
    const systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');

    // 3. Define the clinic document
    const clinicId = 'smilesrus';
    const clinicData = {
      name: 'Smiles R Us',
      notificationEmail: 'faazlaeeq@gmail.com', // fallback testing email
      googleCalendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      systemPrompt: systemPrompt,
      knowledgeBase: knowledgeBase,
      createdAt: new Date().toISOString()
    };

    // 4. Write to Firestore
    await db.collection('clinics').doc(clinicId).set(clinicData);

    console.log('✅ Successfully seeded Smiles R Us to Firestore!');
    console.log(`Document ID: ${clinicId}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
