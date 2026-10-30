import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import HomeScreen from '../home';
import { productService } from '../../../services';
import { getSavedDeliveryAddress } from '../../../services/addressStorage';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockAdd = jest.fn();
const mockToast = jest.fn();
let mockUser: Record<string, unknown> | null = null;
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/layout', () => ({ useContentWidth: () => 390 }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('../../../state/CartContext', () => ({ useCart: () => ({ addItem: mockAdd, fulfillmentType: 'delivery', setFulfillmentType: jest.fn() }) }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../../components/modals/StoreLocationModal', () => ({ StoreLocationModal: () => null }));
jest.mock('../../../services', () => ({ productService: { list: jest.fn() } }));
jest.mock('../../../services/addressStorage', () => ({ getSavedDeliveryAddress: jest.fn(async () => null), saveDeliveryAddress: jest.fn() }));

const product = (id: string, name: string) => ({ id, name, categoryId: 'pizza', description: '', basePrice: 99000, image: 'https://img.test/x.jpg', variants: [], addons: [], isAvailable: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
  (productService.list as jest.Mock).mockResolvedValue([product('PZ1', 'Pizza Hải Sản'), product('PZ2', 'Pizza Bò'), product('PZ3', 'Pizza Phô Mai')]);
});

test('a guest is invited to choose a delivery address', async () => {
  await render(<HomeScreen />);
  expect(screen.getByText('Bấm để chọn địa chỉ nhận hàng...')).toBeTruthy();
});

test('the saved address is shown, and a signed-in customer is greeted by first name', async () => {
  mockUser = { id: 'u1', fullname: 'Nguyễn Văn Lan', isDemo: false };
  (getSavedDeliveryAddress as jest.Mock).mockResolvedValue('12 Lê Lợi, Quận 1');
  await render(<HomeScreen />);
  expect(await screen.findByText('12 Lê Lợi, Quận 1')).toBeTruthy();
  expect(screen.getByText('Chào Lan, mừng bạn trở lại')).toBeTruthy();
});

test('recommended pizzas come from the menu and can be added with one tap', async () => {
  await render(<HomeScreen />);
  expect(await screen.findByText('Pizza Hải Sản')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Thêm Pizza Bò vào giỏ'));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã thêm Pizza Bò vào giỏ hàng' }));
});

test('the bell opens the offers page and "Xem thêm" opens the menu', async () => {
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByText('1'));
  expect(mockRouter.push).toHaveBeenCalledWith('/offers');
  await fireEvent.press(screen.getByText('Xem thêm'));
  expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/menu');
});

test('a menu that fails to load leaves the page usable', async () => {
  (productService.list as jest.Mock).mockRejectedValue(new Error('offline'));
  await render(<HomeScreen />);
  expect(screen.getByText('Menu')).toBeTruthy();
});
