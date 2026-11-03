import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton } from '../AppButton';

test('presses call the handler and expose the title to screen readers', async () => {
  const onPress = jest.fn();
  await render(<AppButton title="Thanh toán" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Thanh toán' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a disabled or loading button never fires', async () => {
  const onPress = jest.fn();
  const { rerender } = await render(<AppButton title="Gửi" onPress={onPress} disabled />);
  await fireEvent.press(screen.getByText('Gửi'));
  await rerender(<AppButton title="Gửi" onPress={onPress} isLoading />);
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi' }));
  expect(onPress).not.toHaveBeenCalled();
});
