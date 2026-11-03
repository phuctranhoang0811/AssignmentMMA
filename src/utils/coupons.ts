import type { Coupon } from '../types/user';

/** End of validity: "dd/mm/yyyy" means through that day (Vietnam time); ISO dates are exact. None = no end. */
export function couponEndsAt(coupon: Pick<Coupon, 'expiresAt'>): number | undefined {
  const value = coupon.expiresAt?.trim();
  if (!value) return undefined;
  const day = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const end = day ? Date.UTC(+day[3], +day[2] - 1, +day[1], 23, 59, 59, 999) - 7 * 3_600_000 : Date.parse(value);
  return Number.isFinite(end) ? end : undefined;
}

export const isCouponExpired = (coupon: Pick<Coupon, 'expiresAt'>, now = Date.now()) => {
  const end = couponEndsAt(coupon);
  return end !== undefined && now > end;
};

/** One use per customer per code; the order that used it is recorded so a cancellation can give it back. */
export const couponUsageId = (code: string, uid: string) => `${code.toUpperCase()}_${uid}`;
