import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import RewardsScreen from '../rewards';
import { getRewardWallet, redeemReward } from '../../../services/rewardService';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockAlert = jest.fn();
let mockAuth: Record<string, unknown> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void | (() => void)) => { const { useEffect } = require('react'); useEffect(callback, [callback]); },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../services/rewardService', () => ({ getRewardWallet: jest.fn(), redeemReward: jest.fn() }));

const member = (overrides = {}) => ({ user: { id: 'u1', rewardPoints: 100, isDemo: false }, isAuthenticated: true, isLoading: false, ...overrides });
const gift = { id: 'G1', rewardId: 'R01', title: 'Đổi 01 Lon Pepsi 320ML miễn phí', points: 30, redeemedAt: '2026-10-30T10:00:00Z' };

beforeEach(() => { jest.clearAllMocks(); mockAuth = member(); });

test('a signed-out visitor is sent to log in and sees nothing', async () => {
  mockAuth = member({ user: null, isAuthenticated: false });
  await render(<RewardsScreen />);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/auth/login', params: { returnTo: 'rewards' } });
  expect(screen.queryByText('FPT rewards')).toBeNull();
});

test('the member card shows the points that the server wallet reports', async () => {
  (getRewardWallet as jest.Mock).mockResolvedValue({ points: 80, gifts: [] });
  await render(<RewardsScreen />);
  expect(await screen.findByText('80')).toBeTruthy();
  expect(screen.getByText('Quà của tôi (0)')).toBeTruthy();
});

test('rewards the customer cannot afford stay disabled', async () => {
  (getRewardWallet as jest.Mock).mockResolvedValue({ points: 40, gifts: [] });
  await render(<RewardsScreen />);
  await screen.findByText('40');
  const buttons = screen.getAllByText('Đổi');
  expect(buttons).toHaveLength(7);
  await fireEvent.press(buttons[6]);
  expect(redeemReward).not.toHaveBeenCalled();
});

test('redeeming spends points on the server, jumps to my gifts and confirms', async () => {
  (getRewardWallet as jest.Mock).mockResolvedValue({ points: 100, gifts: [] });
  (redeemReward as jest.Mock).mockResolvedValue({ points: 70, gifts: [gift] });
  await render(<RewardsScreen />);
  await screen.findByText('100');
  await act(async () => { await fireEvent.press(screen.getAllByText('Đổi')[0]); });
  expect(redeemReward).toHaveBeenCalledWith('R01');
  expect(mockAlert).toHaveBeenCalledWith('Đổi quà thành công', expect.stringContaining('Pepsi'));
  expect(screen.getByText('Quà của tôi (1)')).toBeTruthy();
  expect(screen.getByText('Mã quà: G1')).toBeTruthy();
  expect(screen.getByText('70')).toBeTruthy();
});

test('a failed redemption explains why and reloads the wallet', async () => {
  (getRewardWallet as jest.Mock).mockResolvedValue({ points: 100, gifts: [] });
  (redeemReward as jest.Mock).mockRejectedValue(new Error('Không đủ điểm.'));
  await render(<RewardsScreen />);
  await screen.findByText('100');
  const loads = (getRewardWallet as jest.Mock).mock.calls.length;
  await act(async () => { await fireEvent.press(screen.getAllByText('Đổi')[0]); });
  expect(mockAlert).toHaveBeenCalledWith('Chưa thể đổi quà', 'Không đủ điểm.');
  expect((getRewardWallet as jest.Mock).mock.calls.length).toBeGreaterThan(loads);
});

test('a wallet that cannot be loaded shows an error with a retry', async () => {
  (getRewardWallet as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ points: 10, gifts: [] });
  await render(<RewardsScreen />);
  expect(await screen.findByText('Không thể tải điểm và quà. Vui lòng thử lại.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('10')).toBeTruthy();
});

test('a demo account is asked to sign in with a real one and never loads a wallet', async () => {
  mockAuth = member({ user: { id: 'demo', rewardPoints: 0, isDemo: true } });
  await render(<RewardsScreen />);
  expect(screen.getByText('Đăng nhập tài khoản thật để tải điểm và đổi quà.')).toBeTruthy();
  expect(getRewardWallet).not.toHaveBeenCalled();
});

test('the history tab lists the points spent on each gift', async () => {
  (getRewardWallet as jest.Mock).mockResolvedValue({ points: 70, gifts: [gift] });
  await render(<RewardsScreen />);
  await screen.findByText('70');
  await fireEvent.press(screen.getByLabelText('Lịch sử đổi quà'));
  expect(screen.getByText('Đã dùng 30 điểm')).toBeTruthy();
});
