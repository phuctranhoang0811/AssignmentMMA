import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ForgotPasswordScreen from '../forgot-password';

const mockReset = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }), router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ resetPassword: mockReset }) }));

const send = () => fireEvent.press(screen.getByRole('button', { name: 'Gửi email đặt lại mật khẩu' }));

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('an invalid email is refused locally', async () => {
  await render(<ForgotPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email đã đăng ký'), 'nope');
  await send();
  expect(screen.getByText('Vui lòng nhập địa chỉ email hợp lệ.')).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
});

test('a valid email is trimmed and lower-cased, and the customer is told to check their inbox without revealing if it exists', async () => {
  mockReset.mockResolvedValue(undefined);
  await render(<ForgotPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email đã đăng ký'), '  An@Gmail.com ');
  await act(async () => { await send(); });
  expect(mockReset).toHaveBeenCalledWith('an@gmail.com');
  expect(screen.getByText('Kiểm tra email của bạn')).toBeTruthy();
  expect(screen.getByText(/Nếu email an@gmail\.com đã được đăng ký/)).toBeTruthy();
});

test('resending is blocked for 60 seconds, counting down', async () => {
  mockReset.mockResolvedValue(undefined);
  await render(<ForgotPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email đã đăng ký'), 'an@gmail.com');
  await act(async () => { await send(); });
  expect(screen.getByText('Gửi lại sau 60s')).toBeTruthy();
  await fireEvent.press(screen.getByText('Gửi lại sau 60s'));
  expect(mockReset).toHaveBeenCalledTimes(1);
  // The countdown re-arms itself after each render, so tick one second at a time.
  for (let second = 0; second < 3; second++) await act(async () => { jest.advanceTimersByTime(1000); });
  expect(screen.getByText('Gửi lại sau 57s')).toBeTruthy();
  for (let second = 0; second < 57; second++) await act(async () => { jest.advanceTimersByTime(1000); });
  expect(screen.getByText('Gửi lại email')).toBeTruthy();
});

test('a failure is shown and the form stays editable; "Dùng email khác" returns to the form', async () => {
  mockReset.mockRejectedValueOnce(new Error('Chưa thể gửi email.')).mockResolvedValue(undefined);
  await render(<ForgotPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email đã đăng ký'), 'an@gmail.com');
  await act(async () => { await send(); });
  expect(screen.getByText('Chưa thể gửi email.')).toBeTruthy();
  await act(async () => { await send(); });
  await fireEvent.press(screen.getByText('Dùng email khác'));
  expect(screen.getByText('Đặt lại mật khẩu')).toBeTruthy();
});
