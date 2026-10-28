export type UserRole = 'CUSTOMER' | 'USER' | 'EMPLOYEE' | 'STAFF' | 'STORE_MANAGER' | 'SUPER_ADMIN' | string;

export type DemoUser = {
  id: string;
  fullname: string;
  email: string;
  phone: string;
  avatar?: string;
  birthday?: string;
  gender?: string;
  role?: UserRole;
  branchId?: string;
  rewardPoints?: number;
  isDemo?: boolean;
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
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  maxDiscount?: number;
  minSubtotal: number;
  description: string;
  expiresAt?: string;
};
