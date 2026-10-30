import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactError, normalizePhone } from '../../src/utils/contact';
import { estimatedWindow } from '../../src/utils/orderTime';
import { payosCheckout } from '../../src/utils/payosCheckout';
import { formatCurrency } from '../../src/utils/formatCurrency';

test('Vietnamese phone numbers normalize to the 0xxxxxxxxx form', () => {
  assert.equal(normalizePhone('+84 912.345-678'), '0912345678');
  assert.equal(normalizePhone('84912345678'), '0912345678');
  assert.equal(normalizePhone('0912345678'), '0912345678');
});

test('contact validation accepts real numbers and explains the rest', () => {
  assert.equal(contactError('phone', '0912345678'), '');
  assert.notEqual(contactError('phone', '12345'), '');
  assert.notEqual(contactError('fullname', '   '), '');
  assert.equal(contactError('email', ''), '');
  assert.equal(contactError('email', 'a@b.vn'), '');
  assert.notEqual(contactError('email', 'not-an-email'), '');
});

test('a scheduled delivery time is shown as the customer chose it', () => {
  assert.equal(estimatedWindow({ deliveryTime: 'Hôm nay 19:30', createdAt: '2026-10-30T10:00:00Z' }), 'Hôm nay 19:30');
});

test('soonest orders get a 30-45 minute window from the order time, or fall back without a timestamp', () => {
  const placed = Date.parse('2026-10-30T10:00:00Z');
  const text = estimatedWindow({ deliveryTime: 'Sớm nhất', createdAt: { seconds: placed / 1000 } });
  assert.match(text, /\(dự kiến\)$/);
  assert.equal(estimatedWindow({ deliveryTime: 'Sớm nhất' }), 'Sớm nhất');
  assert.equal(estimatedWindow({}), 'Sớm nhất');
});

test('payOS checkout payload is trimmed and numbers its lines', () => {
  const body = payosCheckout({
    customer: { fullname: '  An ', phone: '0912 345.678', email: ' ' }, fulfillmentType: 'PICKUP', promoCode: ' pizza10 ',
    items: [{ productId: 'PZ001' }, { productId: 'PZ002' }],
  } as any);
  assert.equal(body.customer.fullname, 'An');
  assert.equal(body.customer.phone, '0912345678');
  assert.ok(!('email' in body.customer));
  assert.equal(body.promoCode, 'PIZZA10');
  assert.deepEqual(body.items.map(item => item.lineId), ['line-1', 'line-2']);
  assert.ok(!('address' in body));
});

test('currency formatting handles bad numbers', () => {
  assert.match(formatCurrency(125000), /125\.000/);
  assert.match(formatCurrency(NaN), /^0/);
});
