import type { DemoUser } from '../types/user';

export type GoogleIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  providerData: { providerId: string }[];
};

export function isGmailAddress(email: string | null): boolean {
  return !!email && /^[^\s@]+@gmail\.com$/i.test(email);
}

export function googleAccountProfile(identity: GoogleIdentity, stored?: Partial<DemoUser> & { fullName?: string }): DemoUser {
  if (!isGmailAddress(identity.email) || !identity.emailVerified ||
    !identity.providerData.some(provider => provider.providerId === 'google.com')) {
    throw new Error('Vui lòng chọn tài khoản @gmail.com đã được Google xác minh.');
  }
  return {
    id: identity.uid,
    email: identity.email!,
    fullname: stored?.fullName || stored?.fullname || identity.displayName || 'Khách hàng',
    phone: stored?.phone || '',
    avatar: stored?.avatar || identity.photoURL || undefined,
    gender: stored?.gender,
    birthday: stored?.birthday,
    role: stored?.role || 'USER',
    rewardPoints: stored ? stored.rewardPoints ?? 0 : 0,
    emailVerified: stored ? stored.emailVerified !== false : false,
    hasPassword: identity.providerData.some(provider => provider.providerId === 'password'),
    isDemo: false,
  };
}

export function googleLoginError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/operation-not-allowed') return 'Google Login chưa được bật trong Firebase Authentication.';
  if (code === 'auth/unauthorized-domain') return 'Tên miền này chưa được cho phép trong Firebase Authentication.';
  if (code === 'auth/popup-blocked') return 'Trình duyệt chặn cửa sổ đăng nhập. Vui lòng cho phép popup rồi thử lại.';
  if (code === 'auth/account-exists-with-different-credential') return 'Email này đã dùng phương thức đăng nhập khác. Vui lòng đăng nhập bằng phương thức cũ trước.';
  if (code === 'auth/network-request-failed') return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
  if (code === '10' || code === 'DEVELOPER_ERROR') return 'Cấu hình Google Login chưa khớp. Vui lòng kiểm tra Client ID, package name và SHA-1 của bản build.';
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') return 'Thiết bị cần Google Play Services để đăng nhập Google.';
  return error instanceof Error ? error.message : 'Đăng nhập Google chưa thành công. Vui lòng thử lại.';
}
