import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AhamoveClient, type AhaConfig, type AhaOrder, type AhaPayload } from '../src/ahamove';
import { DeliveryStore, deliveryUpdate, validateQuote, verifyAhaWebhook, safeAhaUrl, type StoredQuote } from '../src/delivery';
import { OrderOpsStore } from '../src/orders';
import { database } from './fakeDb';
import { OrderStore } from '../src/store';
import { checkoutSchema, HttpError, type Checkout } from '../src/domain';
import { readAhamoveConfig } from '../src/config';
import type { Delivery } from '../../src/types/delivery';
import type { PayOS } from '@payos/node';
import { createPaymentServer } from '../src/app';

const config: AhaConfig = { apiKey: 'staging-key', mobile: '84900000000', serviceId: 'SGN-BIKE', webhookSecret: 'a'.repeat(32),
  pickup: { address: '8/15 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM', name: 'Demo', mobile: '0900000000' }, staffUids: ['staff'] };
const checkout: Checkout = checkoutSchema.parse({ customer: { fullname: 'Test', phone: '0900000000' }, fulfillmentType: 'DELIVERY',
  address: '8 Thủ Khoa Huân, Bến Thành, Quận 1, TP.HCM', deliveryNote: 'Gọi trước',
  items: [{ lineId: 'line-1', productId: 'pizza', addonIds: [], quantity: 1 }] });
const initial: Delivery = { provider: 'AHAMOVE', environment: 'staging', serviceId: 'SGN-BIKE', status: 'NOT_REQUESTED', quotedFee: 25000 };
const detail = (id: string, status = 'ASSIGNING', point = ''): AhaOrder => ({ _id: 'AHA123', status,
  path: [{}, { tracking_number: id, status: point }], total_fee: 27000 });

async function fixture(method: 'COD' | 'PAYOS' = 'COD') {
  const { db, docs } = database();
  let creates = 0;
  let payload: AhaPayload | undefined;
  let providerOrder: AhaOrder | null = null;
  let timeout = false;
  const provider = {
    estimate: async () => ({ total_fee: 25000 }),
    create: async (input: AhaPayload) => { creates++; payload = input; providerOrder = detail(input.path[1].tracking_number!); if (timeout) throw new HttpError(502, 'Timeout'); return providerOrder; },
    find: async () => providerOrder,
    get: async () => providerOrder!,
  } as unknown as AhamoveClient;
  const store = new DeliveryStore(db, config, provider);
  const ops = new OrderOpsStore(db, ['staff']);
  const quote = await store.quote('customer', { checkout, paymentMethod: method });
  return { store, ops, db, docs, quote, creates: () => creates, payload: () => payload!,
    restart: () => new DeliveryStore(db, config, provider),
    timeout: () => { timeout = true; }, detail: (value: AhaOrder) => { providerOrder = value; } };
}

test('quote is scoped to checkout, owner, method, expiry and one order', async () => {
  const f = await fixture();
  const quote = f.docs.get(`delivery_quotes/${f.quote.id}`) as StoredQuote;
  assert.equal(f.quote.pricing.total, 125000);
  assert.equal(f.quote.pricing.deliveryFee, 25000);
  for (const [uid, input, method, id, now] of [
    ['other', checkout, 'COD', 'id', Date.now()],
    ['customer', { ...checkout, address: 'Changed address' }, 'COD', 'id', Date.now()],
    ['customer', checkout, 'PAYOS', 'id', Date.now()],
    ['customer', checkout, 'COD', 'id', Date.parse(quote.expiresAt)],
  ] as const) assert.throws(() => validateQuote(quote, uid, input, method, id, now));
  assert.throws(() => validateQuote({ ...quote, orderId: 'old' }, 'customer', checkout, 'COD', 'new'));
});

