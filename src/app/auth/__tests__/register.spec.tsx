import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import RegisterScreen from '../register';
import { sendOtpToEmail, verifyOtp } from '../../../services/otpService';

const mockRegister = jest.fn();
const mockAlert = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: require('expo-router').router.replace }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ registerDemo: mockRegister }) }));
jest.mock('../../../services/otpService', () => ({ sendOtpToEmail: jest.fn(), verifyOtp: jest.fn() }));

const EMAIL = 'Nhập email của bạn';
const confirmButtons = () => screen.getAllByText('Xác nhận');

async function passOtp() {
  (sendOtpToEmail as jest.Mock).mockResolvedValue({ success: true });
  (verifyOtp as jest.Mock).mockResolvedValue({ success: true });
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(EMAIL), 'An@Gmail.com');
  await act(async () => { await fireEvent.press(confirmButtons()[0]); });
  // The email box is filled, so the empty inputs on screen are the four code boxes.
  const boxes = screen.getAllByDisplayValue('');
  for (const [index, digit] of ['1', '2', '3', '4'].entries()) await fireEvent.changeText(boxes[index], digit);
  await act(async () => { await fireEvent.press(confirmButtons()[1]); });
}

beforeEach(() => { jest.clearAllMocks(); });

test('step 1 refuses an invalid email and never asks for a code', async () => {
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(EMAIL), 'not-an-email');
  await fireEvent.press(confirmButtons()[0]);
  expect(mockAlert).toHaveBeenCalledWith('Thông báo', 'Vui lòng nhập email hợp lệ.');
  expect(sendOtpToEmail).not.toHaveBeenCalled();
});

test('a failed code request shows the server\'s reason and stays on step 1', async () => {
  (sendOtpToEmail as jest.Mock).mockResolvedValue({ success: false, error: 'Bạn thử quá nhiều lần.' });
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(EMAIL), 'an@gmail.com');
  await act(async () => { await fireEvent.press(confirmButtons()[0]); });
  expect(mockAlert).toHaveBeenCalledWith('Chưa gửi được mã', 'Bạn thử quá nhiều lần.');
  expect(screen.queryByText('Xác nhận đăng ký')).toBeNull();
});

test('a wrong code is rejected by the server and keeps the customer on the code screen', async () => {
  (sendOtpToEmail as jest.Mock).mockResolvedValue({ success: true });
  (verifyOtp as jest.Mock).mockResolvedValue({ success: false, error: 'Mã không đúng.' });
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(EMAIL), 'an@gmail.com');
  await act(async () => { await fireEvent.press(confirmButtons()[0]); });
  await act(async () => { await fireEvent.press(confirmButtons()[1]); });
  expect(mockAlert).toHaveBeenCalledWith('Thông báo', 'Vui lòng nhập đủ 4 số mã xác nhận.');
  expect(verifyOtp).not.toHaveBeenCalled();
});

test('a correct code (sent to the lower-cased email) opens the personal-info step, which checks name and phone', async () => {
  await passOtp();
  expect(verifyOtp).toHaveBeenCalledWith('an@gmail.com', '1234');
  expect(screen.getByPlaceholderText('Nhập tên của bạn')).toBeTruthy();
  await fireEvent.press(screen.getByText('Xác nhận'));
  expect(mockAlert).toHaveBeenLastCalledWith('Thông báo', 'Vui lòng nhập tên của bạn.');
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập tên của bạn'), 'An Tran');
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập số điện thoại của bạn'), '12345');
  await fireEvent.press(screen.getByText('Xác nhận'));
  expect(mockAlert).toHaveBeenLastCalledWith('Thông báo', expect.stringContaining('không hợp lệ'));
});

test('the password step enforces the strength rules and matching confirmation, then registers and celebrates', async () => {
  mockRegister.mockResolvedValue(undefined);
  await passOtp();
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập tên của bạn'), 'An Tran');
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập số điện thoại của bạn'), '0912 345 678');
  await fireEvent.press(screen.getByText('Xác nhận'));

  await fireEvent.changeText(screen.getByPlaceholderText('Vui lòng nhập mật khẩu của bạn'), 'weakpass');
  await fireEvent.press(screen.getByText('Đăng ký'));
  expect(mockAlert).toHaveBeenLastCalledWith('Mật khẩu chưa đạt yêu cầu', expect.any(String));

  await fireEvent.changeText(screen.getByPlaceholderText('Vui lòng nhập mật khẩu của bạn'), 'Strong#Pass1');
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập lại mật khẩu của bạn'), 'Different#1');
  await fireEvent.press(screen.getByText('Đăng ký'));
  expect(mockAlert).toHaveBeenLastCalledWith('Thông báo', 'Xác nhận mật khẩu không khớp.');
  expect(mockRegister).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByPlaceholderText('Nhập lại mật khẩu của bạn'), 'Strong#Pass1');
  await act(async () => { await fireEvent.press(screen.getByText('Đăng ký')); });
  expect(mockRegister).toHaveBeenCalledWith('An Tran', 'An@Gmail.com', '0912345678', 'Strong#Pass1', expect.objectContaining({ gender: 'Nam' }));
  expect(screen.getByText('Cảm ơn bạn đã đăng ký')).toBeTruthy();
  await fireEvent.press(screen.getByText('Quay về trang chủ'));
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
});

test('a registration the server refuses is reported, not celebrated', async () => {
  mockRegister.mockRejectedValue(new Error('Email này đã được đăng ký.'));
  await passOtp();
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập tên của bạn'), 'An Tran');
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập số điện thoại của bạn'), '0912345678');
  await fireEvent.press(screen.getByText('Xác nhận'));
  await fireEvent.changeText(screen.getByPlaceholderText('Vui lòng nhập mật khẩu của bạn'), 'Strong#Pass1');
  await fireEvent.changeText(screen.getByPlaceholderText('Nhập lại mật khẩu của bạn'), 'Strong#Pass1');
  await act(async () => { await fireEvent.press(screen.getByText('Đăng ký')); });
  expect(mockAlert).toHaveBeenLastCalledWith('Đăng ký thất bại', 'Email này đã được đăng ký.');
  expect(screen.queryByText('Cảm ơn bạn đã đăng ký')).toBeNull();
});
