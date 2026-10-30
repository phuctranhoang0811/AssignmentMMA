import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentServer } from '../src/app';
import { recordReportedAction } from '../src/audit';
import { database } from './fakeDb';

const entries = (docs: Map<string, Record<string, unknown>>) => [...docs.entries()].filter(([path]) => path.startsWith('audit_logs/')).map(([, value]) => value);

test('an admin action reported by the app is logged under the signed-in admin, not a name from the request', async () => {
  const { db, docs } = database();
  docs.set('users/admin', { role: 'SUPER_ADMIN' });
  await recordReportedAction(db, 'admin', { action: 'ROLE_CHANGED', target: 'users/u2', details: { from: 'USER', to: 'EMPLOYEE' } });
  const [entry] = entries(docs);
  assert.deepEqual([entry.actorId, entry.action, entry.target], ['admin', 'ROLE_CHANGED', 'users/u2']);
  assert.deepEqual(entry.details, { from: 'USER', to: 'EMPLOYEE', reportedBy: 'app' });
  assert.ok(entry.at);
});

test('customers and staff cannot write the audit log', async () => {
  const { db, docs } = database();
  docs.set('users/staff', { role: 'EMPLOYEE' });
  await assert.rejects(recordReportedAction(db, 'staff', { action: 'PRODUCT_DELETED', target: 'products/p1' }), /quản trị viên/);
  await assert.rejects(recordReportedAction(db, 'nobody', { action: 'PRODUCT_DELETED', target: 'products/p1' }), /quản trị viên/);
  assert.equal(entries(docs).length, 0);
});

async function server(t: TestContext) {
  const { db, docs } = database();
  docs.set('users/admin', { role: 'ADMIN' });
  const app = createPaymentServer({
    store: {} as never, payos: {} as never, origins: [], returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c',
    verifyToken: async token => ({ uid: token, exp: Math.floor(Date.now() / 1000) + 3600 }),
    audit: (uid, input) => recordReportedAction(db, uid, input),
  });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  t.after(() => new Promise<void>(resolve => { app.io.close(() => resolve()); }));
  const send = (body: unknown, token = 'admin') => fetch(`http://127.0.0.1:${address.port}/api/admin/audit`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { send, docs };
}

test('HTTP: unknown actions, forged actors and non-admins are refused', async t => {
  const f = await server(t);
  assert.equal((await f.send({ action: 'HACK', target: 'x' })).status, 400);
  assert.equal((await f.send({ action: 'PRODUCT_DELETED', target: 'products/p1', actorId: 'someone-else' })).status, 400);
  assert.equal((await f.send({ action: 'PRODUCT_DELETED', target: 'products/p1' }, 'u1')).status, 403);
  assert.equal((await f.send({ action: 'PRODUCT_DELETED', target: 'products/p1', details: { name: 'Pizza Bò' } })).status, 200);
  assert.equal(entries(f.docs).length, 1);
});
