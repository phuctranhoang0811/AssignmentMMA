import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { parseStoreSettings } from '../storeSettings';
import { defaultStoreSettings } from '../../utils/storeHours';
import { forgetPayosAttempt, request } from '../payosService';
import { reportAdminAction } from '../orderApi';

jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: jest.fn() }));

const mockAuth = auth as unknown as { currentUser: unknown };
const respond = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, clone() { return this; } });

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  mockAuth.currentUser = { uid: 'u1', getIdToken: async () => 'token' };
});

describe('parseStoreSettings', () => {
  test('a well-formed document is used as it is', () => {
    expect(parseStoreSettings({ acceptingOrders: false, openTime: '08:00', closeTime: '22:00', closedMessage: 'Nghỉ lễ' }))
      .toEqual({ acceptingOrders: false, openTime: '08:00', closeTime: '22:00', closedMessage: 'Nghỉ lễ' });
  });

  test('a missing or malformed document means open all day, so a fresh install never blocks orders', () => {
    expect(parseStoreSettings(undefined)).toEqual(defaultStoreSettings);
    expect(parseStoreSettings({ acceptingOrders: 'no', openTime: 8, closeTime: null })).toEqual(defaultStoreSettings);
  });
});

describe('store closed answers', () => {
  test('a STORE_CLOSED refusal reaches the customer as the store\'s own message', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(403, { error: 'Cửa hàng mở cửa từ 08:00 đến 22:00.', code: 'STORE_CLOSED' }) as never);
    await expect(request('/api/orders/cash', { method: 'POST' })).rejects.toThrow('Cửa hàng mở cửa từ 08:00 đến 22:00.');
  });

  test('other refusals keep the generic message', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(403, { error: 'Tài khoản đã bị khóa.' }) as never);
    await expect(request('/api/payments/payos', { method: 'POST' })).rejects.toThrow('Chưa thể xử lý thanh toán');
  });
});

describe('forgetPayosAttempt', () => {
  const key = '@pizza_payos_attempt:u1';

  test('a dead payment link is forgotten so the next try creates a new order', async () => {
    await AsyncStorage.setItem(key, JSON.stringify({ orderId: 'dead', key: 'PAYOS-1' }));
    await forgetPayosAttempt('dead');
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  test('another order\'s attempt, and broken cache entries, are left alone or ignored', async () => {
    await AsyncStorage.setItem(key, JSON.stringify({ orderId: 'other', key: 'PAYOS-2' }));
    await forgetPayosAttempt('dead');
    expect(await AsyncStorage.getItem(key)).not.toBeNull();
    await AsyncStorage.setItem(key, '{broken');
    await expect(forgetPayosAttempt('dead')).resolves.toBeUndefined();
  });
});

describe('reportAdminAction', () => {
  test('sends the action to the audit endpoint', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(200, { success: true }) as never);
    await reportAdminAction('PRODUCT_DELETED', 'products/p1', { name: 'Pizza Bò' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/admin/audit');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ action: 'PRODUCT_DELETED', target: 'products/p1', details: { name: 'Pizza Bò' } });
  });

  test('a logging failure never throws, so the admin\'s change is not affected', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await expect(reportAdminAction('ROLE_CHANGED', 'users/u2')).resolves.toBeUndefined();
  });
});
