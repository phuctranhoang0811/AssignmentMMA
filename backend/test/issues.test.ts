import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentServer } from '../src/app';
import { IssueStore } from '../src/issues';
import { database } from './fakeDb';

function fixture(status = 'COMPLETED') {
  const { db, docs } = database();
  docs.set('users/admin', { role: 'ADMIN' });
  docs.set('users/staff', { role: 'EMPLOYEE' });
  docs.set('orders/o1', { userId: 'u1', orderCode: 'PF-1', status });
  const resolved: unknown[] = [];
  return { db, docs, resolved, store: new IssueStore(db, issue => resolved.push(issue)) };
}
const audit = (docs: Map<string, Record<string, unknown>>) => [...docs.entries()].filter(([path]) => path.startsWith('audit_logs/'));

test('a customer reports a problem with their own finished order, once per problem type', async () => {
  const f = fixture();
  assert.deepEqual(await f.store.report('u1', 'o1', { type: 'MISSING_ITEM', description: 'Thiếu một lon Pepsi' }), { id: 'o1_MISSING_ITEM', status: 'OPEN' });
  assert.equal(f.docs.get('order_issues/o1_MISSING_ITEM')?.status, 'OPEN');
  assert.equal(f.docs.get('order_issues/o1_MISSING_ITEM')?.orderCode, 'PF-1');
  await assert.rejects(f.store.report('u1', 'o1', { type: 'MISSING_ITEM', description: 'Báo lại lần nữa' }), /đã báo/);
  await f.store.report('u1', 'o1', { type: 'LATE_DELIVERY', description: 'Giao trễ 40 phút' });
});

test('only the owner can report, and only on an order that was prepared or is on its way', async () => {
  const f = fixture();
  await assert.rejects(f.store.report('intruder', 'o1', { type: 'OTHER', description: 'Không phải đơn của tôi' }), /Không tìm thấy/);
  await assert.rejects(f.store.report('u1', 'missing', { type: 'OTHER', description: 'Đơn không tồn tại' }), /Không tìm thấy/);
  for (const status of ['PENDING_CONFIRMATION', 'PREPARING', 'CANCELLED']) {
    const early = fixture(status);
    await assert.rejects(early.store.report('u1', 'o1', { type: 'OTHER', description: 'Quá sớm để báo' }), /đã làm xong hoặc đang giao/, status);
  }
  await fixture('OUT_FOR_DELIVERY').store.report('u1', 'o1', { type: 'LATE_DELIVERY', description: 'Tài xế đi lạc đường' });
});

test('customers see only their own reports for an order, with the store\'s answer', async () => {
  const f = fixture();
  await f.store.report('u1', 'o1', { type: 'POOR_QUALITY', description: 'Pizza bị nguội' });
  const [mine] = await f.store.forOrder('u1', 'o1');
  assert.equal(mine.status, 'OPEN');
  assert.equal('userId' in mine, false);
  assert.deepEqual(await f.store.forOrder('u2', 'o1'), []);
});

test('only an admin lists and resolves reports; the oldest is first', async () => {
  const f = fixture();
  await f.store.report('u1', 'o1', { type: 'POOR_QUALITY', description: 'Pizza bị nguội' });
  await assert.rejects(f.store.list('staff'), /quản trị viên/);
  await assert.rejects(f.store.resolve('staff', 'o1_POOR_QUALITY', { resolution: 'APOLOGY', note: 'Xin lỗi bạn' }), /quản trị viên/);
  assert.equal((await f.store.list('admin')).length, 1);
});

