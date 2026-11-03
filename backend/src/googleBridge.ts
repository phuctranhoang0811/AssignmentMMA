import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { GoogleBridgeStore, GoogleApprovalIdentity } from './googleBridgeStore';
import { HttpError } from './domain';

export type GoogleBridgeOptions = {
  store: Pick<GoogleBridgeStore, 'start' | 'browserInfo' | 'status' | 'approve' | 'consume' | 'cancel'>;
  publicOrigin: string;
  firebase: { apiKey: string; authDomain: string; projectId: string };
  verifyToken: (token: string) => Promise<GoogleApprovalIdentity>;
  createCustomToken: (uid: string) => Promise<string>;
};
const secret = z.string().regex(/^[a-f0-9]{64}$/);
const deviceBody = z.object({ sessionId: secret, verifier: secret }).strict();
const browserBody = z.object({ sessionId: secret, browserKey: secret }).strict();

export function googleBridgeRouter(options?: GoogleBridgeOptions) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' });
    if (!options) throw new HttpError(503, 'Đăng nhập Google qua Expo Go chưa được cấu hình trên máy chủ.');
    next();
  });
  router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Có quá nhiều yêu cầu. Vui lòng chờ một phút rồi thử lại.' } }));
  router.get('/google', (_req, res) => {
    res.set('Content-Security-Policy', `default-src 'none'; script-src 'self' https://www.gstatic.com https://apis.google.com; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://${options!.firebase.authDomain}; frame-src https://${options!.firebase.authDomain} https://accounts.google.com; style-src 'unsafe-inline'; img-src 'self' https://www.gstatic.com; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
    res.sendFile(fileURLToPath(new URL('../public/google-login.html', import.meta.url)));
  });
  router.get('/google/client.js', (_req, res) => res.sendFile(fileURLToPath(new URL('../public/google-login.js', import.meta.url))));
  router.get('/google/config', (_req, res) => res.json(options!.firebase));
  router.post('/bridge/start', rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Bạn đã tạo quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 10 phút.' } }), async (req, res) => {
    const { challenge } = z.object({ challenge: secret }).strict().parse(req.body);
    const { browserKey, ...session } = await options!.store.start(challenge);
    const url = new URL('/auth/google', options!.publicOrigin);
    url.searchParams.set('session', session.sessionId);
    url.hash = browserKey;
    res.status(201).json({ ...session, browserUrl: url.href, projectId: options!.firebase.projectId });
  });
  router.post('/bridge/info', async (req, res) => {
    const body = browserBody.parse(req.body);
    res.json(await options!.store.browserInfo(body.sessionId, body.browserKey));
  });
  router.post('/bridge/approve', async (req, res) => {
    if (req.headers.origin !== options!.publicOrigin) throw new HttpError(403, 'Nguồn xác nhận không hợp lệ.');
    const body = browserBody.parse(req.body);
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    let identity: GoogleApprovalIdentity;
    try { if (!match) throw new Error('Missing token'); identity = await options!.verifyToken(match[1]); }
    catch { throw new HttpError(401, 'Vui lòng đăng nhập lại Google.'); }
    await options!.store.approve(body.sessionId, body.browserKey, identity);
    res.json({ ok: true });
  });
  router.post('/bridge/status', async (req, res) => {
    const body = deviceBody.parse(req.body);
    res.json(await options!.store.status(body.sessionId, body.verifier));
  });
  router.post('/bridge/claim', async (req, res) => {
    const body = deviceBody.parse(req.body);
    const uid = await options!.store.consume(body.sessionId, body.verifier);
    res.json({ customToken: await options!.createCustomToken(uid) });
  });
  router.post('/bridge/cancel', async (req, res) => {
    const body = deviceBody.parse(req.body);
    await options!.store.cancel(body.sessionId, body.verifier);
    res.json({ ok: true });
  });
  return router;
}
