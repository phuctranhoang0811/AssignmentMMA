import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CheckoutScreen from '../index';
import { createCashOrder } from '../../../services/orderApi';
import { createPayosPayment } from '../../../services/payosService';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockClear = jest.fn();
const mockAlert = jest.fn();
let mockCart: Record<string, unknown> = {};
let mockUser: Record<string, unknown> | null = null;
const product = { id: 'PZ1', name: 'Pizza bò', categoryId: 'pizza', basePrice: 100000, description: '', image: '', variants: [], addons: [], isAvailable: true };

let mockStore: { open: boolean; reason: string | null; message: string; settings?: unknown } = { open: true, reason: null, message: '' };
const mockGeocode = jest.fn();
jest.mock('../../../services/addressService', () => ({ geocodeAddressStrict: (...args: unknown[]) => mockGeocode(...args) }));
const shipping = { storeLat: 10.8, storeLng: 106.8, baseKm: 3, baseFee: 15000, perKm: 5000, maxKm: 10 };
const northKm = (km: number) => ({ lat: 10.8 + km / 111.2, lng: 106.8 });
jest.mock('../../../services/storeSettings', () => ({ useStoreStatus: () => mockStore }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void | (() => void)) => { const { useEffect } = require('react'); useEffect(callback, [callback]); },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/CartContext', () => ({ useCart: () => mockCart }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../components/modals/StoreLocationModal', () => ({ StoreLocationModal: () => null }));
jest.mock('../../../components/modals/DeliveryTimeModal', () => ({ DeliveryTimeModal: () => null }));
jest.mock('../../../services/addressStorage', () => ({
  getSavedDeliveryAddress: jest.fn(async () => '12 Lê Lợi, Quận 1'), saveDeliveryAddress: jest.fn(),
  getSavedCustomerInfo: jest.fn(async () => null), saveCustomerInfo: jest.fn(),
}));
jest.mock('../../../services/catalog', () => ({
  useCatalog: () => ({ productsMap: { PZ1: product } }), useCoupons: () => [], findCoupon: () => undefined,
}));
jest.mock('../../../services/deliveryService', () => ({
  ahamoveEnabled: false, createAhamoveCod: jest.fn(), deliveryCheckout: (input: unknown) => input, getDeliveryQuote: jest.fn(), resumeAhamoveCod: jest.fn(),
}));
jest.mock('../../../services/orderApi', () => ({ createCashOrder: jest.fn() }));
jest.mock('../../../services/payosService', () => ({ createPayosPayment: jest.fn() }));

const customer = { id: 'u1', fullname: 'Lan Nguyen', phone: '0912345678', email: 'lan@gmail.com' };
const cart = (overrides = {}) => ({ items: [{ lineId: 'l1', productId: 'PZ1', quantity: 2, addonIds: [] }], isLoaded: true, clearCart: mockClear,
  promoCode: '', setPromoCode: jest.fn(), fulfillmentType: 'takeaway', setFulfillmentType: jest.fn(), needCutlery: false, ...overrides });
const placeOrder = () => fireEvent.press(screen.getByLabelText(/Đặt hàng|Đặt đơn và thanh toán payOS/));
const pickPayos = async () => {
  await fireEvent.press(screen.getByText('Tiền mặt'));
  await fireEvent.press(screen.getByText('Chuyển khoản bằng mã QR • Cần đăng nhập'));
  await fireEvent.press(screen.getByText('Áp dụng'));
};

beforeEach(() => { jest.clearAllMocks(); mockCart = cart(); mockUser = customer; mockStore = { open: true, reason: null, message: '' }; });

test('an empty cart sends the customer back to the menu', async () => {
  mockCart = cart({ items: [] });
  await render(<CheckoutScreen />);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/menu');
});

test('the order summary shows the items and the total with no delivery fee for pickup', async () => {
  await render(<CheckoutScreen />);
  expect(screen.getByText('Thanh toán')).toBeTruthy();
  expect(screen.getAllByText(/200\.000/).length).toBeGreaterThan(0);
});

test('a guest placing an order must fill in valid contact details first', async () => {
  mockUser = null;
  await render(<CheckoutScreen />);
  await placeOrder();
  expect(screen.getByText('Nhập họ tên người nhận.')).toBeTruthy();
  expect(createCashOrder).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Họ tên, bắt buộc'), 'An');
  await fireEvent.changeText(screen.getByLabelText('Số điện thoại, bắt buộc'), '123');
  await placeOrder();
  expect(screen.getByText('Nhập số di động Việt Nam hợp lệ.')).toBeTruthy();
});

test('a guest who is valid but not signed in is sent to log in, then back to checkout', async () => {
  mockUser = null;
  await render(<CheckoutScreen />);
  await fireEvent.changeText(screen.getByLabelText('Họ tên, bắt buộc'), 'An Tran');
  await fireEvent.changeText(screen.getByLabelText('Số điện thoại, bắt buộc'), '912345678');
  await placeOrder();
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/auth/login', params: { returnTo: 'checkout' } });
  expect(createCashOrder).not.toHaveBeenCalled();
});

