import { PromoService } from '../contracts';
import { Coupon } from '../../types/user';
import { mockCoupons } from '../../data/mockPromotions';
import { demoConfig } from '../../data/mockConfig';
import { formatCurrency } from '../../utils/formatCurrency';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MockPromoService implements PromoService {
  async listAvailable(): Promise<Coupon[]> {
    await delay(demoConfig.simulatedLatencyMs);
    return [...mockCoupons];
  }

  async validate(
    code: string,
    subtotal: number
  ): Promise<{ isValid: boolean; coupon?: Coupon; message?: string }> {
    await delay(demoConfig.simulatedLatencyMs);
    const normalized = (code || '').trim().toUpperCase();
    const coupon = mockCoupons.find((c) => c.code.toUpperCase() === normalized);

    if (!coupon) {
      return {
        isValid: false,
        message: 'Mã giảm giá không hợp lệ',
      };
    }

    if (subtotal < coupon.minSubtotal) {
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
  }
}

export const mockPromoService = new MockPromoService();
