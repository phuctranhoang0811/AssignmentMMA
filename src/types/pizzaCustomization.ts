export type PizzaSizeId = 'small' | 'medium' | 'large';

/**
 * The size/crust/topping builder applies only to real pizzas, whose sizes are small/medium/large.
 * Combos are filed under the pizza category too, but their variants (e.g. 'pep') are not pizza sizes.
 * Shared by the app and the backend so both agree on what may carry a customization.
 */
export function isCustomizablePizza(product?: { categoryId?: string; variants?: { id: string }[] }) {
  const sizes = ['small', 'medium', 'large'];
  return product?.categoryId === 'pizza' && !!product.variants?.length && product.variants.every(v => sizes.includes(v.id));
}

export interface PizzaCrust {
  id: string;
  name: string;
  description?: string;
  price: number;
  supportedSizes: PizzaSizeId[];
  isPopular?: boolean;
}

export interface PizzaSauce {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface PizzaTopping {
  id: string;
  name: string;
  price: number;
  category: 'cheese' | 'meat' | 'veggie';
}

export type SpiceLevel = 'none' | 'mild' | 'medium' | 'hot';
export type BakingPreference = 'standard' | 'crispy';
export type CutPreference = '6-slices' | '8-slices' | 'no-cut';

export interface SelectedTopping {
  id: string;
  quantity: number; // 1, 2...
}

export interface PizzaCustomizationState {
  sizeId: PizzaSizeId;
  crustId: string;
  sauceId: string;
  hasExtraSauce: boolean;
  toppings: SelectedTopping[];
  spiceLevel: SpiceLevel;
  bakingPreference: BakingPreference;
  cutPreference: CutPreference;
  removedIngredients: string[];
  specialInstructions?: string;
}

// Master Data definition
export const PIZZA_SIZES: { id: PizzaSizeId; name: string; diameter: string }[] = [
  { id: 'small', name: 'Nhỏ', diameter: '20 cm' },
  { id: 'medium', name: 'Vừa', diameter: '25 cm' },
  { id: 'large', name: 'Lớn', diameter: '30 cm' },
];

export const PIZZA_CRUSTS: PizzaCrust[] = [
  {
    id: 'classic-hand-tossed',
    name: 'Classic Hand-Tossed',
    description: 'Đế vừa truyền thống giòn xốp bên ngoài, mềm thơm bên trong',
    price: 0,
    supportedSizes: ['small', 'medium', 'large'],
    isPopular: true,
  },
  {
    id: 'thin-crispy',
    name: 'Thin & Crispy',
    description: 'Đế siêu mỏng giòn rụm đậm vị topping',
    price: 0,
    supportedSizes: ['small', 'medium', 'large'],
  },
  {
    id: 'thick-pan',
    name: 'Thick Pan',
    description: 'Đế dày vàng ươm giòn rụm bên ngoài xốp mềm ruột',
    price: 15000,
    supportedSizes: ['small', 'medium', 'large'],
  },
  {
    id: 'cheese-stuffed',
    name: 'Cheese Stuffed Crust',
    description: 'Viền phô mai Mozzarella hảo hạng kéo sợi béo ngậy',
    price: 30000,
    supportedSizes: ['medium', 'large'],
  },
  {
    id: 'sausage-stuffed',
    name: 'Sausage Stuffed Crust',
    description: 'Viền xúc xích gà nướng phô mai giòn dai đậm đà',
    price: 35000,
    supportedSizes: ['medium', 'large'],
  },
  {
    id: 'detroit-style',
    name: 'Detroit Style',
    description: 'Đế chữ nhật viền phô mai nướng xém cạnh đặc trưng',
    price: 25000,
    supportedSizes: ['medium', 'large'],
  },
];

export const PIZZA_SAUCES: PizzaSauce[] = [
  { id: 'classic-tomato', name: 'Classic Tomato Sauce', price: 0, description: 'Sốt cà chua San Marzano truyền thống' },
  { id: 'creamy-white', name: 'Creamy White Sauce', price: 0, description: 'Sốt kem béo Alfredo mịn màng' },
  { id: 'smoky-bbq', name: 'Smoky BBQ Sauce', price: 0, description: 'Sốt BBQ đậm đà thơm mùi khói gỗ sồi' },
  { id: 'basil-pesto', name: 'Basil Pesto Sauce', price: 10000, description: 'Sốt húng quế Ý thơm bùi hạt thông' },
  { id: 'truffle-cream', name: 'Truffle Cream Sauce', price: 20000, description: 'Sốt kem nấm truffle đen thượng hạng' },
];

export const EXTRA_SAUCE_PRICE = 10000;
export const MAX_TOPPINGS_COUNT = 5;

export const PIZZA_TOPPINGS: PizzaTopping[] = [
  // Cheese
  { id: 'extra-mozzarella', name: 'Extra Mozzarella', price: 20000, category: 'cheese' },
  { id: 'double-cheese', name: 'Double Cheese', price: 35000, category: 'cheese' },
  { id: 'parmesan-cheese', name: 'Parmesan Cheese', price: 15000, category: 'cheese' },
  // Meat & Protein
  { id: 'pepperoni', name: 'Pepperoni', price: 25000, category: 'meat' },
  { id: 'double-pepperoni', name: 'Double Pepperoni', price: 35000, category: 'meat' },
  { id: 'grilled-chicken', name: 'Grilled Chicken', price: 25000, category: 'meat' },
  { id: 'smoked-bacon', name: 'Smoked Bacon', price: 25000, category: 'meat' },
  { id: 'italian-sausage', name: 'Italian Sausage', price: 30000, category: 'meat' },
  // Veggie
  { id: 'mushroom', name: 'Mushroom', price: 15000, category: 'veggie' },
  { id: 'black-olives', name: 'Black Olives', price: 12000, category: 'veggie' },
  { id: 'bell-pepper', name: 'Bell Pepper', price: 10000, category: 'veggie' },
  { id: 'sweet-corn', name: 'Sweet Corn', price: 10000, category: 'veggie' },
  { id: 'jalapeno', name: 'Jalapeño', price: 10000, category: 'veggie' },
  { id: 'caramelized-onion', name: 'Caramelized Onion', price: 12000, category: 'veggie' },
];

export const SPICE_LEVELS: { id: SpiceLevel; label: string; icon: string }[] = [
  { id: 'none', label: 'Không cay', icon: '🌱' },
  { id: 'mild', label: 'Ít cay', icon: '🌶️' },
  { id: 'medium', label: 'Vừa', icon: '🌶️🌶️' },
  { id: 'hot', label: 'Rất cay', icon: '🔥' },
];

export const BAKING_PREFERENCES: { id: BakingPreference; label: string; desc: string }[] = [
  { id: 'standard', label: 'Nướng tiêu chuẩn', desc: 'Vỏ vàng ruộm, ruột xốp' },
  { id: 'crispy', label: 'Nướng giòn hơn', desc: 'Vỏ nướng kỹ giòn tan' },
];

export const CUT_PREFERENCES: { id: CutPreference; label: string }[] = [
  { id: '6-slices', label: '6 miếng' },
  { id: '8-slices', label: '8 miếng' },
  { id: 'no-cut', label: 'Không cắt' },
];

/**
 * Calculates extra cost from crust, sauce, extra sauce, and selected toppings
 */
export function calculateCustomizationExtra(customization?: PizzaCustomizationState): number {
  if (!customization) return 0;
  let total = 0;

  // Crust price
  const crust = PIZZA_CRUSTS.find((c) => c.id === customization.crustId);
  if (crust) total += crust.price;

  // Sauce price
  const sauce = PIZZA_SAUCES.find((s) => s.id === customization.sauceId);
  if (sauce) total += sauce.price;

  // Extra sauce
  if (customization.hasExtraSauce) {
    total += EXTRA_SAUCE_PRICE;
  }

  // Toppings
  if (customization.toppings && customization.toppings.length > 0) {
    customization.toppings.forEach((item) => {
      const topping = PIZZA_TOPPINGS.find((t) => t.id === item.id);
      if (topping) {
        total += topping.price * item.quantity;
      }
    });
  }

  return total;
}

/**
 * Formats user-readable summary tags for order/cart display
 */
export function formatCustomizationSummary(customization?: PizzaCustomizationState): string[] {
  if (!customization) return [];
  const tags: string[] = [];

  const crust = PIZZA_CRUSTS.find((c) => c.id === customization.crustId);
  if (crust && crust.id !== 'classic-hand-tossed') {
    tags.push(crust.name);
  }

  const sauce = PIZZA_SAUCES.find((s) => s.id === customization.sauceId);
  if (sauce && sauce.id !== 'classic-tomato') {
    tags.push(sauce.name);
  }
  if (customization.hasExtraSauce) {
    tags.push('Thêm sốt');
  }

  if (customization.toppings && customization.toppings.length > 0) {
    const toppingNames = customization.toppings
      .map((t) => {
        const item = PIZZA_TOPPINGS.find((tp) => tp.id === t.id);
        if (!item) return '';
        return t.quantity > 1 ? `${item.name} (x${t.quantity})` : item.name;
      })
      .filter(Boolean);
    if (toppingNames.length > 0) {
      tags.push(`+ ${toppingNames.join(', ')}`);
    }
  }

  if (customization.removedIngredients && customization.removedIngredients.length > 0) {
    tags.push(`Bỏ: ${customization.removedIngredients.join(', ')}`);
  }

  if (customization.spiceLevel && customization.spiceLevel !== 'none') {
    const sp = SPICE_LEVELS.find((s) => s.id === customization.spiceLevel);
    if (sp) tags.push(sp.label);
  }

  if (customization.bakingPreference === 'crispy') {
    tags.push('Nướng giòn');
  }

  if (customization.cutPreference && customization.cutPreference !== '6-slices') {
    const cut = CUT_PREFERENCES.find((c) => c.id === customization.cutPreference);
    if (cut) tags.push(cut.label);
  }

  return tags;
}
