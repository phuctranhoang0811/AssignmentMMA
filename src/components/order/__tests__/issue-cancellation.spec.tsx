import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { OrderIssueCard } from '../OrderIssueCard';
import { OrderCancellationCard } from '../OrderCancellationCard';
import { listOrderIssues, reportOrderIssue } from '../../../services/orderApi';

const mockAlert = jest.fn();
jest.mock('../../../utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../../services/orderApi', () => ({
  listOrderIssues: jest.fn(), reportOrderIssue: jest.fn(),
  ISSUE_TYPES: [{ key: 'MISSING_ITEM', label: 'Thiếu món' }, { key: 'LATE_DELIVERY', label: 'Giao trễ' }],
}));

beforeEach(() => { jest.clearAllMocks(); (listOrderIssues as jest.Mock).mockResolvedValue([]); });

describe('reporting a problem', () => {
  test('the form needs a description, then sends the chosen problem type', async () => {
    (reportOrderIssue as jest.Mock).mockResolvedValue({ id: 'o1_LATE_DELIVERY', status: 'OPEN' });
    await render(<OrderIssueCard orderId="o1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Báo vấn đề' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Giao trễ' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi phản ánh' }));
    expect(reportOrderIssue).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Mô tả vấn đề'), 'Giao trễ gần một tiếng');
    await act(async () => { await fireEvent.press(screen.getByRole('button', { name: 'Gửi phản ánh' })); });
    expect(reportOrderIssue).toHaveBeenCalledWith('o1', 'LATE_DELIVERY', 'Giao trễ gần một tiếng');
    expect(mockAlert).toHaveBeenCalledWith('Đã gửi phản ánh', expect.any(String));
  });

  test('a duplicate or refused report shows the server message', async () => {
    (reportOrderIssue as jest.Mock).mockRejectedValue(new Error('Bạn đã báo vấn đề này cho đơn hàng rồi.'));
    await render(<OrderIssueCard orderId="o1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Báo vấn đề' }));
    await fireEvent.changeText(screen.getByLabelText('Mô tả vấn đề'), 'Thiếu một lon Pepsi');
    await act(async () => { await fireEvent.press(screen.getByRole('button', { name: 'Gửi phản ánh' })); });
    expect(mockAlert).toHaveBeenCalledWith('Chưa gửi được phản ánh', 'Bạn đã báo vấn đề này cho đơn hàng rồi.');
  });

  test('earlier reports show their state and the store\'s answer', async () => {
    (listOrderIssues as jest.Mock).mockResolvedValue([
      { id: 'a', orderId: 'o1', type: 'MISSING_ITEM', description: 'x', status: 'RESOLVED', resolutionNote: 'Shop hoàn tiền lon Pepsi', refundAmount: 20000 },
      { id: 'b', orderId: 'o1', type: 'LATE_DELIVERY', description: 'y', status: 'OPEN' },
    ]);
    await render(<OrderIssueCard orderId="o1" />);
    expect(await screen.findByText('Đã xử lý')).toBeTruthy();
    expect(screen.getByText('Cửa hàng: Shop hoàn tiền lon Pepsi')).toBeTruthy();
    expect(screen.getByText('Hoàn tiền: 20.000 ₫')).toBeTruthy();
    expect(screen.getByText('Đang chờ cửa hàng xử lý')).toBeTruthy();
  });
});

describe('cancelled order notice', () => {
  test('nothing shows for an order that is not cancelled', async () => {
    await render(<OrderCancellationCard order={{ status: 'PREPARING' }} />);
    expect(screen.queryByText('Đơn hàng đã bị hủy')).toBeNull();
  });

  test('the reason is shown without the internal prefix', async () => {
    await render(<OrderCancellationCard order={{ status: 'CANCELLED', cancelReason: 'Cửa hàng từ chối: Hết nguyên liệu', paymentStatus: 'UNPAID' }} />);
    expect(screen.getByText('Lý do: Hết nguyên liệu')).toBeTruthy();
    expect(screen.queryByText(/hoàn tiền/)).toBeNull();
  });

  test('a paid cancelled order shows the refund deadline, then the refund as done', async () => {
    const due = { seconds: Date.parse('2026-10-31T10:00:00Z') / 1000 };
    const pending = await render(<OrderCancellationCard order={{ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', refundDueAt: due }} />);
    expect(screen.getByText(/Đang chờ hoàn tiền, dự kiến hoàn trước/)).toBeTruthy();
    await pending.unmount();
    await render(<OrderCancellationCard order={{ status: 'CANCELLED', paymentStatus: 'REFUNDED', refundedAt: due }} />);
    expect(screen.getByText(/Đã hoàn tiền lúc/)).toBeTruthy();
  });
});
