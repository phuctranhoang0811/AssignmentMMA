import { Product } from '../../types/product';
import { ProductFilterParams, ProductService } from '../contracts';
import { loadProducts } from '../catalog';
import { demoConfig } from '../../data/mockConfig';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MockProductService implements ProductService {
  async list(params?: ProductFilterParams): Promise<Product[]> {
    await delay(demoConfig.simulatedLatencyMs);
    let result = [...await loadProducts()];

    if (params?.categoryId && params.categoryId !== 'all') {
      if (params.categoryId === 'offers') {
        result = result.filter((p) => (p.discountPercent && p.discountPercent > 0) || p.tags?.includes('Bestseller') || p.tags?.includes('Mới'));
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
    await delay(demoConfig.simulatedLatencyMs);
    const product = (await loadProducts()).find((p) => p.id === id);
    return product || null;
  }
}

export const mockProductService = new MockProductService();
