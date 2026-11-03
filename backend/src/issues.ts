import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';
import { isAdminRole } from '../../src/utils/staff';
import { auditInTransaction } from './audit';

export const ISSUE_TYPES = ['MISSING_ITEM', 'WRONG_ITEM', 'POOR_QUALITY', 'LATE_DELIVERY', 'PAYMENT_PROBLEM', 'OTHER'] as const;
export const issueInput = z.object({
  type: z.enum(ISSUE_TYPES),
  description: z.string().trim().min(5, 'Vui lòng mô tả vấn đề (ít nhất 5 ký tự).').max(500),
}).strict();
export const RESOLUTIONS = ['APOLOGY', 'REFUND', 'VOUCHER', 'REJECTED'] as const;
export const resolveInput = z.object({
  resolution: z.enum(RESOLUTIONS),
  note: z.string().trim().min(3).max(300),
  /** Money to give back, recorded for the admin to pay by hand (no automatic refund). */
  refundAmount: z.number().int().positive().max(50_000_000).optional(),
}).strict();

// A problem can only be reported about an order that was actually prepared or is on its way.
const REPORTABLE = ['READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];

/** Customer problem reports about an order, handled by admins. One open report per order and problem type. */
export class IssueStore {
  constructor(private db: Firestore, private onResolved: (issue: DocumentData & { id: string }) => void = () => {}) {}

  async report(uid: string, orderId: string, input: z.infer<typeof issueInput>) {
    const orderRef = this.db.collection('orders').doc(orderId);
    const id = `${orderId}_${input.type}`;
    const issueRef = this.db.collection('order_issues').doc(id);
    return this.db.runTransaction(async tx => {
      const order = (await tx.get(orderRef)).data();
      if (!order || order.userId !== uid) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
      if (!REPORTABLE.includes(order.status)) throw new HttpError(409, 'Chỉ báo được vấn đề với đơn đã làm xong hoặc đang giao.');
      if ((await tx.get(issueRef)).exists) throw new HttpError(409, 'Bạn đã báo vấn đề này cho đơn hàng rồi. Cửa hàng sẽ phản hồi sớm.');
      tx.create(issueRef, { orderId, orderCode: order.orderCode ?? orderId, userId: uid, type: input.type, description: input.description,
        status: 'OPEN', createdAt: Timestamp.now() });
      return { id, status: 'OPEN' };
    });
  }

  /** The customer's own reports for one order, with the store's answer once there is one. */
  async forOrder(uid: string, orderId: string): Promise<DocumentData[]> {
    const found = await this.db.collection('order_issues').where('orderId', '==', orderId).get();
    return found.docs.map(doc => ({ ...doc.data(), id: doc.id }) as DocumentData & { id: string }).filter(issue => issue.userId === uid)
      .map(({ userId: _owner, ...issue }) => ({ ...issue, createdAt: iso(issue.createdAt), resolvedAt: iso(issue.resolvedAt) }));
  }

  async list(uid: string, status = 'OPEN') {
    await this.assertAdmin(uid);
    const found = await this.db.collection('order_issues').where('status', '==', status).limit(200).get();
    return found.docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: iso(doc.data().createdAt) }))
      .sort((a, b) => Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? ''));
  }

  async resolve(uid: string, id: string, input: z.infer<typeof resolveInput>) {
    await this.assertAdmin(uid);
    if (input.refundAmount && input.resolution !== 'REFUND') throw new HttpError(400, 'Chỉ nhập số tiền hoàn khi chọn "Hoàn tiền".');
    const ref = this.db.collection('order_issues').doc(id);
    const resolved = await this.db.runTransaction(async tx => {
      const issue = (await tx.get(ref)).data();
      if (!issue) throw new HttpError(404, 'Không tìm thấy phiếu.');
      if (issue.status !== 'OPEN') throw new HttpError(409, 'Phiếu này đã được xử lý.');
      const status = input.resolution === 'REJECTED' ? 'REJECTED' : 'RESOLVED';
      tx.update(ref, { status, resolution: input.resolution, resolutionNote: input.note, resolvedBy: uid, resolvedAt: Timestamp.now(),
        ...(input.refundAmount ? { refundAmount: input.refundAmount } : {}) });
      auditInTransaction(tx, this.db, { actorId: uid, action: 'ISSUE_RESOLVED', target: `order_issues/${id}`,
        details: { orderId: issue.orderId, resolution: input.resolution, ...(input.refundAmount ? { refundAmount: input.refundAmount } : {}) } });
      return { ...issue, id, status, resolution: input.resolution, resolutionNote: input.note };
    });
    this.onResolved(resolved);
    return { id, status: resolved.status };
  }

  private async assertAdmin(uid: string) {
    if (!isAdminRole((await this.db.collection('users').doc(uid).get()).data()?.role)) {
      throw new HttpError(403, 'Chỉ quản trị viên được xử lý phản ánh của khách.');
    }
  }
}

const iso = (value: unknown) => {
  const millis = (value as { toMillis?: () => number })?.toMillis?.();
  return millis === undefined ? undefined : new Date(millis).toISOString();
};
