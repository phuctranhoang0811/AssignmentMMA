import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderOpsStore } from '../src/orders';
import { HttpError } from '../src/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { database } from './fakeDb';

const status = (code: number) => (error: unknown) => error instanceof HttpError && error.status === code;
const base = { orderCode: 'PF-1', userId: 'customer', fulfillmentType: 'delivery', paymentMethod: 'cash', paymentStatus: 'UNPAID',
  total: 200000, statusHistory: [], address: '1 Lê Lợi', customer: { fullname: 'Khách', phone: '0900000000' }, items: [] };

function fixture() {
  const { db, docs } = database();
  docs.set('users/rider', { role: 'ROLE_RIDER', fullname: 'Anh Tài', phone: '0911111111' });
  docs.set('users/rider2', { role: 'ROLE_RIDER', fullname: 'Anh Hai' });
  docs.set('users/cook', { role: 'ROLE_KITCHEN' });
  docs.set('users/customer', { rewardPoints: 0 });
  docs.set('orders/ready', { ...base, status: 'READY' });
  docs.set('orders/cooking', { ...base, status: 'PREPARING' });
  docs.set('orders/pickup', { ...base, status: 'READY', fulfillmentType: 'takeaway' });
  docs.set('orders/aha', { ...base, status: 'READY', delivery: { provider: 'AHAMOVE', status: 'NOT_REQUESTED' } });
  return { ops: new OrderOpsStore(db, []), docs };
}

test('a rider is not store staff: every kitchen and admin action is refused', async () => {
  const { ops } = fixture();
  await assert.rejects(ops.list('rider'), status(403));
  await assert.rejects(ops.advance('rider', 'ready'), status(403));
  await assert.rejects(ops.reject('rider', 'ready', 'Hết nguyên liệu'), status(403));
  // And store staff or admins are not riders.
  await assert.rejects(ops.riderOrders('cook'), status(403));
});

test('before accepting, a rider sees where to go and what to collect, never who the customer is', async () => {
  const { ops, docs } = fixture();
  docs.set('orders/ready', { ...docs.get('orders/ready')!, deliveryNote: 'Gọi trước', itemCount: 3, userId: 'customer', checkoutFingerprint: 'secret' });
  const [free] = await ops.riderOrders('rider');
  assert.deepEqual(Object.keys(free).sort(), ['address', 'codAmount', 'createdAt', 'id', 'itemCount', 'mine', 'orderCode', 'paymentStatus', 'riderPay', 'status']);
  assert.equal(free.codAmount, 200000);
  assert.equal(JSON.stringify(free).includes('0900000000'), false);
  await ops.riderAction('rider', 'ready', 'accept');
  const [taken] = await ops.riderOrders('rider');
  assert.equal(taken.mine, true);
  assert.deepEqual(taken.customer, { fullname: 'Khách', phone: '0900000000' });
  assert.equal(taken.deliveryNote, 'Gọi trước');
  assert.equal('userId' in taken, false);
  assert.equal('checkoutFingerprint' in taken, false);
});

test('only riders see ready store-delivery orders, not Ahamove, pickup or still-cooking ones', async () => {
  const { ops } = fixture();
  await assert.rejects(ops.riderOrders('cook'), status(403));
  await assert.rejects(ops.riderOrders('customer'), status(403));
  assert.deepEqual((await ops.riderOrders('rider')).map(order => order.id), ['ready']);
});

