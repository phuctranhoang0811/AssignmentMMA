import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { apiUrl, request } from './payosService';
import type { CreateOrderInput } from './contracts';
import { deliveryCheckout } from './deliveryService';
import type { StaffOrder } from '../types/order';
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
  const result = await request<{ id: string; orderCode: string }>('/api/orders/cash', {
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
  try {
    response = await fetch(`${apiUrl()}/api/auth/phone-login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }),
    });
  } catch { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại hoặc đăng nhập bằng email.'); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 429 ? 'Bạn thử quá nhiều lần. Vui lòng chờ 15 phút.' : body?.error || 'Đăng nhập không thành công.');
  return body.token as string;
}
