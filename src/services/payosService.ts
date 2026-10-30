import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { PermissionsAndroid, Platform } from 'react-native';
import { auth } from './firebase';
import type { CreateOrderInput } from './contracts';
import { payosCheckout } from '../utils/payosCheckout';

export type PaymentSnapshot = {
  id: string;
  orderCode: number;
  paymentStatus: 'PENDING' | 'PAID';
  total: number;
  paidAt: string | null;
  providerStatus?: string;
  payment: { paymentLinkId: string; checkoutUrl: string; qrCode: string | null } | null;
};

export function apiUrl() {
  const configured = Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_ANDROID_API_URL || process.env.EXPO_PUBLIC_API_URL
    : process.env.EXPO_PUBLIC_API_URL;
  const value = configured?.trim().replace(/\/$/, '');
  if (!value || !/^https?:\/\//.test(value)) {
    throw new Error('Máy chủ chưa được cấu hình. Vui lòng thử lại sau.');
  }
  return value;
}

async function requireLocalNetworkAccess(baseUrl: string) {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 37) return;
  const host = new URL(baseUrl).hostname;
  const local = host === 'localhost' || /^(127|10)\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (!local) return;
  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_LOCAL_NETWORK;
  if (await PermissionsAndroid.check(permission)) return;
  const result = await PermissionsAndroid.request(permission);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Vui lòng cho phép ứng dụng truy cập mạng cục bộ để kết nối máy chủ thanh toán. Bạn có thể bật quyền này trong Cài đặt của ứng dụng.');
  }
}

