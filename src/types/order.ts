import { PizzaCustomizationState } from './pizzaCustomization';
import type { Delivery } from './delivery';

export type StaffOrder = {
  id: string; orderCode: string; status: string; fulfillmentType: string; address: string;
  customer: { fullname: string; phone: string }; total: number; paymentName?: string; paymentStatus?: string;
  createdAt?: string | { seconds?: number; _seconds?: number };
  deliveryNote?: string; paymentMethod?: string;
  deliveryTime?: string; items: {
    productName: string; quantity: number; variantName?: string; addonNames?: string[];
    note?: string; lineTotal?: number; customizationSummary?: string | string[];
  }[];
  delivery?: Delivery;
  rider?: OrderRider | null;
};

/** What a rider may see: where to go and what to collect; customer details only once the order is theirs. */
export type RiderOrder = {
  id: string; orderCode: string; status: string; address: string; itemCount: number;
  createdAt?: StaffOrder['createdAt']; paymentStatus: 'PAID' | 'UNPAID'; codAmount: number; riderPay: number; mine: boolean;
  rider?: OrderRider; customer?: { fullname: string; phone: string }; deliveryNote?: string; deliveryTime?: string;
};

/** A rider's finished trips and what they earned (Vietnam-time day and week). */
export type RiderEarnings = {
  today: number; week: number; total: number; trips: number;
  /** Not yet squared up with the store: wages owed and cash collected that the rider still holds. */
  unsettled: { trips: number; earned: number; cash: number };
  recent: { id: string; orderCode: string; earned: number; distanceKm: number | null; failed: boolean; deliveredAt: string | null }[];
};

/** The rider who took a delivery order who took a delivery order (set by the backend). */
export type OrderRider = { uid: string; name: string; phone?: string; acceptedAt: string; pickedUpAt?: string };

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
  | 'PAID'
  | 'PAID_DEMO'
  | 'FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'REFUNDED_DEMO';

export type FulfillmentType = 'DELIVERY' | 'PICKUP';
export type PaymentMethod = 'COD' | 'PAYOS';

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
  customization?: PizzaCustomizationState | null;
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
  needCutlery?: boolean;
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
