import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import ProductDetailScreen from '../[id]';
import { productService } from '../../../services';

const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockToast = jest.fn();
const mockToggleFavorite = jest.fn();
let mockParams: Record<string, string> = {};
let mockItems: unknown[] = [];
const mockAlert = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true, push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/CartContext', () => ({ useCart: () => ({ items: mockItems, addItem: mockAdd, updateItem: mockUpdate }) }));
jest.mock('../../../state/FavoritesContext', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: mockToggleFavorite }) }));
jest.mock('../../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../../components/product/pizza/PizzaCustomizer', () => ({ PizzaCustomizer: () => null }));
jest.mock('../../../components/product/ProductImage', () => ({ ProductImage: () => null }));
jest.mock('../../../services', () => ({ productService: { getById: jest.fn(), list: jest.fn() } }));

const drink = { id: 'DR1', name: 'Pepsi', categoryId: 'drinks', description: 'Mát lạnh', basePrice: 20000, image: '', isAvailable: true,
  variants: [{ id: 'S', name: 'Lon 320ml', price: 20000 }, { id: 'L', name: 'Chai 1.5L', price: 35000 }],
  addons: [{ id: 'ice', name: 'Thêm đá', price: 0 }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'DR1' };
  mockItems = [];
  (productService.getById as jest.Mock).mockResolvedValue(drink);
  (productService.list as jest.Mock).mockResolvedValue([drink]);
});

test('a missing product explains itself and links back to the menu', async () => {
  (productService.getById as jest.Mock).mockResolvedValue(undefined);
  await render(<ProductDetailScreen />);
  expect(await screen.findByText('Món này không còn trong thực đơn.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Xem thực đơn'));
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/menu');
});

test('the first size is preselected and the bar shows its price', async () => {
  await render(<ProductDetailScreen />);
  expect(await screen.findByText('Chọn kích cỡ')).toBeTruthy();
  expect(screen.getByText('Pepsi')).toBeTruthy();
  expect(screen.getAllByText(/20\.000/).length).toBeGreaterThan(0);
});

test('choosing a bigger size and quantity adds exactly that line to the cart', async () => {
  await render(<ProductDetailScreen />);
  await fireEvent.press(await screen.findByText('Chai 1.5L'));
  await fireEvent.press(screen.getByLabelText('Tăng số lượng'));
  await fireEvent.press(screen.getByText('Thêm vào giỏ'));
  expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ productId: 'DR1', variantId: 'L', quantity: 2, addonIds: [] }));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã thêm 2x Pepsi vào giỏ hàng', actionText: 'Xem giỏ' }));
  // A new line stays on the page (the toast offers the cart); only editing returns to the cart.
  expect(router.back).not.toHaveBeenCalled();
});

test('an unavailable product cannot be added', async () => {
  (productService.getById as jest.Mock).mockResolvedValue({ ...drink, isAvailable: false });
  await render(<ProductDetailScreen />);
  await fireEvent.press(await screen.findByText('Thêm vào giỏ'));
  expect(mockAdd).not.toHaveBeenCalled();
});

test('editing a cart line loads its choices and saves them back instead of adding', async () => {
  mockParams = { id: 'DR1', lineId: 'l1' };
  mockItems = [{ lineId: 'l1', productId: 'DR1', variantId: 'L', addonIds: [], quantity: 3 }];
  await render(<ProductDetailScreen />);
  await fireEvent.press(await screen.findByText('Lưu thay đổi'));
  expect(mockUpdate).toHaveBeenCalledWith('l1', expect.objectContaining({ variantId: 'L', quantity: 3 }));
  expect(mockAdd).not.toHaveBeenCalled();
  expect(router.back).toHaveBeenCalled();
});

test('a stale edit link for a line that left the cart is refused', async () => {
  mockParams = { id: 'DR1', lineId: 'gone' };
  await render(<ProductDetailScreen />);
  await fireEvent.press(await screen.findByText('Lưu thay đổi'));
  expect(mockAlert).toHaveBeenCalledWith('Món không còn trong giỏ', expect.any(String));
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('the heart toggles the favourite', async () => {
  await render(<ProductDetailScreen />);
  await fireEvent.press(await screen.findByLabelText('Yêu thích'));
  expect(mockToggleFavorite).toHaveBeenCalledWith('DR1');
});
