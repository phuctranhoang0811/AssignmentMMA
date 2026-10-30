/**
 * One spelling per Vietnamese mobile number ("0912345678"), used as the key in phone_numbers/{phone}
 * so a number belongs to one account. Returns '' when the input is not a 10-digit number.
 */
export function normalizePhone(raw: string) {
  const digits = raw.trim().replace(/[\s.()-]/g, '').replace(/^\+?84/, '0');
  return /^0\d{9}$/.test(digits) ? digits : '';
}
