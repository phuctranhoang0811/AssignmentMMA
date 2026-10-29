import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { mockProducts } from '../data/mockProducts';
import { mockCoupons } from '../data/mockPromotions';
import type { Product } from '../types/product';
import type { Coupon } from '../types/user';
import { mergeStored } from '../utils/catalogMerge';
import { isCouponExpired } from '../utils/coupons';

// The backend prices orders from Firestore `products` and `coupons`, which admins edit.
// The app reads the same collections so displayed prices match; the bundled data is the offline fallback.
const MAX_AGE_MS = 60_000;

// Products are exclusive (only what the backend can price); coupons merge, since the backend also accepts built-ins.
function cached<T extends { id?: string; code?: string }>(name: string, fallback: T[], key: (item: T) => string, exclusive: boolean) {
  let value = fallback;
  let loadedAt = 0;
  let pending: Promise<T[]> | null = null;
  const load = (): Promise<T[]> => {
    if (Date.now() - loadedAt < MAX_AGE_MS) return Promise.resolve(value);
    pending ??= getDocs(collection(db, name)).then(snapshot => {
      const stored = new Map(snapshot.docs.map(doc => {
        const item = { ...doc.data(), [name === 'coupons' ? 'code' : 'id']: doc.id } as unknown as T;
        return [key(item), item] as const;
      }));
      value = mergeStored(fallback, stored, key, exclusive);
      loadedAt = Date.now();
      return value;
    }).catch(() => value).finally(() => { pending = null; });
    return pending;
  };
  const useList = () => {
    const [list, setList] = useState(value);
    useEffect(() => {
      let active = true;
      void load().then(next => { if (active) setList(next); });
      return () => { active = false; };
    }, []);
    return list;
  };
  return { load, useList, current: () => value };
}

const products = cached<Product>('products', mockProducts, p => p.id, true);
const coupons = cached<Coupon>('coupons', mockCoupons, c => c.code.toUpperCase(), false);

export const loadProducts = products.load;
/** Latest loaded product, for code outside React render (cart restore/add). */
export const cachedProduct = (id: string) => products.current().find(p => p.id === id);
export const loadCoupons = coupons.load;
export const useCoupons = coupons.useList;
/** Codes a customer can still use today (offers page). */
export const useActiveCoupons = () => coupons.useList().filter(c => !isCouponExpired(c));

export function useCatalog() {
  const list = products.useList();
  const productsMap = useMemo(() => Object.fromEntries(list.map(p => [p.id, p])) as Record<string, Product>, [list]);
  return { products: list, productsMap };
}

/** Expired codes are treated as unknown; per-customer and total limits are checked by the backend at order time. */
export const findCoupon = (list: Coupon[], code: string) =>
  list.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && !isCouponExpired(c));
