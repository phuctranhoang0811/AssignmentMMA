import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminRidersScreen from '../riders';
import * as orderApi from '../../../services/orderApi';

const mockAlert = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => { const { useEffect } = require('react'); useEffect(callback, [callback]); },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../services/orderApi', () => ({ getRiderLedger: jest.fn(), settleRider: jest.fn() }));
const api = orderApi as jest.Mocked<typeof orderApi>;

const owes = { uid: 'r1', name: 'Anh Tài', trips: 2, earned: 55000, cash: 335000, net: 280000 };
const owed = { uid: 'r2', name: 'Anh Hai', trips: 1, earned: 50000, cash: 0, net: -50000 };

beforeEach(() => jest.clearAllMocks());

test('the ledger shows who owes the store cash and whom the store owes wages', async () => {
  api.getRiderLedger.mockResolvedValue([owes, owed]);
  await render(<AdminRidersScreen />);
  expect(await screen.findByText('Anh Tài')).toBeTruthy();
  expect(screen.getByText(/Tài xế nộp lại: 280\.000/)).toBeTruthy();
  expect(screen.getByText(/Cửa hàng trả tài xế: 50\.000/)).toBeTruthy();
});

test('settling asks for confirmation and only then closes the rider\'s trips', async () => {
  api.getRiderLedger.mockResolvedValueOnce([owes]).mockResolvedValue([]);
  api.settleRider.mockResolvedValue({ riderUid: 'r1', trips: 2, earned: 55000, cash: 335000, net: 280000 });
  await render(<AdminRidersScreen />);
  await act(async () => { fireEvent.press(await screen.findByText('Chốt đối soát')); });
  expect(api.settleRider).not.toHaveBeenCalled();
  const [title, , buttons] = mockAlert.mock.calls[0];
  expect(title).toBe('Chốt đối soát?');
  await act(async () => { buttons.find((button: { text: string }) => button.text.startsWith('Đã xong')).onPress(); });
  expect(api.settleRider).toHaveBeenCalledWith('r1');
  expect(await screen.findByText('Không có chuyến nào cần đối soát.')).toBeTruthy();
});

test('an empty ledger says so', async () => {
  api.getRiderLedger.mockResolvedValue([]);
  await render(<AdminRidersScreen />);
  expect(await screen.findByText('Không có chuyến nào cần đối soát.')).toBeTruthy();
});
