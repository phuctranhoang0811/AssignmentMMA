import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderOpsStore, nextStatus } from '../src/orders';
import { checkoutSchema, HttpError } from '../src/domain';
import { database } from './fakeDb';
import { phoneLogin } from '../src/phoneLogin';

const sized = { name: 'Pizza Size', categoryId: 'pizza', basePrice: 100000, addons: [], isAvailable: true,
  variants: [{ id: 'medium', name: 'Cỡ Vừa', price: 200000 }] };
const checkout = (fulfillmentType: 'PICKUP' | 'DELIVERY' = 'PICKUP') => checkoutSchema.parse({
  customer: { fullname: 'Khách', phone: '0900000000' }, fulfillmentType,
  ...(fulfillmentType === 'DELIVERY' ? { address: '1 Lê Lợi, Quận 1' } : {}),
  items: [{ lineId: 'line-1', productId: 'sized', variantId: 'medium', addonIds: [], quantity: 2 }] });

function fixture() {
  const { db, docs } = database({ sized });
  docs.set('users/customer', { rewardPoints: 5 });
  return { ops: new OrderOpsStore(db, ['staff']), docs };
}
const status = (code: number) => (error: unknown) => error instanceof HttpError && error.status === code;

test('cash order is priced by the server, applies a real coupon and is idempotent', async () => {
  const { ops, docs } = fixture();
  const input = { checkout: checkout(), promoCode: 'pizza20' };
  const first = await ops.createCash('customer', 'cash-key-0000000001', input);
  const again = await ops.createCash('customer', 'cash-key-0000000001', input);
  assert.deepEqual(again, first);
  const order = docs.get(`orders/${first.id}`)!;
  // 2 × 200.000 = 400.000; PIZZA20 = 20% capped at 50.000; VAT applies after discount.
  assert.equal(order.subtotal, 400000);
  assert.equal(order.discount, 50000);
  assert.equal(order.total, (order.subtotal as number) - 50000 + (order.tax as number));
  assert.equal(order.status, 'PENDING_CONFIRMATION');
  assert.equal(order.paymentStatus, 'UNPAID');
  await assert.rejects(ops.createCash('customer', 'cash-key-0000000001', { checkout: checkout('DELIVERY') }), status(409));
  await assert.rejects(ops.createCash('customer', 'cash-key-0000000002', { checkout: checkout(), promoCode: 'FAKE' }), status(422));
});

test('staff walk a pickup order to COMPLETED; points are awarded exactly once', async () => {
  const { ops, docs } = fixture();
  const { id } = await ops.createCash('customer', 'cash-key-0000000003', { checkout: checkout() });
  await assert.rejects(ops.advance('customer', id), status(403));
  const seen = [];
  for (let i = 0; i < 4; i++) seen.push((await ops.advance('staff', id)).status);
  assert.deepEqual(seen, ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']);
  await assert.rejects(ops.advance('staff', id), status(409));
  const order = docs.get(`orders/${id}`)!;
  assert.equal(docs.get('users/customer')!.rewardPoints, 5 + Math.floor((order.total as number) / 10000));
  assert.equal(order.pointsAwarded, true);
  assert.deepEqual((order.statusHistory as { status: string }[]).map(h => h.status),
    ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']);
});

test('delivery goes READY → OUT_FOR_DELIVERY; Ahamove stops after READY', () => {
  assert.equal(nextStatus({ status: 'READY', fulfillmentType: 'delivery' }), 'OUT_FOR_DELIVERY');
  assert.equal(nextStatus({ status: 'OUT_FOR_DELIVERY', fulfillmentType: 'delivery' }), 'COMPLETED');
  assert.equal(nextStatus({ status: 'READY', fulfillmentType: 'takeaway' }), 'COMPLETED');
  assert.equal(nextStatus({ status: 'READY', fulfillmentType: 'delivery', delivery: { provider: 'AHAMOVE' } }), undefined);
  assert.equal(nextStatus({ status: 'CANCELLED' }), undefined);
});

test('customer cancels only their own pending order; staff reject flags paid orders for refund', async () => {
  const { ops, docs } = fixture();
  const { id } = await ops.createCash('customer', 'cash-key-0000000004', { checkout: checkout() });
  await assert.rejects(ops.cancel('other', id), status(404));
  assert.equal((await ops.cancel('customer', id)).status, 'CANCELLED');
  await assert.rejects(ops.cancel('customer', id), status(409));

  const paid = await ops.createCash('customer', 'cash-key-0000000005', { checkout: checkout() });
  docs.set(`orders/${paid.id}`, { ...docs.get(`orders/${paid.id}`)!, paymentStatus: 'PAID' });
  await ops.advance('staff', paid.id);
  await assert.rejects(ops.cancel('customer', paid.id), status(409));
  await assert.rejects(ops.reject('customer', paid.id, 'Hết bột'), status(403));
  await ops.reject('staff', paid.id, 'Hết bột');
  const order = docs.get(`orders/${paid.id}`)!;
  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.paymentStatus, 'REFUND_PENDING');
  assert.equal(docs.get('users/customer')!.rewardPoints, 5);
});

test('phone login verifies the password server-side and never reveals whether a number exists', async () => {
  const users = [{ id: 'uid-1', data: () => ({ email: 'a@b.vn', phone: '0900000000' }) }];
  const db = { collection: () => ({ where: (_f: string, _op: string, forms: string[]) => ({ limit: () => ({
    get: async () => ({ docs: users.filter(u => forms.includes(u.data().phone)) }) }) }) }) } as unknown as Parameters<typeof phoneLogin>[0]['db'];
  const calls: string[] = [];
  const deps = { db, apiKey: 'k', createCustomToken: async (uid: string) => `token-${uid}`,
    fetch: (async (_url: string, init: RequestInit) => {
      const { password } = JSON.parse(init.body as string);
      calls.push(password);
      return new Response(JSON.stringify(password === 'right' ? { localId: 'uid-1' } : { error: {} }), { status: password === 'right' ? 200 : 400 });
    }) as typeof fetch };
  assert.deepEqual(await phoneLogin(deps, '+84 900 000 000', 'right'), { token: 'token-uid-1' });
  const wrong = await phoneLogin(deps, '0900000000', 'wrong').catch(e => e);
  const unknown = await phoneLogin(deps, '0911111111', 'right').catch(e => e);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.message, unknown.message);
  assert.deepEqual(calls, ['right', 'wrong']);
});
