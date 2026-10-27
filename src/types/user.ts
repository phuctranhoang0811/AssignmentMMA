export type DemoUser = {
  id: string;
  fullname: string;
  email: string;
  phone: string;
  avatar?: string;
  birthday?: string;
  gender?: string;
  role?: 'USER' | 'EMPLOYEE' | 'STORE_MANAGER' | 'SUPER_ADMIN' | string;
  rewardPoints?: number;
  isDemo?: boolean;
  hasPassword?: boolean;
};

export type UserAddress = {
  id: string;
  label: string; // Nhà riêng, Công ty, v.v.
  recipientName: string;
  phone: string;
  address: string;
  isDefault: boolean;
};

export type Coupon = {
  freeShipping?: boolean;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  maxDiscount?: number;
  minSubtotal: number;
  description: string;
  expiresAt?: string;
};
