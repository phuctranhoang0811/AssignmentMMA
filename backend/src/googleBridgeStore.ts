import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpError } from './domain';
import { isGmailAddress } from '../../src/utils/googleAccount';

export type GoogleApprovalIdentity = {
  uid: string; exp: number; auth_time: number; email?: string; email_verified?: boolean;
  firebase: { sign_in_provider: string };
};
type Session = {
  deviceChallenge: string; browserHash: string; pairingCode: string;
  createdAt: number; expiresAt: number; state: 'pending' | 'approved' | 'consumed' | 'cancelled';
  uid?: string; email?: string;
};
export const bridgeHash = (value: string) => createHash('sha256').update(value).digest('hex');
const matches = (value: string, expected: string) => timingSafeEqual(Buffer.from(bridgeHash(value), 'hex'), Buffer.from(expected, 'hex'));

export class GoogleBridgeStore {
  // shortcut: ephemeral login for one backend process; use a private shared store before running multiple instances.
  private sessions = new Map<string, Session>();
  constructor(private now = Date.now) {}
  private get(id: string) { return this.validate(this.sessions.get(id)); }
  private validate(session?: Session): Session {
    if (!session || session.expiresAt <= this.now()) throw new HttpError(410, 'Yêu cầu đăng nhập đã hết hạn. Vui lòng thử lại.');
    if (session.state === 'consumed' || session.state === 'cancelled') throw new HttpError(410, 'Yêu cầu đăng nhập đã kết thúc.');
    return session;
  }
  async start(deviceChallenge: string) {
    for (const [key, session] of this.sessions) if (session.expiresAt <= this.now()) this.sessions.delete(key);
    if (this.sessions.size >= 500) throw new HttpError(503, 'Có quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.');
    const id = randomBytes(32).toString('hex');
    const browserKey = randomBytes(32).toString('hex');
    const createdAt = this.now();
    const session: Session = { deviceChallenge, browserHash: bridgeHash(browserKey),
      pairingCode: String(randomInt(100000, 1000000)), createdAt, expiresAt: createdAt + 5 * 60_000, state: 'pending' };
    this.sessions.set(id, session);
    return { sessionId: id, browserKey, pairingCode: session.pairingCode, expiresAt: session.expiresAt };
  }
  async browserInfo(id: string, key: string) {
    const session = this.get(id);
    if (!matches(key, session.browserHash)) throw new HttpError(403, 'Mã xác nhận trình duyệt không hợp lệ.');
    return { pairingCode: session.pairingCode, expiresAt: session.expiresAt };
  }
  async status(id: string, verifier: string) {
    const session = this.get(id);
    if (!matches(verifier, session.deviceChallenge)) throw new HttpError(403, 'Thiết bị không khớp yêu cầu đăng nhập.');
    return { state: session.state, pairingCode: session.pairingCode, expiresAt: session.expiresAt,
      ...(session.state === 'approved' ? { email: session.email } : {}) };
  }
  async approve(id: string, key: string, identity: GoogleApprovalIdentity) {
    if (!identity.uid || !Number.isFinite(identity.exp) || !identity.email_verified || !isGmailAddress(identity.email ?? null) ||
      identity.firebase?.sign_in_provider !== 'google.com' || identity.exp * 1000 <= this.now()) {
      throw new HttpError(403, 'Vui lòng đăng nhập bằng Gmail đã được Google xác minh.');
    }
    const session = this.get(id);
    if (!matches(key, session.browserHash)) throw new HttpError(403, 'Mã xác nhận trình duyệt không hợp lệ.');
    if (!Number.isFinite(identity.auth_time) || identity.auth_time * 1000 < session.createdAt - 60_000) {
      throw new HttpError(403, 'Vui lòng đăng nhập lại Google để xác nhận yêu cầu mới.');
    }
    if (session.state === 'approved' && session.uid !== identity.uid) throw new HttpError(409, 'Yêu cầu này đã được xác nhận bằng tài khoản khác.');
    this.sessions.set(id, { ...session, state: 'approved', uid: identity.uid, email: identity.email });
  }

  async consume(id: string, verifier: string) {
    const session = this.get(id);
    if (!matches(verifier, session.deviceChallenge)) throw new HttpError(403, 'Thiết bị không khớp yêu cầu đăng nhập.');
    if (session.state !== 'approved' || !session.uid) throw new HttpError(409, 'Chưa xác nhận đăng nhập trên trình duyệt.');
    this.sessions.set(id, { ...session, state: 'consumed' });
    return session.uid;
  }
  async cancel(id: string, verifier: string) {
    const session = this.sessions.get(id);
    if (!session) return;
    if (!matches(verifier, session.deviceChallenge)) throw new HttpError(403, 'Thiết bị không khớp yêu cầu đăng nhập.');
    if (session.state !== 'consumed') this.sessions.set(id, { ...session, state: 'cancelled' });
  }
}
