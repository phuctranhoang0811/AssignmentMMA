import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';
import { isAdminRole } from '../../src/utils/staff';

export type AuditInput = { actorId: string; action: string; target: string; details?: Record<string, unknown> };

/** Who did what, when. Written by the backend only (no Firestore rule opens this collection to apps). */
export const auditEntry = (input: AuditInput) => ({ ...input, details: input.details ?? {}, at: Timestamp.now() });

/** For a change already inside a transaction, so the log and the change succeed or fail together. */
export const auditInTransaction = (tx: Transaction, db: Firestore, input: AuditInput) =>
  tx.create(db.collection('audit_logs').doc(), auditEntry(input));

export const recordAudit = (db: Firestore, input: AuditInput) => db.collection('audit_logs').doc().create(auditEntry(input));

/** Admin actions the app performs straight against Firestore (roles, menu, vouchers) and then reports here. */
export const REPORTED_ACTIONS = [
  'ROLE_CHANGED', 'USER_LOCKED', 'USER_UNLOCKED',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'PRODUCT_STOCK_CHANGED',
  'COUPON_CREATED', 'COUPON_DELETED',
] as const;
export const reportedActionInput = z.object({
  action: z.enum(REPORTED_ACTIONS),
  target: z.string().trim().min(1).max(200),
  details: z.record(z.string().max(50), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).refine(value => Object.keys(value).length <= 10).optional(),
}).strict();

/**
 * The actor is always the signed-in admin (never taken from the request), so entries cannot be attributed to someone
 * else. The action itself is reported by the app after it succeeds, so the details are self-reported.
 */
export async function recordReportedAction(db: Firestore, uid: string, input: z.infer<typeof reportedActionInput>) {
  if (!isAdminRole((await db.collection('users').doc(uid).get()).data()?.role)) {
    throw new HttpError(403, 'Chỉ quản trị viên được ghi nhật ký thao tác.');
  }
  await recordAudit(db, { actorId: uid, action: input.action, target: input.target, details: { ...input.details, reportedBy: 'app' } });
  return { success: true };
}
