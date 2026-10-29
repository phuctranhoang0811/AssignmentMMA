import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderOpsStore, nextStatus, findCoupon, isBlocked } from '../src/orders';
import { checkoutSchema, HttpError, priceCheckout } from '../src/domain';
import { mockProducts } from '../../src/data/mockProducts';
import { database } from './fakeDb';
import { phoneLogin } from '../src/phoneLogin';
import { OtpStore } from '../src/otp';
import { isCustomizablePizza, PIZZA_TOPPINGS } from '../../src/types/pizzaCustomization';
import { mergeStored } from '../../src/utils/catalogMerge';
import { isCouponExpired } from '../../src/utils/coupons';
import { normalizePhone } from '../../src/utils/phone';

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
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => undefined }) }),
    where: (_f: string, _op: string, forms: string[]) => ({ limit: () => ({
    get: async () => ({ docs: users.filter(u => forms.includes(u.data().phone)) }) }) }) }) } as unknown as Parameters<typeof phoneLogin>[0]['db'];
  const calls: string[] = [];
  const deps = { db, apiKey: 'k', createCustomToken: async (uid: string) => `token-${uid}`,
    fetch: (async (_url: string, init: RequestInit) => {
      const { password } = JSON.parse(init.body as string);
      calls.push(password);
      return new Response(JSON.stringify(password === 'right' ? { localId: 'uid-1' } : { error: {} }), { status: password === 'right' ? 200 : 400 });
    }) as typeof fetch };
  assert.deepEqual(await phoneLogin(deps, '+84 900 000 000', 'right'), { token: 'token-uid-1' });
  users.push({ id: 'uid-2', data: () => ({ email: 'c@d.vn', phone: '0911 222 333' }) });
  const spaced = await phoneLogin(deps, '0911 222 333', 'wrong').catch(e => e);
  assert.equal(calls.at(-1), 'wrong'); // stored with spaces is still found (password then checked)
  assert.equal(spaced.status, 401);
  const wrong = await phoneLogin(deps, '0900000000', 'wrong').catch(e => e);
  const unknown = await phoneLogin(deps, '0911111111', 'right').catch(e => e);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.message, unknown.message);
  assert.deepEqual(calls, ['right', 'wrong', 'wrong']);
});

test('OTP is generated and checked on the server: expiry, wrong code, attempt limit, single use', async () => {
  let now = 0;
  const sent: string[] = [];
  const otp = new OtpStore(async (_to, code) => { sent.push(code); }, () => now);
  await otp.start('A@B.vn');
  assert.match(sent[0], /^\d{4}$/);
  await assert.rejects(otp.start('a@b.vn'), status(429));
  const wrong = sent[0] === '0000' ? '1111' : '0000';
  assert.throws(() => otp.verify('a@b.vn', wrong), status(400));
  otp.verify('a@b.vn', sent[0]);
  assert.throws(() => otp.verify('a@b.vn', sent[0]), status(410));

  now += 31_000;
  await otp.start('a@b.vn');
  for (let i = 0; i < 5; i++) assert.throws(() => otp.verify('a@b.vn', sent[1] === '0000' ? '1111' : '0000'), status(400));
  assert.throws(() => otp.verify('a@b.vn', sent[1]), status(429));

  now += 31_000;
  await otp.start('a@b.vn');
  now += 5 * 60_000 + 1;
  assert.throws(() => otp.verify('a@b.vn', sent[2]), status(410));
});

test('pizza builder applies only to real pizzas: combos in the pizza category are ordered without it', async () => {
  const combo = { name: 'Combo', categoryId: 'pizza', basePrice: 300000, addons: [], isAvailable: true,
    variants: [{ id: 'pep', name: 'Pepperoni', price: 300000 }] };
  const { db } = database({ combo });
  const ops = new OrderOpsStore(db, ['staff']);
  const item = { lineId: 'line-1', productId: 'combo', variantId: 'pep', addonIds: [], quantity: 1 };
  const plain = checkoutSchema.parse({ customer: { fullname: 'K', phone: '0900000000' }, fulfillmentType: 'PICKUP', items: [item] });
  assert.ok((await ops.createCash('customer', 'cash-key-combo-0001', { checkout: plain })).id);
  const built = checkoutSchema.parse({ ...plain, items: [{ ...item, variantId: 'pep', customization: { sizeId: 'medium',
    crustId: 'classic-hand-tossed', sauceId: 'classic-tomato', hasExtraSauce: false, toppings: [], spiceLevel: 'none',
    bakingPreference: 'standard', cutPreference: '6-slices', removedIngredients: [] } }] });
  await assert.rejects(ops.createCash('customer', 'cash-key-combo-0002', { checkout: built }), status(422));
  assert.equal(isCustomizablePizza({ categoryId: 'pizza', variants: [{ id: 'small' }, { id: 'large' }] }), true);
  assert.equal(isCustomizablePizza({ categoryId: 'pizza', variants: [] }), false);
});

