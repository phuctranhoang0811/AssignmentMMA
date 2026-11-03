import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import OrderTrackingScreen from '../OrderTrackingScreen';
import { cancelOrder, submitOrderReview } from '../../../services/orderApi';

let mockDeliver: (snapshot: unknown) => void = () => {};
let mockUser: { id: string; fullname?: string; isDemo?: boolean } | null = { id: 'u1', fullname: 'Lan' };
let mockParams: Record<string, string> = {};
const mockAlert = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../services/orderApi', () => ({
  cancelOrder: jest.fn(), submitOrderReview: jest.fn(), listOrderIssues: jest.fn(async () => []), reportOrderIssue: jest.fn(),
  ISSUE_TYPES: [{ key: 'MISSING_ITEM', label: 'Thiếu món' }, { key: 'OTHER', label: 'Vấn đề khác' }],
}));
jest.mock('../DeliveryDetails', () => ({ DeliveryDetails: () => null }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), where: jest.fn(),
  onSnapshot: jest.fn((_q, next) => { mockDeliver = next; return () => {}; }),
}));

const order = (id: string, status: string, extra = {}) => ({ id, orderCode: Number(`10${id.slice(-1)}`), status, fulfillmentType: 'pickup', total: 250000,
  subtotal: 250000, deliveryTime: 'Sớm nhất', createdAt: { seconds: Date.parse('2026-10-30T10:00:00Z') / 1000 }, items: [{ productName: 'Pizza bò', quantity: 1, lineTotal: 250000 }],
  paymentMethod: 'payos', ...extra });
const deliver = (orders: ReturnType<typeof order>[]) => mockDeliver({ docs: orders.map(o => ({ id: o.id, data: () => o })) });

beforeEach(() => { jest.clearAllMocks(); mockUser = { id: 'u1', fullname: 'Lan' }; mockParams = {}; });

test('open orders are listed under "Đang xử lý" and finished ones under "Lịch sử"', async () => {
  await render(<OrderTrackingScreen />);
  await act(async () => { deliver([order('o1', 'PREPARING'), order('o2', 'COMPLETED')]); });
  expect(screen.getByText('#101')).toBeTruthy();
  expect(screen.queryByText('#102')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử' }));
  expect(screen.getByText('#102')).toBeTruthy();
});

test('a guest is asked to sign in instead of seeing someone\'s orders', async () => {
  mockUser = null;
  await render(<OrderTrackingScreen />);
  expect(await screen.findByText('Đăng nhập để xem đơn hàng của bạn')).toBeTruthy();
});

test('opening an order from the success screen shows its detail and live timeline', async () => {
  mockParams = { orderId: 'o1' };
  await render(<OrderTrackingScreen />);
  await act(async () => { deliver([order('o1', 'PREPARING')]); });
  expect(await screen.findByText('Chi tiết đơn hàng')).toBeTruthy();
  expect(screen.getByText('Cảm ơn bạn Lan!')).toBeTruthy();
  expect(screen.getByText('Đang nấu')).toBeTruthy();
  expect(screen.getByText(/dự kiến\)$/)).toBeTruthy();
  expect(screen.queryByText('Giảm giá thành viên')).toBeNull();
});

test('only a not-yet-confirmed order can be cancelled; later ones explain why not', async () => {
  mockParams = { orderId: 'o1' };
  await render(<OrderTrackingScreen />);
  await act(async () => { deliver([order('o1', 'PENDING_CONFIRMATION')]); });
  expect(screen.getByRole('button', { name: 'Hủy đơn' })).toBeTruthy();
  await act(async () => { deliver([order('o1', 'CONFIRMED')]); });
  expect(screen.queryByRole('button', { name: 'Hủy đơn' })).toBeNull();
  expect(screen.getByText(/không thể tự hủy/)).toBeTruthy();
});

test('cancelling asks for confirmation and then calls the backend', async () => {
  mockParams = { orderId: 'o1' };
  (cancelOrder as jest.Mock).mockResolvedValue({ id: 'o1', status: 'CANCELLED' });
  await render(<OrderTrackingScreen />);
  await act(async () => { deliver([order('o1', 'PENDING_CONFIRMATION')]); });
  await fireEvent.press(screen.getByRole('button', { name: 'Hủy đơn' }));
  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  expect(cancelOrder).not.toHaveBeenCalled();
  await act(async () => { await buttons.find(b => b.text === 'Hủy đơn')!.onPress!(); });
  expect(cancelOrder).toHaveBeenCalledWith('o1');
});

test('a completed order can be rated once, and a rated one shows thanks', async () => {
  mockParams = { orderId: 'o1' };
  (submitOrderReview as jest.Mock).mockResolvedValue({ orderId: 'o1', rating: 5 });
  await render(<OrderTrackingScreen />);
  await act(async () => { deliver([order('o1', 'COMPLETED')]); });
  expect(screen.queryByText('Cảm ơn bạn Lan!')).toBeNull();
  await fireEvent.press(screen.getByLabelText('5 sao'));
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  expect(submitOrderReview).toHaveBeenCalledWith('o1', 5, '');
  await act(async () => { deliver([order('o1', 'COMPLETED', { reviewed: true, rating: 5 })]); });
  expect(screen.getByText('Cảm ơn bạn đã đánh giá!')).toBeTruthy();
});
