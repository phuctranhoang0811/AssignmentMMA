import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminDashboardScreen from '../dashboard';
import AdminReportsScreen from '../reports';
import AdminUsersScreen from '../users';
import { updateDoc } from 'firebase/firestore';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockAlert = jest.fn();
let mockMe: Record<string, unknown> = { id: 'admin1', role: 'SUPER_ADMIN' };
const listeners: Record<string, (snapshot: unknown) => void> = {};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../state/AuthContext', () => ({ useAuth: () => ({ user: mockMe }) }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ name })), query: jest.fn((ref: unknown) => ref), orderBy: jest.fn(),
  doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })), updateDoc: jest.fn(async () => {}), serverTimestamp: jest.fn(() => 'TS'),
  onSnapshot: jest.fn((ref: { name: string }, next: (snapshot: unknown) => void) => { listeners[ref.name] = next; return () => {}; }),
}));

const snapshot = (docs: { id: string; data: Record<string, unknown> }[]) => ({
  empty: docs.length === 0, docs: docs.map(d => ({ id: d.id, data: () => d.data })),
  forEach: (fn: (d: unknown) => void) => docs.forEach(d => fn({ id: d.id, data: () => d.data })),
});
const order = (id: string, data: Record<string, unknown>) => ({ id, data: { status: 'COMPLETED', total: 100000, createdAt: { toDate: () => new Date() }, items: [], ...data } });

beforeEach(() => { jest.clearAllMocks(); mockMe = { id: 'admin1', role: 'SUPER_ADMIN' }; for (const key of Object.keys(listeners)) delete listeners[key]; });

describe('dashboard', () => {
  test('a store with no orders or products shows zeros, never invented revenue', async () => {
    await render(<AdminDashboardScreen />);
    await act(async () => { listeners.orders(snapshot([])); listeners.products(snapshot([])); });
    expect(screen.queryByText(/1\.250\.000/)).toBeNull();
    expect(screen.getAllByText(/^0\s?₫$/).length).toBeGreaterThan(0);
    expect(screen.getByText('0 món')).toBeTruthy();
  });

  test('revenue counts only completed orders; pending and completed counts follow the live orders', async () => {
    await render(<AdminDashboardScreen />);
    await act(async () => {
      listeners.orders(snapshot([
        order('a', { total: 200000 }), order('b', { total: 300000, status: 'DELIVERED' }),
        order('c', { status: 'PENDING_CONFIRMATION', total: 999999 }), order('d', { status: 'CANCELLED', total: 999999 }),
      ]));
      listeners.products(snapshot([{ id: 'p1', data: {} }, { id: 'p2', data: { isAvailable: false } }]));
    });
    expect(screen.getByText(/500\.000/)).toBeTruthy();
    expect(screen.getByText('1 đơn', { exact: false })).toBeTruthy();
    expect(screen.getByText('1 món')).toBeTruthy();
  });
});