export class BackendRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function request<T>(path: string, options: RequestInit = {}, expectedUid?: string): Promise<T> {
  const baseUrl = apiUrl();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập tài khoản để tiếp tục.');
  if (expectedUid && user.uid !== expectedUid) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
  await requireLocalNetworkAccess(baseUrl);
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      if (response.status === 403) {
        // The store is closed or has paused ordering: say so instead of a generic failure.
        const detail = await response.clone().json().catch(() => null);
        if (detail?.code === 'STORE_CLOSED' && detail.error) throw new Error(detail.error);
      }
      if (/^\/api\/(rewards|delivery|staff|orders\/(cash|[^/]+\/cancel))/.test(path)) {
        const detail = await response.json().catch(() => null);
        throw new BackendRequestError(detail?.error || 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.', response.status);
      }
      if (response.status === 422) throw new Error('Sản phẩm hoặc tùy chọn không còn hợp lệ. Vui lòng kiểm tra lại giỏ hàng.');
      if (response.status === 502) {
        const detail = await response.json().catch(() => null);
        if (detail?.code === 'PAYOS_SIGNATURE_INVALID') {
          throw new Error('Cấu hình chữ ký payOS không hợp lệ. Vui lòng liên hệ cửa hàng để kiểm tra khóa checksum của kênh thanh toán.');
        }
      }
      if (response.status === 409) throw new Error('Thông tin hoặc báo phí đã thay đổi. Vui lòng kiểm tra lại đơn và lấy lại phí giao hàng.');
      throw new Error('Chưa thể xử lý thanh toán. Vui lòng thử lại, hệ thống sẽ giữ nguyên đơn chờ thanh toán.');
    }
    return await response.json() as T;
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      if (path.startsWith('/api/delivery')) throw new Error('Kết nối giao hàng quá thời gian chờ. Kiểm tra đơn vừa gửi trước khi thử lại.');
      if (path.startsWith('/api/rewards')) throw new Error('Kết nối quá thời gian chờ. Vui lòng tải lại quà để kiểm tra kết quả trước khi thử lại.');
      throw new Error('Kết nối thanh toán quá thời gian chờ. Vui lòng thử lại, giỏ hàng vẫn được giữ nguyên.');
    }
    if (error instanceof TypeError) {
      if (path.startsWith('/api/delivery')) throw new Error('Không kết nối được máy chủ giao hàng. Vui lòng kiểm tra kết nối và trạng thái đơn.');
      if (path.startsWith('/api/rewards')) throw new Error('Không kết nối được máy chủ đổi quà. Vui lòng kiểm tra kết nối và thử lại.');
      throw new Error('Không kết nối được máy chủ thanh toán. Vui lòng kiểm tra backend và kết nối mạng.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

// Keep the same request/key across retries, including an app restart after a timeout.
export async function createPayosPayment(input: CreateOrderInput): Promise<PaymentSnapshot> {
  apiUrl();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Vui lòng đăng nhập tài khoản trước khi thanh toán payOS.');
  const body = payosCheckout(input);
  const serialized = JSON.stringify(body);
  const storageKey = `@pizza_payos_attempt:${user.uid}`;
  const raw = await AsyncStorage.getItem(storageKey);
  let previous: { serialized: string; key: string; orderId?: string; cart: string } | null = null;
  try { previous = raw ? JSON.parse(raw) : null; } catch { /* Replace an invalid local cache. */ }
  const attempt = previous?.serialized === serialized ? previous : {
    serialized, key: `PAYOS-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`, cart: JSON.stringify(input.items),
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(attempt));
  const snapshot = await request<PaymentSnapshot>('/api/payments/payos', {
    method: 'POST', headers: { 'Idempotency-Key': attempt.key }, body: serialized,
  });
  await AsyncStorage.setItem(storageKey, JSON.stringify({ ...attempt, orderId: snapshot.id }));
  return snapshot;
}

export const getPayosPayment = (id: string) => request<PaymentSnapshot>(`/api/orders/${encodeURIComponent(id)}`);
export const reconcilePayosPayment = (id: string) => request<PaymentSnapshot>(`/api/orders/${encodeURIComponent(id)}/reconcile`, { method: 'POST' });

export async function forgetPayosAttempt(id: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const key = `@pizza_payos_attempt:${uid}`;
  try {
    const attempt = JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');
    if (attempt?.orderId === id) await AsyncStorage.removeItem(key);
  } catch { /* A broken cache entry is replaced on the next attempt anyway. */ }
}

export async function finishPayosCart(id: string, currentCart: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const key = `@pizza_payos_attempt:${uid}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return false;
  const attempt = JSON.parse(raw);
  if (attempt.orderId !== id) return false;
  await AsyncStorage.removeItem(key);
  return attempt.cart === currentCart;
}

export function watchPayosPayments(onUpdate: (snapshot: PaymentSnapshot) => void, onConnect: () => void) {
  const socket = io(apiUrl(), {
    auth: callback => {
      const user = auth.currentUser;
      if (!user) { callback({}); return; }
      void user.getIdToken().then(token => callback({ token })).catch(() => callback({}));
    },
  });
  socket.on('payment:updated', onUpdate);
  socket.on('connect', onConnect);
  socket.on('disconnect', reason => {
    if (reason === 'io server disconnect' && auth.currentUser) socket.connect();
  });
  return () => { socket.removeAllListeners(); socket.disconnect(); };
}

export type StaffOrderEvent = { id: string; orderCode?: number; status: string; kind: 'new' | 'updated' };

// Staff sockets are put in the "staff" room by the backend, which checks the account's role.
export type StaffAlert = { id: string; orderCode: string | number; waitedMinutes: number; kind: 'UNCONFIRMED' | 'RIDER_NO_PICKUP' | 'RIDER_OVERDUE' };

export type RiderOrderEvent = { id: string; status: string; available: boolean };

/** Riders' own channel: only store-delivery orders, no customer data. */
export function watchRiderOrders(onEvent: (event: RiderOrderEvent) => void, onConnect: () => void) {
  const socket = io(apiUrl(), {
    auth: callback => {
      const user = auth.currentUser;
      if (!user) { callback({}); return; }
      void user.getIdToken().then(token => callback({ token })).catch(() => callback({}));
    },
  });
  socket.on('rider:orders', onEvent);
  socket.on('connect', onConnect);
  return () => { socket.removeAllListeners(); socket.disconnect(); };
}

export function watchStaffOrders(onEvent: (event: StaffOrderEvent) => void, onConnect: () => void, onAlert?: (alert: StaffAlert) => void) {
  const socket = io(apiUrl(), {
    auth: callback => {
      const user = auth.currentUser;
      if (!user) { callback({}); return; }
      void user.getIdToken().then(token => callback({ token })).catch(() => callback({}));
    },
  });
  socket.on('staff:orders', onEvent);
  if (onAlert) socket.on('staff:alert', onAlert);
  socket.on('connect', onConnect);
  return () => { socket.removeAllListeners(); socket.disconnect(); };
}
