import { birthdayError, birthdayText } from '../birthday';

const today = new Date(2026, 9, 30);

test('a real past date is accepted, including a leap day', () => {
  expect(birthdayError('15', '03', '2000', today)).toBeNull();
  expect(birthdayError('29', '02', '2000', today)).toBeNull();
});

test('missing parts, impossible dates, short years and future dates are explained', () => {
  expect(birthdayError('', '03', '2000', today)).toContain('đầy đủ');
  expect(birthdayError('31', '02', '2000', today)).toBe('Ngày sinh không tồn tại.');
  expect(birthdayError('29', '02', '2001', today)).toBe('Ngày sinh không tồn tại.');
  expect(birthdayError('10', '13', '2000', today)).toBe('Ngày sinh không tồn tại.');
  expect(birthdayError('10', '03', '99', today)).toBe('Năm sinh không hợp lệ.');
  expect(birthdayError('31', '10', '2026', today)).toBe('Ngày sinh không thể ở tương lai.');
});

test('the stored text is always dd/mm/yyyy', () => {
  expect(birthdayText('5', '3', '2000')).toBe('05/03/2000');
});
