import { Coupon } from '../types/user';

export const mockCoupons: Coupon[] = [
  {
    code: 'PIZZA20',
    discountType: 'PERCENT',
    value: 20,
    maxDiscount: 50000,
    minSubtotal: 200000,
    description: 'Giảm 20% tối đa 50.000₫ cho đơn hàng từ 200.000₫',
    expiresAt: '31/12/2026',
  },
  {
    code: 'WELCOME30',
    discountType: 'FIXED',
    value: 30000,
    minSubtotal: 150000,
    description: 'Giảm ngay 30.000₫ cho đơn hàng đầu tiên từ 150.000₫',
    expiresAt: '31/12/2026',
  },
];
