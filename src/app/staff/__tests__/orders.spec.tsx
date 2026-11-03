import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import StaffOrdersScreen from '../orders';
import * as orderApi from '../../../services/orderApi';
import * as payos from '../../../services/payosService';

const mockShowToast = jest.fn();
let mockHear: (event: { id: string; orderCode?: number; status: string; kind: 'new' | 'updated' }) => void = () => {};
let mockAlertHear: (alert: { id: string; orderCode: string; waitedMinutes: number; kind: 'UNCONFIRMED' }) => void = () => {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => { const { useEffect } = require('react'); useEffect(callback, [callback]); },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff1' }, logout: jest.fn() }) }));
jest.mock('../../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../../services/deliveryService', () => ({ updateDeliveryOrder: jest.fn() }));
jest.mock('../../../services/orderApi', () => ({ listStaffOrders: jest.fn(), advanceStaffOrder: jest.fn(), rejectStaffOrder: jest.fn() }));
jest.mock('../../../services/payosService', () => ({ watchStaffOrders: jest.fn() }));
const api = orderApi as jest.Mocked<typeof orderApi>;
const socket = payos as jest.Mocked<typeof payos>;

const pending = (code: number) => ({ id: `o${code}`, orderCode: code, status: 'PENDING_CONFIRMATION', fulfillmentType: 'pickup',
  customer: { fullname: 'Lan', phone: '0912345678' }, items: [{ quantity: 2, productName: 'Pizza bò', lineTotal: 200000 }],
  paymentMethod: 'cash', paymentStatus: 'UNPAID', total: 200000, createdAt: new Date().toISOString() });

beforeEach(() => {
  jest.clearAllMocks();
  socket.watchStaffOrders.mockImplementation((onEvent, onConnect, onAlert) => { mockHear = onEvent; mockAlertHear = onAlert!; onConnect(); return () => {}; });
});

test('staff see pending orders with the customer, items and total', async () => {
  api.listStaffOrders.mockResolvedValue([pending(101)] as never);
  await render(<StaffOrdersScreen />);
  expect(await screen.findByText('#101')).toBeTruthy();
  expect(screen.getByText('Lan')).toBeTruthy();
  expect(screen.getByText('2 × Pizza bò')).toBeTruthy();
});

test('a new order announced over the socket raises an alert and reloads the list at once', async () => {
  api.listStaffOrders.mockResolvedValue([pending(101)] as never);
  await render(<StaffOrdersScreen />);
  await screen.findByText('#101');
  const loadsBefore = api.listStaffOrders.mock.calls.length;
  api.listStaffOrders.mockResolvedValue([pending(102), pending(101)] as never);
  await act(async () => { mockHear({ id: 'o102', orderCode: 102, status: 'PENDING_CONFIRMATION', kind: 'new' }); });
  expect(mockShowToast).toHaveBeenCalledWith({ message: 'Có đơn mới #102', type: 'info' });
  expect(api.listStaffOrders.mock.calls.length).toBeGreaterThan(loadsBefore);
  expect(await screen.findByText('#102')).toBeTruthy();
});

test('a plain status update reloads quietly, without a new-order alert', async () => {
  api.listStaffOrders.mockResolvedValue([pending(101)] as never);
  await render(<StaffOrdersScreen />);
  await screen.findByText('#101');
  await act(async () => { mockHear({ id: 'o101', orderCode: 101, status: 'CONFIRMED', kind: 'updated' }); });
  expect(mockShowToast).not.toHaveBeenCalled();
});

test('a load failure shows the backend message instead of an empty list', async () => {
  api.listStaffOrders.mockRejectedValue(new Error('Tài khoản chưa được cấp quyền nhân viên.'));
  await render(<StaffOrdersScreen />);
  expect(await screen.findByText('Tài khoản chưa được cấp quyền nhân viên.')).toBeTruthy();
});

test('an order nobody has confirmed for 10 minutes raises an urgent alert', async () => {
  api.listStaffOrders.mockResolvedValue([pending(101)] as never);
  await render(<StaffOrdersScreen />);
  await screen.findByText('#101');
  await act(async () => { mockAlertHear({ id: 'o101', orderCode: 'PF-101', waitedMinutes: 10, kind: 'UNCONFIRMED' }); });
  expect(mockShowToast).toHaveBeenCalledWith({ message: 'Đơn #PF-101 đã chờ 10 phút chưa được xác nhận!', type: 'error' });
});
