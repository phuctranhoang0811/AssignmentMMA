import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { OrderOpsStore } from '../src/orders';
import { OrderSweeper, type SweepAlert } from '../src/sweeper';
import { HttpError } from '../src/domain';
import { database } from './fakeDb';

const status = (code: number) => (error: unknown) => error instanceof HttpError && error.status === code;
const base = { orderCode: 'PF-1', userId: 'customer', fulfillmentType: 'delivery', paymentMethod: 'cash', paymentStatus: 'UNPAID',
  total: 235000, riderPay: 35000, statusHistory: [], address: '1 Lê Lợi', customer: { fullname: 'Khách', phone: '0900000000' }, items: [] };

function fixture() {
  const { db, docs } = database();
  docs.set('users/rider', { role: 'ROLE_RIDER', fullname: 'Anh Tài', phone: '0911111111' });
  docs.set('users/rider2', { role: 'ROLE_RIDER', fullname: 'Anh Hai' });
  docs.set('users/cook', { role: 'ROLE_KITCHEN' });
  docs.set('users/admin', { role: 'ADMIN' });
  docs.set('users/customer', { rewardPoints: 0 });
  return { ops: new OrderOpsStore(db, []), docs, db };
}
const audits = (docs: Map<string, Record<string, unknown>>) => [...docs.entries()].filter(([path]) => path.startsWith('audit_logs/')).map(([, value]) => value.action);

async function ride(ops: OrderOpsStore, docs: Map<string, Record<string, unknown>>, id: string, extra: Record<string, unknown> = {}, who = 'rider') {
  docs.set(`orders/${id}`, { ...base, status: 'READY', ...extra });
  await ops.riderAction(who, id, 'accept');
  await ops.riderAction(who, id, 'pickup');
}

test('a delivered cash order records the cash the rider holds and waits to be settled', async () => {
  const { ops, docs } = fixture();
  await ride(ops, docs, 'cash');
  await ops.riderAction('rider', 'cash', 'deliver');
  const order = docs.get('orders/cash')!;
  assert.deepEqual([order.riderCash, order.riderEarned, order.riderSettled, order.paymentStatus], [235000, 35000, false, 'PAID']);
  // A prepaid order has no cash to hand over.
  await ride(ops, docs, 'paid', { paymentMethod: 'payos', paymentStatus: 'PAID' });
  await ops.riderAction('rider', 'paid', 'deliver');
  assert.equal(docs.get('orders/paid')!.riderCash, 0);
  const earnings = await ops.riderEarnings('rider');
  assert.deepEqual(earnings.unsettled, { trips: 2, earned: 70000, cash: 235000 });
});

test('a failed delivery cancels the order, still pays the rider for a customer-side reason, and is audited', async () => {
  const { ops, docs } = fixture();
  await ride(ops, docs, 'ghost');
  await assert.rejects(ops.riderFail('rider2', 'ghost', 'WRONG_ADDRESS'), status(404));
  const result = await ops.riderFail('rider', 'ghost', 'CUSTOMER_UNREACHABLE', 'Gọi 3 lần không nghe');
  assert.equal(result.status, 'CANCELLED');
  const order = docs.get('orders/ghost')!;
  assert.equal(order.cancelReason, 'Giao thất bại: Không liên lạc được khách');
  assert.deepEqual([order.riderEarned, order.riderCash, order.riderSettled], [35000, 0, false]);
  assert.equal((order.deliveryFailure as { reason: string }).reason, 'CUSTOMER_UNREACHABLE');
  assert.deepEqual(audits(docs), ['ORDER_DELIVERY_FAILED']);
  const earnings = await ops.riderEarnings('rider');
  assert.equal(earnings.recent[0].failed, true);
  assert.equal(earnings.total, 35000);
  // Already finished: it cannot be failed or delivered again.
  await assert.rejects(ops.riderFail('rider', 'ghost', 'OTHER'), status(409));
  await assert.rejects(ops.riderAction('rider', 'ghost', 'deliver'), status(409));
});

test('a failed delivery before pickup is refused, "other" earns nothing until reviewed, and a paid order goes to the refund queue', async () => {
  const { ops, docs } = fixture();
  docs.set('orders/early', { ...base, status: 'READY' });
  await ops.riderAction('rider', 'early', 'accept');
  await assert.rejects(ops.riderFail('rider', 'early', 'OTHER'), status(409));
  await ride(ops, docs, 'prepaid', { paymentMethod: 'payos', paymentStatus: 'PAID' }, 'rider2');
  await ops.riderFail('rider2', 'prepaid', 'OTHER', 'Khách hủy qua điện thoại');
  const order = docs.get('orders/prepaid')!;
  assert.equal(order.paymentStatus, 'REFUND_PENDING');
  assert.equal(order.riderEarned, 0);
});

