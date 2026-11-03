export const rewardCatalog = [
  { id: 'R01', title: 'Đổi 01 Lon Pepsi 320ML miễn phí', points: 30 },
  { id: 'R02', title: 'Đổi 01 Lon 7Up 320ML miễn phí', points: 30 },
  { id: 'R03', title: 'Đổi 01 Lon Mirinda Cam 320ML miễn phí', points: 30 },
  { id: 'R04', title: 'Đổi 01 Xà Lách Cá Ngừ và Thịt Xông Khói miễn phí', points: 70 },
  { id: 'R05', title: 'Đổi 01 Mỳ Ý Bò Bằm Xốt Cà Chua miễn phí', points: 100 },
  { id: 'R06', title: 'Đổi 01 Pizza Phô Mai Cao Cấp Đế Dày Cỡ Vừa miễn phí', points: 120 },
  { id: 'R07', title: 'Đổi 01 Pizza Thập Cẩm Đế Dày Cỡ Vừa miễn phí', points: 180 },
] as const;

export type RedeemedGift = { id: string; rewardId: string; title: string; points: number; redeemedAt: string };
export type RewardWallet = { points: number; gifts: RedeemedGift[] };

export function redeemFromWallet(wallet: RewardWallet, rewardId: string, id: string, redeemedAt: string): RewardWallet {
  const existing = wallet.gifts.find(gift => gift.id === id);
  if (existing) {
    if (existing.rewardId !== rewardId) throw new Error('Yêu cầu đổi quà không khớp.');
    return wallet;
  }
  const reward = rewardCatalog.find(item => item.id === rewardId);
  if (!reward) throw new Error('Quà không còn khả dụng.');
  if (!Number.isSafeInteger(wallet.points) || wallet.points < reward.points) throw new Error('Bạn chưa đủ điểm để đổi quà này.');
  return { points: wallet.points - reward.points,
    gifts: [{ id, rewardId, title: reward.title, points: reward.points, redeemedAt }, ...wallet.gifts] };
}
