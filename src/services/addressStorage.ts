import AsyncStorage from '@react-native-async-storage/async-storage';

// Sử dụng key v4 hoàn toàn mới để reset sạch mọi dữ liệu cũ trên máy
const ADDRESS_STORAGE_KEY = '@pizza_delivery_address_v4';
const HAS_CHOSEN_ADDRESS_KEY = '@pizza_has_chosen_address_v4';

// Tự động dọn sạch tất cả các key cũ trước đây trên thiết bị
AsyncStorage.multiRemove([
  '@pizza_delivery_address_v1',
  '@pizza_has_chosen_address_v1',
  '@pizza_delivery_address_v2',
  '@pizza_has_chosen_address_v2',
  '@pizza_delivery_address',
  '@pizza_has_chosen_address',
  '@pizza_delivery_address_fresh',
  '@pizza_has_chosen_address_fresh',
  '@pizza_delivery_address_v3',
  '@pizza_has_chosen_address_v3',
]).catch(() => {});

/**
 * Xóa sạch hoàn toàn dữ liệu địa chỉ trong Local Storage
 */
export async function clearDeliveryAddress(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      ADDRESS_STORAGE_KEY,
      HAS_CHOSEN_ADDRESS_KEY,
      '@pizza_delivery_address_v1',
      '@pizza_has_chosen_address_v1',
      '@pizza_delivery_address_v2',
      '@pizza_has_chosen_address_v2',
      '@pizza_delivery_address_fresh',
      '@pizza_has_chosen_address_fresh',
    ]);
  } catch {
    // Bỏ qua lỗi
  }
}

/**
 * Lấy địa chỉ giao hàng đã lưu trong máy
 */
export async function getSavedDeliveryAddress(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ADDRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Lưu địa chỉ giao hàng vào bộ nhớ máy (Local Storage)
 */
export async function saveDeliveryAddress(address: string): Promise<void> {
  try {
    const trimmed = (address || '').trim();
    if (trimmed) {
      await AsyncStorage.setItem(ADDRESS_STORAGE_KEY, trimmed);
      await AsyncStorage.setItem(HAS_CHOSEN_ADDRESS_KEY, 'true');
    }
  } catch {
    // Bỏ qua lỗi
  }
}

/**
 * Kiểm tra xem người dùng/khách đã từng chọn địa chỉ chưa
 */
export async function checkHasChosenAddress(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(HAS_CHOSEN_ADDRESS_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}

export type SavedCustomerInfo = {
  fullname?: string;
  phone?: string;
  email?: string;
  deliveryNote?: string;
};

const CUSTOMER_INFO_KEY = '@pizza_checkout_customer_info_v2';

/**
 * Lấy thông tin người đặt hàng đã lưu trong máy
 */
export async function getSavedCustomerInfo(): Promise<SavedCustomerInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOMER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Lưu thông tin người đặt hàng vào máy để không bắt người dùng nhập lại
 */
export async function saveCustomerInfo(info: Partial<SavedCustomerInfo>): Promise<void> {
  try {
    const existing = (await getSavedCustomerInfo()) || {};
    const updated = { ...existing, ...info };
    await AsyncStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify(updated));
  } catch {
    // Bỏ qua lỗi
  }
}


