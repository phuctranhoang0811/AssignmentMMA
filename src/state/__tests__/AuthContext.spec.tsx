import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as firebaseAuth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { AuthProvider, useAuth } from '../AuthContext';
import { auth } from '../../services/firebase';
import { phoneLoginToken, verifyAccountEmail } from '../../services/orderApi';
import { clearCustomerInfo, clearDeliveryAddress } from '../../services/addressStorage';

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(), deleteUser: jest.fn(), signInWithCustomToken: jest.fn(), signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(async () => {}), updatePassword: jest.fn(), sendPasswordResetEmail: jest.fn(),
  EmailAuthProvider: { credential: jest.fn(() => 'credential') }, reauthenticateWithCredential: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })), getDoc: jest.fn(), serverTimestamp: jest.fn(() => 'TS'),
  onSnapshot: jest.fn(() => () => {}), runTransaction: jest.fn(),
}));
jest.mock('../../services', () => ({ authService: { login: jest.fn() } }));
jest.mock('../../services/orderApi', () => ({ phoneLoginToken: jest.fn(), verifyAccountEmail: jest.fn() }));
jest.mock('../../services/addressStorage', () => ({ clearCustomerInfo: jest.fn(async () => {}), clearDeliveryAddress: jest.fn(async () => {}) }));
jest.mock('../../services/googleSignIn', () => ({ signInWithGoogle: jest.fn() }));

const fa = firebaseAuth as jest.Mocked<typeof firebaseAuth>;
const fs = firestore as jest.Mocked<typeof firestore>;
const mockAuth = auth as unknown as { currentUser: unknown; languageCode?: string };
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const profileDoc = (data: Record<string, unknown> | null) => ({ exists: () => !!data, data: () => data });

async function storageKey() {
  const keys = await AsyncStorage.getAllKeys();
  return keys.find(key => key.includes('auth'));
}

// A rejected call inside act() leaves React's act scope broken for later tests, so capture the error instead.
async function failure(call: () => Promise<unknown>) {
  let error: unknown;
  await act(async () => { try { await call(); } catch (caught) { error = caught; } });
  return (error as Error | undefined)?.message;
}

async function setup() {
  const view = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockAuth.currentUser = null;
});

test('a first launch starts as a guest', async () => {
  const { result } = await setup();
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(false);
});

test('signing in with email loads the profile and keeps the session', async () => {
  fa.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1', providerData: [{ providerId: 'password' }] } } as never);
  fs.getDoc.mockResolvedValue(profileDoc({ fullName: 'Lan Nguyen', email: 'lan@gmail.com', phone: '0912345678', role: 'EMPLOYEE', rewardPoints: 40 }) as never);
  const { result } = await setup();
  await act(async () => { await result.current.loginDemo('Lan@Gmail.com', 'secret1'); });
  expect(fa.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'lan@gmail.com', 'secret1');
  expect(result.current.user).toMatchObject({ id: 'u1', fullname: 'Lan Nguyen', role: 'EMPLOYEE', rewardPoints: 40, hasPassword: true, isDemo: false });
  const key = await storageKey();
  expect(JSON.parse((await AsyncStorage.getItem(key!))!).id).toBe('u1');
});

test('a saved real account is restored only while Firebase still has the same session', async () => {
  fa.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1', providerData: [] } } as never);
  fs.getDoc.mockResolvedValue(profileDoc({ fullName: 'Lan' }) as never);
  const first = await setup();
  await act(async () => { await first.result.current.loginDemo('lan@gmail.com', 'secret1'); });
  await first.unmount();

  mockAuth.currentUser = { uid: 'u1' };
  const same = await setup();
  expect(same.result.current.user?.id).toBe('u1');
  await same.unmount();

  mockAuth.currentUser = { uid: 'someone-else' };
  const other = await setup();
  expect(other.result.current.user).toBeNull();
  expect(fa.signOut).toHaveBeenCalled();
});

