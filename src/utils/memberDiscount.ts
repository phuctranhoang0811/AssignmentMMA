import type { Product } from '../types/product';

/**
 % ưu đãi thành viên, tính từ giá gốc và giá bán: (original - price) / original.
 Trả về null nếu món không có ưu đãi thành viên hợp lệ.
 */
export const memberDiscountPercent = (
  original?: number,
  price?: number,
): number | null => {
  if (!original || !price || original <= price) return null;
  const pct = Math.round(((original - price) / original) * 100);
  return pct > 0 ? pct : null;
};

/**
 * Nhãn ưu đãi hiển thị dạng phần trăm, ví dụ "Ưu đãi thành viên 14%".
 * Món gắn nhãn kiểu cũ (tính bằng tiền) tự động quy đổi ra % theo giá thực tế.
 */
export const memberDiscountLabel = (product: Product): string | null => {
  if (!product.memberDiscountTag) return null;
  // Nhãn mới đã lưu sẵn % do admin nhập — giữ nguyên.
  if (/^Ưu đãi thành viên\s*-?\d+(\.\d+)?%$/i.test(product.memberDiscountTag.trim())) {
    return product.memberDiscountTag.replace('-', '');
  }
  const pct = memberDiscountPercent(product.originalPrice, product.basePrice);
  if (!pct) return product.memberDiscountTag;
  return `Ưu đãi thành viên ${pct}%`;
};
