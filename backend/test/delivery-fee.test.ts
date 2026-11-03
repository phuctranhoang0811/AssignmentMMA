import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderOpsStore } from '../src/orders';
import { StoreSettingsStore, storeSettingsInput } from '../src/storeSettings';
import { checkoutSchema, HttpError } from '../src/domain';
import { deliveryFeeQuote, parseDeliveryFeeConfig, roadDistanceKm, type DeliveryFeeConfig } from '../../src/utils/deliveryFee';
import { database } from './fakeDb';

const config: DeliveryFeeConfig = { storeLat: 10.8, storeLng: 106.8, baseKm: 3, baseFee: 15000, perKm: 5000, maxKm: 10, freeOver: 500000 };
const at = (km: number) => ({ lat: 10.8 + km / 111.2, lng: 106.8 }); // km due north, straight line
const sized = { name: 'Pizza Size', categoryId: 'pizza', basePrice: 100000, addons: [], isAvailable: true,
  variants: [{ id: 'medium', name: 'Cỡ Vừa', price: 200000 }] };
const checkout = (extra: Record<string, unknown> = {}, quantity = 2, fulfillmentType: 'DELIVERY' | 'PICKUP' = 'DELIVERY') => checkoutSchema.parse({
  customer: { fullname: 'Khách', phone: '0900000000' }, fulfillmentType, address: '1 Lê Lợi, Quận 1', ...extra,
  items: [{ lineId: 'line-1', productId: 'sized', variantId: 'medium', addonIds: [], quantity }] });
const code = (value: string) => (error: unknown) => error instanceof HttpError && error.code === value;

function fixture(shipping: DeliveryFeeConfig | null = config) {
  const { db, docs } = database({ sized });
  docs.set('users/admin', { role: 'ADMIN' });
  return { docs, db, ops: new OrderOpsStore(db, [], () => {}, async () => shipping ?? undefined) };
}

test('distance is a rounded-up road estimate and the fee grows by every started km past the base', () => {
  assert.equal(roadDistanceKm({ lat: 10.8, lng: 106.8 }, { lat: 10.8, lng: 106.8 }), 0);
  const near = deliveryFeeQuote(config, at(1), 100000);
  assert.deepEqual([near.fee, near.outOfRange, near.free], [15000, false, false]);
  const far = deliveryFeeQuote(config, at(5), 100000); // ≈6.5 km road → 4 started km beyond the base
  assert.equal(far.fee, 15000 + 4 * 5000);
  assert.ok(far.distanceKm > 6 && far.distanceKm < 7);
  assert.equal(deliveryFeeQuote(config, at(9), 100000).outOfRange, true);
});

test('free above the order value or with a free-shipping voucher; incomplete config means no fee at all', () => {
  assert.equal(deliveryFeeQuote(config, at(5), 500000).fee, 0);
  assert.equal(deliveryFeeQuote(config, at(5), 100000, true).fee, 0);
  assert.equal(parseDeliveryFeeConfig({ storeLat: 1 }), undefined);
  assert.equal(parseDeliveryFeeConfig(undefined), undefined);
  const { freeOver: _unused, ...withoutFreeOver } = config;
  assert.deepEqual(parseDeliveryFeeConfig({ ...config, freeOver: 0 }), withoutFreeOver);
});

test('a delivery order is priced by the server: food + shipping, with the distance kept for review', async () => {
  const { ops, docs } = fixture();
  const result = await ops.createCash('customer', 'ship-key-00000001', { checkout: checkout({ deliveryLocation: at(5) }, 1) });
  const order = docs.get(`orders/${result.id}`)!;
  assert.equal(order.subtotal, 200000);
  assert.equal(order.deliveryFee, 35000);
  assert.equal(order.total, 235000);
  assert.equal(result.deliveryFee, 35000);
  assert.equal(result.total, 235000);
  assert.ok((order.deliveryDistanceKm as number) > 6);
  // Same key again returns the same priced order.
  assert.deepEqual(await ops.createCash('customer', 'ship-key-00000001', { checkout: checkout({ deliveryLocation: at(5) }, 1) }), result);
});

