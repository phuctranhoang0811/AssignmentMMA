import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizePhone } from '../../src/utils/phone';

// Profiles created before phone_numbers existed: claim each number for its only owner.
// Numbers used by several accounts are listed, not assigned; an admin decides who keeps them.
async function backfillPhones() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required in backend/.env.');
  const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId }));
  try {
    const owners = new Map<string, string[]>();
    const invalid: string[] = [];
    for (const user of (await db.collection('users').get()).docs) {
      const raw = String(user.data().phone ?? '');
      if (!raw) continue;
      const phone = normalizePhone(raw);
      if (!phone) { invalid.push(user.id); continue; }
      owners.set(phone, [...(owners.get(phone) ?? []), user.id]);
    }
    let claimed = 0;
    const shared: string[] = [];
    for (const [phone, uids] of owners) {
      if (uids.length > 1) { shared.push(`${phone}: ${uids.join(', ')}`); continue; }
      const ref = db.collection('phone_numbers').doc(phone);
      if ((await ref.get()).exists) continue;
      await ref.create({ uid: uids[0] });
      claimed++;
    }
    console.log(`Phones ${projectId}: claimed ${claimed}, already claimed ${owners.size - claimed - shared.length}.`);
    if (shared.length) console.log(`Shared by several accounts (not claimed):\n  ${shared.join('\n  ')}`);
    if (invalid.length) console.log(`Not a 10-digit number (user ids): ${invalid.join(', ')}`);
  } finally {
    await db.terminate();
  }
}

backfillPhones().catch(() => {
  console.error('Phone backfill failed. Check Firebase Admin credentials, project and Firestore access in backend/.env.');
  process.exitCode = 1;
});
