import { Timestamp, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { checkoutSchema, HttpError, orderIdentity, priceCheckout, type Checkout } from './domain';
import { mockCoupons } from '../../src/data/mockPromotions';
import type { Product } from '../../src/types/product';
import type { Coupon } from '../../src/types/user';
import { isAdminRole, isRiderRole, isStaffRole } from '../../src/utils/staff';
import { couponUsageId, isCouponExpired } from '../../src/utils/coupons';
import { auditInTransaction } from './audit';
import type { DeliveryFeeConfig } from '../../src/utils/deliveryFee';

export const cashOrderInput = z.object({
  checkout: checkoutSchema,
  promoCode: z.string().trim().max(30).optional(),
  deliveryTime: z.string().trim().max(100).optional(),
}).strict();

const KITCHEN: Record<string, string> = { PENDING_CONFIRMATION: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY' };
const FINAL = ['COMPLETED', 'CANCELLED'];
export const REFUND_SLA_MS = 24 * 60 * 60_000;
/** Why a rider could not hand the food over. */
export const FAIL_REASONS = {
  CUSTOMER_UNREACHABLE: 'Không liên lạc được khách', WRONG_ADDRESS: 'Sai hoặc không tìm thấy địa chỉ',
  CUSTOMER_REFUSED: 'Khách từ chối nhận', OTHER: 'Lý do khác',
} as const;
const ACTIVE = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

export const rewardPointsFor = (total: number) => Math.floor(total / 10000);
/** Welcome gift for a new account, granted with its first completed order (never at sign-up, which anyone can repeat). */
export const WELCOME_POINTS = 100;

export function nextStatus(order: DocumentData): string | undefined {
  if (KITCHEN[order.status]) return KITCHEN[order.status];
  // After READY, Ahamove's driver updates drive the order (see DeliveryStore.apply), or the store's own rider once one took it.
  if (order.delivery?.provider === 'AHAMOVE' || order.rider) return undefined;
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
    const welcome = user.data()?.welcomePending === true;
    tx.update(user.ref, { rewardPoints: (user.data()?.rewardPoints ?? 0) + rewardPointsFor(order.total ?? 0) + (welcome ? WELCOME_POINTS : 0),
      ...(welcome ? { welcomePending: false } : {}) });
    changes.pointsAwarded = true;
  }
  if (status === 'CANCELLED') changes.cancelReason = note ?? '';
  if (status === 'CANCELLED' && order.paymentStatus === 'PAID') {
    changes.paymentStatus = 'REFUND_PENDING';
    // The customer is promised a refund within a day; the admin queue highlights anything past this time.
    changes.refundRequestedAt = Timestamp.now();
    changes.refundDueAt = Timestamp.fromMillis(Date.now() + REFUND_SLA_MS);
  }
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

/** A new account whose e-mail is not proven yet (an explicit `false`; older accounts have no flag) cannot order. */
export async function isUnverified(db: Firestore, uid: string) {
  return (await db.collection('users').doc(uid).get()).data()?.emailVerified === false;
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

/** A rider is an outside party: before taking an order they see where it goes and what to collect, never who it is for. */
export function riderView(order: DocumentData & { id: string }, uid: string) {
  const mine = order.rider?.uid === uid;
  const paid = order.paymentStatus === 'PAID' || order.paymentStatus === 'PAID_DEMO';
  return {
    id: order.id, orderCode: order.orderCode, status: order.status, createdAt: order.createdAt,
    address: order.address ?? '', itemCount: order.itemCount ?? 0, paymentStatus: paid ? 'PAID' : 'UNPAID',
    // Cash to collect on delivery; nothing when the customer has already paid.
    codAmount: paid ? 0 : order.total ?? 0,
    // What the rider earns for this trip (the store covers it when the customer's shipping is free).
    riderPay: order.riderPay ?? 0,
    mine, ...(mine ? { rider: order.rider, customer: { fullname: order.customer?.fullname ?? '', phone: order.customer?.phone ?? '' },
      deliveryNote: order.deliveryNote ?? '', deliveryTime: order.deliveryTime ?? '' } : {}),
  };
}

export class OrderOpsStore {
  constructor(private db: Firestore, private staffUids: string[], private onRefunded: (order: DocumentData & { id: string }) => void = () => {},
    private shippingConfig: () => Promise<DeliveryFeeConfig | undefined> = async () => undefined) {}

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
    return this.cancelWhere(id, order => !FINAL.includes(order.status) && order.status !== 'OUT_FOR_DELIVERY' && !order.rider &&
      (!order.delivery || order.delivery.status === 'NOT_REQUESTED'), `Cửa hàng từ chối: ${reason}`, undefined, { actor: uid, action: 'ORDER_REJECTED', reason });
  }

  private async assertRider(uid: string) {
    const user = (await this.db.collection('users').doc(uid).get()).data();
    if (!isRiderRole(user?.role)) throw new HttpError(403, 'Tài khoản chưa được cấp quyền tài xế.');
    return user!;
  }

  /** Store-delivered orders that are ready and still free, plus the ones this rider is carrying. */
  async riderOrders(uid: string) {
    await this.assertRider(uid);
    // shortcut: up to 300 open delivery orders; one store's queue never gets near that.
    const result = await this.db.collection('orders').where('status', 'in', ['READY', 'OUT_FOR_DELIVERY']).limit(300).get();
    return result.docs.map(doc => ({ ...doc.data(), id: doc.id }) as DocumentData & { id: string })
      .filter(order => order.fulfillmentType === 'delivery' && !order.delivery &&
        (order.rider ? order.rider.uid === uid : order.status === 'READY'))
      .map(order => riderView(order, uid));
  }

  /** The rider's finished trips and what they earned: today, this week (from Monday) and all time, Vietnam time. */
  async riderEarnings(uid: string, now = Date.now()) {
    await this.assertRider(uid);
    // shortcut: history and totals come from up to 200 of the rider's orders (Firestore returns them unordered, and an
    // ordered query would need a composite index); only the unsettled figures below are exact.
    const result = await this.db.collection('orders').where('riderUid', '==', uid).limit(200).get();
    // A trip counts once it is finished: delivered, or failed through no fault of the rider's.
    const trips = result.docs.filter(doc => !!doc.data().deliveredAt).map(doc => {
      const data = doc.data();
      return { id: doc.id, orderCode: data.orderCode as string, earned: (data.riderEarned as number) ?? 0,
        distanceKm: (data.deliveryDistanceKm as number | undefined) ?? null, failed: data.status === 'CANCELLED',
        deliveredAt: (data.deliveredAt?.toMillis?.() as number | undefined) ?? 0 };
    }).sort((a, b) => b.deliveredAt - a.deliveredAt);
    // The money still to be squared up must not depend on that cap: it is read exactly, like the admin ledger.
    const openTrips = (await this.db.collection('orders').where('riderUid', '==', uid).where('riderSettled', '==', false).limit(400).get()).docs
      .map(doc => doc.data());
    const VN = 7 * 3_600_000, DAY = 86_400_000;
    const today = Math.floor((now + VN) / DAY) * DAY - VN;
    const weekday = (new Date(now + VN).getUTCDay() + 6) % 7; // Monday = 0
    const week = today - weekday * DAY;
    const sum = (from: number) => trips.filter(trip => trip.deliveredAt >= from).reduce((total, trip) => total + trip.earned, 0);
    return { today: sum(today), week: sum(week), total: sum(0), trips: trips.length,
      // Not yet squared up with the store: wages owed to the rider and cash the rider collected and still holds.
      unsettled: { trips: openTrips.length, earned: openTrips.reduce((total, trip) => total + (trip.riderEarned ?? 0), 0), cash: openTrips.reduce((total, trip) => total + (trip.riderCash ?? 0), 0) },
      recent: trips.slice(0, 30).map(trip => ({ ...trip, deliveredAt: trip.deliveredAt ? new Date(trip.deliveredAt).toISOString() : null })) };
  }

  /** accept → pickup → deliver; release hands an untouched order back to the queue. */
  async riderAction(uid: string, id: string, action: 'accept' | 'release' | 'pickup' | 'deliver') {
    const user = await this.assertRider(uid);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order || order.fulfillmentType !== 'delivery' || order.delivery) throw new HttpError(404, 'Không tìm thấy đơn.');
      const mine = order.rider?.uid === uid;
      const name = String(user.fullname || 'Tài xế');
      if (action === 'accept') {
        if (order.status !== 'READY' || order.rider) throw new HttpError(409, 'Đơn đã có tài xế khác nhận.');
        tx.update(ref, { riderUid: uid, rider: { uid, name, phone: user.phone ?? '', acceptedAt: new Date().toISOString() } });
        return { id, status: order.status };
      }
      if (!mine) throw new HttpError(409, 'Đơn này không do bạn giao.');
      if (action === 'release') {
        if (order.status !== 'READY') throw new HttpError(409, 'Đã lấy món thì không thể trả đơn.');
        tx.update(ref, { riderUid: null, rider: null });
        return { id, status: order.status };
      }
      if (action === 'pickup' && order.status === 'READY') {
        const result = await transition(tx, this.db, ref, order, 'OUT_FOR_DELIVERY', `Tài xế ${name} đã lấy món`);
        tx.update(ref, { rider: { ...order.rider, pickedUpAt: new Date().toISOString() } });
        return result;
      }
      if (action === 'deliver' && order.status === 'OUT_FOR_DELIVERY') {
        const result = await transition(tx, this.db, ref, order, 'COMPLETED', `Tài xế ${name} đã giao thành công`);
        // The trip's pay is fixed when the order is priced; it is written once, here, and never recomputed.
        const cash = order.paymentMethod === 'cash' && order.paymentStatus === 'UNPAID' ? order.total ?? 0 : 0;
        tx.update(ref, { riderEarned: order.riderPay ?? 0, riderCash: cash, riderSettled: false, deliveredAt: Timestamp.now() });
        return result;
      }
      throw new HttpError(409, 'Đơn không ở bước này.');
    });
  }

  /**
   * The rider could not hand the food over. The order is cancelled (a paid one goes to the refund queue). The rider is
   * still paid for the trip unless the reason is OTHER, which the store reviews.
   */
  async riderFail(uid: string, id: string, reason: keyof typeof FAIL_REASONS, note?: string) {
    const user = await this.assertRider(uid);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order || order.rider?.uid !== uid) throw new HttpError(404, 'Không tìm thấy đơn.');
      if (order.status !== 'OUT_FOR_DELIVERY') throw new HttpError(409, 'Chỉ báo thất bại sau khi đã lấy món.');
      const result = await transition(tx, this.db, ref, order, 'CANCELLED', `Giao thất bại: ${FAIL_REASONS[reason]}`);
      tx.update(ref, { deliveryFailure: { reason, ...(note ? { note } : {}), riderUid: uid, at: new Date().toISOString() },
        riderEarned: reason === 'OTHER' ? 0 : order.riderPay ?? 0, riderCash: 0, riderSettled: false, deliveredAt: Timestamp.now() });
      auditInTransaction(tx, this.db, { actorId: uid, action: 'ORDER_DELIVERY_FAILED', target: `orders/${id}`,
        details: { reason, rider: String(user.fullname ?? ''), paid: order.paymentStatus === 'PAID', ...(note ? { note } : {}) } });
      return result;
    });
  }

  /**
   * Store takes the order back from its rider. Before pickup any staff member can do it (the order returns to the
   * queue); after pickup only an admin can, and it ends the trip as cancelled.
   */
  async unassignRider(uid: string, id: string) {
    await this.assertStaff(uid);
    const admin = isAdminRole((await this.db.collection('users').doc(uid).get()).data()?.role);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order?.rider) throw new HttpError(404, 'Đơn này chưa có tài xế.');
      if (order.status === 'READY') {
        tx.update(ref, { riderUid: null, rider: null });
        auditInTransaction(tx, this.db, { actorId: uid, action: 'RIDER_UNASSIGNED', target: `orders/${id}`, details: { rider: order.rider.uid } });
        return { id, status: order.status };
      }
      if (order.status !== 'OUT_FOR_DELIVERY') throw new HttpError(409, 'Đơn không ở bước này.');
      if (!admin) throw new HttpError(403, 'Chỉ quản trị viên được hủy chuyến đã lấy món.');
      const result = await transition(tx, this.db, ref, order, 'CANCELLED', 'Cửa hàng hủy chuyến giao');
      tx.update(ref, { deliveryFailure: { reason: 'STORE_CANCELLED', riderUid: order.rider.uid, at: new Date().toISOString() },
        riderEarned: order.riderPay ?? 0, riderCash: 0, riderSettled: false, deliveredAt: Timestamp.now() });
      auditInTransaction(tx, this.db, { actorId: uid, action: 'DELIVERY_CANCELLED_BY_STORE', target: `orders/${id}`,
        details: { rider: order.rider.uid, paid: order.paymentStatus === 'PAID' } });
      return result;
    });
  }

  /** Per rider: finished trips not yet squared up. Positive `net` means the rider owes the store cash. */
  async riderLedger(uid: string) {
    await this.assertAdmin(uid);
    // shortcut: up to 1000 unsettled trips across all riders.
    const result = await this.db.collection('orders').where('riderSettled', '==', false).limit(1000).get();
    const byRider = new Map<string, { uid: string; name: string; trips: number; earned: number; cash: number }>();
    for (const doc of result.docs) {
      const order = doc.data();
      const id = String(order.riderUid ?? order.rider?.uid ?? '');
      if (!id) continue;
      const row = byRider.get(id) ?? { uid: id, name: String(order.rider?.name ?? 'Tài xế'), trips: 0, earned: 0, cash: 0 };
      row.trips++; row.earned += order.riderEarned ?? 0; row.cash += order.riderCash ?? 0;
      byRider.set(id, row);
    }
    return [...byRider.values()].map(row => ({ ...row, net: row.cash - row.earned })).sort((a, b) => b.trips - a.trips);
  }

  /** Admin has counted the rider's cash and paid the wages: close all of that rider's open trips and keep a record. */
  async settleRider(uid: string, riderUid: string) {
    await this.assertAdmin(uid);
    const query = this.db.collection('orders').where('riderUid', '==', riderUid).where('riderSettled', '==', false).limit(400);
    return this.db.runTransaction(async tx => {
      const open = await tx.get(query);
      if (open.empty) throw new HttpError(409, 'Tài xế này không có chuyến nào cần đối soát.');
      let earned = 0, cash = 0;
      for (const doc of open.docs) { earned += doc.data().riderEarned ?? 0; cash += doc.data().riderCash ?? 0; }
      for (const doc of open.docs) tx.update(doc.ref, { riderSettled: true, riderSettledAt: Timestamp.now() });
      tx.create(this.db.collection('rider_settlements').doc(), { riderUid, trips: open.size, earned, cash, net: cash - earned, settledBy: uid, at: Timestamp.now() });
      auditInTransaction(tx, this.db, { actorId: uid, action: 'RIDER_SETTLED', target: `users/${riderUid}`, details: { trips: open.size, earned, cash, net: cash - earned } });
      return { riderUid, trips: open.size, earned, cash, net: cash - earned };
    });
  }

  private async assertAdmin(uid: string) {
    if (!isAdminRole((await this.db.collection('users').doc(uid).get()).data()?.role)) {
      throw new HttpError(403, 'Chỉ quản trị viên được thực hiện thao tác này.');
    }
  }

  /** Admin confirms the money for a cancelled paid order was returned by hand (no payOS refund API is used). */
  async markRefunded(uid: string, id: string, note?: string) {
    if (!isAdminRole((await this.db.collection('users').doc(uid).get()).data()?.role)) {
      throw new HttpError(403, 'Chỉ quản trị viên được xác nhận hoàn tiền.');
    }
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order) throw new HttpError(404, 'Không tìm thấy đơn.');
      if (order.paymentStatus !== 'REFUND_PENDING') throw new HttpError(409, 'Đơn không ở trạng thái chờ hoàn tiền.');
      tx.update(ref, { paymentStatus: 'REFUNDED', refundedAt: Timestamp.now(), refundedBy: uid, ...(note ? { refundNote: note } : {}) });
      auditInTransaction(tx, this.db, { actorId: uid, action: 'ORDER_REFUNDED', target: `orders/${id}`,
        details: { total: order.total ?? 0, ...(note ? { note } : {}) } });
      return { id, paymentStatus: 'REFUNDED', order: { ...order, id } };
    }).then(({ order, ...result }) => { this.onRefunded(order); return result; });
  }

  async cancel(uid: string, id: string) {
    return this.cancelWhere(id, order => order.userId === uid && order.status === 'PENDING_CONFIRMATION', 'Khách hàng hủy đơn', uid,
      { actor: uid, action: 'ORDER_CANCELLED_BY_CUSTOMER' });
  }

  private cancelWhere(id: string, allowed: (order: DocumentData) => boolean, note: string, owner?: string,
    audit?: { actor: string; action: string; reason?: string }) {
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      // Hide other customers' orders behind the same 404.
      if (!order || (owner && order.userId !== owner)) throw new HttpError(404, 'Không tìm thấy đơn.');
      if (!allowed(order)) throw new HttpError(409, 'Đơn đã được xử lý, không thể hủy.');
      const result = await transition(tx, this.db, ref, order, 'CANCELLED', note);
      if (audit) auditInTransaction(tx, this.db, { actorId: audit.actor, action: audit.action, target: `orders/${id}`,
        details: { paid: order.paymentStatus === 'PAID', ...(audit.reason ? { reason: audit.reason } : {}) } });
      return result;
    });
  }

  async createCash(uid: string, key: string, input: z.infer<typeof cashOrderInput>) {
    const { checkout, deliveryTime } = input;
    const promoCode = input.promoCode ?? checkout.promoCode;
    if (checkout.deliveryQuoteId) throw new HttpError(400, 'Đơn Ahamove dùng /api/delivery/orders.');
    const shipping = await this.shippingConfig();
    const { id, fingerprint } = orderIdentity(uid, `CASH-${key}`, { ...checkout, promoCode, deliveryTime } as Checkout);
    const ref = this.db.collection('orders').doc(id);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.checkoutFingerprint !== fingerprint) throw new HttpError(409, 'Idempotency-Key đã dùng cho đơn khác.');
        const saved = existing.data()!;
        return { id, orderCode: saved.orderCode as string, subtotal: saved.subtotal as number, discount: saved.discount as number, deliveryFee: (saved.deliveryFee as number) ?? 0, total: saved.total as number };
      }
      const voucher = promoCode ? await checkCoupon(tx, this.db, promoCode, uid) : undefined;
      const coupon = voucher?.coupon;
      const refs = [...new Set(checkout.items.map(item => item.productId))].map(productId => this.db.collection('products').doc(productId));
      const products = await tx.getAll(...refs);
      const { pricing, items, deliveryDistanceKm, riderPay } = priceCheckout(checkout, products.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id }) as Product), coupon, shipping);
      const orderCode = `PF-${id.slice(0, 10).toUpperCase()}`;
      tx.create(ref, { orderCode, checkoutFingerprint: fingerprint, userId: uid, customer: checkout.customer,
        address: checkout.address ?? '', deliveryNote: checkout.deliveryNote ?? '',
        fulfillmentType: checkout.fulfillmentType === 'DELIVERY' ? 'delivery' : 'takeaway',
        needCutlery: checkout.needCutlery ?? false, createdAt: Timestamp.now(), deliveryTime: deliveryTime || 'Sớm nhất',
        paymentMethod: 'cash', paymentName: 'Tiền mặt', paymentStatus: 'UNPAID',
        status: 'PENDING_CONFIRMATION', statusHistory: [{ status: 'PENDING_CONFIRMATION', at: new Date().toISOString(), note: 'Khách hàng vừa đặt đơn' }],
        items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), ...pricing,
        ...(deliveryDistanceKm !== undefined ? { deliveryDistanceKm, riderPay: riderPay ?? 0, deliveryLocation: checkout.deliveryLocation } : {}),
        voucherCode: coupon?.code ?? null, earnedPoints: rewardPointsFor(pricing.total) });
      voucher?.claim(id);
      // The confirmation screen shows these server amounts, not the app's own estimate.
      return { id, orderCode, subtotal: pricing.subtotal, discount: pricing.discount, deliveryFee: pricing.deliveryFee, total: pricing.total };
    });
  }

  /** Guest lookup by phone + order code; returns only what the tracking screen shows. */
  async lookup(phone: string, orderCode: string) {
    const result = await this.db.collection('orders').where('orderCode', '==', orderCode).limit(1).get();
    const order = result.docs[0]?.data();
    const digits = (value: string) => value.replace(/\D/g, '').replace(/^84/, '0');
    if (!order || digits(order.customer?.phone ?? '') !== digits(phone)) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
    // Phone + code proves it is the customer's order; drop internal fields only.
    const { userId: _u, checkoutFingerprint: _f, paymentOrderId: _p, reference: _r, deliveryQuoteId: _q, createdAt,
      riderPay: _pay, riderEarned: _earned, riderCash: _cash, riderSettled: _settled, riderSettledAt: _settledAt, riderUid: _riderUid,
      riderWarnedAt: _warned, riderOverdueWarnedAt: _overdue, deliveryFailure: _failure, rider, ...visible } = order;
    // The tracking screen shows who is bringing the food, never the rider's account id or earnings.
    return { ...visible, ...(rider ? { rider: { name: rider.name, phone: rider.phone } } : {}), id: result.docs[0].id,
      createdAt: createdAt?.toDate?.().toISOString?.() ?? null };
  }
}
