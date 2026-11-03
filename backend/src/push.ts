import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

export const pushTokenInput = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[\w-]{10,}\]$/),
}).strict();

const MESSAGE: Record<string, string> = {
  CONFIRMED: 'đã được cửa hàng xác nhận',
  PREPARING: 'đang được chuẩn bị',
  READY: 'đã sẵn sàng',
  OUT_FOR_DELIVERY: 'đang được giao tới bạn',
  COMPLETED: 'đã hoàn thành. Chúc bạn ngon miệng!',
  CANCELLED: 'đã bị hủy',
};

/** Expo push tokens of customers' phones, in a backend-only collection (no Firestore rule opens it). */
export class PushStore {
  constructor(private db: Firestore, private send: typeof fetch = fetch) {}

  /** A phone belongs to whoever signed in last, so a token moves between accounts on the same device. */
  async save(uid: string, token: string) {
    await this.db.collection('push_tokens').doc(encodeURIComponent(token)).set({ uid, token, updatedAt: Timestamp.now() });
  }

  async notifyStatus(order: { userId?: string; orderCode?: number | string; status?: string }, orderId: string) {
    const text = order.status ? MESSAGE[order.status] : undefined;
    if (!order.userId || !text) return;
    await this.deliver(order.userId, `Đơn #${order.orderCode ?? orderId.slice(0, 8).toUpperCase()} ${text}`, orderId);
  }

  /** The store's rider took the order and is on the way to pick it up. */
  async notifyRiderAssigned(order: { userId?: string; orderCode?: number | string; rider?: { name?: string } | null }, orderId: string) {
    if (!order.userId || !order.rider) return;
    await this.deliver(order.userId, `Tài xế ${order.rider.name ?? ''} đã nhận đơn #${order.orderCode ?? orderId.slice(0, 8).toUpperCase()} và đang tới cửa hàng lấy món.`.replace('  ', ' '), orderId);
  }

  /** Tell the customer the money for a cancelled, paid order is on its way back. */
  async notifyRefund(order: { userId?: string; orderCode?: number | string; total?: number; [key: string]: unknown }, orderId: string) {
    if (!order.userId) return;
    await this.deliver(order.userId, `Đơn #${order.orderCode ?? orderId.slice(0, 8).toUpperCase()} đã được hoàn tiền. Tiền sẽ về tài khoản của bạn trong 1-3 ngày làm việc.`, orderId);
  }

  /** Tell the customer the store answered their problem report. */
  async notifyIssueResolved(issue: { userId?: string; orderCode?: number | string; resolutionNote?: string }, orderId: string) {
    if (!issue.userId) return;
    await this.deliver(issue.userId, `Cửa hàng đã phản hồi vấn đề của đơn #${issue.orderCode ?? orderId.slice(0, 8).toUpperCase()}: ${issue.resolutionNote ?? ''}`.trim(), orderId);
  }

  private async deliver(userId: string, body: string, orderId: string) {
    const tokens = (await this.db.collection('push_tokens').where('uid', '==', userId).get()).docs;
    if (!tokens.length) return;
    const response = await this.send('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map(doc => ({ to: doc.data().token, title: 'Pizza FPT', body, sound: 'default',
        channelId: 'orders', data: { orderId } }))),
    });
    const result = await response.json().catch(() => null) as { data?: { status: string; details?: { error?: string } }[] } | null;
    // Drop tokens of uninstalled apps so they are not retried forever.
    await Promise.all((result?.data ?? []).map((ticket, index) =>
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[index].ref.delete() : undefined));
  }
}