test('COD retry creates one backend-priced order and rejects a reused key for another quote', async () => {
  const f = await fixture();
  const first = await f.store.createCod('customer', 'cod-idempotency-key', f.quote.id);
  const quote = f.docs.get(`delivery_quotes/${f.quote.id}`)!;
  quote.expiresAt = '2000-01-01T00:00:00Z';
  assert.deepEqual(await f.store.createCod('customer', 'cod-idempotency-key', f.quote.id), first);
  const next = await f.store.quote('customer', { checkout, paymentMethod: 'COD' });
  await assert.rejects(() => f.store.createCod('customer', 'cod-idempotency-key', next.id), /Idempotency-Key/);
  assert.equal(f.docs.get(`orders/${first.id}`)!.total, 125000);
  assert.equal(f.creates(), 0, 'checkout must not book a driver');
  await assert.rejects(() => f.store.createCod('other', 'another-key', f.quote.id), /báo phí/);
});

test('payOS reserves the quoted total, publishes shipment metadata, and retries after expiry', async () => {
  const f = await fixture('PAYOS');
  const payments = new OrderStore(f.db, true);
  await assert.rejects(() => payments.reserve('customer', 'payment-key', checkout), /báo phí/);
  const order = await payments.reserve('customer', 'payment-key', { ...checkout, deliveryQuoteId: f.quote.id });
  assert.equal(order.total, 125000);
  f.docs.get(`delivery_quotes/${f.quote.id}`)!.expiresAt = '2000-01-01T00:00:00Z';
  assert.equal((await payments.reserve('customer', 'payment-key', order.checkout)).id, order.id);
  await payments.pay({ orderCode: order.orderCode, amount: 125000, paymentLinkId: 'link', reference: 'bank' });
  const fulfillment = f.docs.get(`orders/${order.id}`)!;
  assert.equal(fulfillment.deliveryQuoteId, f.quote.id);
  assert.equal((fulfillment.delivery as Delivery).quotedFee, 25000);
  await f.ops.advance('staff', order.id); await f.ops.advance('staff', order.id); await f.ops.advance('staff', order.id);
  await f.store.dispatch('staff', order.id);
  assert.equal(f.payload().path[1].cod, 0);
});

test('dispatch enforces staff/READY; timeout survives restart and never repeats booking POST', async () => {
  const f = await fixture();
  const order = await f.store.createCod('customer', 'cod-key', f.quote.id);
  await assert.rejects(() => f.store.dispatch('customer', order.id), /quyền/);
  await assert.rejects(() => f.store.dispatch('staff', order.id), /sẵn sàng/);
  for (let i = 0; i < 3; i++) await f.ops.advance('staff', order.id);
  f.timeout();
  await assert.rejects(() => f.store.dispatch('staff', order.id), /Timeout/);
  assert.equal(f.payload().payment_method, 'BALANCE');
  assert.equal(f.payload().path[1].cod, 125000);
  const restarted = f.restart();
  const resumed = await restarted.dispatch('staff', order.id);
  assert.equal(resumed.delivery.status, 'SEARCHING');
  await restarted.dispatch('staff', order.id);
  assert.equal(f.creates(), 1);
  f.detail(detail(order.id, 'COMPLETED', 'FAILED'));
  const failed = await f.store.refresh('customer', order.id);
  assert.equal(failed.delivery.status, 'FAILED');
  assert.notEqual(failed.status, 'COMPLETED');
  await assert.rejects(() => f.store.refresh('other', order.id), /Không tìm/);
});

test('callback uses current provider data; successful drop-off completes once, without claiming COD settlement', async () => {
  const f = await fixture();
  const order = await f.store.createCod('customer', 'cod-key', f.quote.id);
  for (let i = 0; i < 3; i++) await f.ops.advance('staff', order.id);
  await f.store.dispatch('staff', order.id);
  f.detail(detail(order.id, 'IN PROCESS'));
  await f.store.webhook({ _id: 'AHA123', status: 'CANCELLED' });
  assert.equal(f.docs.get(`orders/${order.id}`)!.status, 'OUT_FOR_DELIVERY');
  f.detail(detail(order.id, 'COMPLETED', 'COMPLETED'));
  await f.store.webhook({ _id: 'AHA123-1' });
  const first = f.docs.get(`orders/${order.id}`)!;
  assert.equal(first.status, 'COMPLETED');
  assert.equal(first.codCollectionStatus, 'COLLECTED_STAGING');
  assert.equal(first.paymentStatus, 'UNPAID');
  await f.store.webhook({ _id: 'AHA123' });
  assert.deepEqual(f.docs.get(`orders/${order.id}`)!.statusHistory, first.statusHistory);
});

