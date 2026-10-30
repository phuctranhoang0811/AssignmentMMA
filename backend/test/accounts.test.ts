import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentServer } from '../src/app';
import { AccountStore, type TokenIdentity } from '../src/accounts';
import { OrderOpsStore, isUnverified, WELCOME_POINTS, rewardPointsFor } from '../src/orders';
import { OtpStore } from '../src/otp';
import { HttpError, checkoutSchema } from '../src/domain';
import { database } from './fakeDb';

const status = (code: number) => (error: unknown) => error instanceof HttpError && error.status === code;
const sized = { name: 'Pizza', categoryId: 'pizza', basePrice: 100000, addons: [], isAvailable: true, variants: [{ id: 'medium', name: 'Vừa', price: 200000 }] };

function otpFixture() {
  const sent: Record<string, string> = {};
  const otp = new OtpStore(async (to, code) => { sent[to] = code; });
  return { otp, sent };
}

test('the OTP check does not use the code up, so the new account can still claim it; claiming uses it once', async () => {
  const { otp, sent } = otpFixture();
  await otp.start('an@gmail.com');
  otp.check('an@gmail.com', sent['an@gmail.com']);
  otp.check('an@gmail.com', sent['an@gmail.com']);
  otp.verify('an@gmail.com', sent['an@gmail.com']);
  assert.throws(() => otp.verify('an@gmail.com', sent['an@gmail.com']), status(410));
});

test('an e-mail account is verified only by the code mailed to its own address', async () => {
  const { db, docs } = database();
  const { otp, sent } = otpFixture();
  docs.set('users/u1', { emailVerified: false, welcomePending: true });
  const accounts = new AccountStore(db, otp);
  const identity: TokenIdentity = { email: 'An@Gmail.com', email_verified: false, firebase: { sign_in_provider: 'password' } };
  await assert.rejects(accounts.verifyEmail('u1', identity), status(400));
  await assert.rejects(accounts.verifyEmail('u1', identity, '1234'), status(410));
  await otp.start('an@gmail.com');
  // A code mailed to someone else's address proves nothing for this account.
  await otp.start('other@gmail.com');
  const wrong = sent['an@gmail.com'] === sent['other@gmail.com'] ? String((Number(sent['other@gmail.com']) + 1) % 10000).padStart(4, '0') : sent['other@gmail.com'];
  await assert.rejects(accounts.verifyEmail('u1', identity, wrong), status(400));
  assert.equal(docs.get('users/u1')!.emailVerified, false);
  assert.deepEqual(await accounts.verifyEmail('u1', identity, sent['an@gmail.com']), { verified: true });
  assert.equal(docs.get('users/u1')!.emailVerified, true);
  assert.equal(await isUnverified(db, 'u1'), false);
});

