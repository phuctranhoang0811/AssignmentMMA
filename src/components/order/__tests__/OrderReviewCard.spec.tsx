import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OrderReviewCard } from '../OrderReviewCard';
import { submitOrderReview } from '../../../services/orderApi';

jest.mock('../../../services/orderApi', () => ({ submitOrderReview: jest.fn() }));
jest.mock('../../../utils/alert', () => ({ Alert: { alert: jest.fn() } }));
const submit = submitOrderReview as jest.Mock;

beforeEach(() => submit.mockReset());

test('sending needs a star rating, then posts the rating and comment', async () => {
  submit.mockResolvedValue({ orderId: 'o1', rating: 4 });
  await render(<OrderReviewCard orderId="o1" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  expect(submit).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('4 sao'));
  await fireEvent.changeText(screen.getByLabelText('Góp ý cho cửa hàng'), 'Pizza nóng, giao nhanh');
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  expect(submit).toHaveBeenCalledWith('o1', 4, 'Pizza nóng, giao nhanh');
});

test('an already reviewed order shows thanks instead of the form', async () => {
  await render(<OrderReviewCard orderId="o1" rating={5} />);
  expect(screen.getByText('Cảm ơn bạn đã đánh giá!')).toBeTruthy();
  expect(screen.queryByText('Gửi đánh giá')).toBeNull();
});
