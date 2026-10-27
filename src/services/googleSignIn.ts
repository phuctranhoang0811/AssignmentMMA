import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { isGmailAddress } from '../utils/googleAccount';
import type { GoogleLoginOptions } from '../types/googleLogin';

export async function signInWithGoogle(options?: GoogleLoginOptions) {
  if (options?.signal?.aborted) return null;
  if (isRunningInExpoGo()) {
    const { signInViaGoogleBrowser } = await import('./googleBridge');
    return signInViaGoogleBrowser(options);
  }
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!webClientId || !webClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Chưa cấu hình Web OAuth Client ID cho Google Login.');
  }
  if (Platform.OS === 'ios' && !iosClientId) throw new Error('Chưa cấu hình iOS OAuth Client ID cho Google Login.');
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
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