test('staff can take an order back before pickup; only an admin can cancel a trip after pickup', async () => {
  const { ops, docs } = fixture();
  docs.set('orders/a', { ...base, status: 'READY' });
  await ops.riderAction('rider', 'a', 'accept');
  await assert.rejects(ops.unassignRider('rider', 'a'), status(403)); // riders are not store staff
  await ops.unassignRider('cook', 'a');
  assert.equal(docs.get('orders/a')!.rider, null);
  assert.equal(docs.get('orders/a')!.riderUid, null);
  await assert.rejects(ops.unassignRider('cook', 'a'), status(404)); // no rider any more
  // It is back in the queue for another rider.
  await ops.riderAction('rider2', 'a', 'accept');

  await ride(ops, docs, 'b');
  await assert.rejects(ops.unassignRider('cook', 'b'), status(403));
  const result = await ops.unassignRider('admin', 'b');
  assert.equal(result.status, 'CANCELLED');
  assert.deepEqual([docs.get('orders/b')!.riderEarned, docs.get('orders/b')!.riderSettled], [35000, false]);
  assert.deepEqual(audits(docs).sort(), ['DELIVERY_CANCELLED_BY_STORE', 'RIDER_UNASSIGNED']);
});

test('the ledger nets cash held against wages owed; settling closes the trips once and keeps a record', async () => {
  const { ops, docs } = fixture();
  await ride(ops, docs, 'c1');
  await ops.riderAction('rider', 'c1', 'deliver');
  await ride(ops, docs, 'c2', { total: 100000, riderPay: 20000 });
  await ops.riderAction('rider', 'c2', 'deliver');
  await ride(ops, docs, 'p1', { paymentMethod: 'payos', paymentStatus: 'PAID', riderPay: 50000 }, 'rider2');
  await ops.riderAction('rider2', 'p1', 'deliver');

  await assert.rejects(ops.riderLedger('cook'), status(403));
  await assert.rejects(ops.riderLedger('rider'), status(403));
  const ledger = await ops.riderLedger('admin');
  const one = ledger.find(row => row.uid === 'rider')!;
  const two = ledger.find(row => row.uid === 'rider2')!;
  assert.deepEqual([one.trips, one.earned, one.cash, one.net], [2, 55000, 335000, 280000]); // rider owes the store 280.000
  assert.deepEqual([two.trips, two.earned, two.cash, two.net], [1, 50000, 0, -50000]);       // the store owes this rider 50.000

  await assert.rejects(ops.settleRider('rider', 'rider'), status(403));
  const settled = await ops.settleRider('admin', 'rider');
  assert.deepEqual([settled.trips, settled.cash, settled.earned, settled.net], [2, 335000, 55000, 280000]);
  assert.equal(docs.get('orders/c1')!.riderSettled, true);
  await assert.rejects(ops.settleRider('admin', 'rider'), status(409));
  assert.equal((await ops.riderLedger('admin')).some(row => row.uid === 'rider'), false);
  assert.equal((await ops.riderEarnings('rider')).unsettled.trips, 0);
  assert.equal((await ops.riderEarnings('rider2')).unsettled.trips, 1); // untouched
  assert.equal([...docs.keys()].filter(path => path.startsWith('rider_settlements/')).length, 1);
  assert.ok(audits(docs).includes('RIDER_SETTLED'));
});

test('staff are alerted once when a rider does not pick up or does not finish in time', async () => {
  const { db, docs } = database();
  const NOW = Date.parse('2026-10-30T10:00:00Z');
  const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
  const alerts: SweepAlert[] = [];
  const sweeper = new OrderSweeper(db, {} as never, async () => null, alert => alerts.push(alert), undefined, () => NOW);
  docs.set('orders/slow', { ...base, status: 'READY', rider: { uid: 'rider', name: 'T', acceptedAt: ago(20) } });
  docs.set('orders/quick', { ...base, status: 'READY', rider: { uid: 'rider', name: 'T', acceptedAt: ago(5) } });
  docs.set('orders/free', { ...base, status: 'READY' });
  docs.set('orders/late', { ...base, status: 'OUT_FOR_DELIVERY', rider: { uid: 'rider', name: 'T', acceptedAt: ago(90), pickedUpAt: ago(75) } });
  docs.set('orders/ontime', { ...base, status: 'OUT_FOR_DELIVERY', rider: { uid: 'rider', name: 'T', acceptedAt: ago(30), pickedUpAt: ago(20) } });
  docs.set('orders/pending', { ...base, status: 'PENDING_CONFIRMATION', createdAt: Timestamp.fromMillis(NOW) });
  const first = await sweeper.run();
  assert.equal(first.warnedRiders, 2);
  assert.deepEqual(alerts.map(a => [a.id, a.kind]).sort(), [['late', 'RIDER_OVERDUE'], ['slow', 'RIDER_NO_PICKUP']]);
  assert.equal((await sweeper.run()).warnedRiders, 0); // already told
});