test('catalog price change rejects a stale quote before COD or payOS is persisted', async () => {
  for (const method of ['COD', 'PAYOS'] as const) {
    const f = await fixture(method);
    f.docs.get('products/pizza')!.basePrice = 120000;
    if (method === 'COD') await assert.rejects(() => f.store.createCod('customer', 'cod-key', f.quote.id), /Giá món/);
    else await assert.rejects(() => new OrderStore(f.db, true).reserve('customer', 'payos-key', { ...checkout, deliveryQuoteId: f.quote.id }), /Giá món/);
    assert.equal([...f.docs.keys()].some(key => key.startsWith('orders/') || key.startsWith('payment_orders/')), false);
  }
});

test('a cancelled carrier trip leaves the food order available for staff handling', async () => {
  const f = await fixture();
  const order = await f.store.createCod('customer', 'cod-key', f.quote.id);
  for (let i = 0; i < 3; i++) await f.ops.advance('staff', order.id);
  await f.store.dispatch('staff', order.id);
  f.detail(detail(order.id, 'CANCELLED'));
  const result = await f.store.refresh('staff', order.id);
  assert.equal(result.delivery.status, 'CANCELLED');
  assert.equal(result.status, 'READY');
  await f.store.dispatch('staff', order.id);
  assert.equal(f.creates(), 1);
});

test('delivery status and webhook boundaries reject false completion, regressions and unsafe links', () => {
  assert.equal(deliveryUpdate(initial, detail('id', 'ACCEPTED')).status, 'ASSIGNED');
  assert.equal(deliveryUpdate(initial, detail('id', 'COMPLETED', 'FAILED')).status, 'FAILED');
  const picked = deliveryUpdate(initial, detail('id', 'IN PROCESS'));
  assert.equal(deliveryUpdate(picked, detail('id')).status, 'PICKED_UP');
  const delivered = deliveryUpdate(picked, detail('id', 'COMPLETED', 'COMPLETED'));
  assert.equal(deliveryUpdate(delivered, detail('id', 'CANCELLED')), delivered);
  assert.equal(safeAhaUrl('javascript:alert(1)'), undefined);
  assert.equal(safeAhaUrl('https://expressstg.ahamove.com.evil.test/x'), undefined);
  assert.equal(verifyAhaWebhook(undefined, config.webhookSecret), false);
  assert.equal(verifyAhaWebhook('Bearer wrong', config.webhookSecret), false);
  assert.equal(verifyAhaWebhook(`Bearer ${config.webhookSecret}`, config.webhookSecret), true);
});

test('Ahamove client uses v3 staging contracts, caches token, and never retries a booking POST', async () => {
  const calls: { url: string; body: Record<string, unknown>; authorization: string | null }[] = [];
  const client = new AhamoveClient(config, (async (url, options) => {
    const path = String(url);
    calls.push({ url: path, body: JSON.parse(String(options?.body ?? '{}')), authorization: new Headers(options?.headers).get('Authorization') });
    if (path.endsWith('/token')) return Response.json({ token: 'test-token' });
    if (path.endsWith('/estimates')) return Response.json([{ service_id: 'SGN-BIKE', data: { total_fee: 25000 } }]);
    if (path.endsWith('/orders')) throw new Error('network timeout after create');
    throw new Error('Unexpected request');
  }) as typeof fetch);
  const payload: AhaPayload = { order_time: 0, path: [{ ...config.pickup }, { ...config.pickup, tracking_number: 'id', cod: 0 }], service_id: 'SGN-BIKE', requests: [], payment_method: 'BALANCE', remarks: 'Pizza' };
  assert.equal((await client.estimate(payload)).total_fee, 25000);
  await assert.rejects(() => client.create(payload), /Ahamove/);
  assert.equal(calls.filter(call => call.url.endsWith('/token')).length, 1);
  assert.equal(calls.filter(call => call.url.endsWith('/orders')).length, 1);
  assert.ok(calls.every(call => call.url.startsWith('https://partner-apistg.ahamove.com/v3/')));
  assert.deepEqual(calls[1].body.services, [{ _id: 'SGN-BIKE', requests: [] }]);
  assert.equal(calls[1].authorization, 'Bearer test-token');
});

