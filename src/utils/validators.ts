export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s.-]/g, '');
  return /^0[0-9]{9}$/.test(cleaned);
}

export function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 2;
}
