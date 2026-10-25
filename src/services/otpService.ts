import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Lấy URL gốc của server Metro để gọi API /api/send-otp
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  // Trên thiết bị thật (Expo Go), hostUri chứa IP của máy tính (vd: 192.168.1.174:8081)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8081`;
  }

  // Fallback mặc định theo IP mạng Wi-Fi hiện tại của máy
  return 'http://192.168.1.174:8081';
}

/**
 * Tạo mã OTP ngẫu nhiên 4 chữ số (từ 1000 đến 9999)
 */
export function generateOtpCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Gửi mã OTP đến Gmail người dùng qua endpoint Metro /api/send-otp
 */
export async function sendOtpToEmail(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 giây timeout

    const res = await fetch(`${baseUrl}/api/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Không thể gửi email OTP.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[OTP Service] Lỗi kết nối khi gửi OTP:', err.message);
    return {
      success: false,
      error:
        err.name === 'AbortError'
          ? 'Quá thời gian kết nối (Timeout). Vui lòng thử lại.'
          : err.message || 'Không thể kết nối đến máy chủ gửi mail.',
    };
  }
}
