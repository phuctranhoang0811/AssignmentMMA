import { Timestamp, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { checkoutSchema, HttpError, orderIdentity, priceCheckout, type Checkout } from './domain';
import { mockCoupons } from '../../src/data/mockPromotions';
import type { Product } from '../../src/types/product';
import type { Coupon } from '../../src/types/user';
import { isAdminRole, isStaffRole } from '../../src/utils/staff';
import { couponUsageId, isCouponExpired } from '../../src/utils/coupons';

export const cashOrderInput = z.object({
  checkout: checkoutSchema,
  promoCode: z.string().trim().max(30).optional(),
  deliveryTime: z.string().trim().max(100).optional(),
}).strict();

const KITCHEN: Record<string, string> = { PENDING_CONFIRMATION: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY' };
const FINAL = ['COMPLETED', 'CANCELLED'];
const ACTIVE = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

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
  // A cancelled order gives its voucher back (the customer's single use and one of the coupon's total uses).
  const release = status === 'CANCELLED' && order.voucherCode && order.userId;
  const usage = release ? await tx.get(db.collection('coupon_usages').doc(couponUsageId(order.voucherCode, order.userId))) : null;
  const coupon = usage?.exists && usage.data()?.orderId === ref.id ? await tx.get(db.collection('coupons').doc(order.voucherCode)) : null;
  const changes: Record<string, unknown> = { status,
    statusHistory: [...(order.statusHistory ?? []), { status, at: new Date().toISOString(), ...(note ? { note } : {}) }] };
  if (user?.exists) {
    tx.update(user.ref, { rewardPoints: (user.data()?.rewardPoints ?? 0) + rewardPointsFor(order.total ?? 0) });
    changes.pointsAwarded = true;
  }
  if (status === 'CANCELLED' && order.paymentStatus === 'PAID') changes.paymentStatus = 'REFUND_PENDING';
  if (coupon) {
    tx.delete(usage!.ref);
    const used = coupon.data()?.usedCount;
    if (typeof used === 'number' && used > 0) tx.update(coupon.ref, { usedCount: used - 1 });
  }
  // Store staff collect cash at hand-over. An Ahamove driver collects it instead, so that stays for reconciliation.
  if (status === 'COMPLETED' && order.paymentMethod === 'cash' && order.paymentStatus === 'UNPAID' && !order.delivery) {
    changes.paymentStatus = 'PAID';
  }
  tx.update(ref, changes);
  return { id: ref.id, status };
}

/** Coupons created in the admin portal (doc id = code) win over the built-in ones. */
export async function findCoupon(db: Firestore, code: string): Promise<Coupon | undefined> {
  const normalized = code.trim().toUpperCase();
  const stored = (await db.collection('coupons').doc(normalized).get()).data();
  if (stored) return { ...stored, code: normalized } as Coupon;
  return mockCoupons.find(c => c.code === normalized);
}

/** Accounts an admin locked (role BLACKLISTED) cannot place orders or redeem rewards. */
export async function isBlocked(db: Firestore, uid: string) {
  return (await db.collection('users').doc(uid).get()).data()?.role === 'BLACKLISTED';
}

/**
 * Validates a voucher for this customer inside a transaction (reads only) and returns claim(), to be called
 * after all reads, which records the use: one per customer per code, plus the coupon's total if it has one.
 */
export async function checkCoupon(tx: Transaction, db: Firestore, code: string, uid: string) {
  const coupon = await findCoupon(db, code);
  if (!coupon) throw new HttpError(422, 'Mã giảm giá không hợp lệ.');
  if (isCouponExpired(coupon)) throw new HttpError(422, `Mã ${coupon.code} đã hết hạn.`);
  const usageRef = db.collection('coupon_usages').doc(couponUsageId(coupon.code, uid));
  const couponRef = coupon.usageLimit ? db.collection('coupons').doc(coupon.code) : null;
  if ((await tx.get(usageRef)).exists) throw new HttpError(409, `Bạn đã dùng mã ${coupon.code} rồi.`);
  const used = couponRef ? (await tx.get(couponRef)).data()?.usedCount ?? 0 : 0;
  if (couponRef && used >= coupon.usageLimit!) throw new HttpError(409, `Mã ${coupon.code} đã hết lượt sử dụng.`);
  if (coupon.firstOrderOnly) {
    const previous = await tx.get(db.collection('orders').where('userId', '==', uid).limit(50));
    if (previous.docs.some(doc => doc.data().status !== 'CANCELLED')) {
      throw new HttpError(409, `Mã ${coupon.code} chỉ áp dụng cho đơn hàng đầu tiên.`);
    }
  }
  return { coupon, claim: (orderId: string) => {
    tx.create(usageRef, { uid, code: coupon.code, orderId, usedAt: Timestamp.now() });
    if (couponRef) tx.update(couponRef, { usedCount: used + 1 });
  } };
}

/**
 * For a payment that has already settled: record the voucher use without re-checking limits, since the
 * customer has paid the discounted price. Reads first; returns the write to run after all reads.
 */
export async function recordCouponUse(tx: Transaction, db: Firestore, code: string, uid: string) {
  const usageRef = db.collection('coupon_usages').doc(couponUsageId(code, uid));
  const coupon = await tx.get(db.collection('coupons').doc(code.toUpperCase()));
  return (orderId: string) => {
    tx.set(usageRef, { uid, code: code.toUpperCase(), orderId, usedAt: Timestamp.now() });
    const data = coupon.data();
    if (data?.usageLimit) tx.update(coupon.ref, { usedCount: (data.usedCount ?? 0) + 1 });
  };
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

  /**
   * Every order still being worked on, however old, plus the 50 newest for the "done" tab.
   * Single-field filters need no composite index; results are sorted here, newest first.
   */
  async list(uid: string, status?: string) {
    await this.assertStaff(uid);
    const orders = this.db.collection('orders');
    const results = status
      // shortcut: up to 300 matches, unordered by Firestore; fine for active statuses, not a full history.
      ? [await orders.where('status', '==', status).limit(300).get()]
      : await Promise.all([orders.where('status', 'in', ACTIVE).limit(500).get(), orders.orderBy('createdAt', 'desc').limit(50).get()]);
    const byId = new Map(results.flatMap(result => result.docs).map(doc => [doc.id, { ...doc.data(), id: doc.id }]));
    const time = (order: DocumentData) => {
      const value = order.createdAt?.toMillis?.() ?? Date.parse(order.createdAt ?? '');
      return Number.isFinite(value) ? value : 0;
    };
    return [...byId.values()].sort((a, b) => time(b) - time(a));
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

  /** Admin confirms the money for a cancelled paid order was returned by hand (no payOS refund API is used). */
  async markRefunded(uid: string, id: string) {
    if (!isAdminRole((await this.db.collection('users').doc(uid).get()).data()?.role)) {
      throw new HttpError(403, 'Chỉ quản trị viên được xác nhận hoàn tiền.');
    }
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order) throw new HttpError(404, 'Không tìm thấy đơn.');
      if (order.paymentStatus !== 'REFUND_PENDING') throw new HttpError(409, 'Đơn không ở trạng thái chờ hoàn tiền.');
      tx.update(ref, { paymentStatus: 'REFUNDED', refundedAt: Timestamp.now(), refundedBy: uid });
      return { id, paymentStatus: 'REFUNDED' };
    });
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
    const { checkout, deliveryTime } = input;
    const promoCode = input.promoCode ?? checkout.promoCode;
    if (checkout.deliveryQuoteId) throw new HttpError(400, 'Đơn Ahamove dùng /api/delivery/orders.');
    const { id, fingerprint } = orderIdentity(uid, `CASH-${key}`, { ...checkout, promoCode, deliveryTime } as Checkout);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.checkoutFingerprint !== fingerprint) throw new HttpError(409, 'Idempotency-Key đã dùng cho đơn khác.');
        const saved = existing.data()!;
        return { id, orderCode: saved.orderCode as string, subtotal: saved.subtotal as number, discount: saved.discount as number, total: saved.total as number };
      }
      const voucher = promoCode ? await checkCoupon(tx, this.db, promoCode, uid) : undefined;
      const coupon = voucher?.coupon;
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
      voucher?.claim(id);
      // The confirmation screen shows these server amounts, not the app's own estimate.
      return { id, orderCode, subtotal: pricing.subtotal, discount: pricing.discount, total: pricing.total };
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
