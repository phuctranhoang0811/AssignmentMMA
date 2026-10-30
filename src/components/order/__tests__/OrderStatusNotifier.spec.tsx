import React from 'react';
import { act, render } from '@testing-library/react-native';
import { OrderStatusNotifier } from '../OrderStatusNotifier';

let mockUser: { id: string; isDemo?: boolean; role?: string } | null = { id: 'u1', role: 'USER' };
const mockShowToast = jest.fn();
let mockDeliver: (snapshot: unknown) => void = () => {};
const mockRegister = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../state/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../../services/pushService', () => ({
  registerForOrderPush: (uid: string) => mockRegister(uid), listenForOrderPush: async () => () => {},
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), where: jest.fn(),
  onSnapshot: jest.fn((_q, next) => { mockDeliver = next; return () => {}; }),
}));

const snap = (orders: Record<string, string>, changes: { type: string; id: string }[] = []) => ({
  docs: Object.entries(orders).map(([id, status]) => ({ id, data: () => ({ status, orderCode: 111 }) })),
  docChanges: () => changes.map(change => ({ type: change.type, doc: { id: change.id, data: () => ({ status: orders[change.id], orderCode: 111 }) } })),
});

beforeEach(() => { jest.clearAllMocks(); mockUser = { id: 'u1', role: 'USER' }; });

test('the first snapshot is not news; a later status change raises a toast naming the order', async () => {
  await render(<OrderStatusNotifier />);
  await act(async () => { mockDeliver(snap({ o1: 'PENDING_CONFIRMATION' })); });
  expect(mockShowToast).not.toHaveBeenCalled();
  await act(async () => { mockDeliver(snap({ o1: 'PREPARING' }, [{ type: 'modified', id: 'o1' }])); });
  expect(mockShowToast).toHaveBeenCalledTimes(1);
  expect(mockShowToast.mock.calls[0][0]).toMatchObject({ message: 'Đơn #111 đang được chuẩn bị.', type: 'success', actionText: 'Xem' });
});

test('a cancelled order is shown as an error, and unchanged or new orders stay silent', async () => {
  await render(<OrderStatusNotifier />);
  await act(async () => { mockDeliver(snap({ o1: 'READY' })); });
  await act(async () => { mockDeliver(snap({ o1: 'READY' }, [{ type: 'modified', id: 'o1' }])); });
  await act(async () => { mockDeliver(snap({ o1: 'READY', o2: 'PENDING_CONFIRMATION' }, [{ type: 'added', id: 'o2' }])); });
  expect(mockShowToast).not.toHaveBeenCalled();
  await act(async () => { mockDeliver(snap({ o1: 'CANCELLED', o2: 'PENDING_CONFIRMATION' }, [{ type: 'modified', id: 'o1' }])); });
  expect(mockShowToast.mock.calls[0][0]).toMatchObject({ type: 'error', message: 'Đơn #111 đã bị hủy.' });
});

test('guests, demo accounts and staff are never watched, and push registers for customers only', async () => {
  const { onSnapshot } = require('firebase/firestore');
  for (const who of [null, { id: 'd', isDemo: true }, { id: 's', role: 'EMPLOYEE' }]) {
    mockUser = who as never;
    await render(<OrderStatusNotifier />);
  }
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(mockRegister).not.toHaveBeenCalled();
  mockUser = { id: 'u9', role: 'USER' };
  await render(<OrderStatusNotifier />);
  expect(mockRegister).toHaveBeenCalledWith('u9');
});
