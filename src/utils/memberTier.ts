import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayRemove,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { isCouponExpired } from './coupons';

export type MemberTierId = 'basic' | 'gold' | 'vip';

export type MemberGiftOccasion =
  | 'TIER_GOLD'
  | 'TIER_VIP'
  | 'BIRTHDAY_GOLD'
  | 'BIRTHDAY_VIP';

export interface MemberGiftRule {
  id: string;
  occasion: MemberGiftOccasion;
  title: string;
  productId?: string;
  imageUrl?: string;
  pizzaSize?: 'small' | 'medium' | 'large';
  minSubtotal: number;
  expiresAt?: string;
  deleted?: boolean;
}

export const MEMBER_GIFTS_DOC_ID = '__MEMBER_GIFTS_CONFIG';

export const MEMBER_GIFT_OCCASIONS: {
  id: MemberGiftOccasion;
  tierGroup: 'gold' | 'diamond';
  label: string;
  shortLabel: string;
  shortBadge: string;
  description: string;
}[] = [
  {
    id: 'TIER_GOLD',
    tierGroup: 'gold',
    label: 'Đạt Thành Viên Vàng',
    shortLabel: 'Đạt Thành Viên Vàng',
    shortBadge: 'Quà Thăng Hạng Vàng',
    description: 'Tặng khi khách đạt Hạng Vàng',
  },
  {
    id: 'BIRTHDAY_GOLD',
    tierGroup: 'gold',
    label: 'Sinh Nhật Thành Viên Vàng',
    shortLabel: 'Sinh Nhật Hạng Vàng',
    shortBadge: 'Quà Sinh Nhật Vàng',
    description: 'Tặng trong tháng sinh nhật Hạng Vàng',
  },
  {
    id: 'TIER_VIP',
    tierGroup: 'diamond',
    label: 'Đạt Thành Viên Kim Cương',
    shortLabel: 'Đạt Thành Viên Kim Cương',
    shortBadge: 'Quà Thăng Hạng Kim Cương',
    description: 'Tặng khi khách đạt Hạng Kim Cương',
  },
  {
    id: 'BIRTHDAY_VIP',
    tierGroup: 'diamond',
    label: 'Sinh Nhật Thành Viên Kim Cương',
    shortLabel: 'Sinh Nhật Kim Cương',
    shortBadge: 'Quà Sinh Nhật Kim Cương',
    description: 'Tặng trong tháng sinh nhật Hạng Kim Cương',
  },
];

export function getMemberGiftOccasionLabel(occasion: MemberGiftOccasion): string {
  return (
    MEMBER_GIFT_OCCASIONS.find((o) => o.id === occasion)?.shortBadge ||
    'Quà Thành Viên'
  );
}

export interface MemberTierInfo {
  id: MemberTierId;
  label: string;
  cardTitle: string;
  discountPercent: number;
  discountRate: number;
  totalSpent: number;
  earnedPointsFromOrders: number;
  maturityDate: string;
  goldAchievedAtMs?: number;
  vipAchievedAtMs?: number;
}

function parseTimestampToMs(input?: any): number | undefined {
  if (!input) return undefined;
  if (typeof input?.toMillis === 'function') return input.toMillis();
  if (typeof input?.seconds === 'number') return input.seconds * 1000;
  if (typeof input === 'number' && !Number.isNaN(input)) return input;
  const parsed = Date.parse(String(input));
  return !Number.isNaN(parsed) ? parsed : undefined;
}

