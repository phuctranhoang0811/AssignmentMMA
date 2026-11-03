import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AdminRecommendationsScreen from '../recommendations';
import { updateDoc } from 'firebase/firestore';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockAlert = jest.fn();
let mockDeliverProducts: (snapshot: unknown) => void = () => {};
let mockDeliverOrders: (snapshot: unknown) => void = () => {};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('../../../utils/alert', () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));
jest.mock('../../../services/orderApi', () => ({
  reportAdminAction: jest.fn(),
}));

const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn(async () => {});

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ name })),
  doc: jest.fn((_db, coll, id) => ({ path: `${coll}/${id}` })),
  query: jest.fn((ref) => ref),
  updateDoc: jest.fn(async () => {}),
  serverTimestamp: jest.fn(() => 'TS'),
  writeBatch: jest.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
  onSnapshot: jest.fn((ref, next) => {
    if (ref.name === 'products') {
      mockDeliverProducts = next;
    } else {
      mockDeliverOrders = next;
    }
    return () => {};
  }),
}));

const makeProduct = (id: string, name: string, basePrice: number, isPopular = false) => ({
  id,
  data: () => ({
    name,
    basePrice,
    isPopular,
    isAvailable: true,
    categoryId: 'pizza',
  }),
});

const makeOrder = (id: string, items: { productId: string; name: string; quantity: number }[]) => ({
  id,
  data: () => ({
    status: 'COMPLETED',
    items,
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('ranks products by sales count and shows popularity badge', async () => {
  await render(<AdminRecommendationsScreen />);

  await act(async () => {
    mockDeliverProducts({
      empty: false,
      forEach: (fn: any) => [
        makeProduct('P1', 'Pizza Phô Mai', 120000, false),
        makeProduct('P2', 'Pizza Hải Sản', 180000, true),
      ].forEach(fn),
    });

    mockDeliverOrders({
      forEach: (fn: any) => [
        makeOrder('O1', [{ productId: 'P2', name: 'Pizza Hải Sản', quantity: 5 }]),
        makeOrder('O2', [{ productId: 'P1', name: 'Pizza Phô Mai', quantity: 2 }]),
      ].forEach(fn),
    });
  });

  expect(screen.getByText('Pizza Hải Sản')).toBeTruthy();
  expect(screen.getByText('Đã bán: 5 phần')).toBeTruthy();
  expect(screen.getByText('Pizza Phô Mai')).toBeTruthy();
  expect(screen.getByText('Đã bán: 2 phần')).toBeTruthy();
  expect(screen.getByText('Đang trong "Bạn sẽ thích"')).toBeTruthy();
});

test('toggling a product calls updateDoc with new isPopular state', async () => {
  await render(<AdminRecommendationsScreen />);

  await act(async () => {
    mockDeliverProducts({
      empty: false,
      forEach: (fn: any) => [
        makeProduct('P1', 'Pizza Phô Mai', 120000, false),
      ].forEach(fn),
    });

    mockDeliverOrders({
      forEach: () => {},
    });
  });

  const toggleBtn = screen.getByText('Đưa vào "Bạn sẽ thích"');
  await act(async () => {
    fireEvent.press(toggleBtn);
  });

  expect(updateDoc).toHaveBeenCalledWith(
    { path: 'products/P1' },
    { isPopular: true, updatedAt: 'TS' }
  );
});

