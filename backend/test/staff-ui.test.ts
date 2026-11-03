import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { OrderOpsStore, nextStatus } from '../src/orders';
import { database } from './fakeDb';
import type { StaffOrder } from '../../src/types/order';
import { canRejectStaffOrder, filterStaffOrders, isRiderRole, isStaffRole, loginDestination, staffDeliveryTime, staffOrderAction, staffOrderTime } from '../../src/utils/staff';

const order: StaffOrder = {
  id: 'order-1', orderCode: 'PF-123', status: 'PENDING_CONFIRMATION', fulfillmentType: 'takeaway',
  address: '', customer: { fullname: 'Nguyễn An', phone: '0900000000' }, total: 100000, items: [],
};

test('staff portal filters real backend fulfillment values and searches customer/order details', () => {
  const delivery = { ...order, id: 'order-2', orderCode: 'AHA-456', fulfillmentType: 'delivery' };
  const kitchen = { ...order, id: 'order-3', status: 'PREPARING' };
  const completed = { ...order, id: 'order-4', status: 'COMPLETED' };
  const orders = [order, delivery, kitchen, completed];
  assert.deepEqual(filterStaffOrders(orders, 'pending', 'takeaway', 'pf-123'), [order]);
  assert.deepEqual(filterStaffOrders(orders, 'pending', 'delivery', '  NGUYỄN AN '), [delivery]);
  assert.deepEqual(filterStaffOrders(orders, 'kitchen', 'ALL', '0900000000'), [kitchen]);
  assert.deepEqual(filterStaffOrders(orders, 'completed'), [completed]);
  assert.deepEqual(filterStaffOrders(orders, 'pending', 'ALL', 'missing'), []);
});

test('staff portal actions match backend transitions, including Ahamove ownership after READY', () => {
  for (const status of ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED']) {
    for (const fulfillmentType of ['delivery', 'takeaway']) {
      for (const delivery of [undefined, { provider: 'AHAMOVE', environment: 'staging', serviceId: 'bike', status: 'NOT_REQUESTED', quotedFee: 20000 } as const]) {
        const value = { ...order, status, fulfillmentType, delivery };
        assert.equal(Boolean(staffOrderAction(value)), Boolean(nextStatus(value)), `${status}/${fulfillmentType}/${delivery?.provider}`);
        const ridden = { ...value, rider: { uid: 'rider', name: 'Tài xế', acceptedAt: '2026-10-30T00:00:00Z' } };
        assert.equal(Boolean(staffOrderAction(ridden)), Boolean(nextStatus(ridden)), `${status}/${fulfillmentType}/rider`);
      }
    }
  }
});

test('staff reject availability agrees with backend and paid rejections retain refund handling', async () => {
  for (const status of ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED']) {
    for (const deliveryStatus of [undefined, 'NOT_REQUESTED', 'SEARCHING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED'] as const) {
      const { db, docs } = database();
      const ops = new OrderOpsStore(db, ['staff']);
      const value = { ...order, status, paymentStatus: 'PAID', delivery: deliveryStatus
        ? { provider: 'AHAMOVE', environment: 'staging', serviceId: 'bike', status: deliveryStatus, quotedFee: 20000 } as const : undefined };
      docs.set('orders/order-1', value);
      if (canRejectStaffOrder(value)) {
        await ops.reject('staff', value.id, 'Hết nguyên liệu');
        assert.equal(docs.get('orders/order-1')?.paymentStatus, 'REFUND_PENDING');
      } else {
        await assert.rejects(ops.reject('staff', value.id, 'Hết nguyên liệu'));
      }
    }
  }
});

test('staff time reads Admin SDK JSON timestamps and client timestamps consistently', () => {
  const timestamp = Timestamp.fromDate(new Date('2026-10-28T03:00:00Z'));
  const expected = timestamp.toMillis();
  assert.equal(staffOrderTime(JSON.parse(JSON.stringify(timestamp))), expected);
  assert.equal(staffOrderTime({ seconds: timestamp.seconds }), expected);
  assert.equal(staffOrderTime('2026-10-28T03:00:00Z'), expected);
  assert.equal(staffOrderTime(undefined), undefined);
  assert.equal(staffOrderTime('invalid'), undefined);
  assert.equal(staffDeliveryTime('asap'), 'Sớm nhất');
  assert.equal(staffDeliveryTime('Giao ngay khi món sẵn sàng'), 'Giao ngay khi món sẵn sàng');
  assert.notEqual(staffDeliveryTime('2026-10-28T03:00:00Z'), 'Chọn lại thời gian nhận');
});

test('only ROLE_RIDER is a rider; admins and kitchen staff are not', () => {
  assert.equal(isRiderRole('ROLE_RIDER'), true);
  for (const role of ['EMPLOYEE', 'ROLE_KITCHEN', 'ADMIN', 'SUPER_ADMIN', 'STORE_MANAGER', 'USER', undefined]) assert.equal(isRiderRole(role), false);
});

test('every supported staff role, including store manager, can enter the same portal', () => {
  for (const role of ['EMPLOYEE', 'ROLE_KITCHEN', 'STORE_MANAGER', 'SUPER_ADMIN', 'ADMIN']) assert.equal(isStaffRole(role), true);
  // Riders are an outside party: not store staff, and only riders are riders.
  for (const role of ['USER', '', undefined, 'ROLE_RIDER']) assert.equal(isStaffRole(role), false);
});

test('staff routing preserves every customer login destination, including checkout and rewards', () => {
  for (const [returnTo, expected] of [
    ['checkout', 'back'], ['cart-checkout', '/checkout'], ['profile', '/(tabs)/profile'],
    ['rewards', '/(tabs)/rewards'], ['menu', '/(tabs)/menu'], ['cart', '/(tabs)/cart'],
    [undefined, '/(tabs)/home'],
  ]) assert.equal(loginDestination('USER', returnTo), expected);
  for (const role of ['EMPLOYEE', 'ROLE_KITCHEN']) assert.equal(loginDestination(role), '/staff/orders');
  for (const returnTo of [undefined, 'staff', 'rider']) assert.equal(loginDestination('ROLE_RIDER', returnTo), '/rider');
  // Managers/admins land on the admin portal, and can still open the staff portal on purpose.
  for (const role of ['STORE_MANAGER', 'SUPER_ADMIN', 'ADMIN']) {
    assert.equal(loginDestination(role), '/admin/dashboard');
    assert.equal(loginDestination(role, 'staff'), '/staff/orders');
  }
  assert.equal(loginDestination('USER', 'staff'), '/staff/orders');
});
