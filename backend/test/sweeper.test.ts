import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { OrderSweeper, type SweepAlert } from '../src/sweeper';
import { OrderOpsStore, REFUND_SLA_MS } from '../src/orders';
import { PushStore } from '../src/push';
import { database } from './fakeDb';

const NOW = Date.parse('2026-10-30T10:00:00Z');
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000);

function fixture(links: Record<number, { status: string; amountPaid?: number; amountRemaining?: number }> = {}) {
  const { db, docs } = database();
  const cancelled: number[] = [];
  const paid: unknown[] = [];
  const alerts: SweepAlert[] = [];
  const payos = { paymentRequests: {
    get: async (orderCode: number) => {
      const link = links[orderCode];
      if (!link) throw new Error('provider down');
      return { id: `link-${orderCode}`, orderCode, amount: 100000, ...link };
    },
    cancel: async (orderCode: number) => { cancelled.push(orderCode); },
  } };
  const sweeper = new OrderSweeper(db, payos as never, async data => { paid.push(data); return null; }, alert => alerts.push(alert), undefined, () => NOW);
  return { db, docs, sweeper, cancelled, paid, alerts };
}
const unpaid = (orderCode: number, ageMinutes: number, extra = {}) => ({
  userId: 'u1', orderCode, total: 100000, paymentStatus: 'PENDING', createdAt: minutesAgo(ageMinutes).toISOString(),
  payment: { paymentLinkId: `link-${orderCode}`, checkoutUrl: 'https://pay.test', qrCode: 'QR' }, ...extra });
const waiting = (ageMinutes: number, extra = {}) => ({
  userId: 'u1', orderCode: 'PF-1', status: 'PENDING_CONFIRMATION', paymentStatus: 'UNPAID', paymentMethod: 'cash', total: 100000,
  createdAt: Timestamp.fromDate(minutesAgo(ageMinutes)), statusHistory: [], ...extra });

test('an unpaid payOS QR is cancelled after 20 minutes and marked expired; fresh ones are left alone', async () => {
  const f = fixture({ 1: { status: 'PENDING' }, 2: { status: 'PENDING' } });
  f.docs.set('payment_orders/old', unpaid(1, 25));
  f.docs.set('payment_orders/fresh', unpaid(2, 5));
  const result = await f.sweeper.run();
  assert.equal(result.expiredPayments, 1);
  assert.deepEqual(f.cancelled, [1]);
  assert.ok(f.docs.get('payment_orders/old')?.expiredAt);
  assert.equal(f.docs.get('payment_orders/fresh')?.expiredAt, undefined);
  assert.equal((await f.sweeper.run()).expiredPayments, 0);
  assert.deepEqual(f.cancelled, [1]);
});

test('a payment the webhook missed is honoured, never cancelled', async () => {
  const f = fixture({ 1: { status: 'PAID', amountPaid: 100000, amountRemaining: 0 } });
  f.docs.set('payment_orders/late', unpaid(1, 30));
  await f.sweeper.run();
  assert.deepEqual(f.cancelled, []);
  assert.equal(f.paid.length, 1);
  assert.equal(f.docs.get('payment_orders/late')?.expiredAt, undefined);
});

test('one order the provider cannot answer for does not stop the others, and is retried next sweep', async () => {
  const f = fixture({ 2: { status: 'PENDING' } });
  f.docs.set('payment_orders/broken', unpaid(1, 30));
  f.docs.set('payment_orders/ok', unpaid(2, 30));
  assert.equal((await f.sweeper.run()).expiredPayments, 1);
  assert.deepEqual(f.cancelled, [2]);
  assert.equal(f.docs.get('payment_orders/broken')?.expiredAt, undefined);
});

test('a payment whose QR was never created is simply closed', async () => {
  const f = fixture();
  f.docs.set('payment_orders/noqr', unpaid(1, 30, { payment: undefined }));
  assert.equal((await f.sweeper.run()).expiredPayments, 1);
  assert.deepEqual(f.cancelled, []);
});

test('staff are warned once when an order waits 10 minutes without confirmation', async () => {
  const f = fixture();
  f.docs.set('orders/o1', waiting(12));
  f.docs.set('orders/young', waiting(3, { orderCode: 'PF-2' }));
  assert.equal((await f.sweeper.run()).warnedOrders, 1);
  assert.deepEqual(f.alerts.map(alert => [alert.id, alert.waitedMinutes, alert.kind]), [['o1', 12, 'UNCONFIRMED']]);
  assert.ok(f.docs.get('orders/o1')?.staffWarnedAt);
  assert.equal((await f.sweeper.run()).warnedOrders, 0);
  assert.equal(f.alerts.length, 1);
});

