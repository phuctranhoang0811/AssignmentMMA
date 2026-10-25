import AsyncStorage from '@react-native-async-storage/async-storage';

const ADDRESS_STORAGE_KEY = '@pizza_delivery_address_v1';
const HAS_CHOSEN_ADDRESS_KEY = '@pizza_has_chosen_address_v1';

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
