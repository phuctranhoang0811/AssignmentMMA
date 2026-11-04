import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { mockCoupons } from '../data/mockPromotions';
import type { Product } from '../types/product';
import type { Coupon } from '../types/user';
import { mergeStored } from '../utils/catalogMerge';
import { isCouponExpired } from '../utils/coupons';

// The backend prices orders from Firestore `products` and `coupons`, which admins edit.
// The app reads directly from Firestore `products` without mock product fallback.
const MAX_AGE_MS = 3_000;

function cached<T extends { id?: string; code?: string; sortOrder?: number }>(
  name: string,
  fallback: T[],
  key: (item: T) => string,
  exclusive: boolean
) {
  let value = fallback;
  let loadedAt = 0;
  let pending: Promise<T[]> | null = null;
  const listeners = new Set<(items: T[]) => void>();
  let snapshotUnsub: (() => void) | null = null;

  const parseDocs = (docs: any[]): T[] => {
    const stored = new Map(
      docs
        .filter((doc) => !doc.id.startsWith('__'))
        .map((doc) => {
          const raw = doc.data();
          const item = {
            ...raw,
            ...(name === 'products'
              ? {
                  id: doc.id,
                  name: raw.name || '',
                  categoryId: raw.categoryId || raw.category || 'pizza',
                  description: raw.description || '',
                  image: raw.image || raw.imageUrl || '',
                  basePrice: Number(raw.basePrice || raw.price || 0),
                  originalPrice: raw.originalPrice ? Number(raw.originalPrice) : undefined,
                  isAvailable: raw.isAvailable !== false,
                  isPopular: Boolean(raw.isPopular),
                  isNew: Boolean(raw.isNew),
                  isSpicy: Boolean(raw.isSpicy),
                  discountPercent: raw.discountPercent ? Number(raw.discountPercent) : undefined,
                  memberDiscountTag: raw.memberDiscountTag || undefined,
                  promoGroups: Array.isArray(raw.promoGroups) ? raw.promoGroups : undefined,
                  variants: Array.isArray(raw.variants) ? raw.variants : [],
                  addons: Array.isArray(raw.addons) ? raw.addons : [],
                  sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 999,
                }
              : { code: doc.id }),
          } as unknown as T;
          return [key(item), item] as const;
        })
    );
    const merged = mergeStored(fallback, stored, key, exclusive).filter(
      (item) => !(item as any)?.deleted
    );
    if (name === 'products') {
      merged.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    }
    return merged;
  };

  const ensureRealtime = () => {
    if (snapshotUnsub) return;
    try {
      snapshotUnsub = onSnapshot(
        collection(db, name),
        (snapshot) => {
          value = parseDocs(snapshot.docs);
          loadedAt = Date.now();
          listeners.forEach((fn) => fn(value));
        },
        () => {}
      );
    } catch {}
  };

  const load = (): Promise<T[]> => {
    ensureRealtime();
    if (Date.now() - loadedAt < MAX_AGE_MS && value.length > 0) return Promise.resolve(value);
    pending ??= getDocs(collection(db, name))
      .then((snapshot) => {
        value = parseDocs(snapshot.docs);
        loadedAt = Date.now();
        listeners.forEach((fn) => fn(value));
        return value;
      })
      .catch(() => value)
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  const useList = () => {
    const [list, setList] = useState(value);
    useEffect(() => {
      ensureRealtime();
      const listener = (next: T[]) => setList(next);
      listeners.add(listener);
      void load().then((next) => {
        setList(next);
      });
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return list;
  };
  return { load, useList, current: () => value };
}

const products = cached<Product>('products', [], (p) => p.id, true);
const coupons = cached<Coupon>('coupons', mockCoupons, (c) => c.code.toUpperCase(), false);

export const loadProducts = products.load;
/** Latest loaded product, for code outside React render (cart restore/add). */
export const cachedProduct = (id: string) => products.current().find((p) => p.id === id);
export const loadCoupons = coupons.load;
export const useCoupons = coupons.useList;
/** Codes a customer can still use today (offers page). */
export const useActiveCoupons = () =>
  coupons
    .useList()
    .filter(
      (c) =>
        !(c as any)?.deleted &&
        !isCouponExpired(c) &&
        !(c.usageLimit && (c.usedCount || 0) >= c.usageLimit)
    );

export function useCatalog() {
  const list = products.useList();
  const productsMap = useMemo(
    () => Object.fromEntries(list.map((p) => [p.id, p])) as Record<string, Product>,
    [list]
  );
  return { products: list, productsMap };
}

/** Expired codes are treated as unknown; per-customer and total limits are checked by the backend at order time. */
export const findCoupon = (list: Coupon[], code: string) =>
  list.find(
    (c) =>
      !(c as any)?.deleted &&
      c.code.toUpperCase() === code.trim().toUpperCase() &&
      !isCouponExpired(c) &&
      !(c.usageLimit && (c.usedCount || 0) >= c.usageLimit)
  );
