import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import MenuScreen from '../menu';
import { productService } from '../../../services';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../services', () => ({ productService: { list: jest.fn() } }));

const item = (id: string, categoryId: string, name: string, extra = {}) => ({ id, categoryId, name, description: `${name} thơm ngon`, basePrice: 100000,
  image: 'https://img.test/x.jpg', variants: [], addons: [], isAvailable: true, ...extra });
const menu = [
  item('PZ1', 'pizza', 'Pizza Hải Sản', { isNew: true, ingredients: ['tôm', 'mực'] }),
  item('PZ2', 'pizza', 'Pizza Bò', { memberDiscountTag: 'Giảm 20k', originalPrice: 130000 }),
  item('PA1', 'starters', 'Khoai chiên'),
  item('DR1', 'drinks', 'Pepsi'),
];

beforeEach(() => { jest.clearAllMocks(); (productService.list as jest.Mock).mockResolvedValue(menu); });

test('the menu shows a loading state, then products grouped by category with prices', async () => {
  let finish: (value: unknown) => void = () => {};
  (productService.list as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await render(<MenuScreen />);
  expect(screen.getByText('Đang tải thực đơn...')).toBeTruthy();
  await act(async () => { finish(menu); });
  expect(await screen.findByText('Pizza Hải Sản')).toBeTruthy();
  expect(screen.getByText('Khoai chiên')).toBeTruthy();
  expect(screen.getByText('Pepsi')).toBeTruthy();
  expect(screen.getAllByText(/100\.000/).length).toBeGreaterThan(0);
  expect(screen.getByText('New')).toBeTruthy();
  expect(screen.getByText('Giảm 20k')).toBeTruthy();
  expect(screen.getByText(/130\.000/)).toBeTruthy();
});

test('opening a product goes to its detail page', async () => {
  await render(<MenuScreen />);
  await fireEvent.press(await screen.findByText('Pizza Bò'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: 'PZ2' } });
});

test('search matches names, descriptions and ingredients, and says so when nothing matches', async () => {
  await render(<MenuScreen />);
  await screen.findByText('Pizza Bò');
  await fireEvent.press(screen.getByText('Tìm kiếm'));
  const box = screen.getByPlaceholderText('Tìm pizza, combo, khai vị, nước uống...');
  await fireEvent.changeText(box, 'mực');
  expect(screen.getByText('Pizza Hải Sản')).toBeTruthy();
  expect(screen.queryByText('Pepsi')).toBeNull();
  await fireEvent.changeText(box, 'khoai');
  expect(screen.getByText('Khoai chiên')).toBeTruthy();
  await fireEvent.changeText(box, 'zzzz');
  expect(screen.getByText('Không tìm thấy món phù hợp')).toBeTruthy();
});

test('choosing a category tab leaves search mode', async () => {
  await render(<MenuScreen />);
  await screen.findByText('Pizza Bò');
  await fireEvent.press(screen.getByText('Tìm kiếm'));
  await fireEvent.changeText(screen.getByPlaceholderText('Tìm pizza, combo, khai vị, nước uống...'), 'zzzz');
  await fireEvent.press(screen.getByLabelText('Thức Uống'));
  expect(screen.queryByText('Không tìm thấy món phù hợp')).toBeNull();
  expect(screen.getByText('Pepsi')).toBeTruthy();
});
