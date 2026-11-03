import type { Firestore } from 'firebase-admin/firestore';
import { HttpError } from './domain';
import { redeemFromWallet, type RewardWallet } from '../../src/data/rewards';

export class RewardStore {
  constructor(private db: Firestore) {}

  async wallet(uid: string): Promise<RewardWallet> {
    const [user, gifts] = await Promise.all([
      this.db.collection('users').doc(uid).get(),
      this.db.collection('users').doc(uid).collection('reward_gifts').get(),
    ]);
    if (!user.exists) throw new HttpError(404, 'Không tìm thấy tài khoản.');
    return { points: user.data()?.rewardPoints ?? 0,
      gifts: gifts.docs.map(doc => doc.data() as RewardWallet['gifts'][number])
        .sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt)) };
  }

  async redeem(uid: string, rewardId: string, key: string) {
    const userRef = this.db.collection('users').doc(uid);
    const giftRef = userRef.collection('reward_gifts').doc(key);
    await this.db.runTransaction(async tx => {
      const [user, gift] = await Promise.all([tx.get(userRef), tx.get(giftRef)]);
      if (!user.exists) throw new HttpError(404, 'Không tìm thấy tài khoản.');
      const before: RewardWallet = { points: user.data()?.rewardPoints ?? 0,
        gifts: gift.exists ? [gift.data() as RewardWallet['gifts'][number]] : [] };
      let after: RewardWallet;
      try { after = redeemFromWallet(before, rewardId, key, new Date().toISOString()); }
      catch (error) { throw new HttpError(409, error instanceof Error ? error.message : 'Không thể đổi quà.'); }
      if (after === before) return;
      tx.update(userRef, { rewardPoints: after.points });
      tx.create(giftRef, after.gifts[0]);
    });
    return this.wallet(uid);
  }
}
