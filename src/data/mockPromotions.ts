import { Coupon } from '../types/user';

export const mockCoupons: Coupon[] = [
  { code: 'PIZZAFPT', discountType: 'FIXED', value: 40000, minSubtotal: 100000,
    description: 'Giảm 40.000đ cho đơn từ 100.000đ' },
  { code: 'FPT40', discountType: 'FIXED', value: 40000, minSubtotal: 200000,
    description: 'Giảm 40.000đ cho đơn từ 200.000đ' },
  { code: 'FREESHIP', discountType: 'FIXED', value: 0, minSubtotal: 0, freeShipping: true,
    description: 'Miễn phí giao hàng' },
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
