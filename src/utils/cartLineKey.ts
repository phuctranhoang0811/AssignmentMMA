export function generateCartLineKey(
  productId: string,
  variantId?: string,
  addonIds: string[] = [],
  specialInstructions?: string
): string {
  const sortedAddons = [...addonIds].sort().join(',');
  const cleanNote = (specialInstructions || '').trim().toLowerCase();
  return `${productId}__${variantId || 'base'}__${sortedAddons}__${cleanNote}`;
}
