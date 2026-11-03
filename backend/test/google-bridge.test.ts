import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { googleBridgeRouter } from '../src/googleBridge';
import { GoogleBridgeStore, bridgeHash } from '../src/googleBridgeStore';
import { HttpError } from '../src/domain';

const origin = 'https://login.example.com';
async function fixture(t: TestContext, mintFails = false) {
  let now = Date.now();
  const store = new GoogleBridgeStore(() => now);
  const minted: string[] = [];
  const app = express();
  app.use(express.json());
  app.use('/auth', googleBridgeRouter({ store, publicOrigin: origin,
    firebase: { apiKey: 'public-api-key', authDomain: 'test-project.firebaseapp.com', projectId: 'test-project' },
    verifyToken: async token => {
      if (token === 'invalid') throw new Error('Invalid token');
      return { uid: token === 'other-user' ? 'user-b' : 'user-a', email: token === 'other-user' ? 'b@gmail.com' : 'a@gmail.com',
        email_verified: token !== 'unverified', exp: token === 'expired' ? now / 1000 - 1 : now / 1000 + 3600,
        auth_time: token === 'stale' ? now / 1000 - 120 : now / 1000,
        firebase: { sign_in_provider: token === 'password' ? 'password' : token === 'custom' ? 'custom' : 'google.com' },
        ...(token === 'workspace' ? { email: 'a@company.com' } : {}),
      };
    },
    createCustomToken: async uid => {
      minted.push(uid);
      if (mintFails) throw new Error('Mint failed');
      return `custom-token-for-${uid}`;
    },
  }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error instanceof HttpError ? error.status : (error as { name?: string }).name === 'ZodError' ? 400 : 500)
      .json({ error: error instanceof Error ? error.message : 'Error' });
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const request = (path: string, body: object, token?: string, browserOrigin = origin) => fetch(`${base}/auth/bridge/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: browserOrigin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  });
  async function start() {
    const verifier = randomBytes(32).toString('hex');
    const response = await request('start', { challenge: bridgeHash(verifier) });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const session = await response.json();
    const url = new URL(session.browserUrl);
    return { ...session, browserKey: url.hash.slice(1), verifier } as {
      sessionId: string; browserKey: string; verifier: string; browserUrl: string; pairingCode: string; expiresAt: number;
    };
  }
  const deviceBody = (s: Awaited<ReturnType<typeof start>>) => ({ sessionId: s.sessionId, verifier: s.verifier });
  const browserBody = (s: Awaited<ReturnType<typeof start>>) => ({ sessionId: s.sessionId, browserKey: s.browserKey });
  return { store, request, start, deviceBody, browserBody, minted, base, expire: () => { now += 5 * 60_000 + 1; } };
}

test('bridge keeps device proof out of browser URLs and exposes no tokens while pending', async t => {
  const f = await fixture(t);
  const s = await f.start();
  const url = new URL(s.browserUrl);
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, '/auth/google');
  assert.equal(url.searchParams.get('session'), s.sessionId);
  assert.equal(url.searchParams.has('token'), false);
  assert.equal(s.browserUrl.includes(s.verifier), false);
  assert.match(s.pairingCode, /^\d{6}$/);
  assert.equal((await f.request('info', f.browserBody(s))).status, 200);
  const status = await (await f.request('status', f.deviceBody(s))).json();
  assert.equal(status.state, 'pending');
  assert.equal(status.email, undefined);
  assert.equal(status.customToken, undefined);
  assert.equal((await f.request('claim', f.deviceBody(s))).status, 409);
  assert.equal(f.minted.length, 0);
});

test('browser and device secrets are separate, bound to one session, and cannot be exchanged', async t => {
  const f = await fixture(t);
  const a = await f.start(); const b = await f.start();
  assert.equal((await f.request('info', { sessionId: a.sessionId, browserKey: a.verifier })).status, 403);
  assert.equal((await f.request('status', { sessionId: a.sessionId, verifier: a.browserKey })).status, 403);
  assert.equal((await f.request('approve', { sessionId: a.sessionId, browserKey: b.browserKey }, 'valid')).status, 403);
  assert.equal((await f.request('cancel', { sessionId: a.sessionId, verifier: b.verifier })).status, 403);
});

test('approval requires fresh verified Google Gmail from the same-origin browser', async t => {
  const f = await fixture(t); const s = await f.start(); const body = f.browserBody(s);
  assert.equal((await f.request('approve', body)).status, 401);
  assert.equal((await f.request('approve', body, 'invalid')).status, 401);
  for (const token of ['password', 'custom', 'unverified', 'workspace', 'expired', 'stale']) {
    assert.equal((await f.request('approve', body, token)).status, 403, token);
  }
  assert.equal((await f.request('approve', body, 'valid', 'https://evil.example')).status, 403);
  assert.equal((await f.request('approve', { ...body, uid: 'injected-user' }, 'valid')).status, 400);
  assert.equal((await f.request('approve', body, 'valid')).status, 200);
  assert.equal((await f.request('approve', body, 'other-user')).status, 409);
  const status = await (await f.request('status', f.deviceBody(s))).json();
  assert.equal(status.email, 'a@gmail.com');
  assert.equal(status.customToken, undefined);
});

test('concurrent claims mint one token for the verified user, with no replay', async t => {
  const f = await fixture(t); const s = await f.start();
  await f.request('approve', f.browserBody(s), 'valid');
  const responses = await Promise.all([f.request('claim', f.deviceBody(s)), f.request('claim', f.deviceBody(s))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 410]);
  assert.deepEqual(f.minted, ['user-a']);
  const success = responses.find(r => r.ok)!;
  assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.equal((await success.json()).customToken, 'custom-token-for-user-a');
  await f.request('cancel', f.deviceBody(s));
  assert.equal((await f.request('claim', f.deviceBody(s))).status, 410);
});

test('expired and cancelled requests cannot approve or mint tokens', async t => {
  const f = await fixture(t); const cancelled = await f.start();
  await f.request('approve', f.browserBody(cancelled), 'valid');
  assert.equal((await f.request('cancel', f.deviceBody(cancelled))).status, 200);
  assert.equal((await f.request('claim', f.deviceBody(cancelled))).status, 410);
  const expired = await f.start(); f.expire();
  assert.equal((await f.request('info', f.browserBody(expired))).status, 410);
  assert.equal((await f.request('status', f.deviceBody(expired))).status, 410);
  assert.equal((await f.request('approve', f.browserBody(expired), 'valid')).status, 410);
  assert.equal(f.minted.length, 0);
});

test('mint failures fail closed, and browser pages cannot be framed or cached', async t => {
  const f = await fixture(t, true); const s = await f.start();
  await f.request('approve', f.browserBody(s), 'valid');
  assert.equal((await f.request('claim', f.deviceBody(s))).status, 500);
  assert.equal((await f.request('claim', f.deviceBody(s))).status, 410);
  const page = await fetch(`${f.base}/auth/google`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.match(page.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /google\/client\.js/);
});

test('invalid request shapes are rejected and restarted store has no old sessions', async t => {
  const f = await fixture(t); const s = await f.start();
  assert.equal((await f.request('start', { challenge: 'guessable' })).status, 400);
  assert.equal((await f.request('claim', { ...f.deviceBody(s), uid: 'injected' })).status, 400);
  const restarted = new GoogleBridgeStore();
  await assert.rejects(restarted.status(s.sessionId, s.verifier), /hết hạn/);
});

test('ephemeral store is bounded and reclaims expired requests', async () => {
  let now = Date.now(); const store = new GoogleBridgeStore(() => now);
  for (let i = 0; i < 500; i++) await store.start(bridgeHash(String(i)));
  await assert.rejects(store.start(bridgeHash('overflow')), /quá nhiều/);
  now += 5 * 60_000 + 1;
  assert.match((await store.start(bridgeHash('new'))).sessionId, /^[a-f0-9]{64}$/);
});