test('an order nobody confirms in 20 minutes is cancelled with a reason and an audit entry', async () => {
  const f = fixture();
  f.docs.set('orders/o1', waiting(25));
  assert.equal((await f.sweeper.run()).cancelledOrders, 1);
  const order = f.docs.get('orders/o1')!;
  assert.equal(order.status, 'CANCELLED');
  assert.match(String(order.cancelReason), /Quá hạn xác nhận/);
  assert.equal(order.paymentStatus, 'UNPAID');
  const audit = [...f.docs.entries()].filter(([path]) => path.startsWith('audit_logs/'));
  assert.equal(audit.length, 1);
  assert.deepEqual([audit[0][1].actorId, audit[0][1].action], ['system', 'ORDER_AUTO_CANCELLED']);
});

test('a paid order that is auto-cancelled goes to the refund queue with a 24-hour deadline', async () => {
  const f = fixture();
  f.docs.set('orders/o1', waiting(25, { paymentStatus: 'PAID', paymentMethod: 'payos' }));
  await f.sweeper.run();
  const order = f.docs.get('orders/o1')!;
  assert.equal(order.paymentStatus, 'REFUND_PENDING');
  const due = (order.refundDueAt as Timestamp).toMillis() - (order.refundRequestedAt as Timestamp).toMillis();
  assert.ok(Math.abs(due - REFUND_SLA_MS) < 5000);
});

test('an order confirmed just before the sweep is left alone', async () => {
  const f = fixture();
  f.docs.set('orders/o1', waiting(25, { status: 'CONFIRMED' }));
  const result = await f.sweeper.run();
  assert.deepEqual([result.cancelledOrders, result.warnedOrders], [0, 0]);
  assert.equal(f.docs.get('orders/o1')?.status, 'CONFIRMED');
});

test('refunds: an admin records who refunded and why; the customer is told; the action is audited', async () => {
  const { db, docs } = database();
  docs.set('users/admin', { role: 'ADMIN' });
  docs.set('orders/o1', { userId: 'u1', orderCode: 'PF-9', total: 150000, paymentStatus: 'REFUND_PENDING', status: 'CANCELLED' });
  const told: unknown[] = [];
  const store = new OrderOpsStore(db, [], order => told.push(order));
  assert.deepEqual(await store.markRefunded('admin', 'o1', 'Chuyển khoản VCB 30/10'), { id: 'o1', paymentStatus: 'REFUNDED' });
  assert.equal(docs.get('orders/o1')?.refundNote, 'Chuyển khoản VCB 30/10');
  assert.equal(docs.get('orders/o1')?.refundedBy, 'admin');
  assert.equal(told.length, 1);
  assert.equal((told[0] as { orderCode: string }).orderCode, 'PF-9');
  const audit = [...docs.entries()].filter(([path]) => path.startsWith('audit_logs/'));
  assert.equal(audit[0][1].action, 'ORDER_REFUNDED');
  await assert.rejects(store.markRefunded('admin', 'o1'), /chờ hoàn tiền/);
});

test('staff rejecting and customers cancelling leave a reason on the order and an audit entry', async () => {
  const { db, docs } = database();
  docs.set('users/staff', { role: 'EMPLOYEE' });
  docs.set('orders/o1', waiting(1));
  docs.set('orders/o2', waiting(1, { orderCode: 'PF-2' }));
  const store = new OrderOpsStore(db, []);
  await store.reject('staff', 'o1', 'Hết nguyên liệu');
  assert.match(String(docs.get('orders/o1')?.cancelReason), /Hết nguyên liệu/);
  await store.cancel('u1', 'o2');
  assert.equal(docs.get('orders/o2')?.cancelReason, 'Khách hàng hủy đơn');
  const actions = [...docs.entries()].filter(([path]) => path.startsWith('audit_logs/')).map(([, entry]) => entry.action).sort();
  assert.deepEqual(actions, ['ORDER_CANCELLED_BY_CUSTOMER', 'ORDER_REJECTED']);
});

test('push: the customer gets a refund notice with the order code', async () => {
  const { db } = database();
  const sent: { body: string }[][] = [];
  const store = new PushStore(db, (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return { json: async () => ({ data: [{ status: 'ok' }] }) };
  }) as unknown as typeof fetch);
  await store.save('u1', 'ExponentPushToken[abcdefghijklmnop]');
  await store.notifyRefund({ userId: 'u1', orderCode: 'PF-9' }, 'o1');
  assert.match(sent[0][0].body, /#PF-9 đã được hoàn tiền/);
});