function formatAddOneMonthDate(baseMs: number): string {
  const base = new Date(baseMs);
  const exp = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
  const dd = String(exp.getDate()).padStart(2, '0');
  const mm = String(exp.getMonth() + 1).padStart(2, '0');
  const yyyy = exp.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function getMemberGiftExpiryDate(
  rule: MemberGiftRule,
  tierInfo?: MemberTierInfo,
  birthdayStr?: string
): string {
  const now = new Date();
  if (rule.occasion === 'BIRTHDAY_GOLD' || rule.occasion === 'BIRTHDAY_VIP') {
    let bdayDay = now.getDate();
    let bdayMonth = now.getMonth() + 1;
    if (birthdayStr) {
      const clean = birthdayStr.trim();
      const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(clean);
      const ymd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(clean);
      if (dmy) {
        bdayDay = Number(dmy[1]);
        bdayMonth = Number(dmy[2]);
      } else if (ymd) {
        bdayDay = Number(ymd[3]);
        bdayMonth = Number(ymd[2]);
      }
    }
    const bdayThisYear = new Date(now.getFullYear(), bdayMonth - 1, bdayDay);
    return formatAddOneMonthDate(bdayThisYear.getTime());
  }

  if (rule.occasion === 'TIER_VIP') {
    const achievedMs =
      tierInfo?.vipAchievedAtMs || tierInfo?.goldAchievedAtMs || now.getTime();
    return formatAddOneMonthDate(achievedMs);
  }

  const achievedMs = tierInfo?.goldAchievedAtMs || now.getTime();
  return formatAddOneMonthDate(achievedMs);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Tính Ngày đáo hạn theo đúng quy định:
 * Điểm thưởng có giá trị ít nhất 12 tháng kể từ ngày đăng ký thành viên.
 * Đáo hạn vào các ngày cố định hàng năm: 28/02 (29/02); 31/05; 31/08 và 30/11
 * gần nhất sau đủ 12 tháng kể từ ngày đăng ký.
 */
export function calculateMaturityDate(createdAtInput?: any): string {
  let regDate = new Date();
  if (createdAtInput) {
    if (typeof createdAtInput?.toMillis === 'function') {
      regDate = new Date(createdAtInput.toMillis());
    } else if (typeof createdAtInput?.seconds === 'number') {
      regDate = new Date(createdAtInput.seconds * 1000);
    } else if (typeof createdAtInput === 'number') {
      regDate = new Date(createdAtInput);
    } else {
      const parsed = Date.parse(String(createdAtInput));
      if (!Number.isNaN(parsed)) regDate = new Date(parsed);
    }
  }

  // Cộng tối thiểu 12 tháng kể từ ngày đăng ký
  const minExpiry = new Date(
    regDate.getFullYear() + 1,
    regDate.getMonth(),
    regDate.getDate()
  );

  const candidateYears = [minExpiry.getFullYear(), minExpiry.getFullYear() + 1];
  for (const y of candidateYears) {
    const febDay = isLeapYear(y) ? 29 : 28;
    const fixedDates = [
      new Date(y, 1, febDay, 23, 59, 59), // 28/02 hoặc 29/02
      new Date(y, 4, 31, 23, 59, 59),     // 31/05
      new Date(y, 7, 31, 23, 59, 59),     // 31/08
      new Date(y, 10, 30, 23, 59, 59),    // 30/11
    ];
    for (const d of fixedDates) {
      if (d.getTime() >= minExpiry.getTime()) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }

  return '30/11/2027';
}

export function getMemberTierFromSpent(
  totalSpent: number,
  earnedPointsFromOrders: number = 0,
  maturityDate: string = '30/11/2027',
  goldAchievedAtMs?: number,
  vipAchievedAtMs?: number
): MemberTierInfo {
  if (totalSpent >= 2000000) {
    return {
      id: 'vip',
      label: 'VIP',
      cardTitle: 'Thành viên VIP',
      discountPercent: 15,
      discountRate: 0.15,
      totalSpent,
      earnedPointsFromOrders,
      maturityDate,
      goldAchievedAtMs,
      vipAchievedAtMs,
    };
  }
  if (totalSpent >= 1000000) {
    return {
      id: 'gold',
      label: 'Vàng',
      cardTitle: 'Thành viên Vàng',
      discountPercent: 10,
      discountRate: 0.1,
      totalSpent,
      earnedPointsFromOrders,
      maturityDate,
      goldAchievedAtMs,
      vipAchievedAtMs,
    };
  }
  return {
    id: 'basic',
    label: 'Cơ Bản',
    cardTitle: 'Thành viên Cơ Bản',
    discountPercent: 0,
    discountRate: 0,
    totalSpent,
    earnedPointsFromOrders,
    maturityDate,
    goldAchievedAtMs,
    vipAchievedAtMs,
  };
}

/**
 * Tải thông tin tổng chi tiêu, điểm tích lũy từ các đơn hàng và ngày đáo hạn của thành viên từ Firestore
 */
export async function fetchUserMemberStats(userId?: string): Promise<MemberTierInfo> {
  if (!userId) {
    return getMemberTierFromSpent(0, 0, calculateMaturityDate());
  }

  try {
    const [userSnap, ordersSnap, overridesSnap] = await Promise.all([
      getDoc(doc(db, 'users', userId)).catch(() => null),
      getDocs(query(collection(db, 'orders'), where('userId', '==', userId))).catch(() => null),
      getDoc(doc(db, 'coupons', '__ORDER_DISPATCH_OVERRIDES')).catch(() => null),
    ]);

    const overridesItems =
      overridesSnap?.exists() && overridesSnap.data()?.items
        ? (overridesSnap.data()?.items as Record<string, any>)
        : {};

    const createdAt = userSnap?.exists() ? userSnap.data()?.createdAt : undefined;
    const maturityDate = calculateMaturityDate(createdAt);

    let totalSpent = 0;
    let earnedPointsFromOrders = 0;
    const completedOrdersChrono: { total: number; timeMs: number }[] = [];

    if (ordersSnap) {
      ordersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (String(data?.orderCode || '').toUpperCase() === 'PF-X469QK') return;
        const ov = overridesItems[docSnap.id];
        const status = String(ov?.status || data.status || '').toUpperCase();
        if (status !== 'COMPLETED' && status !== 'DELIVERED') return;

        const orderTotal = Number(data.total || data.totalAmount) || 0;
        const points =
          typeof data.earnedPoints === 'number'
            ? data.earnedPoints
            : Math.floor(orderTotal / 10000);
        earnedPointsFromOrders += points;
        totalSpent += orderTotal;
        const tMs =
          parseTimestampToMs(ov?.deliveredAt) ||
          parseTimestampToMs(data.deliveredAt) ||
          parseTimestampToMs(data.updatedAt) ||
          parseTimestampToMs(data.createdAt) ||
          Date.now();
        completedOrdersChrono.push({ total: orderTotal, timeMs: tMs });
      });
    }

    completedOrdersChrono.sort((a, b) => a.timeMs - b.timeMs);
    let runningSpent = 0;
    let goldAchievedAtMs: number | undefined;
    let vipAchievedAtMs: number | undefined;
    for (const ord of completedOrdersChrono) {
      runningSpent += ord.total;
      if (!goldAchievedAtMs && runningSpent >= 1000000) {
        goldAchievedAtMs = ord.timeMs;
      }
      if (!vipAchievedAtMs && runningSpent >= 2000000) {
        vipAchievedAtMs = ord.timeMs;
      }
    }

    const userData = userSnap?.exists() ? userSnap.data() : undefined;
    const redeemedGifts = Array.isArray(userData?.redeemedGifts) ? userData.redeemedGifts : [];
    const spentPoints = redeemedGifts.reduce(
      (s: number, g: any) => s + (Number(g?.points) || 0),
      0
    );
    const storedRewardPoints =
      typeof userData?.rewardPoints === 'number' ? userData.rewardPoints : 0;
    const effectivePoints = Math.max(earnedPointsFromOrders, storedRewardPoints + spentPoints);
    const effectiveSpent = Math.max(totalSpent, effectivePoints * 10000);

    const fallbackAchievedMs =
      completedOrdersChrono.length > 0
        ? completedOrdersChrono[completedOrdersChrono.length - 1].timeMs
        : parseTimestampToMs(userData?.updatedAt) || Date.now();
    if (effectiveSpent >= 1000000 && !goldAchievedAtMs) {
      goldAchievedAtMs = fallbackAchievedMs;
    }
    if (effectiveSpent >= 2000000 && !vipAchievedAtMs) {
      vipAchievedAtMs = fallbackAchievedMs;
    }

    return getMemberTierFromSpent(
      effectiveSpent,
      effectivePoints,
      maturityDate,
      goldAchievedAtMs,
      vipAchievedAtMs
    );
  } catch {
    return getMemberTierFromSpent(0, 0, calculateMaturityDate());
  }
}

export async function loadOrSeedMemberGiftRules(): Promise<MemberGiftRule[]> {
  try {
    const [configSnap, productsSnap] = await Promise.all([
      getDoc(doc(db, 'coupons', MEMBER_GIFTS_DOC_ID)).catch(() => null),
      getDocs(collection(db, 'products')).catch(() => null),
    ]);

    const pList: { id: string; name: string; categoryId: string; image: string }[] = [];
    if (productsSnap && !productsSnap.empty) {
      productsSnap.forEach((d: any) => {
        if (String(d.id).startsWith('__')) return;
        const data = d.data();
        pList.push({
          id: d.id,
          name: data.name || 'Pizza',
          categoryId: String(data.categoryId || data.category || 'pizza').toLowerCase(),
          image: data.image || data.imageUrl || '',
        });
      });
    }

    const snapData = configSnap?.exists?.() ? configSnap.data?.() : null;
    if ((!snapData || snapData.seededDefaultGiftsV1 !== true) && pList.length > 0) {
      const pizzas = pList.filter((p) =>
        ['pizza', 'cheese_party', 'member_deals', 'hot_deals'].includes(p.categoryId)
      );
      const p1 = pizzas[0] || pList[0];
      const p2 = pizzas[1] || p1;

      const defaults: MemberGiftRule[] = [
        {
          id: `MG_TIER_GOLD_${p1.id}`,
          occasion: 'TIER_GOLD',
          title: `Tặng 01 ${p1.name} (Cỡ Vừa) miễn phí`,
          productId: p1.id,
          imageUrl: p1.image,
          pizzaSize: 'medium',
          minSubtotal: 250000,
          expiresAt: '30/11/2027',
        },
        {
          id: `MG_TIER_VIP_${p2.id}`,
          occasion: 'TIER_VIP',
          title: `Tặng 01 ${p2.name} (Cỡ Vừa) miễn phí`,
          productId: p2.id,
          imageUrl: p2.image,
          pizzaSize: 'medium',
          minSubtotal: 280000,
          expiresAt: '30/11/2027',
        },
        {
          id: `MG_BDAY_GOLD_${p1.id}`,
          occasion: 'BIRTHDAY_GOLD',
          title: `Quà Sinh Nhật: Tặng 01 ${p1.name} (Cỡ Vừa) miễn phí`,
          productId: p1.id,
          imageUrl: p1.image,
          pizzaSize: 'medium',
          minSubtotal: 250000,
          expiresAt: '30/11/2027',
        },
        {
          id: `MG_BDAY_VIP_${p2.id}`,
          occasion: 'BIRTHDAY_VIP',
          title: `Quà Sinh Nhật: Tặng 01 ${p2.name} (Cỡ Vừa) miễn phí`,
          productId: p2.id,
          imageUrl: p2.image,
          pizzaSize: 'medium',
          minSubtotal: 280000,
          expiresAt: '30/11/2027',
        },
      ];

      const itemsMap: Record<string, any> = {};
      defaults.forEach((g) => {
        itemsMap[g.id] = {
          ...g,
          updatedAt: serverTimestamp(),
        };
      });

      await setDoc(doc(db, 'coupons', MEMBER_GIFTS_DOC_ID), {
        seededDefaultGiftsV1: true,
        items: itemsMap,
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      return defaults;
    }

    if (snapData && snapData.items) {
      const list: MemberGiftRule[] = [];
      Object.entries(snapData.items).forEach(([id, raw]: [string, any]) => {
        if (!raw || raw.deleted) return;
        list.push({
          id,
          occasion: raw.occasion || 'TIER_GOLD',
          title: raw.title || 'Quà tặng thành viên',
          productId: raw.productId || undefined,
          imageUrl: raw.imageUrl || undefined,
          pizzaSize: raw.pizzaSize || undefined,
          minSubtotal: Number(raw.minSubtotal || 0),
          expiresAt: raw.expiresAt || '30/11/2027',
        });
      });
      return list;
    }

    return [];
  } catch {
    return [];
  }
}

export function isUserInBirthdayMonth(birthdayStr?: string): boolean {
  if (!birthdayStr) return false;
  const clean = birthdayStr.trim();
  const curMonth = new Date().getMonth() + 1;
  // Hỗ trợ dd/mm/yyyy hoặc yyyy-mm-dd
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(clean);
  if (dmy) {
    return Number(dmy[2]) === curMonth;
  }
  const ymd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(clean);
  if (ymd) {
    return Number(ymd[2]) === curMonth;
  }
  return false;
}

export function getEligibleMemberGifts(
  rules: MemberGiftRule[],
  tierId: MemberTierId,
  birthdayStr?: string,
  tierInfo?: MemberTierInfo
): MemberGiftRule[] {
  const isBday = isUserInBirthdayMonth(birthdayStr);
  const result: MemberGiftRule[] = [];
  for (const r of rules) {
    if (r.deleted) continue;
    let match = false;
    if (r.occasion === 'TIER_GOLD') {
      match = tierId === 'gold' || tierId === 'vip';
    } else if (r.occasion === 'TIER_VIP') {
      match = tierId === 'vip';
    } else if (r.occasion === 'BIRTHDAY_GOLD') {
      match = tierId === 'gold' && isBday;
    } else if (r.occasion === 'BIRTHDAY_VIP') {
      match = tierId === 'vip' && isBday;
    }
    if (!match) continue;

    // Tính ngày hết hạn riêng cho từng khách: ngày đạt được + 1 tháng
    const dynamicExp = getMemberGiftExpiryDate(r, tierInfo, birthdayStr);
    if (isCouponExpired({ expiresAt: dynamicExp } as any)) {
      continue;
    }
    result.push({
      ...r,
      expiresAt: dynamicExp,
    });
  }
  return result;
}

/**
 * Hoàn lại Quà của tôi (usedMemberGiftIds), Điểm đổi quà (redeemedPointsTotal) và lượt dùng Voucher (usedCount)
 * khi đơn hàng bị Hủy (CANCELLED) bởi Khách hàng, Quản lý hoặc Admin.
 */
export async function rollbackCancelledOrderBenefits(
  orderOrId: Record<string, any> | string
): Promise<void> {
  try {
    let orderData: Record<string, any> | null = null;
    if (typeof orderOrId === 'string') {
      const snap = await getDoc(doc(db, 'orders', orderOrId)).catch(() => null);
      if (snap?.exists()) {
        orderData = { id: snap.id, ...snap.data() };
      }
    } else if (orderOrId && typeof orderOrId === 'object') {
      orderData = orderOrId;
      if (orderOrId.id && (!Array.isArray(orderOrId.items) || orderOrId.items.length === 0)) {
        const snap = await getDoc(doc(db, 'orders', String(orderOrId.id))).catch(() => null);
        if (snap?.exists()) {
          orderData = { ...orderOrId, ...snap.data(), id: snap.id };
        }
      }
    }
    if (!orderData || orderData.benefitsRolledBack === true) return;

    const orderId = String(orderData.id || '');
    const userId = String(orderData.userId || '');
    const voucherCode = String(orderData.voucherCode || '').trim();
    const items: any[] = Array.isArray(orderData.items) ? orderData.items : [];

    // 1. Tìm các mã Quà của tôi (MG_...) trong đơn hàng
    const usedGiftIds: string[] = Array.isArray(orderData.usedMemberGiftIds)
      ? [...orderData.usedMemberGiftIds]
      : [];
    items.forEach((it) => {
      const note = String(it?.specialInstructions || it?.note || '');
      const m = /Quà đổi điểm FPT Rewards \(([^)]+)\)/.exec(note);
      if (m && m[1] && !usedGiftIds.includes(m[1])) {
        usedGiftIds.push(m[1]);
      }
    });

    // 2. Tính tổng điểm đổi quà đã dùng trong đơn hàng (nếu có)
    const redeemedPointsTotal = Number(orderData.redeemedPointsTotal || 0);

    if (userId) {
      if (usedGiftIds.length > 0) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const key = `fpt_used_member_gifts_${userId}`;
            const raw = window.localStorage.getItem(key);
            const prev: string[] = raw ? JSON.parse(raw) : [];
            const next = prev.filter((id) => !usedGiftIds.includes(id));
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {}

        await updateDoc(doc(db, 'users', userId), {
          usedMemberGiftIds: arrayRemove(...usedGiftIds),
        }).catch(() => {});
      }

      if (redeemedPointsTotal > 0) {
        const uSnap = await getDoc(doc(db, 'users', userId)).catch(() => null);
        const uData = uSnap?.exists() ? uSnap.data() : undefined;
        const prevGifts: any[] = Array.isArray(uData?.redeemedGifts)
          ? [...uData.redeemedGifts]
          : [];
        let remainingToRefund = redeemedPointsTotal;
        const nextGifts = prevGifts.filter((g) => {
          const gPts = Number(g?.points || 0);
          if (remainingToRefund > 0 && gPts > 0 && gPts <= remainingToRefund) {
            remainingToRefund -= gPts;
            return false;
          }
          return true;
        });

        await updateDoc(doc(db, 'users', userId), {
          rewardPoints: increment(redeemedPointsTotal),
          redeemedGifts: nextGifts,
        }).catch(() => {});
      }
    }

    // 3. Hoàn lại 1 lượt sử dụng cho Voucher (usedCount)
    if (voucherCode) {
      const couponsSnap = await getDocs(collection(db, 'coupons')).catch(() => null);
      if (couponsSnap) {
        couponsSnap.forEach((cDoc) => {
          if (String(cDoc.id).startsWith('__')) return;
          const cData = cDoc.data();
          if (
            String(cData?.code || cDoc.id).toUpperCase() === voucherCode.toUpperCase() &&
            Number(cData?.usedCount || 0) > 0
          ) {
            updateDoc(doc(db, 'coupons', cDoc.id), {
              usedCount: increment(-1),
            }).catch(() => {});
          }
        });
      }
    }

    if (orderId) {
      await updateDoc(doc(db, 'orders', orderId), {
        benefitsRolledBack: true,
      }).catch(() => {});
    }
  } catch {}
}


