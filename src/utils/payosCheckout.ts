import type { CreateOrderInput } from '../services/contracts';

export function payosCheckout(input: CreateOrderInput) {
  return {
    customer: { fullname: input.customer.fullname.trim(), phone: input.customer.phone.replace(/[\s.-]/g, ''),
      ...(input.customer.email?.trim() ? { email: input.customer.email.trim() } : {}) },
    fulfillmentType: input.fulfillmentType,
    ...(input.needCutlery ? { needCutlery: true } : {}),
    ...(input.fulfillmentType === 'DELIVERY' ? { address: input.address?.trim() } : {}),
    ...(input.deliveryNote !== undefined ? { deliveryNote: input.deliveryNote.trim() } : {}),
    ...(input.deliveryTime ? { deliveryTime: input.deliveryTime.trim() } : {}),
    ...(input.deliveryQuoteId ? { deliveryQuoteId: input.deliveryQuoteId } : {}),
    ...(input.fulfillmentType === 'DELIVERY' && input.deliveryLocation ? { deliveryLocation: input.deliveryLocation } : {}),
    ...(input.promoCode?.trim() ? { promoCode: input.promoCode.trim().toUpperCase() } : {}),
    items: input.items.map((item, index) => ({ ...item, lineId: `line-${index + 1}` })),
  };
}
