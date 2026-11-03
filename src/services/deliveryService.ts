import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateOrderInput } from './contracts';
import type { DeliveryQuote } from '../types/delivery';
import { BackendRequestError, request } from './payosService';
import { auth } from './firebase';

export const ahamoveEnabled = process.env.EXPO_PUBLIC_DELIVERY_PROVIDER === 'ahamove';
export function deliveryCheckout(input: CreateOrderInput) {
  return {
    customer: { fullname: input.customer.fullname.trim(), phone: input.customer.phone.replace(/[\s.-]/g, ''),
      ...(input.customer.email?.trim() ? { email: input.customer.email.trim() } : {}) },
    fulfillmentType: input.fulfillmentType,
    ...(input.needCutlery ? { needCutlery: true } : {}),
    address: input.address?.trim(), deliveryNote: input.deliveryNote?.trim() || '',
    ...(input.deliveryLocation ? { deliveryLocation: input.deliveryLocation } : {}),
    items: input.items.map((item, index) => ({ ...item, lineId: `line-${index + 1}` })),
  };
}
export const getDeliveryQuote = (input: CreateOrderInput) => request<DeliveryQuote>('/api/delivery/quotes', {
  method: 'POST', body: JSON.stringify({ checkout: deliveryCheckout(input), paymentMethod: input.paymentMethod }),
});
type CodAttempt = { quoteId: string; key: string };
type CodResult = { id: string; orderCode: string };
export async function resumeAhamoveCod(): Promise<CodResult | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const storageKey = `@pizza_ahamove_cod:${uid}`;
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return null;
  const attempt = JSON.parse(raw) as CodAttempt;
  try {
    const result = await request<CodResult>('/api/delivery/orders', {
      method: 'POST', headers: { 'Idempotency-Key': attempt.key }, body: JSON.stringify({ quoteId: attempt.quoteId }),
    }, uid);
    await AsyncStorage.removeItem(storageKey);
    return result;
  } catch (error) {
    if (error instanceof BackendRequestError && [400, 404, 409].includes(error.status)) await AsyncStorage.removeItem(storageKey);
    throw error;
  }
}
export async function createAhamoveCod(quoteId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Vui lòng đăng nhập để đặt giao hàng.');
  const storageKey = `@pizza_ahamove_cod:${uid}`;
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing && (JSON.parse(existing) as CodAttempt).quoteId !== quoteId) {
    throw new Error('Có đơn trước chưa rõ kết quả. Nhấn “Kiểm tra đơn vừa gửi” trước khi đặt đơn khác.');
  }
  if (!existing) {
    await AsyncStorage.setItem(storageKey, JSON.stringify({ quoteId, key: `COD-${Date.now()}-${Math.random().toString(36).slice(2, 14)}` }));
  }
  return (await resumeAhamoveCod())!;
}
export const updateDeliveryOrder = (id: string, action: 'advance' | 'dispatch' | 'refresh') =>
  request(`/api/delivery/orders/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
