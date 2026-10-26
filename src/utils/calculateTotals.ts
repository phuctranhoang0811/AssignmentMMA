import { CartItem, FulfillmentType, OrderPricing } from '../types/order';
import { Product } from '../types/product';
import { Coupon } from '../types/user';
import { calculateCustomizationExtra } from '../types/pizzaCustomization';

export const DEFAULT_TAX_RATE = 0.10;
export const DEFAULT_DELIVERY_FEE = 20000;
export const FREE_DELIVERY_THRESHOLD = 299000;

export function getItemLineUnitPrice(item: CartItem, product?: Product): number {
  if (!product) return 0;
  
  let unitPrice = product.basePrice;
  if (product.variants && product.variants.length > 0 && item.variantId) {
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (variant) {
      unitPrice = variant.price;
    }
  }

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

export function calculateOrderTotals(
  items: CartItem[],
  productsMap: Record<string, Product>,
  fulfillmentType: FulfillmentType = 'DELIVERY',
  coupon?: Coupon | null,
  taxRate: number = DEFAULT_TAX_RATE
): OrderPricing {
  const subtotal = items.reduce((acc, item) => {
    const product = productsMap[item.productId];
    const unitPrice = getItemLineUnitPrice(item, product);
    return acc + unitPrice * item.quantity;
  }, 0);

  let discount = 0;
  if (coupon && subtotal >= coupon.minSubtotal) {
    if (coupon.discountType === 'PERCENT') {
      const percentVal = Math.round((subtotal * coupon.value) / 100);
      discount = coupon.maxDiscount ? Math.min(percentVal, coupon.maxDiscount) : percentVal;
    } else {
      discount = coupon.value;
    }
    discount = Math.min(discount, subtotal);
  }

  const taxableAmount = Math.max(0, subtotal - discount);

  let deliveryFee = 0;
  if (fulfillmentType === 'DELIVERY') {
    deliveryFee = taxableAmount >= FREE_DELIVERY_THRESHOLD ? 0 : DEFAULT_DELIVERY_FEE;
  }

  const tax = Math.round(taxableAmount * taxRate);
  const total = Math.max(0, taxableAmount + deliveryFee + tax);

  return {
    subtotal,
    discount,
    deliveryFee,
    tax,
    total,
  };
}
