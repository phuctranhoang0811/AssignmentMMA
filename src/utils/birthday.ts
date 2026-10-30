const MIN_YEAR = 1900;

/** Returns what is wrong with a day/month/year typed by the customer, or null when it is a real date in the past. */
export function birthdayError(day: string, month: string, year: string, today = new Date()): string | null {
  if (!day || !month || !year) return 'Vui lòng nhập đầy đủ ngày sinh (ngày / tháng / năm).';
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  if (year.length !== 4 || y < MIN_YEAR) return 'Năm sinh không hợp lệ.';
  const date = new Date(y, m - 1, d);
  // Date rolls 31/02 over to March, so a real date must come back unchanged.
  if (m < 1 || m > 12 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return 'Ngày sinh không tồn tại.';
  if (date > today) return 'Ngày sinh không thể ở tương lai.';
  return null;
}

export const birthdayText = (day: string, month: string, year: string) => `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
