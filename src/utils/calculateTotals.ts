import { CartItem, FulfillmentType, OrderPricing } from '../types/order';
import { Product } from '../types/product';
import { Coupon } from '../types/user';
import { calculateCustomizationExtra } from '../types/pizzaCustomization';
import { deliveryFeeQuote, type DeliveryFeeConfig, type LatLng } from './deliveryFee';

// Catalog prices are the displayed item prices; no extra tax is added at checkout.
export const DEFAULT_TAX_RATE = 0;

export function getProductVariantOrBasePrice(
  product?: Product,
  variantId?: string,
  isMember: boolean = true
): number {
  if (!product) return 0;
  const hasDiscount =
    typeof product.originalPrice === 'number' &&
    product.originalPrice > product.basePrice &&
    product.basePrice > 0;

  const variant =
    product.variants && product.variants.length > 0 && variantId
      ? product.variants.find((v) => v.id === variantId)
      : undefined;

  if (!variant) {
    if (!hasDiscount) return product.basePrice;
    return isMember ? product.basePrice : product.originalPrice!;
  }

  if (!hasDiscount) {
    return variant.price;
  }

  const minVariantPrice = Math.min(...product.variants.map((v) => v.price));
  const variantsAlreadyDiscounted = minVariantPrice <= product.basePrice;

  if (variantsAlreadyDiscounted) {
    const discountDelta = product.originalPrice! - product.basePrice;
    return isMember ? variant.price : variant.price + discountDelta;
  } else {
    if (!isMember) return variant.price;
    if (variant.price === product.originalPrice) return product.basePrice;
    const ratio = product.basePrice / product.originalPrice!;
    return Math.round((variant.price * ratio) / 1000) * 1000;
  }
}

export function getItemLineUnitPrice(
  item: CartItem,
  product?: Product,
  isMember: boolean = true
): number {
  if (
    (item as any)?.isRewardGift ||
    String(item?.specialInstructions || '').includes('Quà đổi điểm FPT Rewards')
  ) {
    return 0;
  }
  if (!product) return 0;

  let unitPrice = getProductVariantOrBasePrice(product, item.variantId, isMember);

  if (item.addonIds && item.addonIds.length > 0 && product.addons) {
    const addonsTotal = item.addonIds.reduce((sum, addonId) => {
      const addon = product.addons.find((a) => a.id === addonId);
      return sum + (addon ? addon.price : 0);
    }, 0);
    unitPrice += addonsTotal;
  }

  if (item.customization) {
    unitPrice += calculateCustomizationExtra(item.customization);
  }

  return unitPrice;
}

/** Store-delivered orders: the price list and where the food is going. Absent = no shipping fee. */
export type DeliveryPricing = { config: DeliveryFeeConfig; to: LatLng };

export function calculateOrderTotals(
  items: CartItem[],
  productsMap: Record<string, Product>,
  _fulfillmentType: FulfillmentType = 'DELIVERY',
  coupon?: Coupon | null,
  taxRate: number = DEFAULT_TAX_RATE,
  delivery?: DeliveryPricing,
  isMember: boolean = true
): OrderPricing & { deliveryDistanceKm?: number; riderPay?: number; outOfRange?: boolean } {
  const subtotal = items.reduce((acc, item) => {
    const product = productsMap[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product, isMember);
    return acc + unitPrice * item.quantity;
  }, 0);

  let discount = 0;
  if (coupon && !coupon.freeShipping && subtotal >= coupon.minSubtotal) {
    if (coupon.discountType === 'PERCENT') {
      const percentVal = Math.round((subtotal * coupon.value) / 100);
      discount = coupon.maxDiscount ? Math.min(percentVal, coupon.maxDiscount) : percentVal;
    } else {
      discount = coupon.value;
    }
    discount = Math.min(discount, subtotal);
  }

  const taxableAmount = Math.max(0, subtotal - discount);

  // Fee by distance from the store (see deliveryFee.ts); Ahamove orders bring their own fee and pass no price list here.
  const shipping = delivery && _fulfillmentType === 'DELIVERY'
    ? deliveryFeeQuote(delivery.config, delivery.to, subtotal, !!coupon?.freeShipping && subtotal >= coupon.minSubtotal) : undefined;
  const deliveryFee = shipping ? shipping.fee : 0;

  const tax = Math.round(taxableAmount * taxRate);
  const total = Math.max(0, taxableAmount + deliveryFee + tax);

  return {
    subtotal,
    discount,
    deliveryFee,
    tax,
    total,
    ...(shipping ? { deliveryDistanceKm: shipping.distanceKm, riderPay: shipping.riderPay, outOfRange: shipping.outOfRange } : {}),
  };
}
