import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './domain';

export const otpSendInput = z.object({ email: z.email().max(200) }).strict();
export const otpVerifyInput = z.object({ email: z.email().max(200), code: z.string().regex(/^\d{4}$/) }).strict();

const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_MS = 30_000;
const hash = (code: string) => createHash('sha256').update(code).digest();

/**
 * Server-side OTP: the code is generated here, only its hash is kept, and the app never sees it.
 * shortcut: in-memory, one backend process; move to Firestore if the backend is ever scaled out.
 */
export class OtpStore {
  private codes = new Map<string, { hash: Buffer; expires: number; attempts: number; sentAt: number }>();
  constructor(private send: (email: string, code: string) => Promise<void>, private now = Date.now) {}

  async start(email: string) {
    const key = email.toLowerCase();
    const previous = this.codes.get(key);
    if (previous && this.now() - previous.sentAt < RESEND_MS) throw new HttpError(429, 'Vui lòng chờ 30 giây trước khi gửi lại mã.');
    const code = String(randomInt(1000, 10000));
    await this.send(key, code);
    this.codes.set(key, { hash: hash(code), expires: this.now() + TTL_MS, attempts: 0, sentAt: this.now() });
    for (const [k, v] of this.codes) if (v.expires < this.now()) this.codes.delete(k);
  }

  /** Checks the code without using it up, so the sign-up form can validate it and the account can still claim it. */
  check(email: string, code: string) {
    const key = email.toLowerCase();
    const entry = this.codes.get(key);
    if (!entry || entry.expires < this.now()) throw new HttpError(410, 'Mã OTP đã hết hạn. Vui lòng gửi lại mã.');
    if (++entry.attempts > MAX_ATTEMPTS) { this.codes.delete(key); throw new HttpError(429, 'Nhập sai quá nhiều lần. Vui lòng gửi lại mã.'); }
    if (!timingSafeEqual(entry.hash, hash(code))) throw new HttpError(400, 'Mã OTP không đúng.');
    return key;
  }

  /** Checks the code and uses it up: one code proves one e-mail address once. */
  verify(email: string, code: string) {
    this.codes.delete(this.check(email, code));
  }
}

export function otpEmailHtml(code: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #fed7aa;border-radius:12px">
  <h1 style="color:#CF4226;text-align:center;margin:0">🍕 Pizza FPT</h1>
  <p>Mã xác thực đăng ký tài khoản của bạn:</p>
  <p style="font-size:38px;font-weight:800;letter-spacing:12px;color:#CF4226;text-align:center">${code}</p>
  <p style="color:#888;font-size:13px">Mã có hiệu lực trong <strong>5 phút</strong>. Không chia sẻ mã này cho bất kỳ ai.</p></div>`;
}
