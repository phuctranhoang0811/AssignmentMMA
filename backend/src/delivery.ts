import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { AhamoveClient, type AhaConfig, type AhaOrder, type AhaPayload } from './ahamove';
import { checkoutSchema, HttpError, orderIdentity, priceCheckout, type Checkout } from './domain';
import { transition } from './orders';
import type { Product } from '../../src/types/product';
import type { Delivery, DeliveryQuote, DeliveryStatus } from '../../src/types/delivery';

export const deliveryQuoteInput = z.object({ checkout: checkoutSchema, paymentMethod: z.enum(['COD', 'PAYOS']) }).strict();
export type StoredQuote = DeliveryQuote & {
  userId: string; checkout: Checkout; paymentMethod: 'COD' | 'PAYOS'; delivery: Delivery; orderId?: string;
  pickupMobile: string;
};
export function validateQuote(quote: StoredQuote | undefined, uid: string, checkout: Checkout,
  method: 'COD' | 'PAYOS', id: string, now = Date.now()) {
  const { deliveryQuoteId: _id, ...input } = checkout;
  if (!quote || quote.userId !== uid || quote.paymentMethod !== method ||
    JSON.stringify(quote.checkout) !== JSON.stringify(input)) throw new HttpError(409, 'Báo phí không khớp đơn hàng. Vui lòng lấy lại phí.');
  if (quote.orderId && quote.orderId !== id) throw new HttpError(409, 'Báo phí đã được dùng cho đơn khác.');
  if (Date.parse(quote.expiresAt) <= now) throw new HttpError(409, 'Báo phí đã hết hạn. Vui lòng lấy lại phí.', 'DELIVERY_QUOTE_EXPIRED');
  return quote;
}
export function deliveryUpdate(previous: Delivery, order: AhaOrder): Delivery {
  let status: DeliveryStatus;
  if (order.status === 'COMPLETED') status = order.path.length === 2 && order.path[1].status === 'COMPLETED' ? 'DELIVERED' : 'FAILED';
  else if (order.status === 'CANCELLED') status = 'CANCELLED';
  else if (order.status === 'IN PROCESS') status = 'PICKED_UP';
  else if (order.status === 'ACCEPTED') status = 'ASSIGNED';
  else if (['ASSIGNING', 'IDLE', 'CONFIRMING', 'PAYING'].includes(order.status)) status = 'SEARCHING';
  else throw new HttpError(502, 'Trạng thái Ahamove chưa được hỗ trợ.');
  const terminal = ['DELIVERED', 'FAILED', 'CANCELLED'];
  if (terminal.includes(previous.status) || (previous.status === 'PICKED_UP' && ['SEARCHING', 'ASSIGNED'].includes(status))) return previous;
  const trackingUrl = safeAhaUrl(order.shared_link);
  return { ...previous, status, providerOrderId: order._id, providerStatus: order.status,
    ...(trackingUrl ? { trackingUrl } : {}), ...(order.supplier_name ? { driverName: order.supplier_name } : {}),
    ...(order.supplier_mobile && /^\+?\d{9,15}$/.test(order.supplier_mobile) ? { driverPhone: order.supplier_mobile } : {}),
    ...(Number.isSafeInteger(order.total_fee) && order.total_fee! >= 0 ? { actualFee: order.total_fee } : {}),
    updatedAt: new Date().toISOString() };
}
export function safeAhaUrl(value?: string) {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && ['expressstg.ahamove.com', 'express.ahamove.com'].includes(url.hostname) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
export function verifyAhaWebhook(header: string | undefined, secret: string) {
  const actual = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class DeliveryStore {
  constructor(private db: Firestore, readonly config: AhaConfig, private provider = new AhamoveClient(config)) {}
  private payload(checkout: Checkout, cod: number, tracking: string): AhaPayload {
    return { order_time: 0, service_id: this.config.serviceId, requests: [], payment_method: 'BALANCE',
      path: [{ ...this.config.pickup }, { address: checkout.address!, name: checkout.customer.fullname,
        mobile: checkout.customer.phone, cod, tracking_number: tracking, remarks: checkout.deliveryNote ?? '' }],
      remarks: 'Pizza - thực phẩm chế biến, giữ hộp nằm ngang. Gọi người nhận trước khi giao.' };
  }
  async quote(uid: string, input: z.infer<typeof deliveryQuoteInput>) {
    if (input.checkout.fulfillmentType !== 'DELIVERY' || input.checkout.deliveryQuoteId) throw new HttpError(400, 'Chỉ báo phí cho đơn giao hàng mới.');
    const refs = [...new Set(input.checkout.items.map(item => item.productId))].map(id => this.db.collection('products').doc(id));
    const products = await this.db.getAll(...refs);
    const { pricing } = priceCheckout(input.checkout, products.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id }) as Product));
    const fee = await this.provider.estimate(this.payload(input.checkout, input.paymentMethod === 'COD' ? pricing.total : 0, `QUOTE-${randomUUID()}`));
    if (pricing.total + fee.total_fee > 50_000_000) throw new HttpError(422, 'Tổng đơn vượt hạn mức của ứng dụng.');
    const id = randomUUID();
    const quote: StoredQuote = { id, userId: uid, checkout: input.checkout, paymentMethod: input.paymentMethod,
      provider: 'AHAMOVE', environment: 'staging', expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      pickupName: this.config.pickup.name, pickupAddress: this.config.pickup.address,
      pickupMobile: this.config.pickup.mobile,
      pricing: { ...pricing, deliveryFee: fee.total_fee, total: pricing.total + fee.total_fee },
      delivery: { provider: 'AHAMOVE', environment: 'staging', serviceId: this.config.serviceId, status: 'NOT_REQUESTED', quotedFee: fee.total_fee } };
    await this.db.collection('delivery_quotes').doc(id).create(quote);
    return { id, expiresAt: quote.expiresAt, provider: quote.provider, environment: quote.environment,
      pricing: quote.pricing, pickupName: quote.pickupName, pickupAddress: quote.pickupAddress } satisfies DeliveryQuote;
  }
  async createCod(uid: string, key: string, quoteId: string) {
    const quoteRef = this.db.collection('delivery_quotes').doc(quoteId);
    return this.db.runTransaction(async tx => {
      const quote = (await tx.get(quoteRef)).data() as StoredQuote | undefined;
      if (!quote || quote.userId !== uid) throw new HttpError(404, 'Không tìm thấy báo phí.');
      const checkout = { ...quote.checkout, deliveryQuoteId: quoteId };
      const { id, fingerprint } = orderIdentity(uid, `COD-${key}`, checkout);
      const ref = this.db.collection('orders').doc(id);
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.checkoutFingerprint !== fingerprint) throw new HttpError(409, 'Idempotency-Key đã dùng cho đơn khác.');
        return { id, orderCode: existing.data()!.orderCode };
      }
      validateQuote(quote, uid, checkout, 'COD', id);
      const refs = [...new Set(checkout.items.map(item => item.productId))].map(productId => this.db.collection('products').doc(productId));
      const products = await tx.getAll(...refs);
      const priced = priceCheckout(checkout, products.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id }) as Product));
      if (priced.pricing.total !== quote.pricing.subtotal) throw new HttpError(409, 'Giá món đã thay đổi. Vui lòng lấy lại phí.');
      const orderCode = `AHA-${id.slice(0, 12).toUpperCase()}`;
      const now = new Date().toISOString();
      tx.create(ref, { orderCode, checkoutFingerprint: fingerprint, userId: uid, customer: checkout.customer,
        address: checkout.address, deliveryNote: checkout.deliveryNote ?? '', fulfillmentType: 'delivery',
        needCutlery: checkout.needCutlery ?? false, createdAt: Timestamp.now(), deliveryTime: 'Giao ngay khi món sẵn sàng',
        paymentMethod: 'cash', paymentName: 'Tiền mặt', paymentStatus: 'UNPAID',
        status: 'PENDING_CONFIRMATION', statusHistory: [{ status: 'PENDING_CONFIRMATION', at: now }],
        items: priced.items, itemCount: priced.items.reduce((sum, item) => sum + item.quantity, 0),
        ...quote.pricing, delivery: quote.delivery, deliveryQuoteId: quoteId });
      tx.update(quoteRef, { orderId: id });
      return { id, orderCode };
    });
  }
  assertStaff(uid: string) {
    if (!this.config.staffUids.includes(uid)) throw new HttpError(403, 'Tài khoản chưa được cấp quyền vận hành giao hàng.');
  }
  async list(uid: string) {
    this.assertStaff(uid);
    const result = await this.db.collection('orders').where('delivery.provider', '==', 'AHAMOVE').orderBy('createdAt', 'desc').limit(50).get();
    return result.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  }
  async dispatch(uid: string, id: string) {
    this.assertStaff(uid);
    const ref = this.db.collection('orders').doc(id);
    const operation = this.db.collection('delivery_operations').doc(id);
    const claim = await this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      const old = await tx.get(operation);
      if (!order?.delivery || order.delivery.provider !== 'AHAMOVE') throw new HttpError(404, 'Không tìm thấy đơn Ahamove.');
      if (old.exists) return { fresh: false, quoteId: old.data()!.quoteId as string };
      if (order.status !== 'READY') throw new HttpError(409, 'Chỉ gọi tài xế khi món đã sẵn sàng.');
      const quote = (await tx.get(this.db.collection('delivery_quotes').doc(order.deliveryQuoteId))).data() as StoredQuote | undefined;
      if (!quote || quote.orderId !== id) throw new HttpError(409, 'Đơn chưa được backend xác thực báo phí.');
      if (quote.paymentMethod === 'PAYOS') {
        const paid = (await tx.get(this.db.collection('payment_orders').doc(id))).data();
        if (paid?.paymentStatus !== 'PAID') throw new HttpError(409, 'Đơn payOS chưa được thanh toán.');
      }
      tx.create(operation, { quoteId: quote.id, createdAt: Timestamp.now(), state: 'CREATING' });
      return { fresh: true, quoteId: quote.id };
    });
    const quote = (await this.db.collection('delivery_quotes').doc(claim.quoteId).get()).data() as StoredQuote;
    if (!claim.fresh) {
      const found = await this.provider.find(id);
      if (!found) throw new HttpError(409, 'Chưa xác định kết quả tạo chuyến. Đối chiếu mã đơn trên Ahamove staging; không tạo lại để tránh trùng tài xế.', 'AHAMOVE_BOOKING_UNKNOWN');
      return this.apply(id, found);
    }
    // Never automatically repeat a booking POST: a timeout may have already created a trip.
    try {
      const payload = this.payload(quote.checkout, quote.paymentMethod === 'COD' ? quote.pricing.total : 0, id);
      // Keep the pickup address accepted at checkout, even after changing the configured demo store.
      payload.path[0] = { address: quote.pickupAddress, name: quote.pickupName, mobile: quote.pickupMobile };
      payload.service_id = quote.delivery.serviceId;
      const result = await this.provider.create(payload);
      return await this.apply(id, result);
    } catch (error) {
      await operation.update({ state: 'UNKNOWN' });
      throw error;
    }
  }
  async refresh(uid: string, id: string) {
    const order = (await this.db.collection('orders').doc(id).get()).data();
    if (!order || (order.userId !== uid && !this.config.staffUids.includes(uid))) throw new HttpError(404, 'Không tìm thấy đơn.');
    const operation = await this.db.collection('delivery_operations').doc(id).get();
    if (!operation.exists) throw new HttpError(409, 'Cửa hàng chưa gọi tài xế.');
    const detail = order.delivery?.providerOrderId ? await this.provider.get(order.delivery.providerOrderId) : await this.provider.find(id);
    if (!detail) throw new HttpError(409, 'Chưa tìm thấy chuyến. Cần đối chiếu trên Ahamove staging.');
    return this.apply(id, detail);
  }
  async webhook(body: unknown) {
    const { _id } = z.object({ _id: z.string().regex(/^[A-Za-z0-9-]{1,100}$/) }).parse(body);
    const mapping = await this.db.collection('delivery_shipments').doc(_id.replace(/-\d+$/, '')).get();
    if (!mapping.exists) throw new HttpError(503, 'Chuyến đang được liên kết. Vui lòng gửi lại callback.');
    // Fetch the current provider snapshot; do not trust callback order or callback monetary fields.
    await this.apply(mapping.data()!.orderId, await this.provider.get(mapping.id));
  }
  private async apply(id: string, detail: AhaOrder) {
    if (detail.path.length !== 2 || detail.path[1].tracking_number !== id) throw new HttpError(409, 'Chuyến không khớp đơn hàng.');
    const ref = this.db.collection('orders').doc(id);
    const mapping = this.db.collection('delivery_shipments').doc(detail._id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      const operation = await tx.get(this.db.collection('delivery_operations').doc(id));
      const existingMapping = await tx.get(mapping);
      if (!order?.delivery || !operation.exists || (existingMapping.exists && existingMapping.data()!.orderId !== id) ||
        (order.delivery.providerOrderId && order.delivery.providerOrderId !== detail._id)) throw new HttpError(409, 'Liên kết chuyến không hợp lệ.');
      const delivery = deliveryUpdate(order.delivery as Delivery, detail);
      const status = delivery.status === 'DELIVERED' ? 'COMPLETED' : delivery.status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : order.status;
      const changes: Record<string, unknown> = { delivery };
      if (delivery.status === 'DELIVERED' && order.paymentMethod === 'cash') changes.codCollectionStatus = 'COLLECTED_STAGING';
      if (status !== order.status && !['COMPLETED', 'CANCELLED'].includes(order.status)) {
        await transition(tx, this.db, ref, order, status, 'Cập nhật từ Ahamove staging');
      }
      tx.update(ref, changes);
      tx.set(mapping, { orderId: id });
      tx.update(operation.ref, { state: 'CREATED' });
      return { id, delivery, status };
    });
  }
}