test('Ahamove configuration is opt-in and defaults to a real HCM demo address', () => {
  assert.equal(readAhamoveConfig({}), undefined);
  assert.throws(() => readAhamoveConfig({ AHAMOVE_ENABLED: 'true' }), /AHAMOVE_API_KEY/);
  const value = readAhamoveConfig({ AHAMOVE_ENABLED: 'true', AHAMOVE_API_KEY: 'key', AHAMOVE_ACCOUNT_MOBILE: '84900000000',
    AHAMOVE_SERVICE_ID: 'SGN-BIKE', AHAMOVE_WEBHOOK_SECRET: 'a'.repeat(32), AHAMOVE_STAFF_UIDS: 'staff', AHAMOVE_DEMO_STORE_ID: 'demo-ben-thanh' });
  assert.match(value!.pickup.address, /8 Thủ Khoa Huân/);
});

test('HTTP delivery endpoints enforce auth, strict pricing inputs, staff rights and webhook credentials', async t => {
  const f = await fixture();
  const app = createPaymentServer({ delivery: f.store, orders: f.ops, store: new OrderStore(f.db, true),
    payos: {} as Pick<PayOS, 'paymentRequests' | 'webhooks'>,
    verifyToken: async token => {
      if (!['customer', 'staff', 'other'].includes(token)) throw new Error('Invalid token');
      return { uid: token, exp: Math.floor(Date.now() / 1000) + 3600 };
    }, origins: ['http://localhost:8081'], returnUrl: 'https://example.com/return', cancelUrl: 'https://example.com/cancel' });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => app.io.close(() => resolve())));
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown, token = 'customer') => fetch(base + path, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'http-cod-test-key-123' }, body: JSON.stringify(body),
  });
  assert.equal((await post('/api/delivery/quotes', { checkout, paymentMethod: 'COD' }, 'invalid')).status, 401);
  assert.equal((await post('/api/delivery/quotes', { checkout: { ...checkout, total: 1 }, paymentMethod: 'COD' })).status, 400);
  const quoteResponse = await post('/api/delivery/quotes', { checkout, paymentMethod: 'COD' });
  assert.equal(quoteResponse.status, 200);
  const quote = await quoteResponse.json();
  assert.equal(quote.pricing.total, 125000);
  assert.equal((await post('/api/delivery/orders', { quoteId: quote.id, total: 1 })).status, 400);
  assert.equal((await post('/api/delivery/orders', { quoteId: quote.id }, 'other')).status, 404);
  const response = await post('/api/delivery/orders', { quoteId: quote.id });
  assert.equal(response.status, 200);
  const order = await response.json();
  assert.equal((await post(`/api/delivery/orders/${order.id}/dispatch`, {})).status, 403);
  assert.equal((await post(`/api/delivery/orders/${order.id}/dispatch`, {}, 'staff')).status, 409);
  assert.equal((await post('/api/webhooks/ahamove', { _id: 'AHA123' })).status, 401);
  for (let i = 0; i < 3; i++) assert.equal((await post(`/api/staff/orders/${order.id}/advance`, {}, 'staff')).status, 200);
  assert.equal((await post(`/api/delivery/orders/${order.id}/dispatch`, {}, 'staff')).status, 200);
  f.detail(detail(order.id, 'COMPLETED', 'COMPLETED'));
  assert.equal((await post('/api/webhooks/ahamove', { _id: 'AHA123' }, config.webhookSecret)).status, 200);
  assert.equal(f.docs.get(`orders/${order.id}`)!.status, 'COMPLETED');
});
