import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentServer } from '../src/app';
import { StoreSettingsStore } from '../src/storeSettings';
import { defaultStoreSettings, storeStatus } from '../../src/utils/storeHours';
import { database } from './fakeDb';

// 03:00 UTC is 10:00 in Vietnam; 16:00 UTC is 23:00.
const at = (utcHour: number, utcMinute = 0) => new Date(Date.UTC(2026, 9, 30, utcHour, utcMinute));
const hours = { acceptingOrders: true, openTime: '08:00', closeTime: '22:00' };

test('the store is open inside its hours in Vietnam time, whatever the server clock zone', () => {
  assert.equal(storeStatus(hours, at(3)).open, true);
  assert.equal(storeStatus(hours, at(14, 59)).open, true);
  const late = storeStatus(hours, at(16));
  assert.equal(late.open, false);
  assert.equal(late.reason, 'OUTSIDE_HOURS');
  assert.match(late.message, /08:00 đến 22:00/);
  assert.equal(storeStatus(hours, at(0)).open, false);
});

test('opening hours are inclusive at opening and exclusive at closing', () => {
  assert.equal(storeStatus(hours, at(1, 0)).open, true);
  assert.equal(storeStatus(hours, at(0, 59)).open, false);
  assert.equal(storeStatus(hours, at(15, 0)).open, false);
});

test('a closing time before the opening time runs past midnight, and equal times mean all day', () => {
  const night = { acceptingOrders: true, openTime: '18:00', closeTime: '02:00' };
  assert.equal(storeStatus(night, at(12)).open, true);
  assert.equal(storeStatus(night, at(18)).open, true);
  assert.equal(storeStatus(night, at(3)).open, false);
  assert.equal(storeStatus({ acceptingOrders: true, openTime: '00:00', closeTime: '00:00' }, at(20)).open, true);
});

test('pausing ordering wins over opening hours and shows the custom message', () => {
  const status = storeStatus({ ...hours, acceptingOrders: false, closedMessage: 'Bếp quá tải, quay lại sau 30 phút.' }, at(3));
  assert.deepEqual([status.open, status.reason, status.message], [false, 'PAUSED', 'Bếp quá tải, quay lại sau 30 phút.']);
  assert.match(storeStatus({ ...hours, acceptingOrders: false }, at(3)).message, /tạm ngưng/);
});

test('a missing or invalid settings document falls back to the default hours', async () => {
  const { db, docs } = database();
  const store = new StoreSettingsStore(db, () => at(3).getTime());
  assert.deepEqual(await store.get(), defaultStoreSettings);
  docs.set('settings/store', { acceptingOrders: 'yes' });
  assert.deepEqual(await new StoreSettingsStore(db, () => at(3).getTime()).get(), defaultStoreSettings);
});

test('assertOpen refuses with a STORE_CLOSED error outside hours, and settings are cached briefly', async () => {
  const { db, docs } = database();
  docs.set('settings/store', { ...hours });
  let now = at(16).getTime();
  const store = new StoreSettingsStore(db, () => now);
  await assert.rejects(store.assertOpen(), (error: { status: number; code: string }) => error.status === 403 && error.code === 'STORE_CLOSED');
  docs.set('settings/store', { ...hours, acceptingOrders: true, openTime: '00:00', closeTime: '00:00' });
  await assert.rejects(store.assertOpen());
  now += 16_000;
  await store.assertOpen();
});

test('only an admin changes the settings, and each change is written to the audit log', async () => {
  const { db, docs } = database();
  docs.set('users/admin', { role: 'ADMIN' });
  docs.set('users/staff', { role: 'EMPLOYEE' });
  const store = new StoreSettingsStore(db, () => at(3).getTime());
  await assert.rejects(store.update('staff', { ...hours, acceptingOrders: false }), /quản trị viên/);
  await store.update('admin', { ...hours, acceptingOrders: false, closedMessage: 'Nghỉ lễ' });
  assert.equal(docs.get('settings/store')?.acceptingOrders, false);
  const audit = [...docs.entries()].filter(([path]) => path.startsWith('audit_logs/'));
  assert.equal(audit.length, 1);
  assert.equal(audit[0][1].action, 'STORE_SETTINGS_UPDATED');
  assert.equal(audit[0][1].actorId, 'admin');
  assert.equal((audit[0][1].details as { before: { acceptingOrders: boolean } }).before.acceptingOrders, true);
});

async function server(t: TestContext, closed: boolean) {
  const { db, docs } = database();
  docs.set('users/admin', { role: 'ADMIN' });
  docs.set('settings/store', closed ? { ...hours, acceptingOrders: false } : { ...hours, openTime: '00:00', closeTime: '00:00' });
  const app = createPaymentServer({
    store: {} as never, payos: {} as never, origins: [], returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c',
    verifyToken: async token => ({ uid: token, exp: Math.floor(Date.now() / 1000) + 3600 }),
    storeSettings: new StoreSettingsStore(db),
  });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  t.after(() => new Promise<void>(resolve => { app.io.close(() => resolve()); }));
  const send = (method: string, path: string, body: unknown, token = 'u1') => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'test-key-1234567890' }, body: JSON.stringify(body) });
  return { send, docs };
}

test('HTTP: every order-creating route refuses with a clear message while the store is closed', async t => {
  const f = await server(t, true);
  for (const path of ['/api/payments/payos', '/api/orders/cash', '/api/delivery/orders']) {
    const response = await f.send('POST', path, {});
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).code, 'STORE_CLOSED', path);
  }
});

test('HTTP: while open the gate lets requests through to normal validation', async t => {
  const f = await server(t, false);
  const response = await f.send('POST', '/api/orders/cash', {});
  assert.notEqual((await response.json().catch(() => ({}))).code, 'STORE_CLOSED');
});

test('HTTP: admins change store settings, others cannot, and bad times are rejected', async t => {
  const f = await server(t, false);
  assert.equal((await f.send('PUT', '/api/admin/store-settings', { ...hours, openTime: '25:00' }, 'admin')).status, 400);
  assert.equal((await f.send('PUT', '/api/admin/store-settings', { ...hours, extra: 1 }, 'admin')).status, 400);
  assert.equal((await f.send('PUT', '/api/admin/store-settings', hours, 'u1')).status, 403);
  assert.equal((await f.send('PUT', '/api/admin/store-settings', { ...hours, acceptingOrders: false }, 'admin')).status, 200);
  assert.equal(f.docs.get('settings/store')?.acceptingOrders, false);
});
