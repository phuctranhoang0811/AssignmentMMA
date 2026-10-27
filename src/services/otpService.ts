import { apiUrl } from './payosService';

type OtpResult = { success: true } | { success: false; error: string };

// The backend generates, e-mails and checks the code; the app never sees it.
async function post(path: string, body: object): Promise<OtpResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${apiUrl()}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (response.ok) return { success: true };
    const detail = await response.json().catch(() => null);
    return { success: false, error: detail?.error || 'Không thể xử lý mã OTP. Vui lòng thử lại.' };
  } catch (error) {
    return { success: false, error: error instanceof Error && error.name === 'AbortError'
      ? 'Quá thời gian kết nối. Vui lòng thử lại.'
      : error instanceof Error && error.message.startsWith('Máy chủ') ? error.message
      : 'Không thể kết nối đến máy chủ gửi mã.' };
  } finally { clearTimeout(timeout); }
}

export const sendOtpToEmail = (email: string) => post('/api/otp/send', { email: email.trim().toLowerCase() });
export const verifyOtp = (email: string, code: string) => post('/api/otp/verify', { email: email.trim().toLowerCase(), code });
