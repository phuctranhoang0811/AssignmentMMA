import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createPaymentServer } from '../src/app';
import { PushStore } from '../src/push';
import { ReviewStore } from '../src/reviews';
import { database } from './fakeDb';

const TOKEN = 'ExponentPushToken[abcdefghijklmnop]';

function pushFixture(replies: unknown) {
  const { db, docs } = database();
  const calls: { url: string; body: any[] }[] = [];
  const send = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return { json: async () => replies };
  }) as unknown as typeof fetch;
  return { store: new PushStore(db, send), docs, calls };
}

test('push: a customer\'s phones are notified of a new status with the order code', async () => {
  const { store, docs, calls } = pushFixture({ data: [{ status: 'ok' }] });
  await store.save('u1', TOKEN);
  await store.notifyStatus({ userId: 'u1', orderCode: 123, status: 'PREPARING' }, 'o1');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /exp\.host.*push\/send/);
  assert.equal(calls[0].body[0].to, TOKEN);
  assert.match(calls[0].body[0].body, /#123 đang được chuẩn bị/);
  assert.equal(calls[0].body[0].data.orderId, 'o1');
  assert.ok(docs.has(`push_tokens/${encodeURIComponent(TOKEN)}`));
});

test('push: nothing is sent for statuses customers are not told about, or users without a phone', async () => {
  const { store, calls } = pushFixture({ data: [] });
  await store.save('u1', TOKEN);
  await store.notifyStatus({ userId: 'u1', orderCode: 1, status: 'PENDING_CONFIRMATION' }, 'o1');
  await store.notifyStatus({ userId: 'nobody', orderCode: 1, status: 'READY' }, 'o1');
  await store.notifyStatus({ orderCode: 1, status: 'READY' }, 'o1');
  assert.equal(calls.length, 0);
});

test('push: a token that now belongs to another account moves, and dead tokens are removed', async () => {
  const { store, docs } = pushFixture({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] });
  await store.save('u1', TOKEN);
  await store.save('u2', TOKEN);
  assert.equal(docs.get(`push_tokens/${encodeURIComponent(TOKEN)}`)?.uid, 'u2');
  await store.notifyStatus({ userId: 'u2', orderCode: 9, status: 'COMPLETED' }, 'o9');
  assert.equal(docs.has(`push_tokens/${encodeURIComponent(TOKEN)}`), false);
});

async function server(t: TestContext, { staff = ['staff-1'] } = {}) {
  const saved: [string, string][] = [];
  const { db, docs } = database();
  docs.set('orders/o1', { userId: 'user-a', status: 'COMPLETED' });
  const app = createPaymentServer({
    store: {} as never, payos: {} as never, origins: [], returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c',
    verifyToken: async token => {
      if (!['user-a', 'user-b', 'staff-1'].includes(token)) throw new Error('Invalid');
      return { uid: token, exp: Math.floor(Date.now() / 1000) + 3600 };
    },
    push: { save: async (uid, token) => { saved.push([uid, token]); } },
    reviews: new ReviewStore(db),
    isStaff: async uid => staff.includes(uid),
  });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  t.after(() => new Promise<void>(resolve => { app.io.close(() => resolve()); }));
  const request = (path: string, body: unknown, token = 'user-a') => fetch(url + path, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ...app, url, request, saved, docs };
}

test('HTTP: push token registration needs login and a real Expo token', async t => {
  const f = await server(t);
  assert.equal((await f.request('/api/push/token', { token: TOKEN }, 'bad')).status, 401);
  assert.equal((await f.request('/api/push/token', { token: 'not-a-token' })).status, 400);
  assert.equal((await f.request('/api/push/token', { token: TOKEN, extra: 1 })).status, 400);
  assert.equal((await f.request('/api/push/token', { token: TOKEN })).status, 200);
  assert.deepEqual(f.saved, [['user-a', TOKEN]]);
});

test('HTTP: reviews accept 1-5 stars from the owner, once', async t => {
  const f = await server(t);
  assert.equal((await f.request('/api/orders/o1/review', { rating: 0 })).status, 400);
  assert.equal((await f.request('/api/orders/o1/review', { rating: 6 })).status, 400);
  assert.equal((await f.request('/api/orders/o1/review', { rating: 5 }, 'user-b')).status, 404);
  const ok = await f.request('/api/orders/o1/review', { rating: 5, comment: 'Ngon' });
  assert.equal(ok.status, 200);
  assert.equal((await f.request('/api/orders/o1/review', { rating: 5 })).status, 409);
  assert.equal(f.docs.get('orders/o1')?.rating, 5);
});

test('Socket.IO: staff sockets hear every order change, customers never do', async t => {
  const f = await server(t);
  const staff = connect(f.url, { auth: { token: 'staff-1' }, reconnection: false });
  const customer = connect(f.url, { auth: { token: 'user-a' }, reconnection: false });
  t.after(() => { staff.disconnect(); customer.disconnect(); });
  await Promise.all([staff, customer].map(socket => new Promise<void>((resolve, reject) => {
    socket.on('connect', resolve); socket.on('connect_error', reject);
  })));
  // Joining the staff room is asynchronous (a role lookup); give it a moment.
  await new Promise(resolve => setTimeout(resolve, 100));
  let leaked = false; customer.on('staff:orders', () => { leaked = true; });
  const heard = new Promise<{ id: string }>((resolve, reject) => {
    staff.once('staff:orders', resolve);
    setTimeout(() => reject(new Error('Staff event timeout')), 2000).unref();
  });
  f.io.to('staff').emit('staff:orders', { id: 'o1', status: 'PENDING_CONFIRMATION', kind: 'new' });
  assert.equal((await heard).id, 'o1');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(leaked, false);
});
