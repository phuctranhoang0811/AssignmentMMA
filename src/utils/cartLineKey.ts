import { PizzaCustomizationState } from '../types/pizzaCustomization';

export function generateCartLineKey(
  productId: string,
  variantId?: string,
  addonIds: string[] = [],
  specialInstructions?: string,
  customization?: PizzaCustomizationState
): string {
  const sortedAddons = [...addonIds].sort().join(',');
  const cleanNote = (specialInstructions || '').trim().toLowerCase();

  let customKey = '';
  if (customization) {
    const sortedToppings = (customization.toppings || [])
      .map((t) => `${t.id}:${t.quantity}`)
      .sort()
      .join(',');
    const sortedRemoved = [...(customization.removedIngredients || [])].sort().join(',');
    customKey = `__crust:${customization.crustId}__sauce:${customization.sauceId}:${customization.hasExtraSauce}__top:${sortedToppings}__rem:${sortedRemoved}__pref:${customization.spiceLevel}:${customization.bakingPreference}:${customization.cutPreference}`;
  }

  return `${productId}__${variantId || 'base'}__${sortedAddons}__${cleanNote}${customKey}`;
}
