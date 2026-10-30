import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import PayosScreen from '../payos';
import { auth } from '../../../services/firebase';
import * as payos from '../../../services/payosService';

const ORDER = 'a'.repeat(64);
const snapshot = (overrides = {}) => ({ id: ORDER, orderCode: 1761710000123, paymentStatus: 'PENDING' as const, total: 250000,
  paidAt: null, providerStatus: 'PENDING', payment: { paymentLinkId: 'l1', checkoutUrl: 'https://pay.test/l1', qrCode: 'QR-DATA' }, ...overrides });

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ orderId: 'a'.repeat(64) }) }));
jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const mockClearCart = jest.fn();
jest.mock('../../../state/CartContext', () => ({ useCart: () => ({ items: [{ lineId: 'l' }], clearCart: mockClearCart }) }));
jest.mock('../../../services/payosService', () => ({
  getPayosPayment: jest.fn(), reconcilePayosPayment: jest.fn(), finishPayosCart: jest.fn(), watchPayosPayments: jest.fn(), forgetPayosAttempt: jest.fn(),
}));
const mocked = payos as jest.Mocked<typeof payos>;
let pushUpdate: (value: ReturnType<typeof snapshot>) => void = () => {};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (auth as { currentUser: unknown }).currentUser = { uid: 'u1' };
  mocked.finishPayosCart.mockResolvedValue(true);
  mocked.watchPayosPayments.mockImplementation(onUpdate => { pushUpdate = onUpdate; return () => {}; });
});
afterEach(() => { jest.useRealTimers(); });

test('an unpaid order shows the QR code and the amount, and stays on the screen', async () => {
  mocked.reconcilePayosPayment.mockResolvedValue(snapshot());
  await render(<PayosScreen />);
  expect(await screen.findByText('Quét QR để thanh toán')).toBeTruthy();
  expect(screen.getByText('Đơn #1761710000123')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(router.replace).not.toHaveBeenCalled();
});

test('when payOS confirms payment the cart is emptied and the success screen opens', async () => {
  mocked.reconcilePayosPayment.mockResolvedValue(snapshot({ paymentStatus: 'PAID', providerStatus: 'PAID' }));
  await render(<PayosScreen />);
  expect((await screen.findAllByText('Thanh toán thành công')).length).toBeGreaterThan(0);
  expect(mockClearCart).toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/order/success',
    params: { orderId: ORDER, orderCode: '1761710000123', total: '250000' } });
});

test('a live socket update flips the screen to paid without waiting for a poll', async () => {
  mocked.reconcilePayosPayment.mockResolvedValue(snapshot());
  await render(<PayosScreen />);
  await screen.findByText('Quét QR để thanh toán');
  await act(async () => { pushUpdate(snapshot({ paymentStatus: 'PAID' })); });
  expect((await screen.findAllByText('Thanh toán thành công')).length).toBeGreaterThan(0);
});

test('a paid order is not downgraded by a later stale pending answer', async () => {
  mocked.reconcilePayosPayment.mockResolvedValue(snapshot());
  await render(<PayosScreen />);
  await screen.findByText('Quét QR để thanh toán');
  await act(async () => { pushUpdate(snapshot({ paymentStatus: 'PAID' })); });
  await act(async () => { pushUpdate(snapshot({ paymentStatus: 'PENDING' })); });
  expect((await screen.findAllByText('Thanh toán thành công')).length).toBeGreaterThan(0);
});

test('a cancelled or expired link tells the customer to go back to checkout', async () => {
  mocked.reconcilePayosPayment.mockResolvedValue(snapshot({ providerStatus: 'EXPIRED' }));
  await render(<PayosScreen />);
  expect(await screen.findByText('Link thanh toán đã đóng')).toBeTruthy();
  // The dead link must not be reused by the next attempt.
  expect(mocked.forgetPayosAttempt).toHaveBeenCalledWith(ORDER);
});

test('a backend error is shown instead of spinning forever', async () => {
  mocked.reconcilePayosPayment.mockRejectedValue(new Error('Không kết nối được máy chủ thanh toán.'));
  await render(<PayosScreen />);
  expect(await screen.findByText('Không kết nối được máy chủ thanh toán.')).toBeTruthy();
});
