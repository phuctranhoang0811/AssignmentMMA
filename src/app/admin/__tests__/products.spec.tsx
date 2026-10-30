import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminProductsScreen from '../products/index';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockAlert = jest.fn();
let mockDeliver: (snapshot: unknown) => void = () => {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ name })), doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  updateDoc: jest.fn(async () => {}), addDoc: jest.fn(async () => ({ id: 'new' })), deleteDoc: jest.fn(async () => {}), serverTimestamp: jest.fn(() => 'TS'),
  onSnapshot: jest.fn((_ref, next) => { mockDeliver = next; return () => {}; }),
}));

const stored = (id: string, data: Record<string, unknown>) => ({ id, data: () => ({ name: id, categoryId: 'pizza', description: '', basePrice: 100000, isAvailable: true, ...data }) });
const snapshot = (docs: ReturnType<typeof stored>[]) => ({ empty: docs.length === 0, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) });
const load = (docs = [stored('Pizza Bò', { basePrice: 150000 }), stored('Pepsi', { categoryId: 'drinks', basePrice: 20000, isAvailable: false })]) =>
  act(async () => { mockDeliver(snapshot(docs)); });

beforeEach(() => jest.clearAllMocks());

test('the catalog lists stored products with their price and stock state', async () => {
  await render(<AdminProductsScreen />);
  await load();
  expect(screen.getByText('Pizza Bò')).toBeTruthy();
  expect(screen.getByText(/150\.000/)).toBeTruthy();
  expect(screen.getByText('Đang bán')).toBeTruthy();
  expect(screen.getByText('Hết món')).toBeTruthy();
});

test('search and category pills narrow the list', async () => {
  await render(<AdminProductsScreen />);
  await load();
  await fireEvent.press(screen.getByText('Thức uống'));
  expect(screen.queryByText('Pizza Bò')).toBeNull();
  expect(screen.getByText('Pepsi')).toBeTruthy();
  await fireEvent.press(screen.getByText('Tất cả'));
  await fireEvent.changeText(screen.getByPlaceholderText('Tìm tên món pizza, thức uống...'), 'zzz');
  expect(screen.getByText('Không tìm thấy món ăn nào phù hợp')).toBeTruthy();
});

test('flipping the stock switch updates Firestore, and rolls back with a message when it is refused', async () => {
  await render(<AdminProductsScreen />);
  await load();
  await act(async () => { fireEvent(screen.getByLabelText('Đang bán Pizza Bò'), 'valueChange', false); });
  expect(updateDoc).toHaveBeenCalledWith({ path: 'products/Pizza Bò' }, { isAvailable: false, updatedAt: 'TS' });

  (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
  await act(async () => { fireEvent(screen.getByLabelText('Đang bán Pepsi'), 'valueChange', true); });
  expect(mockAlert).toHaveBeenCalledWith('Chưa cập nhật được tình trạng món', 'Missing or insufficient permissions.');
  expect(screen.getAllByText('Hết món').length).toBeGreaterThan(0);
});

test('a new product needs a name and a valid price, then is created as available with two sizes', async () => {
  await render(<AdminProductsScreen />);
  await load();
  await fireEvent.press(screen.getByLabelText('Thêm món mới'));
  await act(async () => { await fireEvent.press(screen.getByText('Lưu món')); });
  expect(mockAlert).toHaveBeenCalledWith('Lỗi', 'Vui lòng nhập tên món và giá bán');

  await fireEvent.changeText(screen.getByPlaceholderText('Ví dụ: Pizza Hải Sản Sốt Pesto'), 'Pizza Pesto');
  await fireEvent.changeText(screen.getByPlaceholderText('Ví dụ: 189000'), '0');
  await act(async () => { await fireEvent.press(screen.getByText('Lưu món')); });
  expect(mockAlert).toHaveBeenLastCalledWith('Lỗi', 'Giá bán phải là số hợp lệ');
  expect(addDoc).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByPlaceholderText('Ví dụ: 189000'), '189.000');
  await act(async () => { await fireEvent.press(screen.getByText('Lưu món')); });
  expect(addDoc).toHaveBeenCalledWith({ name: 'products' }, expect.objectContaining({
    name: 'Pizza Pesto', basePrice: 189000, isAvailable: true,
    variants: [expect.objectContaining({ price: 189000 }), expect.objectContaining({ price: 249000 })],
  }));
});

test('editing a product updates only that document', async () => {
  await render(<AdminProductsScreen />);
  await load();
  await fireEvent.press(screen.getAllByText('Sửa')[0]);
  await fireEvent.changeText(screen.getByPlaceholderText('Ví dụ: 189000'), '175000');
  await act(async () => { await fireEvent.press(screen.getByText('Lưu món')); });
  expect(updateDoc).toHaveBeenCalledWith({ path: 'products/Pizza Bò' }, expect.objectContaining({ basePrice: 175000 }));
});

test('deleting asks first and removes the document only on confirmation', async () => {
  await render(<AdminProductsScreen />);
  await load();
  await fireEvent.press(screen.getByLabelText('Xóa món Pepsi'));
  expect(deleteDoc).not.toHaveBeenCalled();
  const buttons = mockAlert.mock.calls.at(-1)![2] as { text: string; onPress?: () => Promise<void> }[];
  await act(async () => { await buttons.find(button => button.text === 'Xóa')!.onPress!(); });
  expect(deleteDoc).toHaveBeenCalledWith({ path: 'products/Pepsi' });
  expect(screen.queryByText('Pepsi')).toBeNull();
});

test('tapping a product opens its full editor page', async () => {
  await render(<AdminProductsScreen />);
  await load();
  await fireEvent.press(screen.getByText('Pizza Bò'));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/products/Pizza Bò');
});
