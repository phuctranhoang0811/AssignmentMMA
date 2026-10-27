import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';

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
  const forms = [...new Set([digits, digits.replace(/^\+?84/, '0'), digits.replace(/^0/, '+84')])];
  const found = await db.collection('users').where('phone', 'in', forms).limit(1).get();
  const email = found.docs[0]?.data().email;
  if (!email) throw new HttpError(401, INVALID);
  const response = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  if (response.status === 400) throw new HttpError(401, INVALID);
  if (!response.ok) throw new HttpError(502, 'Chưa thể đăng nhập. Vui lòng thử lại.');
  const { localId } = await response.json() as { localId?: string };
  if (!localId || localId !== found.docs[0].id) throw new HttpError(401, INVALID);
  return { token: await createCustomToken(localId) };
}
