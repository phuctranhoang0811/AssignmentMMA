import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminPromotionsScreen from '../promotions';
import { deleteDoc, getDoc, setDoc } from 'firebase/firestore';

const mockAlert = jest.fn();
let mockDeliver: (snapshot: unknown) => void = () => {};
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: jest.fn(async () => ({ exists: () => false })), setDoc: jest.fn(async () => {}), deleteDoc: jest.fn(async () => {}),
  serverTimestamp: jest.fn(() => 'TS'),
  onSnapshot: jest.fn((_ref, next) => { mockDeliver = next; return () => {}; }),
}));

const stored = (code: string) => ({ data: () => ({ code, discountType: 'PERCENT', value: 20, minSubtotal: 100000, maxDiscount: 50000, description: `Voucher ${code}`, expiresAt: '31/12/2099' }) });
const snapshot = (docs: { data: () => unknown }[]) => ({ forEach: (fn: (d: unknown) => void) => docs.forEach(fn) });
const open = () => fireEvent.press(screen.getByLabelText('Tạo mã giảm giá mới'));
const fill = async (code: string, value: string, expiresAt = '31/12/2099') => {
  await fireEvent.changeText(screen.getByPlaceholderText('Ví dụ: FPTPIZZA30'), code);
  await fireEvent.changeText(screen.getByPlaceholderText('Ví dụ: 20'), value);
  await fireEvent.changeText(screen.getByPlaceholderText('31/12/2026'), expiresAt);
};

beforeEach(() => { jest.clearAllMocks(); (getDoc as jest.Mock).mockResolvedValue({ exists: () => false }); });

test('stored vouchers are listed ahead of the built-in ones', async () => {
  await render(<AdminPromotionsScreen />);
  await act(async () => { mockDeliver(snapshot([stored('ADMIN20')])); });
  expect(screen.getByText('ADMIN20')).toBeTruthy();
  expect(screen.getByText('FPT40')).toBeTruthy();
});

test('a voucher needs a code and a value', async () => {
  await render(<AdminPromotionsScreen />);
  await open();
  await act(async () => { await fireEvent.press(screen.getByText('Phát hành Voucher')); });
  expect(mockAlert).toHaveBeenCalledWith('Lỗi', 'Vui lòng nhập mã Voucher và giá trị giảm');
  expect(setDoc).not.toHaveBeenCalled();
});

test('an expired or badly written end date is refused', async () => {
  await render(<AdminPromotionsScreen />);
  await open();
  await fill('OLD10', '10', '01/01/2020');
  await act(async () => { await fireEvent.press(screen.getByText('Phát hành Voucher')); });
  expect(mockAlert).toHaveBeenCalledWith('Lỗi', expect.stringContaining('dd/mm/yyyy'));
  await fill('OLD10', '10', 'ngày mai');
  await act(async () => { await fireEvent.press(screen.getByText('Phát hành Voucher')); });
  expect(setDoc).not.toHaveBeenCalled();
});

test('a new voucher is stored under its upper-cased code', async () => {
  await render(<AdminPromotionsScreen />);
  await open();
  await fill('fptnew25', '25');
  await act(async () => { await fireEvent.press(screen.getByText('Phát hành Voucher')); });
  expect(setDoc).toHaveBeenCalledWith({ path: 'coupons/FPTNEW25' }, expect.objectContaining({ code: 'FPTNEW25', discountType: 'PERCENT', value: 25 }));
  expect(mockAlert).toHaveBeenCalledWith('Thành công', 'Đã phát hành mã ưu đãi FPTNEW25');
});

test('a code that already exists, in the store or built in, is not overwritten', async () => {
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });
  await render(<AdminPromotionsScreen />);
  await open();
  await fill('TAKEN', '10');
  await act(async () => { await fireEvent.press(screen.getByText('Phát hành Voucher')); });
  expect(mockAlert).toHaveBeenCalledWith('Mã đã tồn tại', 'Mã TAKEN đang được sử dụng.');
  expect(setDoc).not.toHaveBeenCalled();
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
  await fill('FPT40', '10');
  await act(async () => { await fireEvent.press(screen.getByText('Phát hành Voucher')); });
  expect(setDoc).not.toHaveBeenCalled();
});

test('built-in vouchers cannot be removed, stored ones are removed after confirmation', async () => {
  await render(<AdminPromotionsScreen />);
  await act(async () => { mockDeliver(snapshot([stored('ADMIN20')])); });
  await fireEvent.press(screen.getByLabelText('Gỡ mã FPT40'));
  expect(mockAlert).toHaveBeenLastCalledWith('Mã mặc định', expect.stringContaining('FPT40'));
  expect(deleteDoc).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('Gỡ mã ADMIN20'));
  const buttons = mockAlert.mock.calls.at(-1)![2] as { text: string; onPress?: () => Promise<void> }[];
  await act(async () => { await buttons.find(button => button.text === 'Gỡ bỏ')!.onPress!(); });
  expect(deleteDoc).toHaveBeenCalledWith({ path: 'coupons/ADMIN20' });
});