test('signing in with a phone number goes through the backend token', async () => {
  (phoneLoginToken as jest.Mock).mockResolvedValue('custom-token');
  fa.signInWithCustomToken.mockResolvedValue({ user: { uid: 'u2', providerData: [] } } as never);
  fs.getDoc.mockResolvedValue(profileDoc({ fullName: 'An', phone: '0987654321' }) as never);
  const { result } = await setup();
  await act(async () => { await result.current.loginDemo('0987654321', 'secret1'); });
  expect(phoneLoginToken).toHaveBeenCalledWith('0987654321', 'secret1');
  expect(fa.signInWithCustomToken).toHaveBeenCalledWith(auth, 'custom-token');
  expect(result.current.user?.id).toBe('u2');
});

test('wrong credentials and unknown accounts get Vietnamese messages and no session', async () => {
  const { result } = await setup();
  fa.signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
  expect(await failure(() => result.current.loginDemo('a@b.vn', 'secret1'))).toContain('Mật khẩu không chính xác.');
  fa.signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/user-not-found' });
  expect(await failure(() => result.current.loginDemo('a@b.vn', 'secret1'))).toContain('Tài khoản không tồn tại.');
  expect(result.current.user).toBeNull();
});

test('a login without a stored profile is refused and signed out', async () => {
  fa.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1', providerData: [] } } as never);
  fs.getDoc.mockResolvedValue(profileDoc(null) as never);
  const { result } = await setup();
  expect(await failure(() => result.current.loginDemo('a@b.vn', 'secret1'))).toContain('Không tìm thấy hồ sơ');
  expect(fa.signOut).toHaveBeenCalled();
  expect(result.current.user).toBeNull();
});

test('logging out ends the session and wipes saved contact details and address', async () => {
  fa.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1', providerData: [] } } as never);
  fs.getDoc.mockResolvedValue(profileDoc({ fullName: 'Lan' }) as never);
  const { result } = await setup();
  await act(async () => { await result.current.loginDemo('a@b.vn', 'secret1'); });
  await act(async () => { await result.current.logout(); });
  expect(result.current.user).toBeNull();
  expect(fa.signOut).toHaveBeenCalled();
  expect(clearCustomerInfo).toHaveBeenCalled();
  expect(clearDeliveryAddress).toHaveBeenCalled();
  const key = await storageKey();
  expect(JSON.parse((await AsyncStorage.getItem(key!))!)).toEqual({ isLoggedOut: true });
});

test('password reset: a bad email is refused, unknown emails look like known ones, known errors are explained', async () => {
  const { result } = await setup();
  await expect(result.current.resetPassword('nope')).rejects.toThrow('hợp lệ');
  fa.sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });
  await expect(result.current.resetPassword('ghost@gmail.com')).resolves.toBeUndefined();
  fa.sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
  await expect(result.current.resetPassword('a@gmail.com')).rejects.toThrow('quá nhiều lần');
  fa.sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  await expect(result.current.resetPassword('a@gmail.com')).rejects.toThrow('kết nối');
  fa.sendPasswordResetEmail.mockResolvedValueOnce(undefined);
  await result.current.resetPassword('  A@Gmail.com ');
  expect(fa.sendPasswordResetEmail).toHaveBeenLastCalledWith(auth, 'a@gmail.com');
});

function transaction(existing: Record<string, unknown> | null, phoneOwner?: string) {
  const set = jest.fn();
  const tx = {
    get: jest.fn(async (ref: { path: string }) => (ref.path.startsWith('phone_numbers')
      ? { exists: () => !!phoneOwner, data: () => ({ uid: phoneOwner }) } : profileDoc(existing))),
    set,
  };
  fs.runTransaction.mockImplementation((async (_db: unknown, callback: (tx: unknown) => unknown) => callback(tx)) as never);
  return { set };
}

