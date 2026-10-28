export type CategoryId =
  | 'all'
  | 'cheese_party'
  | 'member_deals'
  | 'hot_deals'
  | 'pizza'
  | 'starters'
  | 'drinks'
  | 'pasta'
  | 'sushi'
  | 'offers';

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
  originalPrice?: number;
  memberDiscountTag?: string;
  isNew?: boolean;
  isSpicy?: boolean;
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
