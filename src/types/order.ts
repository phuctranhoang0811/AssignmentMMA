import { PizzaCustomizationState } from './pizzaCustomization';

export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID_DEMO'
  | 'FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED_DEMO';

export type FulfillmentType = 'DELIVERY' | 'PICKUP';
export type PaymentMethod = 'COD' | 'MOCK_WALLET';

export type CartItem = {
  lineId: string;
  productId: string;
  variantId?: string;
  addonIds: string[];
  specialInstructions?: string;
  quantity: number;
  customization?: PizzaCustomizationState;
};

export type CheckoutDraft = {
  fullname: string;
  phone: string;
  email?: string;
  fulfillmentType: FulfillmentType;
  address?: string;
  deliveryNote?: string;
  promoCode?: string;
  paymentMethod: PaymentMethod;
};

export type OrderItemSnapshot = {
  productId: string;
  productName: string;
  variantName?: string;
  addonNames: string[];
  note?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: string;
  customization?: PizzaCustomizationState;
  customizationSummary?: string[];
};

export type Order = {
  id: string;
  createdAt: string;
  userId?: string;
  customer: {
    fullname: string;
    phone: string;
    email?: string;
  };
  fulfillmentType: FulfillmentType;
  address?: string;
  items: OrderItemSnapshot[];
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  statusHistory: {
    status: OrderStatus;
    at: string;
    note?: string;
  }[];
};

export type OrderPricing = {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
};