test('Google-verified addresses need no code; a forged "google" claim without the verified flag does not count', async () => {
  const { db, docs } = database();
  const { otp } = otpFixture();
  docs.set('users/g1', { emailVerified: false });
  docs.set('users/g2', { emailVerified: false });
  const accounts = new AccountStore(db, otp);
  await assert.rejects(accounts.verifyEmail('g2', { email: 'x@gmail.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } }), status(400));
  await accounts.verifyEmail('g1', { email: 'g@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } });
  assert.equal(docs.get('users/g1')!.emailVerified, true);
  // The password provider is never trusted just because the token says the address is verified.
  await assert.rejects(accounts.verifyEmail('g2', { email: 'x@gmail.com', email_verified: true, firebase: { sign_in_provider: 'password' } }), status(400));
});

test('older accounts without the flag are treated as verified', async () => {
  const { db, docs } = database();
  docs.set('users/old', { role: 'USER', rewardPoints: 40 });
  docs.set('users/new', { role: 'USER', emailVerified: false });
  assert.equal(await isUnverified(db, 'old'), false);
  assert.equal(await isUnverified(db, 'new'), true);
  assert.equal(await isUnverified(db, 'missing'), false);
  const { otp } = otpFixture();
  assert.deepEqual(await new AccountStore(db, otp).verifyEmail('old', {}), { verified: true });
});

test('the welcome points arrive with the first completed order, once, and only for new accounts', async () => {
  const { db, docs } = database({ sized });
  docs.set('users/staff', { role: 'EMPLOYEE' });
  docs.set('users/fresh', { rewardPoints: 0, welcomePending: true, emailVerified: true });
  docs.set('users/veteran', { rewardPoints: 7 });
  const ops = new OrderOpsStore(db, []);
  const place = async (uid: string, key: string) => {
    const checkout = checkoutSchema.parse({ customer: { fullname: 'K', phone: '0900000000' }, fulfillmentType: 'PICKUP',
      items: [{ lineId: 'line-1', productId: 'sized', variantId: 'medium', addonIds: [], quantity: 1 }] });
    const { id } = await ops.createCash(uid, key, { checkout });
    for (let i = 0; i < 4; i++) await ops.advance('staff', id);
    return docs.get(`orders/${id}`)!;
  };
  const first = await place('fresh', 'welcome-key-00000001');
  const earned = rewardPointsFor(first.total as number);
  assert.equal(docs.get('users/fresh')!.rewardPoints, earned + WELCOME_POINTS);
  assert.equal(docs.get('users/fresh')!.welcomePending, false);
  await place('fresh', 'welcome-key-00000002');
  assert.equal(docs.get('users/fresh')!.rewardPoints, earned * 2 + WELCOME_POINTS);
  await place('veteran', 'welcome-key-00000003');
  assert.equal(docs.get('users/veteran')!.rewardPoints, 7 + earned);
});

async function server(t: TestContext) {
  const { db, docs } = database({ sized });
  docs.set('users/ok', { role: 'USER', emailVerified: true });
  docs.set('users/pending', { role: 'USER', emailVerified: false, welcomePending: true });
  const { otp, sent } = otpFixture();
  const ops = new OrderOpsStore(db, []);
  const app = createPaymentServer({
    store: {} as never, payos: {} as never, origins: [], returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c',
    verifyToken: async token => ({ uid: token, exp: Math.floor(Date.now() / 1000) + 3600, email: `${token}@gmail.com`, email_verified: false,
      firebase: { sign_in_provider: 'password' } }),
    isUnverified: uid => isUnverified(db, uid), orders: ops, otp, accounts: new AccountStore(db, otp),
  });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  t.after(() => new Promise<void>(resolve => { app.io.close(() => resolve()); }));
  const call = (path: string, token: string, body: unknown, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const order = (token: string, key: string) => call('/api/orders/cash', token, { checkout: { customer: { fullname: 'K', phone: '0900000000' }, fulfillmentType: 'PICKUP',
    items: [{ lineId: 'line-1', productId: 'sized', variantId: 'medium', addonIds: [], quantity: 1 }] } }, { 'Idempotency-Key': key });
  return { call, order, sent, docs, otp, port: address.port };
}

test('HTTP: an unverified account cannot order or redeem; verifying with the mailed code unlocks it', async t => {
  const f = await server(t);
  const blocked = await f.order('pending', 'http-key-00000000001');
  assert.equal(blocked.status, 403);
  assert.equal(((await blocked.json()) as { code: string }).code, 'EMAIL_NOT_VERIFIED');
  assert.equal((await f.call('/api/rewards/redeem', 'pending', { rewardId: 'R01' }, { 'Idempotency-Key': 'http-key-00000000002' })).status, 403);
  assert.equal((await f.order('ok', 'http-key-00000000003')).status, 200);

  // The sign-up form's pre-check does not consume the code; the account's claim does.
  assert.equal((await fetch(`http://127.0.0.1:${f.port}/api/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pending@gmail.com' }) })).status, 200);
  const code = f.sent['pending@gmail.com'];
  assert.equal((await fetch(`http://127.0.0.1:${f.port}/api/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pending@gmail.com', code }) })).status, 200);
  assert.equal((await f.call('/api/account/verify-email', 'pending', {})).status, 400);
  assert.equal((await f.call('/api/account/verify-email', 'pending', { code, extra: 1 })).status, 400);
  assert.equal((await f.call('/api/account/verify-email', 'pending', { code })).status, 200);
  assert.equal(f.docs.get('users/pending')!.emailVerified, true);
  assert.equal((await f.order('pending', 'http-key-00000000004')).status, 200);
  // The code is single-use.
  assert.equal((await f.call('/api/account/verify-email', 'pending', { code })).status, 200); // already verified: nothing to do
});
