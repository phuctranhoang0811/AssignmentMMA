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
  /** False until the e-mail is proven; such an account cannot order or redeem rewards. Missing = older account, verified. */
  emailVerified?: boolean;
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
  /** Only for a customer's first non-cancelled order. */
  firstOrderOnly?: boolean;
  /** Total uses across all customers (admin coupons); usedCount is kept by the backend. */
  usageLimit?: number;
  usedCount?: number;
};
