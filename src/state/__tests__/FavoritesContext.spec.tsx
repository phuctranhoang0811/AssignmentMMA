import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { FavoritesProvider, useFavorites } from '../FavoritesContext';

let mockUser: { id: string; isDemo: boolean } | null = null;
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
const wrapper = ({ children }: { children: React.ReactNode }) => <FavoritesProvider>{children}</FavoritesProvider>;

beforeEach(async () => { mockUser = null; await AsyncStorage.clear(); });

test('toggling adds then removes a favourite, and it is saved', async () => {
  const { result } = await renderHook(() => useFavorites(), { wrapper });
  await act(async () => { result.current.toggleFavorite('PZ1'); });
  expect(result.current.isFavorite('PZ1')).toBe(true);
  await waitFor(async () => expect(await AsyncStorage.getItem('@pizza_time_favorites_v1')).toBe('["PZ1"]'));
  await act(async () => { result.current.toggleFavorite('PZ1'); });
  expect(result.current.isFavorite('PZ1')).toBe(false);
});

test('favourites are restored on launch', async () => {
  await AsyncStorage.setItem('@pizza_time_favorites_v1', '["PZ2"]');
  const { result } = await renderHook(() => useFavorites(), { wrapper });
  await waitFor(() => expect(result.current.isFavorite('PZ2')).toBe(true));
});

test('another account signing in does not inherit the previous account\'s list', async () => {
  mockUser = { id: 'a', isDemo: false };
  const { result, rerender } = await renderHook(() => useFavorites(), { wrapper });
  await act(async () => { result.current.toggleFavorite('PZ1'); });
  expect(result.current.favoriteIds).toEqual(['PZ1']);
  mockUser = { id: 'b', isDemo: false };
  await rerender({});
  await waitFor(() => expect(result.current.favoriteIds).toEqual([]));
});