test('a rider accepts, picks up and delivers; the customer sees each step on the order', async () => {
  const { ops, docs } = fixture();
  await ops.riderAction('rider', 'ready', 'accept');
  assert.equal(docs.get('orders/ready')!.rider && (docs.get('orders/ready')!.rider as { name: string }).name, 'Anh Tài');
  // Another rider can no longer see or take it, and kitchen staff can no longer move it.
  await assert.rejects(ops.riderAction('rider2', 'ready', 'accept'), status(409));
  assert.deepEqual(await ops.riderOrders('rider2'), []);
  await assert.rejects(ops.riderAction('rider2', 'ready', 'pickup'), status(409));
  await assert.rejects(ops.riderAction('rider', 'ready', 'deliver'), status(409));

  assert.equal((await ops.riderAction('rider', 'ready', 'pickup')).status, 'OUT_FOR_DELIVERY');
  await assert.rejects(ops.riderAction('rider', 'ready', 'release'), status(409));
  assert.equal((await ops.riderAction('rider', 'ready', 'deliver')).status, 'COMPLETED');
  const order = docs.get('orders/ready')!;
  assert.deepEqual((order.statusHistory as { status: string }[]).map(h => h.status), ['OUT_FOR_DELIVERY', 'COMPLETED']);
  // Cash collected by the store's own rider counts as paid; reward points are awarded.
  assert.equal(order.paymentStatus, 'PAID');
  assert.equal(docs.get('users/customer')!.rewardPoints, 20);
});

test('a rider can hand an order back before pickup; staff cannot reject or advance a taken order', async () => {
  const { ops, docs } = fixture();
  await ops.riderAction('rider', 'ready', 'accept');
  await assert.rejects(ops.advance('cook', 'ready'), status(409));
  await assert.rejects(ops.reject('cook', 'ready', 'Hết nguyên liệu'), status(409));
  await ops.riderAction('rider', 'ready', 'release');
  assert.equal(docs.get('orders/ready')!.rider, null);
  await ops.riderAction('rider2', 'ready', 'accept');
  await assert.rejects(ops.riderAction('rider', 'aha', 'accept'), status(404));
  await assert.rejects(ops.riderAction('rider', 'cooking', 'accept'), status(409));
});

test('a rider is paid for each delivered trip and sees today, this week and all-time earnings', async () => {
  const { ops, docs } = fixture();
  docs.set('orders/ready', { ...docs.get('orders/ready')!, riderPay: 35000, deliveryDistanceKm: 6.5 });
  assert.equal((await ops.riderOrders('rider'))[0].riderPay, 35000);
  assert.deepEqual(await ops.riderEarnings('rider').then(e => [e.today, e.week, e.total, e.trips]), [0, 0, 0, 0]);
  await ops.riderAction('rider', 'ready', 'accept');
  await ops.riderAction('rider', 'ready', 'pickup');
  // Nothing is earned until the food is delivered.
  assert.equal((await ops.riderEarnings('rider')).total, 0);
  await ops.riderAction('rider', 'ready', 'deliver');
  assert.equal(docs.get('orders/ready')!.riderEarned, 35000);
  // An older trip counts toward the total but not today or this week.
  docs.set('orders/old', { ...base, status: 'COMPLETED', riderUid: 'rider', riderEarned: 20000, deliveredAt: Timestamp.fromMillis(Date.now() - 10 * 86_400_000) });
  docs.set('orders/other', { ...base, status: 'COMPLETED', riderUid: 'rider2', riderEarned: 99000, deliveredAt: Timestamp.now() });
  const earnings = await ops.riderEarnings('rider');
  assert.deepEqual([earnings.today, earnings.week, earnings.total, earnings.trips], [35000, 35000, 55000, 2]);
  assert.deepEqual(earnings.recent.map(trip => trip.orderCode), ['PF-1', 'PF-1']);
  assert.equal(earnings.recent[0].earned, 35000);
  assert.equal(earnings.recent[0].distanceKm, 6.5);
  await assert.rejects(ops.riderEarnings('cook'), status(403));
  await assert.rejects(ops.riderEarnings('customer'), status(403));
});

test('handing an order back clears the rider so it is not counted as theirs', async () => {
  const { ops, docs } = fixture();
  await ops.riderAction('rider', 'ready', 'accept');
  assert.equal(docs.get('orders/ready')!.riderUid, 'rider');
  await ops.riderAction('rider', 'ready', 'release');
  assert.equal(docs.get('orders/ready')!.riderUid, null);
});
