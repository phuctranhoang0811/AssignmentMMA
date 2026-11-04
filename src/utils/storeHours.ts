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

// Cửa hàng mở cửa từ 08:00 đến 22:00 hằng ngày (ngoài khung 22:00 - 08:00 cửa hàng đóng cửa).
export const defaultStoreSettings: StoreSettings = {
  acceptingOrders: true,
  openTime: '08:00',
  closeTime: '22:00',
  closedMessage: '',
};

export type StoreStatus = { open: boolean; reason: 'PAUSED' | 'OUTSIDE_HOURS' | null; message: string };

const minutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

/** Minutes since midnight in Vietnam (UTC+7, no daylight saving), whatever time zone the device or server uses. */
const vietnamMinutes = (now: Date) => (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % 1440;

export function storeStatus(settings: StoreSettings, now: Date = new Date()): StoreStatus {
  if (!settings.acceptingOrders) {
    return {
      open: false,
      reason: 'PAUSED',
      message:
        settings.closedMessage?.trim() ||
        'Cửa hàng đang tạm ngưng nhận đơn. Vui lòng quay lại sau.',
    };
  }
  const effOpenTime =
    !settings.openTime || (settings.openTime === '00:00' && settings.closeTime === '00:00')
      ? '08:00'
      : settings.openTime;
  const effCloseTime =
    !settings.closeTime || (settings.openTime === '00:00' && settings.closeTime === '00:00')
      ? '22:00'
      : settings.closeTime;

  const open = minutes(effOpenTime);
  const close = minutes(effCloseTime);
  const current = vietnamMinutes(now);
  const inside =
    open === close ||
    (open < close ? current >= open && current < close : current >= open || current < close);
  return inside
    ? { open: true, reason: null, message: '' }
    : {
        open: false,
        reason: 'OUTSIDE_HOURS',
        message: `Hiện tại cửa hàng đã đóng cửa (${effCloseTime} – ${effOpenTime}). Vui lòng đặt hàng trong khung giờ hoạt động từ ${effOpenTime} đến ${effCloseTime}.`,
      };
}