test('pizza toppings: the backend counts portions (max 5 in total), which the builder UI now enforces', () => {
  const pizza = mockProducts.find(p => p.id === 'PZ001')!;
  const [a, b] = PIZZA_TOPPINGS;
  const order = (toppings: { id: string; quantity: number }[]) => checkoutSchema.parse({
    customer: { fullname: 'K', phone: '0900000000' }, fulfillmentType: 'PICKUP',
    items: [{ lineId: 'line-1', productId: 'PZ001', variantId: 'medium', addonIds: [], quantity: 1, customization: {
      sizeId: 'medium', crustId: 'classic-hand-tossed', sauceId: 'classic-tomato', hasExtraSauce: false, toppings,
      spiceLevel: 'none', bakingPreference: 'standard', cutPreference: '6-slices', removedIngredients: [] } }] });
  assert.ok(priceCheckout(order([{ id: a.id, quantity: 3 }, { id: b.id, quantity: 2 }]), [pizza]).pricing.total > 0);
  assert.throws(() => priceCheckout(order([{ id: a.id, quantity: 3 }, { id: b.id, quantity: 3 }]), [pizza]), status(422));
});

test('staff access: an env UID or a staff role stored in Firestore; a customer is still refused', async () => {
  const { ops, docs } = fixture();
  docs.set('users/manager', { role: 'STORE_MANAGER' });
  const { id } = await ops.createCash('customer', 'cash-key-0000000006', { checkout: checkout() });
  assert.equal((await ops.advance('manager', id)).status, 'CONFIRMED');
  assert.equal((await ops.advance('staff', id)).status, 'PREPARING');
  await assert.rejects(ops.advance('customer', id), status(403));
  await assert.rejects(ops.reject('nobody', id, 'x'), status(403));
});

test('only an admin marks a refund, and only for an order waiting for one', async () => {
  const { ops, docs } = fixture();
  docs.set('users/admin', { role: 'SUPER_ADMIN' });
  const { id } = await ops.createCash('customer', 'cash-key-0000000007', { checkout: checkout() });
  await assert.rejects(ops.markRefunded('admin', id), status(409));
  docs.set(`orders/${id}`, { ...docs.get(`orders/${id}`)!, paymentStatus: 'PAID' });
  await ops.reject('admin', id, 'Hết bột');
  await assert.rejects(ops.markRefunded('staff', id), status(403));
  assert.equal((await ops.markRefunded('admin', id)).paymentStatus, 'REFUNDED');
  assert.equal(docs.get(`orders/${id}`)!.paymentStatus, 'REFUNDED');
});

test('coupons made in the admin portal are priced by the server; built-in ones still work', async () => {
  const { ops, docs } = fixture();
  docs.set('coupons/ADMIN50K', { discountType: 'FIXED', value: 50000, minSubtotal: 100000, description: 'Admin' });
  const { id } = await ops.createCash('customer', 'cash-key-0000000008', { checkout: checkout(), promoCode: 'admin50k' });
  assert.equal(docs.get(`orders/${id}`)!.discount, 50000);
  assert.equal((await findCoupon((ops as unknown as { db: Parameters<typeof findCoupon>[0] }).db, 'pizza20'))?.code, 'PIZZA20');
  await assert.rejects(ops.createCash('customer', 'cash-key-0000000009', { checkout: checkout(), promoCode: 'NOPE' }), status(422));
});

test('only the BLACKLISTED role counts as locked', async () => {
  const { db, docs } = database({});
  docs.set('users/bad', { role: 'BLACKLISTED' });
  docs.set('users/good', { role: 'USER' });
  assert.equal(await isBlocked(db, 'bad'), true);
  assert.equal(await isBlocked(db, 'good'), false);
  assert.equal(await isBlocked(db, 'missing'), false);
});

