import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OrderTimeline } from '../OrderTimeline';

test('a delivery order shows the delivery steps', async () => {
  await render(<OrderTimeline status="PREPARING" fulfillmentType="DELIVERY" />);
  for (const title of ['Chờ xác nhận', 'Đang nấu', 'Đang giao hàng', 'Đã giao thành công']) {
    expect(screen.getByText(title)).toBeTruthy();
  }
});

test('a pickup order shows pickup steps and no delivery step', async () => {
  await render(<OrderTimeline status="READY" fulfillmentType="PICKUP" />);
  expect(screen.getByText('Sẵn sàng lấy')).toBeTruthy();
  expect(screen.queryByText('Đang giao hàng')).toBeNull();
});
