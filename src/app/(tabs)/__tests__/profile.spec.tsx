import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ProfileScreen from '../profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockLogout = jest.fn(async () => {});
const mockAlert = jest.fn();
let mockAuth: Record<string, unknown> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => mockAuth }));

const signedIn = (user: Record<string, unknown>) => ({ user: { id: 'u1', fullname: 'Lan', rewardPoints: 55, role: 'USER', ...user }, isAuthenticated: true, logout: mockLogout });

beforeEach(() => { jest.clearAllMocks(); mockAuth = signedIn({}); });

test('a guest sees sign-in, register, order lookup and no account menus', async () => {
  mockAuth = { user: null, isAuthenticated: false, logout: mockLogout };
  await render(<ProfileScreen />);
  await fireEvent.press(screen.getByText('Đăng nhập'));
  expect(mockRouter.push).toHaveBeenCalledWith('/auth/login');
  await fireEvent.press(screen.getByText('Đăng ký'));
  expect(mockRouter.push).toHaveBeenCalledWith('/auth/register');
  await fireEvent.press(screen.getByText('Theo dõi đơn hàng'));
  expect(mockRouter.push).toHaveBeenCalledWith('/order/lookup');
  expect(screen.queryByText('Đăng xuất')).toBeNull();
});

test('a customer sees points and the account shortcuts', async () => {
  await render(<ProfileScreen />);
  expect(screen.getByText('Thành viên Thường')).toBeTruthy();
  expect(screen.getByText('55')).toBeTruthy();
  await fireEvent.press(screen.getByText('Hồ sơ của tôi'));
  expect(mockRouter.push).toHaveBeenCalledWith('/profile/edit');
  await fireEvent.press(screen.getByText('Đổi mật khẩu'));
  expect(mockRouter.push).toHaveBeenCalledWith('/profile/change-password');
  await fireEvent.press(screen.getByText('Lịch sử đơn hàng'));
  expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/orders');
});

test('a customer never sees the staff or admin portals', async () => {
  await render(<ProfileScreen />);
  expect(screen.queryByText(/Quản trị/)).toBeNull();
  expect(screen.queryByText(/Giám sát|Nhân viên/)).toBeNull();
});

test('staff and admins get their tier label and portal shortcut', async () => {
  mockAuth = signedIn({ role: 'EMPLOYEE' });
  const staff = await render(<ProfileScreen />);
  expect(screen.getByText('Nhân viên (Staff)')).toBeTruthy();
  await staff.unmount();

  mockAuth = signedIn({ role: 'ADMIN' });
  await render(<ProfileScreen />);
  expect(screen.getByText('Quản trị viên (Admin)')).toBeTruthy();
  expect(screen.getByText('15%')).toBeTruthy();
});

test('signing out asks for confirmation first', async () => {
  await render(<ProfileScreen />);
  await fireEvent.press(screen.getByText('Đăng xuất'));
  expect(mockLogout).not.toHaveBeenCalled();
  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await act(async () => { await buttons.find(button => button.text === 'Đăng xuất')!.onPress!(); });
  expect(mockLogout).toHaveBeenCalledTimes(1);
});

test('the member QR code can be shown and closed', async () => {
  await render(<ProfileScreen />);
  await fireEvent.press(screen.getByText('Hiển thị mã QR'));
  expect(screen.getByText('Mã Thành Viên')).toBeTruthy();
  await fireEvent.press(screen.getByText('Đóng'));
});