test('app catalog: Firestore wins, admin-only items are kept, deleted products disappear once a catalog exists', () => {
  const key = (item: { id: string }) => item.id;
  const bundled = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }];
  const stored = new Map([['b', { id: 'b', price: 20 }], ['new', { id: 'new', price: 5 }]]);
  assert.deepEqual(mergeStored(bundled, stored, key, true), [{ id: 'b', price: 20 }, { id: 'new', price: 5 }]);
  assert.deepEqual(mergeStored(bundled, stored, key, false).map(key), ['a', 'b', 'new']);
  assert.deepEqual(mergeStored(bundled, new Map(), key, true), bundled); // not seeded / offline
});

test('cash is marked paid when the order completes; cancelled cash orders stay unpaid', async () => {
  const { ops, docs } = fixture();
  const { id } = await ops.createCash('customer', 'cash-key-0000000010', { checkout: checkout() });
  for (let i = 0; i < 3; i++) await ops.advance('staff', id);
  assert.equal(docs.get(`orders/${id}`)!.paymentStatus, 'UNPAID'); // READY: not handed over yet
  await ops.advance('staff', id);
  assert.equal(docs.get(`orders/${id}`)!.status, 'COMPLETED');
  assert.equal(docs.get(`orders/${id}`)!.paymentStatus, 'PAID');
  const other = await ops.createCash('customer', 'cash-key-0000000011', { checkout: checkout() });
  await ops.cancel('customer', other.id);
  assert.equal(docs.get(`orders/${other.id}`)!.paymentStatus, 'UNPAID');
});

test('customers see Vietnamese errors naming the product when an item can no longer be ordered', () => {
  const soldOut = { ...mockProducts.find(p => p.id === 'PZ001')!, isAvailable: false };
  const order = checkoutSchema.parse({ customer: { fullname: 'K', phone: '0900000000' }, fulfillmentType: 'PICKUP',
    items: [{ lineId: 'line-1', productId: 'PZ001', variantId: 'medium', addonIds: [], quantity: 1 }] });
  assert.throws(() => priceCheckout(order, [soldOut]), (e: unknown) => e instanceof HttpError && e.status === 422
    && e.message.includes(soldOut.name) && e.message.includes('hết'));
  assert.throws(() => priceCheckout({ ...order, items: [{ ...order.items[0], variantId: 'xl' }] }, [{ ...soldOut, isAvailable: true }]),
    (e: unknown) => e instanceof HttpError && /Size/.test(e.message));
});

test('a voucher is used once per customer; cancelling the order gives it back', async () => {
  const { ops, docs } = fixture();
  const first = await ops.createCash('customer', 'cash-key-0000000020', { checkout: checkout(), promoCode: 'PIZZA20' });
  await assert.rejects(ops.createCash('customer', 'cash-key-0000000021', { checkout: checkout(), promoCode: 'PIZZA20' }),
    (e: unknown) => e instanceof HttpError && e.status === 409 && /đã dùng mã PIZZA20/.test(e.message));
  assert.ok((await ops.createCash('other', 'cash-key-0000000022', { checkout: checkout(), promoCode: 'PIZZA20' })).id);
  await ops.cancel('customer', first.id);
  assert.equal(docs.has('coupon_usages/PIZZA20_customer'), false);
  assert.ok((await ops.createCash('customer', 'cash-key-0000000023', { checkout: checkout(), promoCode: 'PIZZA20' })).id);
});

test('admin coupons stop at their total limit and reopen when a use is cancelled; expired codes are refused', async () => {
  const { ops, docs } = fixture();
  docs.set('coupons/ONLY2', { discountType: 'FIXED', value: 10000, minSubtotal: 0, description: 'x', usageLimit: 2, usedCount: 0 });
  const a = await ops.createCash('u1', 'cash-key-0000000030', { checkout: checkout(), promoCode: 'ONLY2' });
  await ops.createCash('u2', 'cash-key-0000000031', { checkout: checkout(), promoCode: 'ONLY2' });
  assert.equal(docs.get('coupons/ONLY2')!.usedCount, 2);
  await assert.rejects(ops.createCash('u3', 'cash-key-0000000032', { checkout: checkout(), promoCode: 'ONLY2' }),
    (e: unknown) => e instanceof HttpError && /hết lượt/.test(e.message));
  await ops.cancel('u1', a.id);
  assert.equal(docs.get('coupons/ONLY2')!.usedCount, 1);
  assert.ok((await ops.createCash('u3', 'cash-key-0000000033', { checkout: checkout(), promoCode: 'ONLY2' })).id);

  docs.set('coupons/OLD', { discountType: 'FIXED', value: 10000, minSubtotal: 0, description: 'x', expiresAt: '01/01/2020' });
  await assert.rejects(ops.createCash('u4', 'cash-key-0000000034', { checkout: checkout(), promoCode: 'OLD' }),
    (e: unknown) => e instanceof HttpError && e.status === 422 && /hết hạn/.test(e.message));
});

