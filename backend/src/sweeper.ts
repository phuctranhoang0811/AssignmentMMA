import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import type { PayOS } from '@payos/node';
import type { PaymentOrder } from './domain';
import { transition } from './orders';
import { auditInTransaction } from './audit';

export type SweeperLimits = {
  /** An unpaid payOS order is closed (and its QR cancelled) after this long. */
  unpaidAfterMs: number;
  /** Staff are warned once when an order has waited this long without being confirmed. */
  warnAfterMs: number;
  /** After this long without confirmation the order is cancelled (a paid one is flagged for refund). */
  cancelAfterMs: number;
  /** A rider accepted an order but has not picked it up after this long. */
  riderPickupAfterMs?: number;
  /** A rider picked the food up but has not delivered it after this long. */
  riderDeliverAfterMs?: number;
};
export const defaultLimits: SweeperLimits = { unpaidAfterMs: 20 * 60_000, warnAfterMs: 10 * 60_000, cancelAfterMs: 20 * 60_000,
  riderPickupAfterMs: 15 * 60_000, riderDeliverAfterMs: 60 * 60_000 };

export type SweepAlert = { id: string; orderCode: string | number; waitedMinutes: number; kind: 'UNCONFIRMED' | 'RIDER_NO_PICKUP' | 'RIDER_OVERDUE' };
export type SweepResult = { expiredPayments: number; cancelledOrders: number; warnedOrders: number; warnedRiders: number };

const millis = (value: unknown) => {
  const time = (value as { toMillis?: () => number })?.toMillis?.() ?? Date.parse(String(value ?? ''));
  return Number.isFinite(time) ? time : 0;
};

/**
 * Housekeeping that runs on a timer: nothing should wait forever. Unpaid payOS QR codes expire, and an order the
 * store never confirms is escalated to staff and then cancelled (with a refund flag when it was already paid).
 */
export class OrderSweeper {
  constructor(
    private db: Firestore,
    private payos: Pick<PayOS, 'paymentRequests'>,
    private pay: (data: { orderCode: number; paymentLinkId: string; amount: number; reference: string }) => Promise<PaymentOrder | null>,
    private notify: (alert: SweepAlert) => void = () => {},
    private limits: SweeperLimits = defaultLimits,
    private clock: () => number = Date.now,
  ) {}

  async run(): Promise<SweepResult> {
    const expiredPayments = await this.expireUnpaid();
    const { cancelledOrders, warnedOrders } = await this.escalateUnconfirmed();
    return { expiredPayments, cancelledOrders, warnedOrders, warnedRiders: await this.escalateRiders() };
  }

  /** Staff are told once per problem; they then reassign the order or cancel the trip. */
  private async escalateRiders() {
    const pickupAfter = this.limits.riderPickupAfterMs ?? defaultLimits.riderPickupAfterMs!;
    const deliverAfter = this.limits.riderDeliverAfterMs ?? defaultLimits.riderDeliverAfterMs!;
    let warned = 0;
    const taken = await this.db.collection('orders').where('status', '==', 'READY').limit(200).get();
    for (const doc of taken.docs) {
      const order = doc.data();
      if (!order.rider || order.riderWarnedAt) continue;
      const waited = this.clock() - millis(order.rider.acceptedAt);
      if (waited < pickupAfter) continue;
      await doc.ref.update({ riderWarnedAt: Timestamp.fromMillis(this.clock()) });
      this.notify({ id: doc.id, orderCode: order.orderCode, waitedMinutes: Math.floor(waited / 60_000), kind: 'RIDER_NO_PICKUP' });
      warned++;
    }
    const out = await this.db.collection('orders').where('status', '==', 'OUT_FOR_DELIVERY').limit(200).get();
    for (const doc of out.docs) {
      const order = doc.data();
      if (!order.rider?.pickedUpAt || order.riderOverdueWarnedAt) continue;
      const waited = this.clock() - millis(order.rider.pickedUpAt);
      if (waited < deliverAfter) continue;
      await doc.ref.update({ riderOverdueWarnedAt: Timestamp.fromMillis(this.clock()) });
      this.notify({ id: doc.id, orderCode: order.orderCode, waitedMinutes: Math.floor(waited / 60_000), kind: 'RIDER_OVERDUE' });
      warned++;
    }
    return warned;
  }

  private async expireUnpaid() {
    const pending = await this.db.collection('payment_orders').where('paymentStatus', '==', 'PENDING').limit(200).get();
    let expired = 0;
    for (const doc of pending.docs) {
      const order = doc.data() as PaymentOrder & { expiredAt?: unknown };
      if (order.expiredAt || this.clock() - millis(order.createdAt) < this.limits.unpaidAfterMs) continue;
      try {
        if (order.payment) {
          const link = await this.payos.paymentRequests.get(order.orderCode);
          // A payment the webhook missed must be honoured, never cancelled.
          if (link.status === 'PAID' && link.amountPaid === order.total && link.amountRemaining === 0) {
            await this.pay({ orderCode: order.orderCode, paymentLinkId: link.id, amount: link.amount, reference: `sweep:${link.id}` });
            continue;
          }
          if (link.status === 'PENDING') await this.payos.paymentRequests.cancel(order.orderCode, 'Quá hạn thanh toán');
        }
        await doc.ref.update({ expiredAt: Timestamp.fromMillis(this.clock()) });
        expired++;
      } catch { /* The next sweep retries; one bad order must not stop the others. */ }
    }
    return expired;
  }

  private async escalateUnconfirmed() {
    const waiting = await this.db.collection('orders').where('status', '==', 'PENDING_CONFIRMATION').limit(200).get();
    let cancelledOrders = 0;
    let warnedOrders = 0;
    for (const doc of waiting.docs) {
      const order = doc.data();
      const waited = this.clock() - millis(order.createdAt);
      if (waited >= this.limits.cancelAfterMs) {
        if (await this.cancel(doc.id)) cancelledOrders++;
      } else if (waited >= this.limits.warnAfterMs && !order.staffWarnedAt) {
        await doc.ref.update({ staffWarnedAt: Timestamp.fromMillis(this.clock()) });
        this.notify({ id: doc.id, orderCode: order.orderCode, waitedMinutes: Math.floor(waited / 60_000), kind: 'UNCONFIRMED' });
        warnedOrders++;
      }
    }
    return { cancelledOrders, warnedOrders };
  }

  private async cancel(id: string) {
    const ref = this.db.collection('orders').doc(id);
    try {
      return await this.db.runTransaction(async tx => {
        const order = (await tx.get(ref)).data() as DocumentData | undefined;
        // Staff may have confirmed it a moment ago.
        if (!order || order.status !== 'PENDING_CONFIRMATION') return false;
        await transition(tx, this.db, ref, order, 'CANCELLED', 'Quá hạn xác nhận: cửa hàng chưa kịp nhận đơn.');
        auditInTransaction(tx, this.db, { actorId: 'system', action: 'ORDER_AUTO_CANCELLED', target: `orders/${id}`,
          details: { reason: 'UNCONFIRMED_TIMEOUT', paid: order.paymentStatus === 'PAID' } });
        return true;
      });
    } catch { return false; }
  }
}

