import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoUser } from '../types/user';
import { authService } from '../services';
import { demoUser } from '../data/mockUsers';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithCustomToken, signInWithEmailAndPassword, signOut, updatePassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, runTransaction } from 'firebase/firestore';
import { clearCustomerInfo } from '../services/addressStorage';
import { phoneLoginToken } from '../services/orderApi';
import { isValidEmail } from '../utils/validators';
import { signInWithGoogle } from '../services/googleSignIn';
import { googleAccountProfile, googleLoginError } from '../utils/googleAccount';
import type { GoogleLoginOptions } from '../types/googleLogin';

interface AuthContextType {
  user: DemoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginDemo: (email?: string, password?: string) => Promise<void>;
  loginGoogle: (options?: GoogleLoginOptions) => Promise<boolean>;
  registerDemo: (
    name: string,
    email: string,
    phone: string,
    password?: string,
    extra?: { gender?: string; birthday?: string }
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, phone: string, birthday?: string, gender?: string, email?: string) => Promise<void>;
}

const AUTH_STORAGE_KEY = '@pizza_time_auth_v1';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const accountId = user?.isDemo ? undefined : user?.id;
  useEffect(() => {
    if (!accountId) return;
    return onSnapshot(doc(db, 'users', accountId), snapshot => {
      if (!snapshot.exists()) return;
      const points = snapshot.data().rewardPoints ?? 0;
      setUser(previous => previous?.id === accountId ? { ...previous, rewardPoints: points } : previous);
    }, error => console.warn('Không thể đồng bộ điểm thưởng:', error.code));
  }, [accountId]);

  useEffect(() => {
    (async () => {
      try {
        await auth.authStateReady();
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.isLoggedOut || (!parsed.isDemo && parsed.id !== auth.currentUser?.uid))) {
            await signOut(auth);
            setUser(null);
          } else {
            if (parsed?.isDemo) await signOut(auth);
            setUser(parsed);
          }
        } else {
          // Start as demoUser or null if guest
          setUser(demoUser);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const loginDemo = async (identifier: string = 'demo@pizzatime.local', password?: string) => {
    setIsLoading(true);
    try {
      const trimmed = identifier.trim();
      const targetEmail = trimmed.toLowerCase();

      if (password) {
        // Firebase Auth must establish the session used by the payment backend.
        try {
          // Phone numbers are resolved by the backend, so the app never reads other users' profiles.
          const res = trimmed.includes('@')
            ? await signInWithEmailAndPassword(auth, targetEmail, password)
            : await signInWithCustomToken(auth, await phoneLoginToken(trimmed, password));
          const userDoc = await getDoc(doc(db, 'users', res.user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const u: DemoUser = {
              id: res.user.uid,
              fullname: data.fullName || 'Khách hàng',
              email: data.email || targetEmail,
              phone: data.phone || (trimmed.includes('@') ? '' : trimmed),
              gender: data.gender,
              birthday: data.birthday,
              role: data.role || 'USER',
              rewardPoints: data.rewardPoints || 0,
              hasPassword: res.user.providerData.some(provider => provider.providerId === 'password'),
              isDemo: false,
            };
            setUser(u);
            await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
            return;
          }
          throw new Error('Không tìm thấy hồ sơ tài khoản. Vui lòng liên hệ hỗ trợ.');
        } catch (e: any) {
          await signOut(auth).catch(() => {});
          setUser(null);
          if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            throw new Error('Mật khẩu không chính xác.');
          } else if (e.code === 'auth/user-not-found') {
            throw new Error('Tài khoản không tồn tại.');
          }
          throw new Error(e.message || 'Đăng nhập không thành công.');
        }
      }

      await signOut(auth);
      const u = await authService.login(targetEmail);
      setUser(u);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
  };

  const loginGoogle = async (options?: GoogleLoginOptions) => {
    setIsLoading(true);
    let signedIn = false;
    try {
      const result = await signInWithGoogle(options);
      if (!result) return false;
      signedIn = true;
      if (options?.signal?.aborted) throw new Error('Đã hủy đăng nhập Google.');
      const identity = result.user;
      googleAccountProfile(identity);
      const profile = await runTransaction(db, async transaction => {
        const ref = doc(db, 'users', identity.uid);
        const existing = await transaction.get(ref);
        const profile = googleAccountProfile(identity, existing.exists() ? existing.data() : undefined);
        if (!existing.exists()) transaction.set(ref, {
          uid: profile.id, email: profile.email, fullName: profile.fullname,
          phone: profile.phone, role: 'USER', rewardPoints: profile.rewardPoints,
          ...(profile.avatar ? { avatar: profile.avatar } : {}), createdAt: serverTimestamp(),
        });
        return profile;
      });
      if (auth.currentUser?.uid !== identity.uid) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
      if (options?.signal?.aborted) throw new Error('Đã hủy đăng nhập Google.');
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
      setUser(profile);
      return true;
    } catch (error) {
      if (signedIn) {
        await signOut(auth).catch(() => {});
        setUser(null);
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isLoggedOut: true }));
      }
      throw new Error(googleLoginError(error));
    } finally { setIsLoading(false); }
  };

  const registerDemo = async (
    name: string,
    email: string,
    phone: string,
    password: string = 'Password123!',
    extra?: { gender?: string; birthday?: string }
  ) => {
    setIsLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      let uid = `USR-${Date.now().toString().slice(-4)}`;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            const loginRes = await signInWithEmailAndPassword(auth, trimmedEmail, password);
            uid = loginRes.user.uid;
          } catch {
            throw new Error('Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
          }
        } else {
          throw new Error(authErr.message || 'Không thể tạo tài khoản trên Firebase.');
        }
      }

      // Create the profile only once: an existing account (email already registered) keeps its points and role.
      const userRef = doc(db, 'users', uid);
      const stored = await runTransaction(db, async transaction => {
        const existing = await transaction.get(userRef);
        if (existing.exists()) return existing.data();
        transaction.set(userRef, {
          uid,
          email: trimmedEmail,
          fullName: name.trim(),
          phone: phone.trim(),
          gender: extra?.gender || 'Nam',
          birthday: extra?.birthday || '01/01/2000',
          role: 'USER',
          rewardPoints: 100,
          createdAt: serverTimestamp(),
        });
        return null;
      });

      const newUser: DemoUser = {
        id: uid,
        fullname: stored?.fullName ?? name.trim(),
        email: trimmedEmail,
        phone: stored?.phone ?? phone.trim(),
        gender: stored?.gender ?? (extra?.gender || 'Nam'),
        birthday: stored?.birthday ?? (extra?.birthday || '01/01/2000'),
        role: stored?.role ?? 'USER',
        rewardPoints: stored?.rewardPoints ?? 100,
        isDemo: false,
        hasPassword: true,
      };

      setUser(newUser);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');
    try {
      auth.languageCode = 'vi';
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // Keep the same confirmation for registered and unknown email addresses.
      if (code === 'auth/user-not-found') return;
      if (code === 'auth/too-many-requests') throw new Error('Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.');
      if (code === 'auth/network-request-failed') throw new Error('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
      throw new Error('Chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.');
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    await auth.authStateReady();
    const currentUser = auth.currentUser;
    if (user?.hasPassword === false) throw new Error('Tài khoản này đăng nhập bằng Google. Vui lòng quản lý mật khẩu trong tài khoản Google của bạn.');
    if (!user || user.isDemo || !currentUser?.email || currentUser.uid !== user.id) {
      throw new Error('Vui lòng đăng nhập tài khoản thật để đổi mật khẩu.');
    }
    setIsLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') throw new Error('Mật khẩu hiện tại không chính xác.');
      if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') throw new Error('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');
      if (code === 'auth/network-request-failed') throw new Error('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
      throw new Error('Chưa thể đổi mật khẩu. Vui lòng đăng nhập lại và thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}
    setUser(null);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isLoggedOut: true }));
    await clearCustomerInfo();
  };

  const updateProfile = async (name: string, phone: string, birthday?: string, gender?: string, email?: string) => {
    if (!user) return;
    const updated: DemoUser = {
      ...user,
      fullname: name,
      phone,
      birthday: birthday !== undefined ? birthday : user.birthday,
      gender: gender !== undefined ? gender : user.gender,
      email: email !== undefined ? email : user.email,
    };

    // Cập nhật lên Firestore nếu user có id hợp lệ
    try {
      if (user.id && !user.isDemo) {
        await setDoc(
          doc(db, 'users', user.id),
          {
            fullName: name,
            phone,
            ...(birthday !== undefined ? { birthday } : {}),
            ...(gender !== undefined ? { gender } : {}),
            ...(email !== undefined ? { email } : {}),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ cập nhật lên Firestore:', err);
    }

    setUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !(user as any).isLoggedOut,
        isLoading,
        loginDemo,
        loginGoogle,
        registerDemo,
        resetPassword,
        changePassword,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => useContext(AuthContext);
