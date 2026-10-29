import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';
import { normalizePhone } from '../../src/utils/phone';

export const phoneLoginInput = z.object({
  phone: z.string().trim().regex(/^\+?[0-9 .-]{9,20}$/),
  password: z.string().min(1).max(128),
}).strict();

export type PhoneLoginDeps = {
  db: Firestore;
  apiKey: string;
  createCustomToken: (uid: string) => Promise<string>;
  fetch?: typeof fetch;
};

// One message for unknown phone and wrong password, so the endpoint cannot be used to discover registered numbers.
const INVALID = 'Số điện thoại hoặc mật khẩu không đúng.';

/**
 * Phone + password sign-in without exposing the users collection to the app:
 * find the account email server-side, verify the password with Firebase Auth, return a custom token.
 */
export async function phoneLogin({ db, apiKey, createCustomToken, fetch: request = fetch }: PhoneLoginDeps, phone: string, password: string) {
  const digits = phone.replace(/[\s.-]/g, '');
  // Profiles store the number as typed at registration; try the common Vietnamese forms.
  const forms = [...new Set([phone.trim(), digits, digits.replace(/^\+?84/, '0'), digits.replace(/^0/, '+84')])];
  // The claimed owner (phone_numbers) comes first; older profiles may share a number, so each is tried
  // with the password rather than letting whichever profile matches first block the real owner.
  const normalized = normalizePhone(phone);
  const owner = normalized ? (await db.collection('phone_numbers').doc(normalized).get()).data()?.uid as string | undefined : undefined;
  const candidates = new Map<string, string>();
  if (owner) {
    const email = (await db.collection('users').doc(owner).get()).data()?.email;
    if (email) candidates.set(owner, email);
  }
  const found = await db.collection('users').where('phone', 'in', forms).limit(5).get();
  for (const doc of found.docs) if (doc.data().email && !candidates.has(doc.id)) candidates.set(doc.id, doc.data().email);
  for (const [uid, email] of candidates) {
    const response = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    });
    if (response.status === 400) continue;
    if (!response.ok) throw new HttpError(502, 'Chưa thể đăng nhập. Vui lòng thử lại.');
    const { localId } = await response.json() as { localId?: string };
    if (localId === uid) return { token: await createCustomToken(localId) };
  }
  throw new HttpError(401, INVALID);
}
