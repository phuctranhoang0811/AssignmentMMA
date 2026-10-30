import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminStoreScreen from '../store';
import AdminIssuesScreen from '../issues';
import AdminAuditScreen from '../audit';
import { listIssues, resolveIssue, updateStoreSettings } from '../../../services/orderApi';

const mockAlert = jest.fn();
let mockStore: Record<string, unknown> = {};
let mockAuditDeliver: (snapshot: unknown) => void = () => {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => { const { useEffect } = require('react'); useEffect(callback, [callback]); },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../services/storeSettings', () => ({ useStoreStatus: () => mockStore }));
jest.mock('../../../services/orderApi', () => ({
  updateStoreSettings: jest.fn(), listIssues: jest.fn(), resolveIssue: jest.fn(),
  ISSUE_TYPES: [{ key: 'MISSING_ITEM', label: 'Thiếu món' }, { key: 'LATE_DELIVERY', label: 'Giao trễ' }],
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  onSnapshot: jest.fn((_q, next) => { mockAuditDeliver = next; return () => {}; }),
}));

const open = { open: true, reason: null, message: '', settings: { acceptingOrders: true, openTime: '08:00', closeTime: '22:00', closedMessage: '' } };

beforeEach(() => { jest.clearAllMocks(); mockStore = open; });

describe('store settings', () => {
  test('the form starts from the live settings and shows whether orders are being accepted', async () => {
    await render(<AdminStoreScreen />);
    expect(screen.getByText('Hiện đang nhận đơn')).toBeTruthy();
    expect(screen.getByLabelText('Giờ mở cửa').props.value).toBe('08:00');
    expect(screen.getByLabelText('Giờ đóng cửa').props.value).toBe('22:00');
  });

  test('a paused store says why, and the admin can pause with a message for customers', async () => {
    (updateStoreSettings as jest.Mock).mockResolvedValue({});
    await render(<AdminStoreScreen />);
    await fireEvent(screen.getByLabelText('Đang nhận đơn'), 'valueChange', false);
    await fireEvent.changeText(screen.getByLabelText('Thông báo khi tạm ngưng'), 'Bếp quá tải, quay lại sau 30 phút.');
    await act(async () => { await fireEvent.press(screen.getByText('Lưu cài đặt')); });
    expect(updateStoreSettings).toHaveBeenCalledWith({ acceptingOrders: false, openTime: '08:00', closeTime: '22:00', closedMessage: 'Bếp quá tải, quay lại sau 30 phút.' });
    expect(mockAlert).toHaveBeenCalledWith('Đã lưu', expect.any(String));
  });

  test('badly written times are caught before saving', async () => {
    await render(<AdminStoreScreen />);
    await fireEvent.changeText(screen.getByLabelText('Giờ mở cửa'), '8h');
    await act(async () => { await fireEvent.press(screen.getByText('Lưu cài đặt')); });
    expect(mockAlert).toHaveBeenCalledWith('Giờ chưa hợp lệ', expect.stringContaining('HH:mm'));
    expect(updateStoreSettings).not.toHaveBeenCalled();
  });

  test('a rejected save reports the reason', async () => {
    (updateStoreSettings as jest.Mock).mockRejectedValue(new Error('Chỉ quản trị viên được đổi cài đặt cửa hàng.'));
    await render(<AdminStoreScreen />);
    await act(async () => { await fireEvent.press(screen.getByText('Lưu cài đặt')); });
    expect(mockAlert).toHaveBeenCalledWith('Chưa lưu được', 'Chỉ quản trị viên được đổi cài đặt cửa hàng.');
  });
});

describe('customer issues', () => {
  const issue = { id: 'o1_MISSING_ITEM', orderId: 'o1', orderCode: 'PF-1', type: 'MISSING_ITEM', description: 'Thiếu một lon Pepsi', status: 'OPEN', createdAt: '2026-10-30T10:00:00Z' };

  test('open reports are listed with the order, problem and description', async () => {
    (listIssues as jest.Mock).mockResolvedValue([issue]);
    await render(<AdminIssuesScreen />);
    expect(await screen.findByText('Đơn #PF-1 · Thiếu món')).toBeTruthy();
    expect(screen.getByText('Thiếu một lon Pepsi')).toBeTruthy();
    expect(screen.getByText('1 phiếu đang chờ xử lý')).toBeTruthy();
  });

  test('an empty queue says so', async () => {
    (listIssues as jest.Mock).mockResolvedValue([]);
    await render(<AdminIssuesScreen />);
    expect(await screen.findByText('Không có phản ánh nào đang chờ.')).toBeTruthy();
  });

  test('answering needs a note, and a refund also needs an amount', async () => {
    (listIssues as jest.Mock).mockResolvedValue([issue]);
    await render(<AdminIssuesScreen />);
    await fireEvent.press(await screen.findByText('Xử lý'));
    await act(async () => { await fireEvent.press(screen.getByText('Gửi phản hồi')); });
    expect(mockAlert).toHaveBeenCalledWith('Thiếu nội dung', expect.any(String));
    await fireEvent.press(screen.getByLabelText('Hoàn tiền'));
    await fireEvent.changeText(screen.getByLabelText('Lời phản hồi'), 'Xin lỗi, shop hoàn tiền lon Pepsi');
    await act(async () => { await fireEvent.press(screen.getByText('Gửi phản hồi')); });
    expect(mockAlert).toHaveBeenLastCalledWith('Thiếu số tiền', expect.any(String));
    expect(resolveIssue).not.toHaveBeenCalled();
  });

  test('a refund resolution sends the amount and note, then reloads the queue', async () => {
    (listIssues as jest.Mock).mockResolvedValueOnce([issue]).mockResolvedValue([]);
    (resolveIssue as jest.Mock).mockResolvedValue({ id: issue.id, status: 'RESOLVED' });
    await render(<AdminIssuesScreen />);
    await fireEvent.press(await screen.findByText('Xử lý'));
    await fireEvent.press(screen.getByLabelText('Hoàn tiền'));
    await fireEvent.changeText(screen.getByLabelText('Số tiền hoàn'), '20.000');
    await fireEvent.changeText(screen.getByLabelText('Lời phản hồi'), 'Xin lỗi, shop hoàn tiền lon Pepsi');
    await act(async () => { await fireEvent.press(screen.getByText('Gửi phản hồi')); });
    expect(resolveIssue).toHaveBeenCalledWith('o1_MISSING_ITEM', { resolution: 'REFUND', note: 'Xin lỗi, shop hoàn tiền lon Pepsi', refundAmount: 20000 });
    expect(await screen.findByText('Không có phản ánh nào đang chờ.')).toBeTruthy();
  });
});

describe('audit log', () => {
  const entry = (id: string, data: Record<string, unknown>) => ({ id, data: () => ({ actorId: 'admin1', target: 'users/u2', at: { seconds: 1761818400 }, ...data }) });

  test('entries are shown with a readable action, the actor and the details', async () => {
    await render(<AdminAuditScreen />);
    await act(async () => { mockAuditDeliver({ docs: [
      entry('a', { action: 'ROLE_CHANGED', details: { from: 'USER', to: 'EMPLOYEE' } }),
      entry('b', { action: 'ORDER_AUTO_CANCELLED', actorId: 'system', target: 'orders/o1' }),
    ] }); });
    expect(screen.getByText('Đổi quyền tài khoản')).toBeTruthy();
    expect(screen.getByText(/Người thực hiện: admin1/)).toBeTruthy();
    expect(screen.getByText(/"to":"EMPLOYEE"/)).toBeTruthy();
    expect(screen.getByText('Hệ thống tự hủy đơn quá hạn')).toBeTruthy();
    expect(screen.getByText(/^Hệ thống · orders\/o1/)).toBeTruthy();
  });

  test('an empty log says so', async () => {
    await render(<AdminAuditScreen />);
    await act(async () => { mockAuditDeliver({ docs: [] }); });
    expect(screen.getByText('Chưa có thao tác nào được ghi lại.')).toBeTruthy();
  });
});
