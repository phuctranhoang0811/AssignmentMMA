import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { apiUrl, request } from './payosService';
import type { CreateOrderInput } from './contracts';
import { deliveryCheckout } from './deliveryService';
import type { RiderEarnings, RiderOrder, StaffOrder } from '../types/order';
import type { DeliveryFeeConfig } from '../utils/deliveryFee';
export type { StaffOrder } from '../types/order';

// Same shape as a Firestore order document, minus internal fields.
export type LookupOrder = Record<string, any> & { id: string; orderCode: string; status: string };

// Same key for the same cart across retries (and app restarts), so a timeout never creates a second order.
export async function createCashOrder(input: CreateOrderInput, deliveryTime: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Vui lòng đăng nhập để đặt hàng.');
  const { deliveryNote, ...checkout } = deliveryCheckout(input);
  const body = JSON.stringify({
    checkout: { ...checkout, ...(input.fulfillmentType === 'DELIVERY' ? { deliveryNote } : { address: undefined }) },
    ...(input.promoCode ? { promoCode: input.promoCode } : {}), deliveryTime,
  });
  const storageKey = `@pizza_cash_attempt:${uid}`;
  const saved = JSON.parse((await AsyncStorage.getItem(storageKey)) ?? 'null') as { body: string; key: string } | null;
  const attempt = saved?.body === body ? saved : { body, key: `CASH-${Date.now()}-${Math.random().toString(36).slice(2, 12)}` };
  await AsyncStorage.setItem(storageKey, JSON.stringify(attempt));
  const result = await request<{ id: string; orderCode: string; subtotal: number; discount: number; deliveryFee?: number; total: number }>('/api/orders/cash', {
    method: 'POST', headers: { 'Idempotency-Key': attempt.key }, body,
  }, uid);
  await AsyncStorage.removeItem(storageKey);
  return result;
}

export const cancelOrder = (id: string) =>
  request<{ id: string; status: string }>(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });

export const listStaffOrders = (status?: string) =>
  request<StaffOrder[]>(`/api/staff/orders${status ? `?status=${status}` : ''}`);
export const advanceStaffOrder = (id: string) =>
  request<{ id: string; status: string }>(`/api/staff/orders/${encodeURIComponent(id)}/advance`, { method: 'POST' });
/** Proves the signed-in account's e-mail: Google needs no code, e-mail accounts send the code mailed to them. */
export const verifyAccountEmail = (code?: string) =>
  request<{ verified: boolean }>('/api/account/verify-email', { method: 'POST', body: JSON.stringify(code ? { code } : {}) });
export const FAIL_REASON_LABELS = {
  CUSTOMER_UNREACHABLE: 'Không liên lạc được khách', WRONG_ADDRESS: 'Sai hoặc không tìm thấy địa chỉ',
  CUSTOMER_REFUSED: 'Khách từ chối nhận', OTHER: 'Lý do khác',
} as const;
export type FailReason = keyof typeof FAIL_REASON_LABELS;
export const riderFailOrder = (id: string, reason: FailReason, note?: string) =>
  request<{ id: string; status: string }>(`/api/rider/orders/${encodeURIComponent(id)}/fail`, {
    method: 'POST', body: JSON.stringify({ reason, ...(note?.trim() ? { note: note.trim() } : {}) }),
  });
export const unassignRiderOrder = (id: string) =>
  request<{ id: string; status: string }>(`/api/staff/orders/${encodeURIComponent(id)}/unassign-rider`, { method: 'POST' });
export type RiderLedgerRow = { uid: string; name: string; trips: number; earned: number; cash: number; net: number };
export const getRiderLedger = () => request<RiderLedgerRow[]>('/api/admin/riders/ledger');
export const settleRider = (uid: string) =>
  request<{ riderUid: string; trips: number; earned: number; cash: number; net: number }>(`/api/admin/riders/${encodeURIComponent(uid)}/settle`, { method: 'POST' });
