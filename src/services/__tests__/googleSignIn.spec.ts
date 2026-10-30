import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithGoogle } from '../googleSignIn';
import { signInViaGoogleBrowser } from '../googleBridge';

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn() }));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: jest.fn((token: string) => ({ token })) },
  signInWithCredential: jest.fn(),
}));
jest.mock('../firebase', () => ({ auth: { name: 'auth' } }));
jest.mock('../googleBridge', () => ({ signInViaGoogleBrowser: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(async () => true), signOut: jest.fn(async () => null), signIn: jest.fn() },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
}));

const WEB = '123-web.apps.googleusercontent.com';
const IOS = '123-ios.apps.googleusercontent.com';
const google = GoogleSignin as jest.Mocked<typeof GoogleSignin>;
const picked = (email: string, idToken: string | null = 'google-id-token') => ({ type: 'success', data: { idToken, user: { email } } });

beforeEach(() => {
  jest.clearAllMocks();
  (isRunningInExpoGo as jest.Mock).mockReturnValue(false);
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = WEB;
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = IOS;
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => jest.restoreAllMocks());

test('inside Expo Go the browser bridge is used, because the native SDK is not there', async () => {
  (isRunningInExpoGo as jest.Mock).mockReturnValue(true);
  (signInViaGoogleBrowser as jest.Mock).mockResolvedValue({ user: { uid: 'u1' } });
  expect(await signInWithGoogle()).toEqual({ user: { uid: 'u1' } });
  expect(google.signIn).not.toHaveBeenCalled();
});

test('picking a Gmail account signs in to Firebase with the Google ID token', async () => {
  google.signIn.mockResolvedValue(picked('lan@gmail.com') as never);
  (signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: 'u1' } });
  expect(await signInWithGoogle()).toEqual({ user: { uid: 'u1' } });
  expect(google.configure).toHaveBeenCalledWith({ webClientId: WEB, iosClientId: IOS });
  // Signing out first makes Google show the account chooser instead of silently reusing the last account.
  expect(google.signOut.mock.invocationCallOrder[0]).toBeLessThan(google.signIn.mock.invocationCallOrder[0]);
  expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('google-id-token');
  expect(signInWithCredential).toHaveBeenCalledWith({ name: 'auth' }, { token: 'google-id-token' });
});

test('closing the account chooser is not an error and signs nobody in', async () => {
  google.signIn.mockResolvedValue({ type: 'cancelled', data: null } as never);
  expect(await signInWithGoogle()).toBeNull();
  expect(signInWithCredential).not.toHaveBeenCalled();
});

test('a cancelled request does nothing at all', async () => {
  const controller = new AbortController();
  controller.abort();
  expect(await signInWithGoogle({ signal: controller.signal })).toBeNull();
  expect(google.configure).not.toHaveBeenCalled();
});

test('an account that is not @gmail.com is refused and signed out of Google again', async () => {
  google.signIn.mockResolvedValue(picked('lan@company.vn') as never);
  await expect(signInWithGoogle()).rejects.toThrow('@gmail.com');
  expect(google.signOut).toHaveBeenCalledTimes(2);
  expect(signInWithCredential).not.toHaveBeenCalled();
});

test('Google returning no ID token explains that the Web client ID is the likely cause', async () => {
  google.signIn.mockResolvedValue(picked('lan@gmail.com', null) as never);
  await expect(signInWithGoogle()).rejects.toThrow('Web OAuth Client ID');
});

test('a missing or malformed Web client ID is reported before any Google screen opens', async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  await expect(signInWithGoogle()).rejects.toThrow('Web OAuth Client ID');
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'not-a-client-id';
  await expect(signInWithGoogle()).rejects.toThrow('Web OAuth Client ID');
  expect(google.signIn).not.toHaveBeenCalled();
});

test('iOS needs the iOS client ID; Android does not', async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  jest.replaceProperty(Platform, 'OS', 'ios');
  await expect(signInWithGoogle()).rejects.toThrow('iOS OAuth Client ID');
  jest.replaceProperty(Platform, 'OS', 'android');
  google.signIn.mockResolvedValue(picked('lan@gmail.com') as never);
  (signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: 'u1' } });
  await expect(signInWithGoogle()).resolves.toBeTruthy();
});
