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
 * Nhãn ưu đãi hiển thị trên góc trái card (ví dụ: "Ưu đãi thành viên 14%" hoặc "GIẢM 31%").
 */
export const memberDiscountLabel = (product: Product): string | null => {
  if (!product.memberDiscountTag) {
    const pct = memberDiscountPercent(product.originalPrice, product.basePrice);
    if (!pct) return null;
    if ((product.promoGroups || []).includes('hot_deals')) {
      return `GIẢM ${pct}%`;
    }
    return `Ưu đãi thành viên ${pct}%`;
  }
  const trimmed = product.memberDiscountTag.trim();
  if (/^GIẢM\s+\d+(\.\d+)?%$/i.test(trimmed)) {
    return trimmed;
  }
  // Nhãn mới đã lưu sẵn % do admin nhập — giữ nguyên.
  if (/^Ưu đãi thành viên\s*-?\d+(\.\d+)?%$/i.test(trimmed)) {
    return trimmed.replace('-', '');
  }
  const pct = memberDiscountPercent(product.originalPrice, product.basePrice);
  if (!pct) return trimmed;
  if ((product.promoGroups || []).includes('hot_deals')) {
    return `GIẢM ${pct}%`;
  }
  return `Ưu đãi thành viên ${pct}%`;
};
