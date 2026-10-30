import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../../types/product';
import { ProductFilterParams, ProductService } from '../contracts';
import { mockProducts } from '../../data/mockProducts';

function mapDocToProduct(id: string, data: any): Product {
  return {
    id,
    name: data.name || '',
    categoryId: data.categoryId || data.category || 'pizza',
    description: data.description || '',
    image: data.image || data.imageUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
    basePrice: Number(data.basePrice || data.price || 0),
    originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
    isAvailable: data.isAvailable !== false,
    isPopular: Boolean(data.isPopular),
    isNew: Boolean(data.isNew),
    isSpicy: Boolean(data.isSpicy),
    discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
    memberDiscountTag: data.memberDiscountTag || undefined,
    variants: data.variants || [],
    addons: data.addons || [],
    ingredients: data.ingredients || [],
    tags: data.tags || [],
    sizeOptions: data.sizeOptions,
    crustOptions: data.crustOptions,
  } as Product;
}

class FirebaseProductService implements ProductService {
  // In-memory cache for fast lookups
  private cachedProducts: Product[] = [];
  private lastFetched = 0;
  private readonly CACHE_TTL = 30000; // 30s

  private async fetchAllFromDb(): Promise<Product[]> {
    const now = Date.now();
    if (this.cachedProducts.length > 0 && now - this.lastFetched < this.CACHE_TTL) {
      return this.cachedProducts;
    }

    try {
      const snap = await getDocs(collection(db, 'products'));
      if (!snap.empty) {
        const list: Product[] = [];
        snap.forEach((d) => {
          list.push(mapDocToProduct(d.id, d.data()));
        });
        this.cachedProducts = list;
        this.lastFetched = now;
        return list;
      }
    } catch (err: any) {
      console.warn('FirebaseProductService fetch error, falling back:', err?.message);
    }

    // Fallback if Firestore has no products or error
    if (this.cachedProducts.length > 0) return this.cachedProducts;
    return mockProducts;
  }

  async list(params?: ProductFilterParams): Promise<Product[]> {
    const all = await this.fetchAllFromDb();
    let result = [...all];

    if (params?.categoryId && params.categoryId !== 'all') {
      if (params.categoryId === 'offers') {
        result = result.filter(
          (p) =>
            (p.discountPercent && p.discountPercent > 0) ||
            p.tags?.includes('Bestseller') ||
            p.tags?.includes('Mới') ||
            p.tags?.includes('Deal')
        );
      } else {
        result = result.filter((p) => p.categoryId === params.categoryId);
      }
    }

    if (params?.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.ingredients?.some((ing) => ing.toLowerCase().includes(q)) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (params?.onlyAvailable) {
      result = result.filter((p) => p.isAvailable);
    }

    if (params?.maxPrice && params.maxPrice > 0) {
      result = result.filter((p) => p.basePrice <= params.maxPrice!);
    }

    if (params?.sort) {
      if (params.sort === 'price_asc') {
        result.sort((a, b) => a.basePrice - b.basePrice);
      } else if (params.sort === 'price_desc') {
        result.sort((a, b) => b.basePrice - a.basePrice);
      } else if (params.sort === 'popular') {
        result.sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0));
      }
    }

    return result;
  }

  async getById(id: string): Promise<Product | null> {
    try {
      const snap = await getDoc(doc(db, 'products', id));
      if (snap.exists()) {
        return mapDocToProduct(snap.id, snap.data());
      }
    } catch (err: any) {
      console.warn('FirebaseProductService getById error:', err?.message);
    }

    // Check cached or mock
    const fromCache = this.cachedProducts.find((p) => p.id === id);
    if (fromCache) return fromCache;

    const fromMock = mockProducts.find((p) => p.id === id);
    return fromMock || null;
  }

  // Force cache invalidate when needed
  invalidateCache() {
    this.lastFetched = 0;
  }
}

export const firebaseProductService = new FirebaseProductService();
