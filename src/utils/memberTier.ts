import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export type MemberTierId = 'basic' | 'gold' | 'vip';

export interface MemberTierInfo {
  id: MemberTierId;
  label: string;
  cardTitle: string;
  discountPercent: number;
  discountRate: number;
  totalSpent: number;
  earnedPointsFromOrders: number;
  maturityDate: string;
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
  maturityDate: string = '30/11/2027'
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
    const [userSnap, ordersSnap] = await Promise.all([
      getDoc(doc(db, 'users', userId)).catch(() => null),
      getDocs(query(collection(db, 'orders'), where('userId', '==', userId))).catch(() => null),
    ]);

    const createdAt = userSnap?.exists() ? userSnap.data()?.createdAt : undefined;
    const maturityDate = calculateMaturityDate(createdAt);

    let totalSpent = 0;
    let earnedPointsFromOrders = 0;

    if (ordersSnap) {
      ordersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const status = String(data.status ?? '').toUpperCase();
        if (status === 'CANCELLED') return;
        const orderTotal = Number(data.total) || 0;
        const points =
          typeof data.earnedPoints === 'number'
            ? data.earnedPoints
            : Math.floor(orderTotal / 10000);
        earnedPointsFromOrders += points;
        if (status === 'COMPLETED' || status === 'DELIVERED') {
          totalSpent += orderTotal;
        }
      });
    }

    return getMemberTierFromSpent(totalSpent, earnedPointsFromOrders, maturityDate);
  } catch {
    return getMemberTierFromSpent(0, 0, calculateMaturityDate());
  }
}

