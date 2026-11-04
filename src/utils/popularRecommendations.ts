import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Product } from '../types/product';

export const PROMO_GROUP_IDS = ['cheese_party', 'member_deals', 'hot_deals'];
const POPULAR_PRESET_KEY = '@fpt_popular_332_preset_v2';

let autoSyncRunning = false;

/**
 * Kiểm tra một món ăn có đang được giảm giá hoặc nằm trong nhóm ưu đãi hay không.
 */
export function isProductDiscounted(p: Product): boolean {
  if (PROMO_GROUP_IDS.includes(p.categoryId)) return true;
  if (Array.isArray(p.promoGroups) && p.promoGroups.some((g) => PROMO_GROUP_IDS.includes(g))) {
    return true;
  }
  if (typeof p.discountPercent === 'number' && p.discountPercent > 0) return true;
  if (typeof p.memberDiscountTag === 'string' && p.memberDiscountTag.trim().length > 0) {
    return true;
  }
  if (typeof p.originalPrice === 'number' && p.originalPrice > p.basePrice) return true;
  return false;
}

/**
 * Chọn đúng 8 món chuẩn cho mục "Bạn sẽ thích":
 * - 3 món Pizza chưa có giảm giá
 * - 3 món Khai vị
 * - 2 món Thức uống
 */
export function selectDefaultPopularIds(products: Product[]): Set<string> {
  const available = products.filter((p) => p.isAvailable !== false && !p.id.startsWith('__'));

  const undiscountedPizzas = available.filter(
    (p) => p.categoryId === 'pizza' && !isProductDiscounted(p)
  );
  const starters = available.filter((p) => p.categoryId === 'starters');
  const drinks = available.filter((p) => p.categoryId === 'drinks');

  // Ưu chọn 3 Pizza nguyên giá, 3 Khai vị, 2 Nước
  const pickedPizzas = undiscountedPizzas.slice(0, 3);
  const pickedStarters = starters.slice(0, 3);
  const pickedDrinks = drinks.slice(0, 2);

  return new Set<string>([
    ...pickedPizzas.map((p) => p.id),
    ...pickedStarters.map((p) => p.id),
    ...pickedDrinks.map((p) => p.id),
  ]);
}

/**
 * Sắp xếp danh sách "Bạn sẽ thích" theo thứ tự: Pizza -> Khai vị -> Thức uống
 */
export function sortPopularProducts(products: Product[]): Product[] {
  const catOrder: Record<string, number> = {
    pizza: 1,
    starters: 2,
    drinks: 3,
  };
  return [...products].sort((a, b) => {
    const ca = catOrder[a.categoryId] ?? 99;
    const cb = catOrder[b.categoryId] ?? 99;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

/**
 * Ghi batch lên Firestore để đặt đúng 8 món (3 Pizza nguyên giá + 3 Khai vị + 2 Nước) vào "Bạn sẽ thích".
 */
export async function applyDefault332PopularBatch(products: Product[]): Promise<number> {
  const targetIds = selectDefaultPopularIds(products);
  if (targetIds.size === 0) return 0;

  const batch = writeBatch(db);
  let changed = 0;

  products.forEach((p) => {
    if (p.id.startsWith('__')) return;
    const shouldBePopular = targetIds.has(p.id);
    if (Boolean(p.isPopular) !== shouldBePopular) {
      batch.update(doc(db, 'products', p.id), {
        isPopular: shouldBePopular,
        updatedAt: serverTimestamp(),
      });
      changed++;
    }
  });

  if (changed > 0) {
    await batch.commit();
  }
  await AsyncStorage.setItem(POPULAR_PRESET_KEY, 'done').catch(() => {});
  return targetIds.size;
}

/**
 * Tự động khởi tạo 8 món "Bạn sẽ thích" (3 Pizza chưa giảm giá + 3 Khai vị + 2 Nước)
 * chỉ khi trên Firestore chưa có món nào trong "Bạn sẽ thích", hoặc tự động gỡ Pizza
 * nếu món Pizza đó vừa được đưa vào nhóm giảm giá. Tuyệt đối không ghi đè khi Admin thêm/xóa món.
 */
export async function ensureDefaultPopularRecommendations(products: Product[]): Promise<void> {
  if (autoSyncRunning || products.length < 8) return;

  const currentPopular = products.filter((p) => p.isPopular && !p.id.startsWith('__'));
  const popDiscountedPizzas = currentPopular.filter(
    (p) => p.categoryId === 'pizza' && isProductDiscounted(p)
  );

  // Chỉ khởi tạo mặc định 3+3+2 khi danh sách "Bạn sẽ thích" đang trống hoàn toàn
  if (currentPopular.length === 0) {
    const alreadyPreset = await AsyncStorage.getItem(POPULAR_PRESET_KEY).catch(() => null);
    if (alreadyPreset) return;
    autoSyncRunning = true;
    try {
      await applyDefault332PopularBatch(products);
    } catch {
      // Ignore permission or offline errors silently on client
    } finally {
      autoSyncRunning = false;
    }
    return;
  }

  // Nếu đã có danh sách "Bạn sẽ thích", đánh dấu đã khởi tạo để không bao giờ tự reset lại 8 món
  await AsyncStorage.setItem(POPULAR_PRESET_KEY, 'done').catch(() => {});

  if (popDiscountedPizzas.length === 0) {
    return;
  }

  autoSyncRunning = true;
  try {
    // Nếu có Pizza vừa được thêm vào nhóm giảm giá thì tự động gỡ khỏi "Bạn sẽ thích"
    const batch = writeBatch(db);
    popDiscountedPizzas.forEach((dp) => {
      batch.update(doc(db, 'products', dp.id), {
        isPopular: false,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch {
    // Ignore permission or offline errors silently on client
  } finally {
    autoSyncRunning = false;
  }
}

