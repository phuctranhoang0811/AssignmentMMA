import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { request, BackendRequestError } from './payosService';
import type { RewardWallet } from '../data/rewards';

export async function getRewardWallet() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Vui lòng đăng nhập để tải quà.');
  const wallet = await request<RewardWallet>('/api/rewards', {}, uid);
  if (uid) {
    const key = `@pizza_reward_request:${uid}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored && wallet.gifts.some(gift => gift.id === JSON.parse(stored).key)) await AsyncStorage.removeItem(key);
  }
  return wallet;
}

export async function redeemReward(rewardId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Vui lòng đăng nhập tài khoản thật để đổi quà.');
  const storageKey = `@pizza_reward_request:${uid}`;
  const stored = await AsyncStorage.getItem(storageKey);
  const pending: { rewardId: string; key: string } = stored ? JSON.parse(stored) : {
    rewardId, key: `reward-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  if (pending.rewardId !== rewardId) throw new Error('Vui lòng thử lại món quà trước đó để xác nhận kết quả đổi quà.');
  await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
  try {
    if (auth.currentUser?.uid !== uid) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
    const wallet = await request<RewardWallet>('/api/rewards/redeem', {
      method: 'POST', headers: { 'Idempotency-Key': pending.key }, body: JSON.stringify({ rewardId }),
    }, uid);
    await AsyncStorage.removeItem(storageKey);
    return wallet;
  } catch (error) {
    if (error instanceof BackendRequestError && [400, 404, 409].includes(error.status)) await AsyncStorage.removeItem(storageKey);
    throw error;
  }
}
