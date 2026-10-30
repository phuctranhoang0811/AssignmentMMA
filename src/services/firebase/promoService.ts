import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PromoService } from '../contracts';
import { Coupon } from '../../types/user';
import { mockCoupons } from '../../data/mockPromotions';
import { formatCurrency } from '../../utils/formatCurrency';

class FirebasePromoService implements PromoService {
  async listAvailable(): Promise<Coupon[]> {
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      if (!snap.empty) {
        const list: Coupon[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            code: data.code || d.id,
            discountType: data.discountType || 'PERCENT',
            value: Number(data.value || 0),
            maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
            minSubtotal: Number(data.minSubtotal || 0),
            description: data.description || '',
            expiresAt: data.expiresAt || '31/12/2026',
          });
        });
        return list;
      }
    } catch (err: any) {
      console.warn('FirebasePromoService.listAvailable error:', err?.message);
    }
    return [...mockCoupons];
  }

  async validate(
    code: string,
    subtotal: number
  ): Promise<{ isValid: boolean; coupon?: Coupon; message?: string }> {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) {
      return { isValid: false, message: 'Vui lòng nhập mã giảm giá' };
    }

    try {
      // 1. Try finding by doc id
      const couponDoc = await getDoc(doc(db, 'coupons', normalized));
      let coupon: Coupon | null = null;

      if (couponDoc.exists()) {
        const data = couponDoc.data();
        coupon = {
          code: data.code || couponDoc.id,
          discountType: data.discountType || 'PERCENT',
          value: Number(data.value || 0),
          maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
          minSubtotal: Number(data.minSubtotal || 0),
          description: data.description || '',
          expiresAt: data.expiresAt || '31/12/2026',
        };
      } else {
        // Fallback: list all and match
        const all = await this.listAvailable();
        coupon = all.find((c) => c.code.toUpperCase() === normalized) || null;
      }

      if (!coupon) {
        return { isValid: false, message: 'Mã giảm giá không hợp lệ' };
      }

      if (subtotal > 0 && subtotal < coupon.minSubtotal) {
        return {
          isValid: false,
          coupon,
          message: `Đơn hàng tối thiểu ${formatCurrency(coupon.minSubtotal)} để áp dụng mã này`,
        };
      }

      return {
        isValid: true,
        coupon,
        message: 'Áp dụng mã giảm giá thành công!',
      };
    } catch (err: any) {
      console.warn('FirebasePromoService.validate error:', err?.message);
    }

    // Offline / fallback check
    const fallbackCoupon = mockCoupons.find((c) => c.code.toUpperCase() === normalized);
    if (!fallbackCoupon) {
      return { isValid: false, message: 'Mã giảm giá không hợp lệ' };
    }
    if (subtotal > 0 && subtotal < fallbackCoupon.minSubtotal) {
      return {
        isValid: false,
        coupon: fallbackCoupon,
        message: `Đơn hàng tối thiểu ${formatCurrency(fallbackCoupon.minSubtotal)} để áp dụng mã này`,
      };
    }
    return {
      isValid: true,
      coupon: fallbackCoupon,
      message: 'Áp dụng mã giảm giá thành công!',
    };
  }
}

export const firebasePromoService = new FirebasePromoService();
