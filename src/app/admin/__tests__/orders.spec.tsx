import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminOrdersScreen from '../orders';
import { markOrderRefunded } from '../../../services/orderApi';

let mockDeliver: (snapshot: unknown) => void = () => {};
const mockAlert = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../services/orderApi', () => ({ markOrderRefunded: jest.fn(), rejectStaffOrder: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), orderBy: jest.fn(), query: jest.fn(),
  onSnapshot: jest.fn((_q, next) => { mockDeliver = next; return () => {}; }),
}));

const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => ({
  userId: 'u', customer: { fullname: 'Lan', phone: '0912345678' }, fulfillmentType: 'pickup', items: [], status: 'PENDING_CONFIRMATION',
  paymentMethod: 'payos', paymentStatus: 'PAID', total: 200000, createdAt: { toDate: () => new Date('2026-10-30T10:00:00Z') }, ...data }) });
const snapshot = (docs: ReturnType<typeof doc>[]) => ({ empty: docs.length === 0, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) });

beforeEach(() => jest.clearAllMocks());

test('cancelled paid orders form a refund queue with a count, oldest first', async () => {
  await render(<AdminOrdersScreen />);
  await act(async () => { mockDeliver(snapshot([
    doc('newer0001', { status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', createdAt: { toDate: () => new Date('2026-10-30T12:00:00Z') } }),
    doc('older0002', { status: 'CANCELLED', paymentStatus: 'REFUND_PENDING' }),
    doc('fine00003', { status: 'PREPARING' }),
  ])); });
  expect(screen.getByText('Chờ hoàn tiền (2)')).toBeTruthy();
  await fireEvent.press(screen.getByText('Chờ hoàn tiền (2)'));
  const refunds = screen.getAllByText(/Đã hoàn tiền cho khách/);
  expect(refunds).toHaveLength(2);
  expect(screen.queryByText(/FINE00003|E00003/i)).toBeNull();
});

test('an empty refund queue says so', async () => {
  await render(<AdminOrdersScreen />);
  await act(async () => { mockDeliver(snapshot([doc('a0000001', { status: 'PREPARING' })])); });
  expect(screen.queryByText(/Chờ hoàn tiền \(/)).toBeNull();
  await fireEvent.press(screen.getByText('Chờ hoàn tiền'));
  expect(screen.getByText('Không có đơn nào đang chờ hoàn tiền')).toBeTruthy();
});

test('confirming a refund records an optional note and calls the backend for that order', async () => {
  (markOrderRefunded as jest.Mock).mockResolvedValue({ id: 'older0002', paymentStatus: 'REFUNDED' });
  await render(<AdminOrdersScreen />);
  await act(async () => { mockDeliver(snapshot([doc('older0002', { status: 'CANCELLED', paymentStatus: 'REFUND_PENDING' })])); });
  await fireEvent.press(screen.getByText('Chờ hoàn tiền (1)'));
  await fireEvent.press(screen.getByText(/Đã hoàn tiền cho khách/));
  await fireEvent.changeText(screen.getByLabelText('Ghi chú hoàn tiền'), 'VCB 30/10 mã GD 123');
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận hoàn tiền' })); });
  expect(markOrderRefunded).toHaveBeenCalledWith('older0002', 'VCB 30/10 mã GD 123');
});

test('a refund waiting past its deadline is flagged, with the reason the order was cancelled', async () => {
  await render(<AdminOrdersScreen />);
  await act(async () => { mockDeliver(snapshot([doc('late0001', {
    status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', cancelReason: 'Quá hạn xác nhận: cửa hàng chưa kịp nhận đơn.',
    refundDueAt: { toMillis: () => Date.now() - 3600_000 },
  })])); });
  expect(screen.getByText(/QUÁ HẠN hoàn tiền/)).toBeTruthy();
  expect(screen.getByText(/Lý do hủy: Quá hạn xác nhận/)).toBeTruthy();
});
