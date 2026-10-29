import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../src/store';
import { OrderOpsStore } from '../src/orders';
import { checkoutSchema, HttpError } from '../src/domain';
import { DeliveryStore } from '../src/delivery';
import { database } from './fakeDb';
import { mockProducts } from '../../src/data/mockProducts';
import { isCustomizablePizza, PIZZA_CRUSTS, PIZZA_SAUCES, PIZZA_TOPPINGS } from '../../src/types/pizzaCustomization';
import { payosCheckout } from '../../src/utils/payosCheckout';
import type { CreateOrderInput } from '../../src/services/contracts';
import type { AhamoveClient, AhaConfig } from '../src/ahamove';

const pizza = mockProducts.find(product => product.isAvailable && isCustomizablePizza(product))!;
const product = { ...pizza, addons: [{ id: 'test-cheese', name: 'Phô mai thêm', price: 10000 }] };
const sizeId = product.variants[0].id as 'small' | 'medium' | 'large';
const input: CreateOrderInput = {
  customer: { fullname: 'Test Customer', phone: '0900000000' }, fulfillmentType: 'PICKUP', paymentMethod: 'PAYOS',
  deliveryTime: '19:30 • 28/10/2026', deliveryNote: 'Gọi trước khi đến',
  items: [{ lineId: 'line-original', productId: product.id, variantId: sizeId, addonIds: ['test-cheese'], quantity: 1,
    specialInstructions: 'Không hành', customization: {
      sizeId, crustId: PIZZA_CRUSTS.find(crust => crust.supportedSizes.includes(sizeId))!.id,
      sauceId: PIZZA_SAUCES[0].id, hasExtraSauce: true, toppings: [{ id: PIZZA_TOPPINGS[0].id, quantity: 2 }],
      spiceLevel: 'mild', bakingPreference: 'crispy', cutPreference: 'no-cut', removedIngredients: [], specialInstructions: 'Để sốt riêng',
    } }],
};
function assertKitchenDetails(item: Record<string, unknown>) {
  assert.deepEqual(item.customization, input.items[0].customization);
  assert.deepEqual(item.addonNames, ['Phô mai thêm']);
  assert.deepEqual(item.addonIds, ['test-cheese']);
  assert.match(String(item.note), /Không hành/);
  assert.match(String(item.note), /Để sốt riêng/);
  assert.ok((item.customizationSummary as string[]).some(part => part.includes('x2')));
  assert.ok((item.customizationSummary as string[]).includes('Thêm sốt'));
}

test('cash order preserves the paid pizza options and cooking notes in its kitchen snapshot', async () => {
  const { db, docs } = database({ [product.id]: product });
  const ops = new OrderOpsStore(db, ['staff']);
  const checkout = checkoutSchema.parse(payosCheckout(input));
  const order = await ops.createCash('customer', 'cash-details-regression-001', { checkout, deliveryTime: input.deliveryTime });
  assertKitchenDetails((docs.get(`orders/${order.id}`)!.items as Record<string, unknown>[])[0]);
});

test('payOS payload, reservation and paid fulfillment retain schedule, notes and options; retries stay safe', async () => {
  const { db, docs } = database({ [product.id]: product });
  const store = new OrderStore(db);
  const checkout = checkoutSchema.parse(payosCheckout(input));
  assert.equal(checkout.deliveryTime, input.deliveryTime);
  assert.equal(checkout.deliveryNote, input.deliveryNote);
  const payment = await store.reserve('customer', 'payos-details-regression-001', checkout);
  assertKitchenDetails(payment.items[0]);
  assert.equal((await store.reserve('customer', 'payos-details-regression-001', checkout)).id, payment.id);
  await assert.rejects(store.reserve('customer', 'payos-details-regression-001', { ...checkout, deliveryTime: '20:30' }),
    error => error instanceof HttpError && error.status === 409);
  await store.pay({ orderCode: payment.orderCode, paymentLinkId: 'test-link', amount: payment.total, reference: 'test-bank' });
  const order = docs.get(`orders/${payment.id}`)!;
  assert.equal(order.deliveryTime, input.deliveryTime);
  assert.equal(order.deliveryNote, input.deliveryNote);
  assertKitchenDetails((order.items as Record<string, unknown>[])[0]);
});

test('ordinary delivery payOS keeps notes without an Ahamove quote, and legacy payloads still parse', () => {
  const body = payosCheckout({ ...input, fulfillmentType: 'DELIVERY', address: '1 Lê Lợi, TP.HCM' });
  assert.equal(checkoutSchema.parse(body).deliveryNote, input.deliveryNote);
  assert.equal('deliveryQuoteId' in body, false);
  const { deliveryTime: _time, deliveryNote: _note, ...legacy } = body;
  assert.equal(checkoutSchema.safeParse(legacy).success, true);
  assert.equal(checkoutSchema.safeParse({ ...body, deliveryTime: 'x'.repeat(101) }).success, false);
  assert.equal(checkoutSchema.parse(payosCheckout({ ...input, promoCode: ' fpt40 ' })).promoCode, 'FPT40');
});

test('Ahamove quote and COD use the same rich kitchen snapshot without booking a driver', async () => {
  const { db, docs } = database({ [product.id]: product });
  const config: AhaConfig = { apiKey: 'test', mobile: '84900000000', serviceId: 'SGN-BIKE', webhookSecret: 'a'.repeat(32),
    pickup: { address: '8/15 Lê Thánh Tôn, Quận 1, TP.HCM', name: 'Test', mobile: '0900000000' }, staffUids: ['staff'] };
  const provider = { estimate: async () => ({ total_fee: 25000 }) } as unknown as AhamoveClient;
  const delivery = new DeliveryStore(db, config, provider);
  const { deliveryTime: _time, ...noSchedule } = input;
  const checkout = checkoutSchema.parse(payosCheckout({ ...noSchedule, fulfillmentType: 'DELIVERY', address: '1 Lê Lợi, Quận 1, TP.HCM' }));
  const quote = await delivery.quote('customer', { checkout, paymentMethod: 'COD' });
  const order = await delivery.createCod('customer', 'ahamove-details-regression-001', quote.id);
  assertKitchenDetails((docs.get(`orders/${order.id}`)!.items as Record<string, unknown>[])[0]);
  // The same checkout serializer must continue to match a PAYOS quote exactly.
  const paymentQuote = await delivery.quote('customer', { checkout, paymentMethod: 'PAYOS' });
  const store = new OrderStore(db, true);
  const payment = await store.reserve('customer', 'ahamove-payos-regression-001', { ...checkout, deliveryQuoteId: paymentQuote.id });
  assert.equal(payment.total, paymentQuote.pricing.total);
});
