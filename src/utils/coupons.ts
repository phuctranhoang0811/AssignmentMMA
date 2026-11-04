import type { Coupon } from '../types/user';

/** End of validity: "dd/mm/yyyy" means through that day (Vietnam time); ISO dates are exact. None = no end. */
export function couponEndsAt(coupon: Pick<Coupon, 'expiresAt'>): number | undefined {
  const value = coupon.expiresAt?.trim();
  if (!value) return undefined;
  const day = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (day) {
    const dd = +day[1];
    const mm = +day[2];
    const yyyy = +day[3];
    const check = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (
      check.getUTCFullYear() !== yyyy ||
      check.getUTCMonth() !== mm - 1 ||
      check.getUTCDate() !== dd
    ) {
      return undefined;
    }
    return Date.UTC(yyyy, mm - 1, dd, 23, 59, 59, 999) - 7 * 3_600_000;
  }
  const end = Date.parse(value);
  return Number.isFinite(end) ? end : undefined;
}

export const isCouponExpired = (coupon: Pick<Coupon, 'expiresAt'>, now = Date.now()) => {
  const end = couponEndsAt(coupon);
  return end !== undefined && now > end;
};

export function isValidFutureCouponDate(value: string, now = Date.now()): {
  valid: boolean;
  incomplete?: boolean;
  error?: string;
} {
  const clean = value.trim();
  if (!clean) return { valid: true };

  const digits = clean.replace(/\D/g, '');
  if (digits.length < 8) {
    return {
      valid: false,
      incomplete: true,
      error: 'Không đúng định dạng ngày (dd/mm/yyyy)',
    };
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
  if (!match) {
    return { valid: false, error: 'Không đúng định dạng ngày (dd/mm/yyyy)' };
  }

  const dd = +match[1];
  const mm = +match[2];
  const yyyy = +match[3];
  const check = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    mm < 1 ||
    mm > 12 ||
    check.getUTCFullYear() !== yyyy ||
    check.getUTCMonth() !== mm - 1 ||
    check.getUTCDate() !== dd
  ) {
    return { valid: false, error: 'Không đúng định dạng ngày (dd/mm/yyyy)' };
  }

  const endMs = Date.UTC(yyyy, mm - 1, dd, 23, 59, 59, 999) - 7 * 3_600_000;
  if (endMs <= now) {
    return {
      valid: false,
      error: 'Thời gian đã qua',
    };
  }
  return { valid: true };
}

/** One use per customer per code; the order that used it is recorded so a cancellation can give it back. */
export const couponUsageId = (code: string, uid: string) => `${code.toUpperCase()}_${uid}`;
