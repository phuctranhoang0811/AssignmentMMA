import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AddressesScreen from '../addresses';

const mockAlert = jest.fn();
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));

const KEY = '@pizza_time_addresses_v1';
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test('the first visit shows the starter addresses and saves them', async () => {
  await render(<AddressesScreen />);
  expect(await screen.findByText('Nhà riêng')).toBeTruthy();
  expect(screen.getByText('Văn phòng')).toBeTruthy();
  expect(screen.getByText('Mặc định')).toBeTruthy();
  await waitFor(async () => expect((await stored()).length).toBeGreaterThan(0));
});

test('a new address needs a recipient, phone and street before it can be saved', async () => {
  await render(<AddressesScreen />);
  await screen.findByText('Nhà riêng');
  await fireEvent.press(screen.getByLabelText('Thêm địa chỉ mới'));
  await fireEvent.press(screen.getByText('Lưu địa chỉ'));
  expect(mockAlert).toHaveBeenCalledWith('Thiếu thông tin', 'Vui lòng điền đầy đủ các thông tin địa chỉ.');
});

test('a complete address is added at the top and persisted', async () => {
  await render(<AddressesScreen />);
  await screen.findByText('Nhà riêng');
  const before = (await stored()).length;
  await fireEvent.press(screen.getByLabelText('Thêm địa chỉ mới'));
  await fireEvent.changeText(screen.getByPlaceholderText('Nguyễn Văn A'), 'Trần Thị B');
  await fireEvent.changeText(screen.getByPlaceholderText('0901234567'), '0912345678');
  await fireEvent.changeText(screen.getByPlaceholderText('Số nhà, đường, phường, quận...'), '12 Nguyễn Huệ, Quận 1');
  await act(async () => { await fireEvent.press(screen.getByText('Lưu địa chỉ')); });
  expect(await screen.findByText('Trần Thị B • 0912345678')).toBeTruthy();
  expect((await stored()).length).toBe(before + 1);
});

test('choosing another default moves the badge', async () => {
  await render(<AddressesScreen />);
  await screen.findByText('Nhà riêng');
  await act(async () => { await fireEvent.press(screen.getByText('Đặt làm địa chỉ mặc định')); });
  const saved = await stored();
  expect(saved.filter((address: { isDefault: boolean }) => address.isDefault)).toHaveLength(1);
  expect(saved.find((address: { label: string }) => address.label === 'Văn phòng').isDefault).toBe(true);
});

test('deleting asks first and removes only on confirmation', async () => {
  await render(<AddressesScreen />);
  await screen.findByText('Văn phòng');
  await fireEvent.press(screen.getByLabelText('Xóa địa chỉ Văn phòng'));
  const [title, , buttons] = mockAlert.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
  expect(title).toBe('Xóa địa chỉ');
  expect(screen.getByText('Văn phòng')).toBeTruthy();
  await act(async () => { buttons.find(button => button.text === 'Xóa')!.onPress!(); });
  await waitFor(() => expect(screen.queryByText('Văn phòng')).toBeNull());
});