export const getRiderEarnings = () => request<RiderEarnings>('/api/rider/earnings');
export const listRiderOrders = () => request<RiderOrder[]>('/api/rider/orders');
export const riderOrderAction = (id: string, action: 'accept' | 'release' | 'pickup' | 'deliver') =>
  request<{ id: string; status: string }>(`/api/rider/orders/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
export const markOrderRefunded = (id: string, note?: string) =>
  request<{ id: string; paymentStatus: string }>(`/api/admin/orders/${encodeURIComponent(id)}/refunded`, {
    method: 'POST', body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
  });
export const rejectStaffOrder = (id: string, reason: string) =>
  request<{ id: string; status: string }>(`/api/staff/orders/${encodeURIComponent(id)}/reject`, {
    method: 'POST', body: JSON.stringify({ reason }),
  });

/** Guest lookup: no sign-in, phone + order code. */
export async function lookupOrder(phone: string, code: string): Promise<LookupOrder | null> {
  const query = new URLSearchParams({ phone: phone.trim(), code: code.trim() });
  const response = await fetch(`${apiUrl()}/api/orders/lookup?${query}`);
  if (response.status === 404) return null;
  if (response.status === 429) throw new Error('Bạn tra cứu quá nhanh. Vui lòng thử lại sau 1 phút.');
  if (!response.ok) throw new Error('Chưa thể tra cứu đơn. Vui lòng thử lại.');
  return response.json();
}

/** Phone + password → Firebase custom token, verified by the backend (no client access to other profiles). */
export async function phoneLoginToken(phone: string, password: string) {
  let response: Response;
  // An unreachable backend address (e.g. the emulator-only 10.0.2.2 on a real phone) would otherwise spin forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    response = await fetch(`${apiUrl()}/api/auth/phone-login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }),
      signal: controller.signal,
    });
  } catch { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại hoặc đăng nhập bằng email.'); }
  finally { clearTimeout(timeout); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 429 ? 'Bạn thử quá nhiều lần. Vui lòng chờ 15 phút.' : body?.error || 'Đăng nhập không thành công.');
  return body.token as string;
}

export const submitOrderReview = (id: string, rating: number, comment?: string) =>
  request<{ orderId: string; rating: number }>(`/api/orders/${encodeURIComponent(id)}/review`, {
    method: 'POST', body: JSON.stringify({ rating, ...(comment?.trim() ? { comment: comment.trim() } : {}) }),
  });

export const ISSUE_TYPES = [
  { key: 'MISSING_ITEM', label: 'Thiếu món' },
  { key: 'WRONG_ITEM', label: 'Sai món' },
  { key: 'POOR_QUALITY', label: 'Món nguội / chất lượng kém' },
  { key: 'LATE_DELIVERY', label: 'Giao trễ' },
  { key: 'PAYMENT_PROBLEM', label: 'Vấn đề thanh toán' },
  { key: 'OTHER', label: 'Vấn đề khác' },
] as const;
export type IssueType = typeof ISSUE_TYPES[number]['key'];
export type OrderIssue = {
  id: string; orderId: string; orderCode?: string | number; type: IssueType; description: string;
  status: 'OPEN' | 'RESOLVED' | 'REJECTED'; createdAt?: string; resolution?: string; resolutionNote?: string; refundAmount?: number;
};

const orderPath = (id: string) => `/api/orders/${encodeURIComponent(id)}`;
export const reportOrderIssue = (orderId: string, type: IssueType, description: string) =>
  request<{ id: string; status: string }>(`${orderPath(orderId)}/issues`, { method: 'POST', body: JSON.stringify({ type, description: description.trim() }) });
export const listOrderIssues = (orderId: string) => request<OrderIssue[]>(`${orderPath(orderId)}/issues`);
export const listIssues = (status: OrderIssue['status'] = 'OPEN') => request<OrderIssue[]>(`/api/admin/issues?status=${status}`);
export const resolveIssue = (id: string, body: { resolution: 'APOLOGY' | 'REFUND' | 'VOUCHER' | 'REJECTED'; note: string; refundAmount?: number }) =>
  request<{ id: string; status: string }>(`/api/admin/issues/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify(body) });

export type StoreSettingsInput = { acceptingOrders: boolean; openTime: string; closeTime: string; closedMessage?: string; delivery?: DeliveryFeeConfig };
export const updateStoreSettings = (body: StoreSettingsInput) =>
  request<StoreSettingsInput>('/api/admin/store-settings', { method: 'PUT', body: JSON.stringify(body) });

/**
 * Tell the audit log about an admin action the app just performed on Firestore (role, menu, voucher changes).
 * Best effort: a logging failure must never undo or block the change itself.
 */
export async function reportAdminAction(action: string, target: string, details?: Record<string, string | number | boolean | null>) {
  try { await request('/api/admin/audit', { method: 'POST', body: JSON.stringify({ action, target, ...(details ? { details } : {}) }) }); }
  catch { /* see above */ }
}
