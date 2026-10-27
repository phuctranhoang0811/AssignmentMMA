import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { Checkout, PaymentLink, PaymentOrder, PaidData } from './domain';
import { HttpError, orderIdentity, paidFulfillmentOrder, priceCheckout, settle } from './domain';
import type { Product } from '../../src/types/product';
import { validateQuote, type StoredQuote } from './delivery';

export class OrderStore {
  constructor(private db: Firestore, private requireDeliveryQuote = false) {}
  async get(id: string) {
    const doc = await this.db.collection('payment_orders').doc(id).get();
    return doc.exists ? doc.data() as PaymentOrder : null;
  }
  async reserve(uid: string, key: string, checkout: Checkout) {
    const { id, fingerprint } = orderIdentity(uid, key, checkout);
    const ref = this.db.collection('payment_orders').doc(id);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        const order = existing.data() as PaymentOrder;
        if (order.fingerprint !== fingerprint) throw new HttpError(409, 'Idempotency-Key already used for another checkout');
        return order;
      }
      if (this.requireDeliveryQuote && checkout.fulfillmentType === 'DELIVERY' && !checkout.deliveryQuoteId) {
        throw new HttpError(409, 'Vui lòng lấy báo phí Ahamove trước khi thanh toán.');
      }
      const quoteRef = checkout.deliveryQuoteId ? this.db.collection('delivery_quotes').doc(checkout.deliveryQuoteId) : null;
      const quote = quoteRef ? validateQuote((await tx.get(quoteRef)).data() as StoredQuote | undefined, uid, checkout, 'PAYOS', id) : undefined;
      const productIds = [...new Set(checkout.items.map(i => i.productId))];
      const products = await tx.getAll(...productIds.map(id => this.db.collection('products').doc(id)));
      const priced = priceCheckout(checkout, products.filter(p => p.exists).map(p => ({ ...p.data(), id: p.id }) as Product));
      if (quote) {
        if (quote.pricing.subtotal !== priced.pricing.total) throw new HttpError(409, 'Giá món đã thay đổi. Vui lòng lấy lại phí.');
        priced.pricing = quote.pricing;
      }
      const counterRef = this.db.collection('payment_system').doc('order_counter');
      const counter = await tx.get(counterRef);
      const orderCode = Math.max(Date.now(), Number(counter.data()?.value ?? 0) + 1);
      const order: PaymentOrder = { id, fingerprint, userId: uid, orderCode, checkout, ...priced,
        ...(quote ? { delivery: quote.delivery } : {}),
        total: priced.pricing.total, paymentStatus: 'PENDING', createdAt: new Date().toISOString() };
      tx.set(counterRef, { value: orderCode });
      tx.create(ref, order);
      tx.create(this.db.collection('payment_codes').doc(String(orderCode)), { orderId: id });
      if (quoteRef) tx.update(quoteRef, { orderId: id });
      return order;
    });
  }
  async attach(id: string, payment: PaymentLink) {
    const ref = this.db.collection('payment_orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data() as PaymentOrder;
      if (order.payment && order.payment.paymentLinkId !== payment.paymentLinkId) throw new HttpError(409, 'Conflicting payment link');
      // Never overwrite PAID if the webhook arrived during link creation.
      tx.update(ref, { payment: order.payment?.qrCode ? order.payment : payment });
      return { ...order, payment: order.payment?.qrCode ? order.payment : payment };
    });
  }
  async pay(data: PaidData) {
    return this.db.runTransaction(async tx => {
      const mapping = await tx.get(this.db.collection('payment_codes').doc(String(data.orderCode)));
      // payOS sends a signed sample when confirming a webhook URL.
      if (!mapping.exists) return null;
      const ref = this.db.collection('payment_orders').doc(mapping.data()!.orderId);
      const doc = await tx.get(ref);
      if (!doc.exists) throw new HttpError(409, 'Missing mapped order');
      const order = doc.data() as PaymentOrder;
      const updated = settle(order, data);
      if (updated !== order) {
        tx.update(ref, { paymentStatus: updated.paymentStatus, paidAt: updated.paidAt!, reference: updated.reference! });
        tx.create(this.db.collection('orders').doc(order.id), {
          ...paidFulfillmentOrder(updated), createdAt: Timestamp.fromDate(new Date(order.createdAt)),
        });
      }
      return updated;
    });
  }
}
