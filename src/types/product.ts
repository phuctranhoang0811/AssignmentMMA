export type CategoryId = 'all' | 'pizza' | 'pasta' | 'sushi' | 'drinks' | 'offers';

export type ProductVariant = {
  id: string;
  name: string;
  price: number;
};

export type ProductAddon = {
  id: string;
  name: string;
  price: number;
};

export type Product = {
  id: string;
  name: string;
  categoryId: Exclude<CategoryId, 'all' | 'offers'>;
  description: string;
  image: string;
  basePrice: number;
  variants: ProductVariant[];
  addons: ProductAddon[];
  isAvailable: boolean;
  isPopular?: boolean;
  discountPercent?: number;
  ingredients?: string[];
  tags?: string[];
};

export type Category = {
  id: CategoryId;
  name: string;
  icon?: string;
};
