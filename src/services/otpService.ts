import Constants from 'expo-constants';
import { Platform } from 'react-native';

type OtpResult = { success: true } | { success: false; error: string };

const pendingOtpByEmail = new Map<string, { code: string; expiresAt: number }>();

/**
 * Lấy danh sách các URL tiềm năng có thể kết nối đến server gửi OTP (/api/send-otp)
 */
export function getCandidateBaseUrls(): string[] {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return [window.location.origin, 'http://localhost:3002'];
  }

  const list: string[] = [];

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

    const cleaned = src
      .replace(/^(exp|exps|http|https):\/\//i, '')
      .split('/')[0]
      .trim();

    if (!cleaned) continue;

    if (cleaned.includes('exp.direct')) {
      const hostOnly = cleaned.replace(/:\d+$/, '');
      list.push(`https://${hostOnly}`);
      list.push(`http://${hostOnly}`);
    } else {
      const hostOnly = cleaned.split(':')[0];
      const hostAndPort = cleaned.includes(':') ? cleaned : `${cleaned}:8081`;
      list.push(`http://${hostOnly}:3002`);
      list.push(`http://${hostAndPort}`);
    }
  }

  list.push('http://192.168.1.174:3002');
  list.push('http://192.168.1.174:8081');
  list.push('http://localhost:3002');
  list.push('http://localhost:8081');
  if (Platform.OS === 'android') {
    list.push('http://10.0.2.2:3002');
    list.push('http://10.0.2.2:8081');
  }

  return Array.from(new Set(list));
}

export function generateOtpCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function sendOtpToEmail(email: string, customOtp?: string): Promise<OtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = customOtp || generateOtpCode();
  const candidateUrls = getCandidateBaseUrls();
  let lastError = 'Không thể kết nối đến máy chủ gửi email. Hãy tắt và bật lại npx expo start.';

  for (const baseUrl of candidateUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
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

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        continue;
      }

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        pendingOtpByEmail.set(normalizedEmail, {
          code: otp,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
        return { success: true };
      }

      if (data?.error) {
        lastError = data.error;
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

export async function verifyOtp(email: string, code: string): Promise<OtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const pending = pendingOtpByEmail.get(normalizedEmail);

  if (pending) {
    if (Date.now() > pending.expiresAt) {
      pendingOtpByEmail.delete(normalizedEmail);
      return { success: false, error: 'Mã xác nhận đã hết hạn. Vui lòng gửi lại mã mới.' };
    }
    if (pending.code === code.trim()) {
      return { success: true };
    }
    return { success: false, error: 'Mã xác nhận không chính xác. Vui lòng kiểm tra lại.' };
  }

  return { success: false, error: 'Vui lòng bấm gửi lại mã OTP.' };
}
