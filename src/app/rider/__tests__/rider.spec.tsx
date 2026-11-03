import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import RiderOrdersScreen from '../index';
import * as orderApi from '../../../services/orderApi';
import * as payos from '../../../services/payosService';

const mockShowToast = jest.fn();
let mockHear: (event: { id: string; status: string; available: boolean }) => void = () => {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => { const { useEffect } = require('react'); useEffect(callback, [callback]); },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: { id: 'rider1', fullname: 'Anh Tài' }, logout: jest.fn() }) }));
jest.mock('../../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../../services/orderApi', () => ({
  listRiderOrders: jest.fn(), getRiderEarnings: jest.fn(), riderOrderAction: jest.fn(), riderFailOrder: jest.fn(),
  FAIL_REASON_LABELS: { CUSTOMER_UNREACHABLE: 'Không liên lạc được khách', WRONG_ADDRESS: 'Sai hoặc không tìm thấy địa chỉ', CUSTOMER_REFUSED: 'Khách từ chối nhận', OTHER: 'Lý do khác' },
}));
jest.mock('../../../services/payosService', () => ({ watchRiderOrders: jest.fn() }));
const api = orderApi as jest.Mocked<typeof orderApi>;
const socket = payos as jest.Mocked<typeof payos>;

const free = { id: 'o1', orderCode: 'PF-1', status: 'READY', address: '1 Lê Lợi', itemCount: 2, paymentStatus: 'UNPAID', codAmount: 235000, riderPay: 35000, mine: false };
const carrying = { ...free, id: 'o2', orderCode: 'PF-2', status: 'OUT_FOR_DELIVERY', mine: true, customer: { fullname: 'Lan', phone: '0912345678' },
  rider: { uid: 'rider1', name: 'Anh Tài', acceptedAt: '2026-10-30T09:00:00Z', pickedUpAt: '2026-10-30T09:10:00Z' } };
const earnings = { today: 35000, week: 90000, total: 190000, trips: 6, unsettled: { trips: 2, earned: 55000, cash: 335000 },
  recent: [{ id: 'o9', orderCode: 'PF-9', earned: 35000, distanceKm: 6.5, failed: true, deliveredAt: '2026-10-30T08:00:00Z' }] };

beforeEach(() => {
  jest.clearAllMocks();
  api.getRiderEarnings.mockResolvedValue(earnings as never);
  socket.watchRiderOrders.mockImplementation((onEvent, onConnect) => { mockHear = onEvent; onConnect(); return () => {}; });
});

test('before accepting, a rider sees the address, pay and cash to collect but not who the customer is', async () => {
  api.listRiderOrders.mockResolvedValue([free] as never);
  await render(<RiderOrdersScreen />);
  expect(await screen.findByText('#PF-1')).toBeTruthy();
  expect(screen.getByText('1 Lê Lợi')).toBeTruthy();
  expect(screen.getByText(/Tiền công: 35\.000/)).toBeTruthy();
  expect(screen.getByText('THU HỘ KHI GIAO')).toBeTruthy();
  expect(screen.queryByText('Lan')).toBeNull();
  expect(screen.getByText('Nhận đơn này')).toBeTruthy();
});

test('accepting an order calls the backend and reloads', async () => {
  api.listRiderOrders.mockResolvedValue([free] as never);
  api.riderOrderAction.mockResolvedValue({ id: 'o1', status: 'READY' });
  await render(<RiderOrdersScreen />);
  await act(async () => { fireEvent.press(await screen.findByText('Nhận đơn này')); });
  expect(api.riderOrderAction).toHaveBeenCalledWith('o1', 'accept');
});

test('a new free order announced to riders raises an alert; one already taken does not', async () => {
  api.listRiderOrders.mockResolvedValue([free] as never);
  await render(<RiderOrdersScreen />);
  await screen.findByText('#PF-1');
  await act(async () => { mockHear({ id: 'o3', status: 'READY', available: false }); });
  expect(mockShowToast).not.toHaveBeenCalled();
  await act(async () => { mockHear({ id: 'o3', status: 'READY', available: true }); });
  expect(mockShowToast).toHaveBeenCalledWith({ message: 'Có đơn mới sẵn sàng để giao', type: 'info' });
});

test('after pickup the rider can report a failed delivery with a reason', async () => {
  api.listRiderOrders.mockResolvedValue([carrying] as never);
  api.riderFailOrder.mockResolvedValue({ id: 'o2', status: 'CANCELLED' });
  await render(<RiderOrdersScreen />);
  await act(async () => { fireEvent.press(await screen.findByText('Đơn của tôi')); });
  await act(async () => { fireEvent.press(await screen.findByText('Giao thất bại')); });
  await act(async () => { fireEvent.press(screen.getByText('Sai hoặc không tìm thấy địa chỉ')); });
  await act(async () => { fireEvent.press(screen.getByText('Xác nhận giao thất bại')); });
  expect(api.riderFailOrder).toHaveBeenCalledWith('o2', 'WRONG_ADDRESS');
});

test('the earnings tab shows the totals, the cash held and what is owed at settlement', async () => {
  api.listRiderOrders.mockResolvedValue([] as never);
  await render(<RiderOrdersScreen />);
  await act(async () => { fireEvent.press(await screen.findByText('Thu nhập')); });
  expect(await screen.findByText(/Chưa đối soát với cửa hàng \(2 chuyến\)/)).toBeTruthy();
  expect(screen.getByText(/335\.000/)).toBeTruthy();
  // Cash held (335.000) exceeds wages (55.000): the rider hands back the difference.
  expect(screen.getByText(/bạn nộp lại cửa hàng 280\.000/)).toBeTruthy();
  expect(screen.getByText(/Giao thất bại/)).toBeTruthy();
});
