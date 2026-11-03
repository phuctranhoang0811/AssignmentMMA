import type { DeliveryFeeConfig } from './deliveryFee';

export type StoreSettings = {
  /** Manual switch: false pauses ordering (kitchen overloaded, out of stock, closing early). */
  acceptingOrders: boolean;
  /** Opening and closing time, "HH:mm" in Vietnam time. A closing time before the opening time runs past midnight. */
  openTime: string;
  closeTime: string;
  closedMessage?: string;
  /** Shipping price list for store-delivered orders; absent = no shipping fee. */
  delivery?: DeliveryFeeConfig;
};

// Until an admin sets hours the store is open all day, so a fresh install never blocks orders by surprise.
export const defaultStoreSettings: StoreSettings = { acceptingOrders: true, openTime: '00:00', closeTime: '00:00', closedMessage: '' };

export type StoreStatus = { open: boolean; reason: 'PAUSED' | 'OUTSIDE_HOURS' | null; message: string };

const minutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

/** Minutes since midnight in Vietnam (UTC+7, no daylight saving), whatever time zone the device or server uses. */
const vietnamMinutes = (now: Date) => (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % 1440;

export function storeStatus(settings: StoreSettings, now: Date = new Date()): StoreStatus {
  if (!settings.acceptingOrders) {
    return { open: false, reason: 'PAUSED', message: settings.closedMessage?.trim() || 'Cửa hàng đang tạm ngưng nhận đơn. Vui lòng quay lại sau.' };
  }
  const open = minutes(settings.openTime);
  const close = minutes(settings.closeTime);
  const current = vietnamMinutes(now);
  // Equal times mean open all day.
  const inside = open === close || (open < close ? current >= open && current < close : current >= open || current < close);
  return inside ? { open: true, reason: null, message: '' }
    : { open: false, reason: 'OUTSIDE_HOURS', message: `Cửa hàng mở cửa từ ${settings.openTime} đến ${settings.closeTime}. Vui lòng đặt hàng trong giờ mở cửa.` };
}
