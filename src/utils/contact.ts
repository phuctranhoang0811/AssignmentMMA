export type ContactField = 'fullname' | 'phone' | 'email';
export const normalizePhone = (value: string) => {
  const digits = value.replace(/[\s.-]/g, '').replace(/^\+?84/, '0');
  return digits.startsWith('0') ? digits : `0${digits}`;
};
export const contactError = (field: ContactField, value: string) => {
  if (field === 'fullname') return value.trim() ? '' : 'Nhập họ tên người nhận.';
  if (field === 'phone') return /^0[35789]\d{8}$/.test(normalizePhone(value)) ? '' : 'Nhập số di động Việt Nam hợp lệ.';
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Kiểm tra lại địa chỉ email.';
};