test('WELCOME30 only applies to a first order; a cancelled earlier order does not count', async () => {
  const { ops } = fixture();
  const earlier = await ops.createCash('newbie', 'cash-key-0000000040', { checkout: checkout() });
  await assert.rejects(ops.createCash('newbie', 'cash-key-0000000041', { checkout: checkout(), promoCode: 'WELCOME30' }),
    (e: unknown) => e instanceof HttpError && /đơn hàng đầu tiên/.test(e.message));
  await ops.cancel('newbie', earlier.id);
  assert.ok((await ops.createCash('newbie', 'cash-key-0000000042', { checkout: checkout(), promoCode: 'WELCOME30' })).id);
});

test('coupon end dates: dd/mm/yyyy lasts through that day in Vietnam time', () => {
  const end = Date.UTC(2026, 11, 31, 16, 59, 59, 999); // 31/12/2026 23:59:59.999 +07:00
  assert.equal(isCouponExpired({ expiresAt: '31/12/2026' }, end), false);
  assert.equal(isCouponExpired({ expiresAt: '31/12/2026' }, end + 1), true);
  assert.equal(isCouponExpired({}, end), false);
  assert.equal(isCouponExpired({ expiresAt: 'không rõ' }, end), false);
});

test('phone login: a number shared by older profiles still signs in its real owner; the claimed owner is tried first', async () => {
  const { db, docs } = database();
  docs.set('users/squatter', { email: 'squatter@x.vn', phone: '0912345678' });
  docs.set('users/owner', { email: 'owner@x.vn', phone: '+84912345678' });
  const passwords: Record<string, string> = { 'squatter@x.vn': 'pw-squatter', 'owner@x.vn': 'pw-owner' };
  const uids: Record<string, string> = { 'squatter@x.vn': 'squatter', 'owner@x.vn': 'owner' };
  const tried: string[] = [];
  const users = { where: (field: string, _op: string, forms: string[]) => ({ limit: () => ({ get: async () => ({
    docs: [...docs].filter(([path, data]) => path.startsWith('users/') && forms.includes(data[field] as string))
      .map(([path, data]) => ({ id: path.slice(6), data: () => data })) }) }) }) };
  const deps = { apiKey: 'k', createCustomToken: async (uid: string) => `token-${uid}`,
    db: { collection: (name: string) => name === 'users' ? { ...users, doc: (id: string) => db.collection('users').doc(id) } : db.collection(name) } as unknown as typeof db,
    fetch: (async (_url: string, init: RequestInit) => {
      const { email, password } = JSON.parse(init.body as string);
      tried.push(email);
      const ok = passwords[email] === password;
      return new Response(JSON.stringify(ok ? { localId: uids[email] } : { error: {} }), { status: ok ? 200 : 400 });
    }) as typeof fetch };
  assert.deepEqual(await phoneLogin(deps, '0912345678', 'pw-owner'), { token: 'token-owner' });
  docs.set('phone_numbers/0912345678', { uid: 'owner' });
  tried.length = 0;
  assert.deepEqual(await phoneLogin(deps, '+84912345678', 'pw-owner'), { token: 'token-owner' });
  assert.deepEqual(tried, ['owner@x.vn']);
  assert.equal((await phoneLogin(deps, '0912345678', 'nope').catch(e => e)).status, 401);
});

test('phone numbers have one spelling: 10 digits starting with 0', () => {
  assert.equal(normalizePhone('+84 912 345 678'), '0912345678');
  assert.equal(normalizePhone('0912.345.678'), '0912345678');
  assert.equal(normalizePhone('84912345678'), '0912345678');
  assert.equal(normalizePhone('12345'), '');
});
