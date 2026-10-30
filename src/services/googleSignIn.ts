import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { isGmailAddress } from '../utils/googleAccount';
import type { GoogleLoginOptions } from '../types/googleLogin';

export async function signInWithGoogle(options?: GoogleLoginOptions) {
  if (options?.signal?.aborted) return null;
  if (isRunningInExpoGo()) {
    // Loaded only inside Expo Go; require() keeps it lazy on Metro and works under Jest (which cannot run import()).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInViaGoogleBrowser } = require('./googleBridge') as typeof import('./googleBridge');
    return signInViaGoogleBrowser(options);
  }
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Chưa cấu hình Web OAuth Client ID cho Google Login.');
  }
  if (Platform.OS === 'ios' && !iosClientId) throw new Error('Chưa cấu hình iOS OAuth Client ID cho Google Login.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin, isSuccessResponse } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, iosClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  await GoogleSignin.signOut();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response) || options?.signal?.aborted) return null;
  if (!isGmailAddress(response.data.user.email)) {
    await GoogleSignin.signOut();
    throw new Error('Vui lòng chọn tài khoản @gmail.com.');
  }
  if (!response.data.idToken) throw new Error('Google chưa trả về ID token. Vui lòng kiểm tra Web OAuth Client ID.');
  return signInWithCredential(auth, GoogleAuthProvider.credential(response.data.idToken));
}
