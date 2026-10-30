import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';
import type { OtpStore } from './otp';

export const verifyEmailInput = z.object({ code: z.string().regex(/^\d{4}$/).optional() }).strict();

/** What the verified ID token says about the caller. */
export type TokenIdentity = { email?: string; email_verified?: boolean; firebase?: { sign_in_provider?: string } };

/**
 * An account may place orders and redeem rewards only once its e-mail is proven: by Google (which already verified it)
 * or by the one-time code mailed to that address. New profiles are created unverified (Firestore rules enforce it);
 * only this backend flips the flag.
 */
export class AccountStore {
  constructor(private db: Firestore, private otp: Pick<OtpStore, 'verify'>) {}

  async verifyEmail(uid: string, identity: TokenIdentity, code?: string) {
    const ref = this.db.collection('users').doc(uid);
    const profile = (await ref.get()).data();
    if (!profile) throw new HttpError(404, 'Không tìm thấy tài khoản.');
    // Accounts that predate verification have no flag; only an explicit `false` waits for proof.
    if (profile.emailVerified !== false) return { verified: true };
    const email = identity.email?.toLowerCase();
    if (!email) throw new HttpError(400, 'Tài khoản chưa có email để xác minh.');
    const byGoogle = identity.firebase?.sign_in_provider === 'google.com' && identity.email_verified === true;
    if (!byGoogle) {
      if (!code) throw new HttpError(400, 'Vui lòng nhập mã xác minh gửi tới email của bạn.');
      this.otp.verify(email, code);
    }
    await ref.update({ emailVerified: true, emailVerifiedAt: Timestamp.now() });
    return { verified: true };
  }
}
