import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import OffersScreen from '../offers';

const mockSetPromo = jest.fn();
const mockToast = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../state/CartContext', () => ({ useCart: () => ({ setPromoCode: mockSetPromo }) }));
jest.mock('../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../services/catalog', () => ({ useActiveCoupons: () => [
  { code: 'FPT40', description: 'Giảm 40%', discountType: 'PERCENT', value: 40, minSubtotal: 100000, expiresAt: '31/12/2026' },
  { code: 'FREESHIP', description: 'Miễn phí giao hàng', discountType: 'FIXED', value: 0, minSubtotal: 0 },
] }));

beforeEach(() => jest.clearAllMocks());

test('every active voucher is listed with its discount, description and expiry', async () => {
  await render(<OffersScreen />);
  expect(screen.getByText('FPT40')).toBeTruthy();
  expect(screen.getByText('40% OFF')).toBeTruthy();
  expect(screen.getByText('HSD: 31/12/2026')).toBeTruthy();
  expect(screen.getByText('HSD: Không giới hạn')).toBeTruthy();
  expect(screen.getByText('Miễn phí giao hàng')).toBeTruthy();
});

test('applying a voucher saves it for the next order and offers a shortcut to the cart', async () => {
  await render(<OffersScreen />);
  await fireEvent.press(screen.getAllByText('Áp dụng')[0]);
  expect(mockSetPromo).toHaveBeenCalledWith('FPT40');
  expect(screen.getByText('Đã lưu')).toBeTruthy();
  const toast = mockToast.mock.calls[0][0];
  expect(toast.message).toBe('Mã FPT40 đã được lưu cho đơn hàng tiếp theo');
  toast.onAction();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/cart');
});