describe('reports', () => {
  test('with no sales every figure is zero and the top list says there is nothing yet', async () => {
    await render(<AdminReportsScreen />);
    await act(async () => { listeners.orders(snapshot([])); });
    expect(screen.queryByText(/8\.350\.000/)).toBeNull();
    expect(screen.queryByText('Margherita Pizza')).toBeNull();
    expect(screen.getByText('Chưa có món nào được bán trong kỳ này.')).toBeTruthy();
    expect(screen.getByText('Chưa có dữ liệu')).toBeTruthy();
  });

  test('revenue, cancel rate and top products come from the real orders', async () => {
    await render(<AdminReportsScreen />);
    await act(async () => {
      listeners.orders(snapshot([
        order('a', { total: 200000, items: [{ productName: 'Pizza Bò', quantity: 2, lineTotal: 200000 }] }),
        order('b', { total: 100000, items: [{ productName: 'Pizza Bò', quantity: 1, lineTotal: 100000 }, { productName: 'Pepsi', quantity: 1, lineTotal: 20000 }] }),
        order('c', { status: 'CANCELLED', total: 50000 }),
        order('d', { total: 100000, createdAt: { toDate: () => new Date(Date.now() - 40 * 86400000) } }),
      ]));
    });
    expect(screen.getAllByText(/300\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Pizza Bò')).toBeTruthy();
    expect(screen.getByText('Pepsi')).toBeTruthy();
    expect(screen.getAllByText('33%').length).toBeGreaterThan(0);
  });

  test('the average prep time is measured from each order\'s own confirm-to-ready history', async () => {
    await render(<AdminReportsScreen />);
    const at = (minutes: number) => new Date(Date.UTC(2026, 9, 30, 10, minutes)).toISOString();
    await act(async () => {
      listeners.orders(snapshot([
        order('a', { statusHistory: [{ status: 'CONFIRMED', at: at(0) }, { status: 'READY', at: at(20) }] }),
        order('b', { statusHistory: [{ status: 'CONFIRMED', at: at(0) }, { status: 'READY', at: at(10) }] }),
      ]));
    });
    expect(screen.getByText('15 phút')).toBeTruthy();
  });
});

describe('users', () => {
  const people = [
    { id: 'admin1', data: { fullName: 'Chủ Quán', email: 'chu@x.vn', phone: '0900000001', role: 'SUPER_ADMIN' } },
    { id: 'u2', data: { fullName: 'Lan Nguyen', email: 'lan@x.vn', phone: '0912345678', role: 'USER', rewardPoints: 40 } },
    { id: 'u3', data: { fullName: 'Bình Tran', email: 'binh@x.vn', phone: '0987654321', role: 'BLACKLISTED' } },
  ];

  test('an empty user list is empty, not made-up accounts', async () => {
    await render(<AdminUsersScreen />);
    await act(async () => { listeners.users(snapshot([])); });
    expect(screen.queryByText('Quản Trị Viên (Admin)')).toBeNull();
    expect(screen.queryByText('Khách Hàng Thân Thiết')).toBeNull();
  });

  test('search filters by name, email or phone', async () => {
    await render(<AdminUsersScreen />);
    await act(async () => { listeners.users(snapshot(people)); });
    expect(screen.getByText('Lan Nguyen')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('Tìm theo tên, email hoặc số điện thoại...'), '0987');
    expect(screen.getByText('Bình Tran')).toBeTruthy();
    expect(screen.queryByText('Lan Nguyen')).toBeNull();
  });

  test('an admin cannot change their own account', async () => {
    await render(<AdminUsersScreen />);
    await act(async () => { listeners.users(snapshot([people[0]])); });
    expect(screen.queryByText('Đổi quyền')).toBeNull();
  });

  test('locking an account asks first and then writes the BLACKLISTED role', async () => {
    await render(<AdminUsersScreen />);
    await act(async () => { listeners.users(snapshot([people[1]])); });
    await fireEvent.press(screen.getByText('Khóa'));
    expect(updateDoc).not.toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    await act(async () => { await buttons.find(button => button.text === 'Khóa ngay')!.onPress!(); });
    expect(updateDoc).toHaveBeenCalledWith({ path: 'users/u2' }, { role: 'BLACKLISTED', updatedAt: 'TS' });
    // Both the role badge and the action button now read "Đã khóa".
    expect(screen.getAllByText('Đã khóa')).toHaveLength(2);
  });

  test('a rejected role change is reported and the list is left as it was', async () => {
    (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    await render(<AdminUsersScreen />);
    await act(async () => { listeners.users(snapshot([people[1]])); });
    await fireEvent.press(screen.getByText('Khóa'));
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    await act(async () => { await buttons.find(button => button.text === 'Khóa ngay')!.onPress!(); });
    expect(mockAlert).toHaveBeenLastCalledWith('Chưa cập nhật được', 'Missing or insufficient permissions.');
    expect(screen.getByText('Khóa')).toBeTruthy();
  });
});
