import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CartScreen from '../cart';
import { checkHasChosenAddress } from '../../../services/addressStorage';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockToast = jest.fn();
const mockRemove = jest.fn();
const mockAdd = jest.fn();
const mockSetPromo = jest.fn();
let mockCart: Record<string, unknown> = {};
let mockUser: { id: string; isDemo?: boolean } | null = null;
const product = { id: 'PZ1', name: 'Pizza bò', categoryId: 'pizza', basePrice: 100000, description: '', image: '', variants: [], addons: [], isAvailable: true };
const rec = { id: 'PA002', name: 'Khoai chiên', categoryId: 'side', basePrice: 30000, description: '', image: '', variants: [], addons: [], isAvailable: true };
const coupon = { code: 'FPT10', description: 'Giảm 10%', type: 'PERCENT', value: 10, minSubtotal: 50000 };

let mockStore: { open: boolean; reason: string | null; message: string } = { open: true, reason: null, message: '' };
jest.mock('../../../services/storeSettings', () => ({ useStoreStatus: () => mockStore }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../state/CartContext', () => ({ useCart: () => mockCart }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../../components/modals/StoreLocationModal', () => ({ StoreLocationModal: () => null }));
jest.mock('../../../services/addressStorage', () => ({
  getSavedDeliveryAddress: jest.fn(async () => null), checkHasChosenAddress: jest.fn(async () => true),
}));
jest.mock('../../../services/catalog', () => ({
  useCatalog: () => ({ productsMap: { PZ1: product, PA002: rec } }),
  useCoupons: () => [coupon],
  findCoupon: (list: { code: string }[], code: string) => list.find(c => c.code === code.toUpperCase()),
}));

const line = { lineId: 'l1', productId: 'PZ1', quantity: 2, addonIds: [] };
const cart = (overrides = {}) => ({ items: [line], removeItem: mockRemove, addItem: mockAdd, updateQuantity: jest.fn(), promoCode: '', setPromoCode: mockSetPromo,
  fulfillmentType: 'takeaway', setFulfillmentType: jest.fn(), isLoaded: true, needCutlery: false, setNeedCutlery: jest.fn(), ...overrides });

beforeEach(() => { jest.clearAllMocks(); mockCart = cart(); mockUser = { id: 'u1' }; mockStore = { open: true, reason: null, message: '' }; (checkHasChosenAddress as jest.Mock).mockResolvedValue(true); });

test('the cart waits for its saved items before deciding it is empty', async () => {
  mockCart = cart({ isLoaded: false });
  await render(<CartScreen />);
  expect(screen.getByText('Đang tải giỏ hàng…')).toBeTruthy();
  expect(screen.queryByText('Giỏ hàng đang trống')).toBeNull();
});

test('an empty cart offers the menu', async () => {
  mockCart = cart({ items: [] });
  await render(<CartScreen />);
  expect(screen.getByText('Giỏ hàng đang trống')).toBeTruthy();
  await fireEvent.press(screen.getByText('Khám phá Menu'));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/menu');
});

test('lines show their price and the checkout button carries the total and reward points', async () => {
  await render(<CartScreen />);
  expect(screen.getByText('Pizza bò')).toBeTruthy();
  expect(screen.getByText(/Thanh toán • 200\.000/)).toBeTruthy();
  expect(screen.getByText(/20 điểm/)).toBeTruthy();
});

test('a guest is sent to sign in, and comes back to checkout afterwards', async () => {
  mockUser = null;
  await render(<CartScreen />);
  await fireEvent.press(screen.getByText(/Đăng nhập để thanh toán/));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/auth/login', params: { returnTo: 'cart-checkout' } });
});

test('a signed-in customer with a chosen address goes straight to checkout; without one, the address picker opens', async () => {
  await render(<CartScreen />);
  await fireEvent.press(screen.getByText(/Thanh toán • /));
  await screen.findByText(/Thanh toán • /);
  expect(mockRouter.push).toHaveBeenCalledWith('/checkout');
  mockRouter.push.mockClear();
  (checkHasChosenAddress as jest.Mock).mockResolvedValue(false);
  await fireEvent.press(screen.getByText(/Thanh toán • /));
  await screen.findByText(/Thanh toán • /);
  expect(mockRouter.push).not.toHaveBeenCalled();
});

test('removing a line asks first, then removes it and says so', async () => {
  await render(<CartScreen />);
  await fireEvent.press(screen.getByLabelText('Xóa Pizza bò khỏi giỏ hàng'));
  expect(screen.getByText('Bạn có muốn xóa món này không?')).toBeTruthy();
  expect(mockRemove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Xác nhận'));
  expect(mockRemove).toHaveBeenCalledWith('l1');
  expect(mockToast).toHaveBeenCalledWith({ message: 'Đã xóa món khỏi giỏ hàng', type: 'info' });
});

test('a one-tap recommendation is added straight to the cart', async () => {
  await render(<CartScreen />);
  await fireEvent.press(screen.getByLabelText('Thêm Khoai chiên vào giỏ hàng'));
  expect(mockAdd).toHaveBeenCalledWith({ productId: 'PA002', addonIds: [], quantity: 1 });
});

test('while the store has paused ordering the cart explains why and does not open checkout', async () => {
  mockStore = { open: false, reason: 'PAUSED', message: 'Bếp quá tải, quay lại sau 30 phút.' };
  await render(<CartScreen />);
  expect(screen.getByText('Cửa hàng tạm ngưng nhận đơn')).toBeTruthy();
  await fireEvent.press(screen.getByText(/Thanh toán • /));
  expect(mockToast).toHaveBeenCalledWith({ message: 'Bếp quá tải, quay lại sau 30 phút.', type: 'info' });
  expect(mockRouter.push).not.toHaveBeenCalled();
});
