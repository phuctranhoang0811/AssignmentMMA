import { CheckoutDraft, FulfillmentType, PaymentMethod } from '../types/order';

let currentDraft: CheckoutDraft = {
  fullname: 'Nguyễn Minh Anh',
  phone: '0900000001',
  email: 'demo@pizzatime.local',
  fulfillmentType: 'DELIVERY',
  address: 'Số 45 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  deliveryNote: 'Gọi điện trước khi giao',
  promoCode: '',
  paymentMethod: 'COD',
};

export const getCheckoutDraft = (): CheckoutDraft => ({ ...currentDraft });

export const updateCheckoutDraft = (partial: Partial<CheckoutDraft>): CheckoutDraft => {
  currentDraft = { ...currentDraft, ...partial };
  return { ...currentDraft };
};

export const resetCheckoutDraft = () => {
  currentDraft = {
    fullname: 'Nguyễn Minh Anh',
    phone: '0900000001',
    email: 'demo@pizzatime.local',
    fulfillmentType: 'DELIVERY',
    address: 'Số 45 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    deliveryNote: '',
    promoCode: '',
    paymentMethod: 'COD',
  };
};
