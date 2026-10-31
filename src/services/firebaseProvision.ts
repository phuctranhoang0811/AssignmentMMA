import { initializeApp, getApps } from 'firebase/app';
// @ts-ignore - subpath cho react-native persistence trong Firebase v10/v11
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { app } from './firebase';

// Instance Auth THỨ HAI dành riêng cho admin khi cấp tài khoản nhân viên.
// Tạo tài khoản bằng auth chính sẽ làm đăng nhập hiện tại của admin bị thay
// bằng tài khoản vừa tạo, nên phải dùng app phụ rồi signOut ngay sau đó.
const PROVISION_APP_NAME = 'staff-provisioning';

let provisionAuth: ReturnType<typeof getAuth> | null = null;

export function getProvisioningAuth() {
  if (provisionAuth) return provisionAuth;

  const secondary =
    getApps().find((a) => a.name === PROVISION_APP_NAME) ??
    initializeApp(app.options, PROVISION_APP_NAME);

  try {
    provisionAuth =
      Platform.OS === 'web'
        ? getAuth(secondary)
        : initializeAuth(secondary, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
  } catch {
    provisionAuth = getAuth(secondary);
  }
  return provisionAuth;
}
