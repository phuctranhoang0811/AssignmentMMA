import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Lấy danh sách các URL tiềm năng có thể kết nối đến server Metro /api/send-otp
 */
export function getCandidateBaseUrls(): string[] {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return [window.location.origin];
  }

  const list: string[] = [];

  // Lấy các thuộc tính host có thể có từ Expo
  const rawSources: any[] = [
    Constants.expoConfig?.hostUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).experienceUrl,
    (Constants as any).linkingUri,
  ];

  for (const src of rawSources) {
    if (!src || typeof src !== 'string') continue;

    // Loại bỏ protocol (exp://, exps://, http://, https://) và path đằng sau
    const cleaned = src
      .replace(/^(exp|exps|http|https):\/\//i, '')
      .split('/')[0]
      .trim();

    if (!cleaned) continue;

    if (cleaned.includes('exp.direct')) {
      // ĐÂY LÀ TUNNEL EXPO (ngrok / Cloudflare Tunnel):
      // Tunnel của Expo chuyển tiếp cổng tiêu chuẩn 443 (HTTPS), KHÔNG dùng cổng :8081 bên ngoài!
      const hostOnly = cleaned.replace(/:\d+$/, '');
      list.push(`https://${hostOnly}`);
      list.push(`http://${hostOnly}`);
    } else {
      // ĐÂY LÀ MẠNG NỘI BỘ (LAN Wi-Fi) HOẶC EMULATOR:
      const hostAndPort = cleaned.includes(':') ? cleaned : `${cleaned}:8081`;
      list.push(`http://${hostAndPort}`);
    }
  }

  // Dự phòng theo IP máy tính hiện tại (Wi-Fi) và localhost
  list.push('http://192.168.1.174:8081');
  list.push('http://localhost:8081');
  list.push('http://10.0.2.2:8081');

  // Lọc trùng lặp nhưng giữ nguyên thứ tự ưu tiên
  return Array.from(new Set(list));
}

/**
 * Tạo mã OTP ngẫu nhiên 4 chữ số (từ 1000 đến 9999)
 */
export function generateOtpCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Gửi mã OTP đến Gmail người dùng qua endpoint Metro /api/send-otp
 * Tự động thử các URL kết nối phù hợp (Tunnel, LAN, Localhost)
 */
export async function sendOtpToEmail(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  const candidateUrls = getCandidateBaseUrls();
  const normalizedEmail = email.trim().toLowerCase();
  let lastError = 'Không thể kết nối đến máy chủ gửi email.';

  console.log('[OTP Service] Bắt đầu gửi OTP đến:', normalizedEmail);
  console.log('[OTP Service] Danh sách URL thử nghiệm:', candidateUrls);

  for (const baseUrl of candidateUrls) {
    try {
      console.log(`[OTP Service] Thử gửi qua: ${baseUrl}/api/send-otp`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout cho mỗi URL thử

      const res = await fetch(`${baseUrl}/api/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, otp }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`[OTP Service] Gửi thành công qua: ${baseUrl}`);
        return { success: true };
      }

      if (data && data.error) {
        lastError = data.error;
      }
    } catch (err: any) {
      console.warn(`[OTP Service] Thất bại khi gọi ${baseUrl}:`, err.message);
      lastError =
        err.name === 'AbortError'
          ? 'Quá thời gian kết nối'
          : err.message || 'Lỗi kết nối';
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
