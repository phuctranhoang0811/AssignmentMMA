import * as Crypto from 'expo-crypto';
import { AppState, Linking } from 'react-native';
import { Alert } from '../utils/alert';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';
import type { GoogleLoginOptions } from '../types/googleLogin';
import { isGmailAddress } from '../utils/googleAccount';

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Đã hủy đăng nhập Google.');
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    cancelled(signal);
    const abort = () => { clearTimeout(timer); reject(new Error('Đã hủy đăng nhập Google.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function confirmAccount(email: string, pairingCode: string, signal?: AbortSignal) {
  return new Promise<boolean>(resolve => {
    if (signal?.aborted) { resolve(false); return; }
    let done = false;
    const finish = (accepted: boolean) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', abort);
      resolve(accepted);
    };
    const abort = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });
    Alert.alert('Xác nhận tài khoản Google', `Đăng nhập bằng ${email}?\nMã đối chiếu: ${pairingCode}. Chỉ tiếp tục nếu đây là tài khoản bạn vừa chọn.`, [
      { text: 'Hủy', style: 'cancel', onPress: () => finish(false) },
      { text: 'Đăng nhập', onPress: () => finish(true) },
    ], { cancelable: true, onDismiss: () => finish(false) });
  });
}

export async function signInViaGoogleBrowser(options: GoogleLoginOptions = {}) {
  const value = process.env.EXPO_PUBLIC_GOOGLE_BRIDGE_URL?.trim().replace(/\/$/, '');
  let origin: string;
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.origin !== value) throw new Error('Invalid URL');
    origin = url.origin;
  } catch { throw new Error('Để đăng nhập Google trong Expo Go, cần cấu hình EXPO_PUBLIC_GOOGLE_BRIDGE_URL là URL HTTPS của backend.'); }
  const { signal } = options;
  cancelled(signal);
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verifier = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  let sessionId: string | undefined;
  async function send<T>(path: string, body: object, requestSignal = signal): Promise<T> {
    cancelled(requestSignal);
    const controller = new AbortController();
    const abort = () => controller.abort();
    requestSignal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try {
      const response = await fetch(`${origin}/auth/bridge/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chưa thể xử lý yêu cầu đăng nhập Google.');
      return data as T;
    } catch (error) {
      if (requestSignal?.aborted) throw new Error('Đã hủy đăng nhập Google.');
      if (controller.signal.aborted || error instanceof TypeError) throw new Error('Không kết nối được máy chủ đăng nhập. Vui lòng kiểm tra URL HTTPS và thử lại.');
      throw error;
    } finally { clearTimeout(timer); requestSignal?.removeEventListener('abort', abort); }
  }
  try {
    const session = await send<{ sessionId: string; pairingCode: string; browserUrl: string; expiresAt: number; projectId: string }>('start', { challenge });
    const browserUrl = new URL(session.browserUrl);
    if (!/^[a-f0-9]{64}$/.test(session.sessionId) || !/^\d{6}$/.test(session.pairingCode) ||
      browserUrl.origin !== origin || browserUrl.pathname !== '/auth/google' ||
      browserUrl.searchParams.get('session') !== session.sessionId || !/^#[a-f0-9]{64}$/.test(browserUrl.hash) ||
      session.projectId !== auth.app.options.projectId || !Number.isFinite(session.expiresAt)) {
      throw new Error('Cấu hình máy chủ đăng nhập không khớp Firebase của ứng dụng.');
    }
    sessionId = session.sessionId;
    const deadline = Math.min(session.expiresAt, Date.now() + 5 * 60_000);
    options.onBrowserSession?.(session);
    cancelled(signal);
    await Linking.openURL(session.browserUrl);
    while (Date.now() < deadline) {
      await wait(2000, signal);
      if (AppState.currentState !== 'active') continue;
      const status = await send<{ state: string; email?: string; pairingCode: string }>('status', { sessionId, verifier });
      if (status.state !== 'approved') continue;
      if (!isGmailAddress(status.email ?? null) || status.pairingCode !== session.pairingCode) throw new Error('Tài khoản hoặc mã xác nhận không hợp lệ.');
      if (!await confirmAccount(status.email!, status.pairingCode, signal)) return null;
      const result = await send<{ customToken: string }>('claim', { sessionId, verifier });
      cancelled(signal);
      if (!result.customToken || typeof result.customToken !== 'string') throw new Error('Không nhận được phiên đăng nhập Firebase.');
      return await signInWithCustomToken(auth, result.customToken);
    }
    throw new Error('Yêu cầu đăng nhập đã hết hạn. Vui lòng thử lại.');
  } catch (error) {
    if (signal?.aborted) return null;
    throw error;
  } finally {
    options.onBrowserSession?.(null);
    if (sessionId) {
      // A completed claim stays consumed; cancellation cannot make it reusable.
      const cleanup = new AbortController();
      void send('cancel', { sessionId, verifier }, cleanup.signal).catch(() => {});
    }
  }
}
