import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import OrderSuccessScreen from '../success';

let mockParams: Record<string, string> = {};
let mockEmit: (snapshot: { exists: () => boolean; data: () => unknown }) => void = () => {};
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, collection, id) => `${collection}/${id}`),
  onSnapshot: jest.fn((_ref, next) => { mockEmit = next; return () => {}; }),
}));
const order = (status: string, extra = {}) => ({ exists: () => true, data: () => ({ status, fulfillmentType: 'delivery', ...extra }) });

beforeEach(() => { jest.clearAllMocks(); mockParams = { orderId: 'o1', orderCode: '1761710000123', total: '250000' }; });

test('a paid order shows the amount, the short code and a loading hint until its status arrives', async () => {
  await render(<OrderSuccessScreen />);
  expect(screen.getByText('Thanh toán thành công!')).toBeTruthy();
  expect(screen.getByText('#1761710000123')).toBeTruthy();
  expect(screen.getByText(/250\.000/)).toBeTruthy();
  expect(screen.getByText('Đang tải trạng thái đơn...')).toBeTruthy();
});

test('an order created without payment (cash) keeps the generic title and shows no amount', async () => {
  mockParams = { orderId: 'abcdef1234567890' };
  await render(<OrderSuccessScreen />);
  expect(screen.getByText('Đã tạo đơn hàng thành công!')).toBeTruthy();
  expect(screen.getByText('#ABCDEF12')).toBeTruthy();
  expect(screen.queryByText('Đã thanh toán')).toBeNull();
});

test('the progress follows the live order as staff move it along', async () => {
  await render(<OrderSuccessScreen />);
  await act(async () => { mockEmit(order('PENDING_CONFIRMATION')); });
  expect(screen.getByText('Chờ xác nhận')).toBeTruthy();
  await act(async () => { mockEmit(order('PREPARING')); });
  expect(screen.getByText('Đang nấu')).toBeTruthy();
  await act(async () => { mockEmit(order('CANCELLED')); });
  expect(screen.getByText('Đơn hàng đã bị hủy')).toBeTruthy();
});

test('the buttons open the tracking screen on this order, or go home', async () => {
  await render(<OrderSuccessScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Theo dõi đơn hàng' }));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/order/tracking', params: { orderId: 'o1' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Về trang chủ' }));
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/home');
});
