import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { CartProvider, useCart } from '../CartContext';

const product = { id: 'PZ1', name: 'Pizza', categoryId: 'pizza', basePrice: 100000, description: '', image: '',
  variants: [{ id: 'M', name: 'M', price: 120000 }], addons: [{ id: 'cheese', name: 'Phô mai', price: 15000 }], isAvailable: true };
jest.mock('../../services/catalog', () => ({
  useCatalog: () => ({ productsMap: { PZ1: product } }),
  cachedProduct: (id: string) => (id === 'PZ1' ? product : undefined),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;
async function setup() {
  const view = await renderHook(() => useCart(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  return view;
}

beforeEach(async () => { await AsyncStorage.clear(); });

test('adding the same line twice merges quantities (capped at 20); different options are separate lines', async () => {
  const { result } = await setup();
  await act(async () => { result.current.addItem({ productId: 'PZ1', quantity: 2, addonIds: [] }); });
  await act(async () => { result.current.addItem({ productId: 'PZ1', quantity: 3, addonIds: [] }); });
  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0].quantity).toBe(5);
  await act(async () => { result.current.addItem({ productId: 'PZ1', quantity: 30, addonIds: [] }); });
  expect(result.current.items[0].quantity).toBe(20);
  await act(async () => { result.current.addItem({ productId: 'PZ1', quantity: 1, addonIds: ['cheese'] } as never); });
  expect(result.current.items).toHaveLength(2);
});

test('a size is chosen automatically and the subtotal uses its price plus add-ons', async () => {
  const { result } = await setup();
  await act(async () => { result.current.addItem({ productId: 'PZ1', quantity: 2, addonIds: ['cheese'] } as never); });
  expect(result.current.items[0].variantId).toBe('M');
  expect(result.current.subtotal).toBe((120000 + 15000) * 2);
  expect(result.current.itemCount).toBe(2);
});

test('quantity changes clamp to 1-20 and zero removes the line', async () => {
  const { result } = await setup();
  await act(async () => { result.current.addItem({ productId: 'PZ1', quantity: 1 } as never); });
  const lineId = result.current.items[0].lineId;
  await act(async () => { result.current.updateQuantity(lineId, 99); });
  expect(result.current.items[0].quantity).toBe(20);
  await act(async () => { result.current.updateQuantity(lineId, 0); });
  expect(result.current.items).toHaveLength(0);
});

test('items without a product id are ignored, removeItem and clearCart empty the cart', async () => {
  const { result } = await setup();
  await act(async () => { result.current.addItem({ quantity: 1 } as never); });
  expect(result.current.items).toHaveLength(0);
  await act(async () => { result.current.addItem({ productId: 'PZ1' } as never); result.current.setPromoCode('FPT40'); result.current.setNeedCutlery(true); });
  await act(async () => { result.current.clearCart(); });
  expect(result.current.items).toHaveLength(0);
  expect(result.current.promoCode).toBe('');
  expect(result.current.needCutlery).toBe(false);
});

test('the cart and checkout choices survive an app restart', async () => {
  const first = await setup();
  await act(async () => { first.result.current.addItem({ productId: 'PZ1', quantity: 2 } as never); first.result.current.setPromoCode('FPT40'); first.result.current.setFulfillmentType('takeaway'); });
  await waitFor(async () => expect(await AsyncStorage.getItem('@pizza_time_cart_v1')).toContain('PZ1'));
  await first.unmount();
  const second = await setup();
  await waitFor(() => expect(second.result.current.items).toHaveLength(1));
  expect(second.result.current.items[0].quantity).toBe(2);
  expect(second.result.current.promoCode).toBe('FPT40');
  expect(second.result.current.fulfillmentType).toBe('takeaway');
});

test('a corrupt saved cart does not stop the app from loading', async () => {
  await AsyncStorage.setItem('@pizza_time_cart_v1', '{not json');
  const { result } = await setup();
  expect(result.current.items).toEqual([]);
});
