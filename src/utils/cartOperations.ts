import { CartItem } from '../types/order';
import { generateCartLineKey } from './cartLineKey';
import type { Product } from '../types/product';

export function canEditCartProduct(product?: Product): boolean {
  return Boolean(product);
}

// Replace exactly one line; combine identical configurations without losing quantity.
export function replaceCartItem(items: CartItem[], lineId: string, item: Omit<CartItem, 'lineId'>): CartItem[] {
  if (!items.some(line => line.lineId === lineId)) return items;
  const nextId = generateCartLineKey(item.productId, item.variantId, item.addonIds, item.specialInstructions, item.customization);
  const duplicate = items.find(line => line.lineId === nextId && line.lineId !== lineId);
  if (duplicate && duplicate.quantity + item.quantity > 20) return items;
  return items.flatMap(line => {
    if (line.lineId === lineId) return duplicate ? [] : [{ ...item, lineId: nextId }];
    return line.lineId === nextId ? [{ ...item, lineId: nextId, quantity: line.quantity + item.quantity }] : [line];
  });
}