test('resolving records the answer, notifies the customer once and writes an audit entry', async () => {
  const f = fixture();
  await f.store.report('u1', 'o1', { type: 'MISSING_ITEM', description: 'Thiếu một lon Pepsi' });
  const result = await f.store.resolve('admin', 'o1_MISSING_ITEM', { resolution: 'REFUND', note: 'Hoàn 20.000đ tiền lon Pepsi', refundAmount: 20000 });
  assert.deepEqual(result, { id: 'o1_MISSING_ITEM', status: 'RESOLVED' });
  const issue = f.docs.get('order_issues/o1_MISSING_ITEM')!;
  assert.deepEqual([issue.status, issue.resolution, issue.refundAmount, issue.resolvedBy], ['RESOLVED', 'REFUND', 20000, 'admin']);
  assert.equal(f.resolved.length, 1);
  assert.match((f.resolved[0] as { resolutionNote: string }).resolutionNote, /Pepsi/);
  assert.deepEqual([audit(f.docs)[0][1].action, audit(f.docs)[0][1].actorId], ['ISSUE_RESOLVED', 'admin']);
  await assert.rejects(f.store.resolve('admin', 'o1_MISSING_ITEM', { resolution: 'APOLOGY', note: 'Lần hai' }), /đã được xử lý/);
  assert.equal((await f.store.list('admin')).length, 0);
  assert.equal((await f.store.list('admin', 'RESOLVED')).length, 1);
});

test('rejecting a report is recorded as REJECTED, and an amount only goes with a refund', async () => {
  const f = fixture();
  await f.store.report('u1', 'o1', { type: 'OTHER', description: 'Tôi không thích món này' });
  await assert.rejects(f.store.resolve('admin', 'o1_OTHER', { resolution: 'APOLOGY', note: 'Xin lỗi', refundAmount: 5000 }), /Hoàn tiền/);
  assert.equal((await f.store.resolve('admin', 'o1_OTHER', { resolution: 'REJECTED', note: 'Không thuộc diện đổi trả' })).status, 'REJECTED');
});

async function server(t: TestContext) {
  const f = fixture();
  const app = createPaymentServer({
    store: {} as never, payos: {} as never, origins: [], returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c',
    verifyToken: async token => ({ uid: token, exp: Math.floor(Date.now() / 1000) + 3600 }), issues: f.store,
  });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  t.after(() => new Promise<void>(resolve => { app.io.close(() => resolve()); }));
  const send = (method: string, path: string, body?: unknown, token = 'u1') => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { send, ...f };
}

test('HTTP: validation, ownership and admin-only access are enforced', async t => {
  const f = await server(t);
  assert.equal((await f.send('POST', '/api/orders/o1/issues', { type: 'NOPE', description: 'Loại không có' })).status, 400);
  assert.equal((await f.send('POST', '/api/orders/o1/issues', { type: 'OTHER', description: 'ab' })).status, 400);
  assert.equal((await f.send('POST', '/api/orders/o1/issues', { type: 'OTHER', description: 'Mô tả đủ dài', extra: 1 })).status, 400);
  assert.equal((await f.send('POST', '/api/orders/o1/issues', { type: 'MISSING_ITEM', description: 'Thiếu khoai chiên' })).status, 200);
  assert.equal((await f.send('POST', '/api/orders/o1/issues', { type: 'MISSING_ITEM', description: 'Thiếu khoai chiên' })).status, 409);
  assert.equal((await f.send('POST', '/api/orders/o1/issues', { type: 'LATE_DELIVERY', description: 'Giao rất trễ' }, 'u2')).status, 404);
  assert.equal((await (await f.send('GET', '/api/orders/o1/issues')).json()).length, 1);
  assert.equal((await f.send('GET', '/api/admin/issues')).status, 403);
  assert.equal((await (await f.send('GET', '/api/admin/issues', undefined, 'admin')).json()).length, 1);
  assert.equal((await f.send('POST', '/api/admin/issues/o1_MISSING_ITEM/resolve', { resolution: 'APOLOGY', note: 'Xin lỗi bạn' })).status, 403);
  assert.equal((await f.send('POST', '/api/admin/issues/o1_MISSING_ITEM/resolve', { resolution: 'APOLOGY', note: 'Xin lỗi bạn' }, 'admin')).status, 200);
});
