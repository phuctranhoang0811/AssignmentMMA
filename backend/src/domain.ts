import { createHash } from 'node:crypto';
import { z } from 'zod';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../src/utils/calculateTotals';
import { PIZZA_CRUSTS, PIZZA_SAUCES, PIZZA_TOPPINGS, MAX_TOPPINGS_COUNT, isCustomizablePizza, formatCustomizationSummary } from '../../src/types/pizzaCustomization';
import type { OrderItemSnapshot } from '../../src/types/order';
import type { Product } from '../../src/types/product';
import type { Delivery } from '../../src/types/delivery';
import type { Coupon } from '../../src/types/user';
import type { DeliveryFeeConfig } from '../../src/utils/deliveryFee';

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
  deliveryTime: z.string().trim().min(1).max(100).optional(),
  promoCode: z.string().trim().min(1).max(30).optional(),
  deliveryQuoteId: z.string().uuid().optional(),
  // Where the customer picked the address; the shipping fee is the distance from the store to here.
  deliveryLocation: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict().optional(),
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
  deliveryDistanceKm?: number;
  riderPay?: number;
  items: OrderItemSnapshot[];
};
export function orderIdentity(uid: string, key: string, checkout: Checkout) {
  return { id: createHash('sha256').update(JSON.stringify([uid, key])).digest('hex'),
    fingerprint: createHash('sha256').update(JSON.stringify(checkout)).digest('hex') };
}
export function priceCheckout(checkout: Checkout, products: Product[], coupon?: Coupon, shipping?: DeliveryFeeConfig) {
  const map = Object.fromEntries(products.map(p => [p.id, p]));
  for (const item of checkout.items) {
    const p = map[item.productId];
    if (!p?.isAvailable || !Number.isSafeInteger(p.basePrice) || p.basePrice < 0) throw new HttpError(422, `Món "${p?.name ?? item.productId}" hiện đã hết hoặc ngừng bán. Vui lòng xóa khỏi giỏ.`);
    if (p.variants?.length && !item.variantId) throw new HttpError(422, `Vui lòng chọn size cho món "${p.name}".`);
    if (item.variantId && !p.variants?.some(v => v.id === item.variantId)) throw new HttpError(422, `Size đã chọn của món "${p.name}" không còn. Vui lòng chọn lại.`);
    if (new Set(item.addonIds).size !== item.addonIds.length || item.addonIds.some(id => !p.addons?.some(a => a.id === id))) throw new HttpError(422, `Món thêm của "${p.name}" không còn. Vui lòng chọn lại.`);
    const c = item.customization;
    if (c && (!isCustomizablePizza(p) || c.sizeId !== item.variantId || !PIZZA_CRUSTS.some(v => v.id === c.crustId && v.supportedSizes.includes(c.sizeId)) ||
      !PIZZA_SAUCES.some(v => v.id === c.sauceId) || new Set(c.toppings.map(t => t.id)).size !== c.toppings.length ||
      c.toppings.reduce((sum, t) => sum + t.quantity, 0) > MAX_TOPPINGS_COUNT ||
      c.toppings.some(t => !PIZZA_TOPPINGS.some(v => v.id === t.id)) || c.removedIngredients.some(v => !p.ingredients?.includes(v)))) throw new HttpError(422, `Tùy chọn pizza "${p.name}" không hợp lệ. Vui lòng chỉnh lại món.`);
    const price = getItemLineUnitPrice(item, p);
    if (!Number.isSafeInteger(price) || price < 0) throw new HttpError(422, `Giá món "${p.name}" đang lỗi. Vui lòng thử lại sau.`);
  }
  // shortcut: the coordinates come from the app (the address the customer picked); the server only range-checks them.
  // Someone forging them could shave their own fee, so the distance is stored on the order for review.
  if (shipping && checkout.fulfillmentType === 'DELIVERY' && !checkout.deliveryLocation) {
    throw new HttpError(422, 'Chưa xác định được vị trí giao hàng. Vui lòng chọn lại địa chỉ.', 'DELIVERY_LOCATION_REQUIRED');
  }
  const { outOfRange, deliveryDistanceKm, riderPay, ...pricing } = calculateOrderTotals(checkout.items, map, checkout.fulfillmentType, coupon, undefined,
    shipping && checkout.deliveryLocation ? { config: shipping, to: checkout.deliveryLocation } : undefined);
  if (outOfRange) throw new HttpError(422, `Địa chỉ nằm ngoài vùng giao hàng (tối đa ${shipping!.maxKm} km từ cửa hàng).`, 'OUT_OF_DELIVERY_RANGE');
  if (!Number.isSafeInteger(pricing.total) || pricing.total < 1 || pricing.total > 50000000) throw new HttpError(422, 'Tổng đơn hàng không hợp lệ.');
  return { pricing, ...(deliveryDistanceKm !== undefined ? { deliveryDistanceKm, riderPay } : {}), items: checkout.items.map(item => {
    const product = map[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product);
    return { productId: item.productId, productName: product.name, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity,
      variantName: product.variants?.find(v => v.id === item.variantId)?.name ?? '',
      addonIds: item.addonIds, addonNames: item.addonIds.map(id => product.addons.find(addon => addon.id === id)!.name),
      customization: item.customization ?? null,
      customizationSummary: formatCustomizationSummary(item.customization),
      note: [item.specialInstructions, item.customization?.specialInstructions].filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index).join(' • '),
    };
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
    deliveryTime: order.checkout.deliveryTime ?? (order.delivery ? 'Giao ngay khi món sẵn sàng' : 'Sớm nhất'),
    ...(order.delivery ? { delivery: order.delivery, deliveryQuoteId: order.checkout.deliveryQuoteId } : {}),
    ...(order.deliveryDistanceKm !== undefined ? { deliveryDistanceKm: order.deliveryDistanceKm, riderPay: order.riderPay ?? 0, deliveryLocation: order.checkout.deliveryLocation } : {}),
    paymentMethod: 'payos', paymentName: 'payOS', paymentStatus: 'PAID',
    voucherCode: order.checkout.promoCode?.toUpperCase() ?? null,
    paymentOrderId: order.id, paidAt: order.paidAt, reference: order.reference,
    status: 'PENDING_CONFIRMATION',
    statusHistory: [{ status: 'PENDING_CONFIRMATION', at: order.paidAt, note: 'Đã xác nhận thanh toán payOS' }],
    items: order.items.map((item, index) => ({ ...item,
      addonIds: order.checkout.items[index]?.addonIds ?? [],
      customization: order.checkout.items[index]?.customization ?? null,
      customizationSummary: item.customizationSummary ?? formatCustomizationSummary(order.checkout.items[index]?.customization),
      note: item.note ?? order.checkout.items[index]?.specialInstructions ?? '',
    })),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    ...order.pricing,
  };
}
