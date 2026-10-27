import { createHash } from 'node:crypto';
import { z } from 'zod';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../src/utils/calculateTotals';
import { PIZZA_CRUSTS, PIZZA_SAUCES, PIZZA_TOPPINGS, MAX_TOPPINGS_COUNT, isCustomizablePizza } from '../../src/types/pizzaCustomization';
import type { Product } from '../../src/types/product';
import type { Delivery } from '../../src/types/delivery';
import type { Coupon } from '../../src/types/user';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
const identifier = z.string().min(1).max(100).regex(/^[\w-]+$/);
const customization = z.object({
  sizeId: z.enum(['small', 'medium', 'large']),
  crustId: identifier, sauceId: identifier, hasExtraSauce: z.boolean(),
  toppings: z.array(z.object({ id: identifier, quantity: z.number().int().min(1).max(5) }).strict()).max(MAX_TOPPINGS_COUNT),
  spiceLevel: z.enum(['none', 'mild', 'medium', 'hot']),
  bakingPreference: z.enum(['standard', 'crispy']),
  cutPreference: z.enum(['6-slices', '8-slices', 'no-cut']),
  removedIngredients: z.array(z.string().max(100)).max(30),
  specialInstructions: z.string().max(500).optional(),
}).strict();
export const checkoutSchema = z.object({
  customer: z.object({ fullname: z.string().trim().min(1).max(100), phone: z.string().regex(/^\+?[0-9]{9,15}$/), email: z.email().optional() }).strict(),
  fulfillmentType: z.enum(['DELIVERY', 'PICKUP']),
  needCutlery: z.boolean().optional(),
  address: z.string().trim().min(1).max(500).optional(),
  deliveryNote: z.string().trim().max(500).optional(),
  deliveryQuoteId: z.string().uuid().optional(),
  items: z.array(z.object({
    lineId: identifier, productId: identifier, variantId: identifier.optional(),
    addonIds: z.array(identifier).max(20), quantity: z.number().int().min(1).max(50),
    specialInstructions: z.string().max(500).optional(), customization: customization.optional(),
  }).strict()).min(1).max(50),
}).strict().refine(x => x.fulfillmentType !== 'DELIVERY' || !!x.address, 'Delivery address required');
export type Checkout = z.infer<typeof checkoutSchema>;
export type PaymentLink = { paymentLinkId: string; checkoutUrl: string; qrCode: string | null };
export type PaymentOrder = {
  id: string; userId: string; fingerprint: string; orderCode: number;
  createdAt: string; paymentStatus: 'PENDING' | 'PAID'; paidAt?: string;
  reference?: string; payment?: PaymentLink; total: number;
  checkout: Checkout; pricing: ReturnType<typeof calculateOrderTotals>;
  delivery?: Delivery;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number; variantName?: string }[];
};
export function orderIdentity(uid: string, key: string, checkout: Checkout) {
  return { id: createHash('sha256').update(JSON.stringify([uid, key])).digest('hex'),
    fingerprint: createHash('sha256').update(JSON.stringify(checkout)).digest('hex') };
}
export function priceCheckout(checkout: Checkout, products: Product[], coupon?: Coupon) {
  const map = Object.fromEntries(products.map(p => [p.id, p]));
  for (const item of checkout.items) {
    const p = map[item.productId];
    if (!p?.isAvailable || !Number.isSafeInteger(p.basePrice) || p.basePrice < 0) throw new HttpError(422, 'Product unavailable');
    if (p.variants?.length && !item.variantId) throw new HttpError(422, 'Variant required');
    if (item.variantId && !p.variants?.some(v => v.id === item.variantId)) throw new HttpError(422, 'Invalid variant');
    if (new Set(item.addonIds).size !== item.addonIds.length || item.addonIds.some(id => !p.addons?.some(a => a.id === id))) throw new HttpError(422, 'Invalid addons');
    const c = item.customization;
    if (c && (!isCustomizablePizza(p) || c.sizeId !== item.variantId || !PIZZA_CRUSTS.some(v => v.id === c.crustId && v.supportedSizes.includes(c.sizeId)) ||
      !PIZZA_SAUCES.some(v => v.id === c.sauceId) || new Set(c.toppings.map(t => t.id)).size !== c.toppings.length ||
      c.toppings.reduce((sum, t) => sum + t.quantity, 0) > MAX_TOPPINGS_COUNT ||
      c.toppings.some(t => !PIZZA_TOPPINGS.some(v => v.id === t.id)) || c.removedIngredients.some(v => !p.ingredients?.includes(v)))) throw new HttpError(422, 'Invalid customization');
    const price = getItemLineUnitPrice(item, p);
    if (!Number.isSafeInteger(price) || price < 0) throw new HttpError(422, 'Invalid catalog price');
  }
  const pricing = calculateOrderTotals(checkout.items, map, checkout.fulfillmentType, coupon);
  if (!Number.isSafeInteger(pricing.total) || pricing.total < 1 || pricing.total > 50000000) throw new HttpError(422, 'Invalid order total');
  return { pricing, items: checkout.items.map(item => {
    const product = map[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product);
    return { productId: item.productId, productName: product.name, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity,
      variantName: product.variants?.find(v => v.id === item.variantId)?.name ?? '' };
  }) };
}
export type PaidData = { orderCode: number; amount: number; paymentLinkId: string; reference: string };
export function settle(order: PaymentOrder, data: PaidData): PaymentOrder {
  if (order.orderCode !== data.orderCode || order.total !== data.amount ||
      (order.payment && order.payment.paymentLinkId !== data.paymentLinkId)) throw new HttpError(409, 'Payment does not match order');
  if (order.paymentStatus === 'PAID') return order;
  return { ...order, paymentStatus: 'PAID', paidAt: new Date().toISOString(), reference: data.reference };
}
export function publicOrder(order: PaymentOrder) {
  return { id: order.id, orderCode: order.orderCode, paymentStatus: order.paymentStatus,
    total: order.total, pricing: order.pricing, items: order.items,
    createdAt: order.createdAt, paidAt: order.paidAt ?? null, payment: order.payment ?? null };
}

// Publish a fulfilment order only after the payment transaction has settled.
export function paidFulfillmentOrder(order: PaymentOrder) {
  if (order.paymentStatus !== 'PAID') throw new HttpError(409, 'Payment is not settled');
  return {
    orderCode: String(order.orderCode), userId: order.userId,
    customer: order.checkout.customer, address: order.checkout.address ?? '',
    fulfillmentType: order.checkout.fulfillmentType === 'DELIVERY' ? 'delivery' : 'takeaway',
    needCutlery: order.checkout.needCutlery ?? false,
    deliveryNote: order.checkout.deliveryNote ?? '',
    ...(order.delivery ? { delivery: order.delivery, deliveryQuoteId: order.checkout.deliveryQuoteId } : {}),
    paymentMethod: 'payos', paymentName: 'payOS', paymentStatus: 'PAID',
    paymentOrderId: order.id, paidAt: order.paidAt, reference: order.reference,
    status: 'PENDING_CONFIRMATION',
    statusHistory: [{ status: 'PENDING_CONFIRMATION', at: order.paidAt, note: 'Đã xác nhận thanh toán payOS' }],
    items: order.items.map((item, index) => ({ ...item,
      addonIds: order.checkout.items[index]?.addonIds ?? [],
      customization: order.checkout.items[index]?.customization ?? null,
      note: order.checkout.items[index]?.specialInstructions ?? '',
    })),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    ...order.pricing,
  };
}
