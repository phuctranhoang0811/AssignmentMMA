import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../../types/product';
import { ProductFilterParams, ProductService } from '../contracts';

function mapDocToProduct(id: string, data: any): Product & { sortOrder?: number } {
  return {
    id,
    name: data.name || '',
    categoryId: data.categoryId || data.category || 'pizza',
    description: data.description || '',
    image:
      data.image ||
      data.imageUrl ||
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
    basePrice: Number(data.basePrice || data.price || 0),
    originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
    isAvailable: data.isAvailable !== false,
    isPopular: Boolean(data.isPopular),
    isNew: Boolean(data.isNew),
    isSpicy: Boolean(data.isSpicy),
    discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
    memberDiscountTag: data.memberDiscountTag || undefined,
    variants: Array.isArray(data.variants) ? data.variants : [],
    addons: Array.isArray(data.addons) ? data.addons : [],
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    promoGroups: Array.isArray(data.promoGroups) ? data.promoGroups : undefined,
    sizeOptions: data.sizeOptions,
    crustOptions: data.crustOptions,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
  } as Product & { sortOrder?: number };
}

class FirebaseProductService implements ProductService {
  private cachedProducts: (Product & { sortOrder?: number })[] = [];
  private lastFetched = 0;
  private readonly CACHE_TTL = 3000;

  private async fetchAllFromDb(): Promise<Product[]> {
    const now = Date.now();
    if (this.cachedProducts.length > 0 && now - this.lastFetched < this.CACHE_TTL) {
      return this.cachedProducts;
    }

    try {
      const snap = await getDocs(collection(db, 'products'));
      const list: (Product & { sortOrder?: number })[] = [];
      snap.forEach((d) => {
        if (!d.id.startsWith('__')) {
          list.push(mapDocToProduct(d.id, d.data()));
        }
      });
      list.sort((a, b) => {
        const sa = a.sortOrder ?? 9999;
        const sb = b.sortOrder ?? 9999;
        if (sa !== sb) return sa - sb;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });
      this.cachedProducts = list;
      this.lastFetched = now;
      return list;
    } catch (err: any) {
      console.warn('FirebaseProductService fetch error:', err?.message);
      return this.cachedProducts;
    }
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
      const norm = (s: string) =>
        (s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/\s+/g, ' ')
          .trim();
      const qRaw = params.query.toLowerCase().trim();
      const qNorm = norm(params.query);
      const tokens = qNorm.split(' ').filter(Boolean);

      result = result.filter((p) => {
        const raw = [
          p.name,
          p.description || '',
          ...(p.ingredients || []),
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        if (raw.includes(qRaw)) return true;
        const n = norm(raw);
        return n.includes(qNorm) || (tokens.length > 0 && tokens.every((t) => n.includes(t)));
      });
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

    const fromCache = this.cachedProducts.find((p) => p.id === id);
    return fromCache || null;
  }

  invalidateCache() {
    this.lastFetched = 0;
  }
}

export const firebaseProductService = new FirebaseProductService();