test('registering creates the login and an unverified profile with no points, and signs the customer in', async () => {
  fa.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new1' } } as never);
  const { set } = transaction(null);
  const { result } = await setup();
  await act(async () => { await result.current.registerDemo('An Tran', ' An@Gmail.com ', '0912 345 678', 'Strong#Pass1', { gender: 'Nữ', birthday: '02/03/1999' }); });
  expect(fa.createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'an@gmail.com', 'Strong#Pass1');
  expect(set).toHaveBeenCalledWith({ path: 'users/new1' }, expect.objectContaining({ role: 'USER', rewardPoints: 0, welcomePending: true, emailVerified: false, phone: '0912345678', fullName: 'An Tran' }));
  expect(set).toHaveBeenCalledWith({ path: 'phone_numbers/0912345678' }, { uid: 'new1' });
  expect(result.current.user).toMatchObject({ id: 'new1', rewardPoints: 0, role: 'USER', emailVerified: false });
  expect(verifyAccountEmail).not.toHaveBeenCalled();
});

test('the OTP typed at sign-up is claimed by the new account so the backend marks the email verified', async () => {
  fa.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new1' } } as never);
  (verifyAccountEmail as jest.Mock).mockResolvedValueOnce({ verified: true });
  transaction(null);
  const { result } = await setup();
  await act(async () => { await result.current.registerDemo('An Tran', 'an@gmail.com', '0912345678', 'Strong#Pass1', { otpCode: '1234' }); });
  expect(verifyAccountEmail).toHaveBeenCalledWith('1234');
  expect(result.current.user).toMatchObject({ id: 'new1', emailVerified: true });
});

test('if the claim fails the account still exists but stays unverified, so ordering is blocked until it is retried', async () => {
  fa.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new1' } } as never);
  (verifyAccountEmail as jest.Mock).mockRejectedValueOnce(new Error('Mã OTP đã hết hạn.'));
  transaction(null);
  const { result } = await setup();
  await act(async () => { await result.current.registerDemo('An Tran', 'an@gmail.com', '0912345678', 'Strong#Pass1', { otpCode: '1234' }); });
  expect(result.current.user).toMatchObject({ id: 'new1', emailVerified: false });
});

test('a phone number already owned by someone else rolls the new login back', async () => {
  fa.createUserWithEmailAndPassword.mockImplementation(async () => { mockAuth.currentUser = { uid: 'new1' }; return { user: { uid: 'new1' } } as never; });
  transaction(null, 'another-user');
  const { result } = await setup();
  expect(await failure(() => result.current.registerDemo('An', 'an@gmail.com', '0912345678', 'Strong#Pass1'))).toBeTruthy();
  expect(fa.deleteUser).toHaveBeenCalled();
  expect(result.current.user).toBeNull();
});

test('an email that already exists with another password is refused with guidance', async () => {
  fa.createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });
  fa.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });
  const { result } = await setup();
  expect(await failure(() => result.current.registerDemo('An', 'an@gmail.com', '0912345678', 'Strong#Pass1'))).toContain('đã được sử dụng');
});

test('a malformed phone number never reaches Firebase', async () => {
  const { result } = await setup();
  expect(await failure(() => result.current.registerDemo('An', 'an@gmail.com', '12345', 'Strong#Pass1'))).toContain('10 chữ số');
  expect(fa.createUserWithEmailAndPassword).not.toHaveBeenCalled();
});

test('changing a password: guests are refused, a wrong current password is explained, a right one updates it', async () => {
  const { result } = await setup();
  await expect(result.current.changePassword('old', 'New#Pass1')).rejects.toThrow('đăng nhập tài khoản thật');

  fa.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1', providerData: [{ providerId: 'password' }] } } as never);
  fs.getDoc.mockResolvedValue(profileDoc({ fullName: 'Lan', email: 'lan@gmail.com' }) as never);
  await act(async () => { await result.current.loginDemo('lan@gmail.com', 'secret1'); });
  mockAuth.currentUser = { uid: 'u1', email: 'lan@gmail.com' };
  fa.reauthenticateWithCredential.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
  expect(await failure(() => result.current.changePassword('wrong', 'New#Pass1'))).toContain('Mật khẩu hiện tại không chính xác.');
  fa.reauthenticateWithCredential.mockResolvedValueOnce(undefined as never);
  await act(async () => { await result.current.changePassword('secret1', 'New#Pass1'); });
  expect(fa.updatePassword).toHaveBeenCalledWith({ uid: 'u1', email: 'lan@gmail.com' }, 'New#Pass1');
});
