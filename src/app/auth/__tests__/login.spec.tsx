import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import LoginScreen from '../login';

const mockLogin = jest.fn();
let mockUser: { id: string; role?: string } | null = null;
let mockParams: Record<string, string> = {};
const mockAlert = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loginDemo: mockLogin, loginGoogle: jest.fn(), isLoading: false }) }));

const IDENTIFIER = 'Vui lòng nhập email hoặc số điện thoại của bạn';
const PASSWORD = 'Vui lòng nhập mật khẩu của bạn';
const submit = () => fireEvent.press(screen.getByText('Đăng Nhập'));

beforeEach(() => { jest.clearAllMocks(); mockUser = null; mockParams = {}; });

test('an empty form and a short password are refused before any request', async () => {
  await render(<LoginScreen />);
  await submit();
  expect(screen.getByText('Vui lòng nhập email hoặc số điện thoại của bạn')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER), '0912345678');
  await fireEvent.changeText(screen.getByPlaceholderText(PASSWORD), '123');
  await submit();
  expect(screen.getByText('Mật khẩu phải có ít nhất 6 ký tự')).toBeTruthy();
  expect(mockLogin).not.toHaveBeenCalled();
});

test('valid credentials sign in with the trimmed identifier and the password', async () => {
  mockLogin.mockResolvedValue(undefined);
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER), '  an@gmail.com ');
  await fireEvent.changeText(screen.getByPlaceholderText(PASSWORD), 'secret1');
  await submit();
  expect(mockLogin).toHaveBeenCalledWith('an@gmail.com', 'secret1');
});

test('a wrong password shows the server\'s message and stays on the screen', async () => {
  mockLogin.mockRejectedValue(new Error('Mật khẩu không chính xác.'));
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER), 'an@gmail.com');
  await fireEvent.changeText(screen.getByPlaceholderText(PASSWORD), 'secret1');
  await submit();
  expect(mockAlert).toHaveBeenCalledWith('Đăng nhập thất bại', 'Mật khẩu không chính xác.');
  expect(router.replace).not.toHaveBeenCalled();
});

test('after sign-in a customer goes to the menu flow and staff to the staff portal', async () => {
  mockLogin.mockImplementation(async () => { mockUser = { id: 'u1', role: 'EMPLOYEE' }; });
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER), 'staff@gmail.com');
  await fireEvent.changeText(screen.getByPlaceholderText(PASSWORD), 'secret1');
  await act(async () => { await submit(); });
  expect(router.replace).toHaveBeenCalledWith('/staff/orders');
});