test('a cash order is created by the backend, the cart is emptied and the confirmation shows its code', async () => {
  (createCashOrder as jest.Mock).mockResolvedValue({ id: 'o1', orderCode: 'ABC123', subtotal: 200000, discount: 0, total: 200000 });
  await render(<CheckoutScreen />);
  await act(async () => { await placeOrder(); });
  expect(createCashOrder).toHaveBeenCalledTimes(1);
  const [input] = (createCashOrder as jest.Mock).mock.calls[0];
  expect(input).toMatchObject({ fulfillmentType: 'PICKUP', paymentMethod: 'COD', customer: { fullname: 'Lan Nguyen', phone: '0912345678' } });
  expect(mockClear).toHaveBeenCalled();
  expect(await screen.findByText('#ABC123')).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalledWith('/(tabs)/menu');
});

test('a failed cash order keeps the cart and explains what happened', async () => {
  (createCashOrder as jest.Mock).mockRejectedValue(new Error('Món Pizza bò không còn bán.'));
  await render(<CheckoutScreen />);
  await act(async () => { await placeOrder(); });
  expect(mockAlert).toHaveBeenCalledWith('Chưa thể đặt hàng', 'Món Pizza bò không còn bán.');
  expect(mockClear).not.toHaveBeenCalled();
});

test('paying with payOS creates the payment and opens the QR screen for that order', async () => {
  (createPayosPayment as jest.Mock).mockResolvedValue({ id: 'a'.repeat(64) });
  await render(<CheckoutScreen />);
  await pickPayos();
  await act(async () => { await placeOrder(); });
  expect(createPayosPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'PAYOS', fulfillmentType: 'PICKUP' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/checkout/payos', params: { orderId: 'a'.repeat(64) } });
  expect(mockClear).not.toHaveBeenCalled();
});

test('a payOS failure is reported and nothing navigates', async () => {
  (createPayosPayment as jest.Mock).mockRejectedValue(new Error('Không kết nối được máy chủ thanh toán.'));
  await render(<CheckoutScreen />);
  await pickPayos();
  await act(async () => { await placeOrder(); });
  expect(mockAlert).toHaveBeenCalledWith('Chưa thể thanh toán payOS', 'Không kết nối được máy chủ thanh toán.');
  expect(mockRouter.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/checkout/payos' }));
});

test('while the store is closed the banner shows and placing an order is refused before any request', async () => {
  mockStore = { open: false, reason: 'OUTSIDE_HOURS', message: 'Cửa hàng mở cửa từ 08:00 đến 22:00. Vui lòng đặt hàng trong giờ mở cửa.' };
  await render(<CheckoutScreen />);
  expect(screen.getByText('Cửa hàng đang đóng cửa')).toBeTruthy();
  await act(async () => { await placeOrder(); });
  expect(mockAlert).toHaveBeenCalledWith('Cửa hàng chưa nhận đơn', expect.stringContaining('08:00'));
  expect(createCashOrder).not.toHaveBeenCalled();
  expect(createPayosPayment).not.toHaveBeenCalled();
});

describe('shipping fee by distance', () => {
  beforeEach(() => {
    mockCart = cart({ fulfillmentType: 'delivery' });
    mockStore = { open: true, reason: null, message: '', settings: { delivery: shipping } };
  });

  test('delivery shows the fee for the distance and sends the location with the order', async () => {
    mockGeocode.mockResolvedValue(northKm(5));
    (createCashOrder as jest.Mock).mockResolvedValue({ id: 'o1', orderCode: 'ABC123', subtotal: 200000, discount: 0, deliveryFee: 35000, total: 235000 });
    await render(<CheckoutScreen />);
    expect(await screen.findByText(/Phí giao hàng \(6\.\d km\)/)).toBeTruthy();
    expect(screen.getAllByText(/35\.000/).length).toBeGreaterThan(0);
    await act(async () => { await placeOrder(); });
    const [input] = (createCashOrder as jest.Mock).mock.calls[0];
    expect(input.deliveryLocation).toEqual(northKm(5));
  });

  test('an address beyond the delivery range cannot be ordered', async () => {
    mockGeocode.mockResolvedValue(northKm(20));
    await render(<CheckoutScreen />);
    expect(await screen.findByText('Ngoài vùng giao')).toBeTruthy();
    await act(async () => { await placeOrder(); });
    expect(createCashOrder).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Ngoài vùng giao hàng', expect.stringContaining('10 km'));
  });

  test('an address that cannot be located is never priced as if it were next door', async () => {
    mockGeocode.mockResolvedValue(null);
    await render(<CheckoutScreen />);
    expect(await screen.findByText('Chọn địa chỉ để tính')).toBeTruthy();
    await act(async () => { await placeOrder(); });
    expect(createCashOrder).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Chưa xác định được vị trí', expect.stringContaining('chọn lại địa chỉ'));
  });

  test('pickup orders never show or pay a shipping fee', async () => {
    mockCart = cart({ fulfillmentType: 'takeaway' });
    await render(<CheckoutScreen />);
    expect(screen.queryByText(/Phí giao hàng/)).toBeNull();
    expect(mockGeocode).not.toHaveBeenCalled();
  });
});
