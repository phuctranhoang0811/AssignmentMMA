import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuantityStepper } from '../QuantityStepper';

test('increment and decrement report the new quantity', async () => {
  const onChange = jest.fn();
  await render(<QuantityStepper value={2} onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText('Giảm số lượng'));
  expect(onChange).toHaveBeenLastCalledWith(1);
  await fireEvent.press(screen.getByLabelText('Tăng số lượng'));
  expect(onChange).toHaveBeenLastCalledWith(3);
});

test('the quantity stops at its minimum and maximum', async () => {
  const onChange = jest.fn();
  const { rerender } = await render(<QuantityStepper value={1} onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText('Giảm số lượng'));
  await rerender(<QuantityStepper value={20} onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText('Tăng số lượng'));
  expect(onChange).not.toHaveBeenCalled();
});
