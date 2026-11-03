import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotals } from '../../src/utils/calculateTotals';
import { canEditCartProduct, replaceCartItem } from '../../src/utils/cartOperations';
import { generateCartLineKey } from '../../src/utils/cartLineKey';
import { getDeliverySlots, isDeliveryTimeAvailable, formatDeliveryTime } from '../../src/utils/deliveryTime';
import { mockCoupons } from '../../src/data/mockPromotions';
import type { Product } from '../../src/types/product';
import type { CartItem } from '../../src/types/order';

const product: Product = { id: 'pizza', name: 'Pizza', categoryId: 'pizza', basePrice: 249000,
  description: '', image: '', variants: [], addons: [], isAvailable: true };
const line: CartItem = { lineId: generateCartLineKey('pizza', undefined, []), productId: 'pizza', addonIds: [], quantity: 2 };

test('review regression: 498000 cart with FPT40 remains 458000 at checkout', () => {
  const totals = calculateOrderTotals([line], { pizza: product }, 'DELIVERY', mockCoupons.find(c => c.code === 'FPT40'));
  assert.deepEqual(totals, { subtotal: 498000, discount: 40000, deliveryFee: 0, tax: 0, total: 458000 });
});

test('delivery fees stay disabled for delivery, pickup, and vouchers', () => {
  const price = (subtotal: number, mode: 'DELIVERY' | 'PICKUP', code?: string) =>
    calculateOrderTotals([{ ...line, quantity: 1 }], { pizza: { ...product, basePrice: subtotal } }, mode, mockCoupons.find(c => c.code === code));
  assert.equal(price(299999, 'DELIVERY').deliveryFee, 0);
  assert.equal(price(100000, 'DELIVERY').total, 100000);
  assert.equal(price(300000, 'DELIVERY').deliveryFee, 0);
  assert.equal(price(100000, 'PICKUP').total, 100000);
  assert.equal(price(100000, 'DELIVERY', 'FREESHIP').total, 100000);
  assert.equal(price(100000, 'PICKUP', 'FREESHIP').total, 100000);
  assert.equal(price(199999, 'DELIVERY', 'FPT40').discount, 0);
  assert.equal(price(200000, 'DELIVERY', 'FPT40').total, 160000);
  assert.equal(calculateOrderTotals([], { pizza: product }).total, 0);
});

test('editing replaces one cart line and preserves quantity and options', () => {
  const edited = { ...line, specialInstructions: 'Ít cay' };
  const updated = replaceCartItem([line], line.lineId, edited);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].quantity, 2);
  assert.equal(updated[0].specialInstructions, 'Ít cay');
  assert.notEqual(updated[0].lineId, line.lineId);
  const duplicate = { ...edited, lineId: updated[0].lineId, quantity: 3 };
  assert.equal(replaceCartItem([line, duplicate], line.lineId, edited)[0].quantity, 5);
  const original = [line, { ...duplicate, quantity: 20 }];
  assert.equal(replaceCartItem(original, line.lineId, edited), original);
});

test('receipt slots follow Vietnam hours, lead time, and roll to the next day', () => {
  const now = new Date('2026-10-27T13:50:00Z'); // 20:50 Vietnam; earliest slot is tomorrow.
  const slots = getDeliverySlots(now);
  assert.equal(slots[0].value, '2026-10-28T03:30:00.000Z');
  assert.match(slots[0].dayLabel, /Ngày mai/);
  assert.ok(slots.every(slot => Date.parse(slot.value) >= now.getTime() + 45 * 60000));
  assert.ok(slots.every(slot => slot.time >= '10:30' && slot.time <= '21:30'));
  assert.equal(isDeliveryTimeAvailable('2026-10-27T03:30:00.000Z', now), false);
  assert.equal(isDeliveryTimeAvailable('asap', now), true);
  assert.match(formatDeliveryTime('asap', now), /10:30.*Ngày mai/);
});


test('cart hides edit for every drink and fixed item, retaining configured food editing', () => {
  assert.equal(canEditCartProduct(undefined), false);
  assert.equal(canEditCartProduct({ ...product, categoryId: 'drinks' }), false);
  assert.equal(canEditCartProduct({ ...product, categoryId: 'drinks', variants: [{ id: 'large', name: 'Lớn', price: 30000 }] }), false);
  assert.equal(canEditCartProduct({ ...product, categoryId: 'starters' }), false);
  assert.equal(canEditCartProduct({ ...product, variants: [{ id: 'large', name: 'Lớn', price: 30000 }] }), true);
  assert.equal(canEditCartProduct({ ...product, categoryId: 'pasta', addons: [{ id: 'cheese', name: 'Phô mai', price: 10000 }] }), true);
});
