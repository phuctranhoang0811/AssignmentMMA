import { Timestamp, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { checkoutSchema, HttpError, orderIdentity, priceCheckout, type Checkout } from './domain';
import { mockCoupons } from '../../src/data/mockPromotions';
import type { Product } from '../../src/types/product';
import { isStaffRole } from '../../src/utils/staff';

export const cashOrderInput = z.object({
  checkout: checkoutSchema,
  promoCode: z.string().trim().max(30).optional(),
  deliveryTime: z.string().trim().max(100).optional(),
}).strict();

const KITCHEN: Record<string, string> = { PENDING_CONFIRMATION: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY' };
const FINAL = ['COMPLETED', 'CANCELLED'];

export const rewardPointsFor = (total: number) => Math.floor(total / 10000);

export function nextStatus(order: DocumentData): string | undefined {
  if (KITCHEN[order.status]) return KITCHEN[order.status];
  // After READY, Ahamove's driver updates drive the order (see DeliveryStore.apply).
  if (order.delivery?.provider === 'AHAMOVE') return undefined;
  if (order.status === 'READY') return order.fulfillmentType === 'delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED';
  if (order.status === 'OUT_FOR_DELIVERY') return 'COMPLETED';
  return undefined;
}

/**
 * Moves an order to `status` inside a transaction. Reads first (Firestore rule), then writes.
 * Completion awards reward points once; cancelling a paid order flags it for a manual refund.
 */
export async function transition(tx: Transaction, db: Firestore, ref: DocumentReference, order: DocumentData,
  status: string, note?: string) {
  const user = status === 'COMPLETED' && order.userId && !order.pointsAwarded
    ? await tx.get(db.collection('users').doc(order.userId)) : null;
  const changes: Record<string, unknown> = { status,
    statusHistory: [...(order.statusHistory ?? []), { status, at: new Date().toISOString(), ...(note ? { note } : {}) }] };
  if (user?.exists) {
    tx.update(user.ref, { rewardPoints: (user.data()?.rewardPoints ?? 0) + rewardPointsFor(order.total ?? 0) });
    changes.pointsAwarded = true;
  }
  if (status === 'CANCELLED' && order.paymentStatus === 'PAID') changes.paymentStatus = 'REFUND_PENDING';
  tx.update(ref, changes);
  return { id: ref.id, status };
}

// Staff = a UID listed in env, or the same roles the app uses to open the staff portal.
// Firestore rules stop users from editing their own role, so the stored role can be trusted.
export async function assertStaffAccess(db: Firestore, staffUids: string[], uid: string) {
  if (staffUids.includes(uid)) return;
  const role = (await db.collection('users').doc(uid).get()).data()?.role;
  if (!isStaffRole(role)) throw new HttpError(403, 'Tài khoản chưa được cấp quyền nhân viên.');
}

export class OrderOpsStore {
  constructor(private db: Firestore, private staffUids: string[]) {}

  assertStaff(uid: string) {
    return assertStaffAccess(this.db, this.staffUids, uid);
  }

  async list(uid: string, status?: string) {
    await this.assertStaff(uid);
    // shortcut: recent 100 then filter in memory; avoids a composite index until order volume needs paging.
    const result = await this.db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
    return result.docs.map(doc => ({ ...doc.data(), id: doc.id }))
      .filter(order => !status || (order as DocumentData).status === status);
  }

  async advance(uid: string, id: string) {
    await this.assertStaff(uid);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order) throw new HttpError(404, 'Không tìm thấy đơn.');
      const status = nextStatus(order);
      if (!status) throw new HttpError(409, 'Đơn không thể chuyển sang bước tiếp theo.');
      return transition(tx, this.db, ref, order, status);
    });
  }

  async reject(uid: string, id: string, reason: string) {
    await this.assertStaff(uid);
    return this.cancelWhere(id, order => !FINAL.includes(order.status) && order.status !== 'OUT_FOR_DELIVERY' &&
      (!order.delivery || order.delivery.status === 'NOT_REQUESTED'), `Cửa hàng từ chối: ${reason}`);
  }

  async cancel(uid: string, id: string) {
    return this.cancelWhere(id, order => order.userId === uid && order.status === 'PENDING_CONFIRMATION', 'Khách hàng hủy đơn', uid);
  }

  private cancelWhere(id: string, allowed: (order: DocumentData) => boolean, note: string, owner?: string) {
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      // Hide other customers' orders behind the same 404.
      if (!order || (owner && order.userId !== owner)) throw new HttpError(404, 'Không tìm thấy đơn.');
      if (!allowed(order)) throw new HttpError(409, 'Đơn đã được xử lý, không thể hủy.');
      return transition(tx, this.db, ref, order, 'CANCELLED', note);
    });
  }

  async createCash(uid: string, key: string, input: z.infer<typeof cashOrderInput>) {
    const { checkout, promoCode, deliveryTime } = input;
    if (checkout.deliveryQuoteId) throw new HttpError(400, 'Đơn Ahamove dùng /api/delivery/orders.');
    const coupon = promoCode ? mockCoupons.find(c => c.code === promoCode.toUpperCase()) : undefined;
    if (promoCode && !coupon) throw new HttpError(422, 'Mã giảm giá không hợp lệ.');
    const { id, fingerprint } = orderIdentity(uid, `CASH-${key}`, { ...checkout, promoCode, deliveryTime } as Checkout);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.checkoutFingerprint !== fingerprint) throw new HttpError(409, 'Idempotency-Key đã dùng cho đơn khác.');
        return { id, orderCode: existing.data()!.orderCode as string };
      }
      const refs = [...new Set(checkout.items.map(item => item.productId))].map(productId => this.db.collection('products').doc(productId));
      const products = await tx.getAll(...refs);
      const { pricing, items } = priceCheckout(checkout, products.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id }) as Product), coupon);
      const orderCode = `PF-${id.slice(0, 10).toUpperCase()}`;
      tx.create(ref, { orderCode, checkoutFingerprint: fingerprint, userId: uid, customer: checkout.customer,
        address: checkout.address ?? '', deliveryNote: checkout.deliveryNote ?? '',
        fulfillmentType: checkout.fulfillmentType === 'DELIVERY' ? 'delivery' : 'takeaway',
        needCutlery: checkout.needCutlery ?? false, createdAt: Timestamp.now(), deliveryTime: deliveryTime || 'Sớm nhất',
        paymentMethod: 'cash', paymentName: 'Tiền mặt', paymentStatus: 'UNPAID',
        status: 'PENDING_CONFIRMATION', statusHistory: [{ status: 'PENDING_CONFIRMATION', at: new Date().toISOString(), note: 'Khách hàng vừa đặt đơn' }],
        items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), ...pricing,
        voucherCode: coupon?.code ?? null, earnedPoints: rewardPointsFor(pricing.total) });
      return { id, orderCode };
    });
  }

  /** Guest lookup by phone + order code; returns only what the tracking screen shows. */
  async lookup(phone: string, orderCode: string) {
    const result = await this.db.collection('orders').where('orderCode', '==', orderCode).limit(1).get();
    const order = result.docs[0]?.data();
    const digits = (value: string) => value.replace(/\D/g, '').replace(/^84/, '0');
    if (!order || digits(order.customer?.phone ?? '') !== digits(phone)) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
    // Phone + code proves it is the customer's order; drop internal fields only.
    const { userId: _u, checkoutFingerprint: _f, paymentOrderId: _p, reference: _r, deliveryQuoteId: _q, createdAt, ...visible } = order;
    return { ...visible, id: result.docs[0].id, createdAt: createdAt?.toDate?.().toISOString?.() ?? null };
  }
}