test('large orders ship free; pickup never pays shipping', async () => {
  const { ops, docs } = fixture();
  const free = await ops.createCash('customer', 'ship-key-00000002', { checkout: checkout({ deliveryLocation: at(5) }, 3) });
  assert.equal(docs.get(`orders/${free.id}`)!.deliveryFee, 0);
  const pickup = await ops.createCash('customer', 'ship-key-00000003', { checkout: checkout({}, 1, 'PICKUP') });
  assert.equal(docs.get(`orders/${pickup.id}`)!.deliveryFee, 0);
  assert.equal(docs.get(`orders/${pickup.id}`)!.total, 200000);
});

test('no location or an address too far away is refused with a clear code', async () => {
  const { ops } = fixture();
  await assert.rejects(ops.createCash('customer', 'ship-key-00000004', { checkout: checkout() }), code('DELIVERY_LOCATION_REQUIRED'));
  await assert.rejects(ops.createCash('customer', 'ship-key-00000005', { checkout: checkout({ deliveryLocation: at(20) }) }), code('OUT_OF_DELIVERY_RANGE'));
});

test('until the store sets a price list, delivery costs nothing extra and needs no location', async () => {
  const { ops, docs } = fixture(null);
  const result = await ops.createCash('customer', 'ship-key-00000006', { checkout: checkout() });
  assert.equal(docs.get(`orders/${result.id}`)!.deliveryFee, 0);
  assert.equal(docs.get(`orders/${result.id}`)!.total, 400000);
});

test('saved store settings, including the price list, are read back after an admin saves them', async () => {
  const { db } = fixture();
  const input = { acceptingOrders: false, openTime: '09:00', closeTime: '22:00', closedMessage: 'Nghỉ lễ', delivery: config };
  await new StoreSettingsStore(db).update('admin', input);
  // A fresh instance (no cache) must see the saved values, not the open-all-day default.
  const saved = await new StoreSettingsStore(db).get();
  assert.equal(saved.acceptingOrders, false);
  assert.deepEqual(saved.delivery, config);
  assert.equal(storeSettingsInput.safeParse(input).success, true);
  // The maximum distance can't be shorter than the base-fee distance.
  assert.equal(storeSettingsInput.safeParse({ ...input, delivery: { ...config, maxKm: 1 } }).success, false);
});

test('the rider is paid for the distance even when the customer ships free', async () => {
  const { ops, docs } = fixture();
  const paid = await ops.createCash('customer', 'ship-key-00000007', { checkout: checkout({ deliveryLocation: at(5) }, 1) });
  const free = await ops.createCash('customer', 'ship-key-00000008', { checkout: checkout({ deliveryLocation: at(5) }, 3) });
  assert.equal(docs.get(`orders/${paid.id}`)!.riderPay, 35000);
  assert.equal(docs.get(`orders/${free.id}`)!.deliveryFee, 0);
  assert.equal(docs.get(`orders/${free.id}`)!.riderPay, 35000);
  const pickup = await ops.createCash('customer', 'ship-key-00000009', { checkout: checkout({}, 1, 'PICKUP') });
  assert.equal(docs.get(`orders/${pickup.id}`)!.riderPay, undefined);
  assert.equal(deliveryFeeQuote(config, at(5), 100000, true).riderPay, 35000);
});

test('a free-shipping voucher only works from its minimum order value', async () => {
  const { ops, docs } = fixture();
  const code = 'FREESHIP';
  const small = await ops.createCash('customer', 'ship-key-00000010', { checkout: checkout({ deliveryLocation: at(5), promoCode: code }, 1) });
  assert.equal(docs.get(`orders/${small.id}`)!.deliveryFee, 0); // FREESHIP has no minimum
  docs.set('coupons/BIGSHIP', { discountType: 'FIXED', value: 0, minSubtotal: 300000, freeShipping: true });
  const below = await ops.createCash('c2', 'ship-key-00000011', { checkout: checkout({ deliveryLocation: at(5), promoCode: 'BIGSHIP' }, 1) });
  assert.equal(docs.get(`orders/${below.id}`)!.deliveryFee, 35000);
  const above = await ops.createCash('c3', 'ship-key-00000012', { checkout: checkout({ deliveryLocation: at(5), promoCode: 'BIGSHIP' }, 2) });
  assert.equal(docs.get(`orders/${above.id}`)!.deliveryFee, 0);
});
