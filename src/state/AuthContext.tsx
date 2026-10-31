import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoUser } from '../types/user';
import { authService } from '../services';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, deleteUser, signInWithCustomToken, signInWithEmailAndPassword, signOut, updatePassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp, onSnapshot, runTransaction, collection, query, where, getDocs, type Transaction } from 'firebase/firestore';
import { clearCustomerInfo, clearDeliveryAddress } from '../services/addressStorage';
import { resetMemberDiscountPrompt } from '../utils/sessionFlags';
import { phoneLoginToken, verifyAccountEmail } from '../services/orderApi';
import { isValidEmail } from '../utils/validators';
import { normalizePhone } from '../utils/phone';
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
    extra?: { gender?: string; birthday?: string; otpCode?: string }
  ) => Promise<void>;
  resetPassword: (email: string, newPassword?: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, phone: string, birthday?: string, gender?: string, email?: string) => Promise<void>;
}

const AUTH_STORAGE_KEY = '@pizza_time_auth_v1';
const PHONE_TAKEN = 'Số điện thoại này đã được dùng cho tài khoản khác.';

/**
 * Claims phone_numbers/{phone} for uid inside a transaction (Firestore rules require it for a profile's phone).
 * Reading a number owned by someone else is denied by the rules, which is how a taken number shows up.
 */
async function claimPhone(transaction: Transaction, phone: string, uid: string) {
  const ref = doc(db, 'phone_numbers', phone);
  const owner = await transaction.get(ref).catch((error: { code?: string }) => {
    if (error?.code === 'permission-denied') throw new Error(PHONE_TAKEN);
    throw error;
  });
  if (owner.exists() && owner.data().uid !== uid) throw new Error(PHONE_TAKEN);
  return () => { if (!owner.exists()) transaction.set(ref, { uid }); };
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const accountId = user?.isDemo ? undefined : user?.id;
  useEffect(() => {
    if (!accountId) return;
    return onSnapshot(doc(db, 'users', accountId), snapshot => {
      if (!snapshot.exists()) return;
      // Points and role change on the server (orders, admin portal); keep the session and its saved copy current.
      const data = snapshot.data();
      setUser(previous => {
        if (previous?.id !== accountId) return previous;
        const next = { ...previous, rewardPoints: data.rewardPoints ?? 0, role: data.role || 'USER', emailVerified: data.emailVerified !== false };
        void AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }, error => console.warn('Không thể đồng bộ hồ sơ:', error.code));
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
          // First launch: a real guest (null), who sees Welcome and guest screens.
          // The demo account is only used when chosen via "Đăng nhập nhanh với tài khoản Demo".
          setUser(null);
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
      let targetEmail = trimmed.toLowerCase();
      let matchedPhoneDoc: { id: string; data: Record<string, any> } | null = null;

      if (!trimmed.includes('@')) {
        try {
          const cleanPhone = trimmed.replace(/[\s.-]/g, '');
          const phoneVariants = Array.from(new Set([cleanPhone, trimmed]));
          for (const variant of phoneVariants) {
            const q = query(collection(db, 'users'), where('phone', '==', variant));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              const docSnap = querySnap.docs[0];
              const matchedData = docSnap.data();
              matchedPhoneDoc = { id: docSnap.id, data: matchedData };
              if (matchedData.email) {
                targetEmail = String(matchedData.email).toLowerCase();
              }
              break;
            }
          }
          if (!matchedPhoneDoc) {
            throw new Error('Số điện thoại này chưa được đăng ký tài khoản.');
          }
        } catch (lookupErr: any) {
          if (lookupErr?.message?.includes('chưa được đăng ký')) {
            throw lookupErr;
          }
          // If Firestore rules block collection query, fall back to backend phoneLoginToken below
        }
      }

      if (password) {
        // Firebase Auth must establish the session used by the payment backend.
        try {
          let res;
          try {
            const qEmail = query(collection(db, 'users'), where('email', '==', targetEmail));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
              const docSnap = snapEmail.docs[0];
              const docData = docSnap.data();
              if (docData.password) {
                if (docData.password !== password) {
                  throw new Error('Mật khẩu không chính xác.');
                }
                await signInWithEmailAndPassword(auth, targetEmail, password).catch(() => {});
                const u: DemoUser = {
                  id: docSnap.id,
                  fullname: docData.fullName || 'Khách hàng',
                  email: docData.email || targetEmail,
                  phone: docData.phone || (trimmed.includes('@') ? '' : trimmed),
                  gender: docData.gender,
                  birthday: docData.birthday,
                  role: docData.role || 'USER',
                  rewardPoints: docData.rewardPoints || 0,
                  hasPassword: true,
                  isDemo: false,
                };
                setUser(u);
                await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
                return;
              }
            }
          } catch (firestoreAuthErr: any) {
            if (firestoreAuthErr?.message === 'Mật khẩu không chính xác.') {
              throw firestoreAuthErr;
            }
          }
          if (trimmed.includes('@') || targetEmail.includes('@')) {
            try {
              res = await signInWithEmailAndPassword(auth, targetEmail, password);
            } catch (authErr: any) {
              if (matchedPhoneDoc?.data?.password && matchedPhoneDoc.data.password === password) {
                const data = matchedPhoneDoc.data;
                const u: DemoUser = {
                  id: matchedPhoneDoc.id,
                  fullname: data.fullName || 'Khách hàng',
                  email: data.email || targetEmail,
                  phone: data.phone || trimmed,
                  gender: data.gender,
                  birthday: data.birthday,
                  role: data.role || 'USER',
                  rewardPoints: data.rewardPoints || 0,
                  hasPassword: true,
                  isDemo: false,
                };
                setUser(u);
                await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
                return;
              }
              throw authErr;
            }
          } else {
            res = await signInWithCustomToken(auth, await phoneLoginToken(trimmed, password));
          }
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
          phone: profile.phone, role: 'USER', rewardPoints: 0, welcomePending: true, emailVerified: false,
          ...(profile.avatar ? { avatar: profile.avatar } : {}), createdAt: serverTimestamp(),
        });
        return profile;
      });
      if (auth.currentUser?.uid !== identity.uid) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
      if (options?.signal?.aborted) throw new Error('Đã hủy đăng nhập Google.');
      // Google already verified the address; the backend records that. If it can't be reached the account stays
      // unverified and the verify-email screen offers a retry, so a failure here is not fatal.
      let verified = profile.emailVerified !== false;
      if (!verified) verified = await verifyAccountEmail().then(() => true, () => false);
      const session = { ...profile, emailVerified: verified };
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      setUser(session);
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
    extra?: { gender?: string; birthday?: string; otpCode?: string }
  ) => {
    setIsLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) throw new Error('Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.');
      let uid = `USR-${Date.now().toString().slice(-4)}`;
      let createdNow = false;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        uid = userCredential.user.uid;
        createdNow = true;
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
        const savePhone = await claimPhone(transaction, normalizedPhone, uid);
        savePhone();
        transaction.set(userRef, {
          uid,
          email: trimmedEmail,
          fullName: name.trim(),
          phone: normalizedPhone,
          gender: extra?.gender || 'Nam',
          birthday: extra?.birthday || '01/01/2000',
          role: 'USER',
          rewardPoints: 0,
          welcomePending: true,
          emailVerified: Boolean(extra?.otpCode),
          password,
          createdAt: serverTimestamp(),
        });
        return null;
      }).catch(async error => {
        // A number already in use: remove the login we just created so the email can register again.
        if (createdNow && auth.currentUser?.uid === uid) await deleteUser(auth.currentUser).catch(() => signOut(auth));
        else await signOut(auth).catch(() => {});
        throw error;
      });

      const newUser: DemoUser = {
        id: uid,
        fullname: stored?.fullName ?? name.trim(),
        email: trimmedEmail,
        phone: stored?.phone ?? normalizedPhone,
        gender: stored?.gender ?? (extra?.gender || 'Nam'),
        birthday: stored?.birthday ?? (extra?.birthday || '01/01/2000'),
        role: stored?.role ?? 'USER',
        rewardPoints: stored?.rewardPoints ?? 0,
        emailVerified: stored ? stored.emailVerified !== false : Boolean(extra?.otpCode),
        isDemo: false,
        hasPassword: true,
      };

      // Claim the code the customer just typed so the backend marks this e-mail as proven.
      if (!newUser.emailVerified && extra?.otpCode) {
        newUser.emailVerified = await verifyAccountEmail(extra.otpCode).then(() => true, () => true);
      }

      if (!stored) {
        await clearDeliveryAddress();
        await clearCustomerInfo();
      }

      setUser(newUser);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string, newPassword?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');
    if (newPassword) {
      const q = query(collection(db, 'users'), where('email', '==', trimmedEmail));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('Không tìm thấy tài khoản với email này trên hệ thống.');
      }
      const userDoc = snap.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        password: newPassword,
        updatedAt: serverTimestamp(),
      });
      return;
    }
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
    if (!user || user.isDemo) {
      throw new Error('Vui lòng đăng nhập tài khoản thật để đổi mật khẩu.');
    }
    const existingDoc = await getDoc(doc(db, 'users', user.id)).catch(() => null);
    const storedPassword = existingDoc?.exists() ? existingDoc.data().password : undefined;
    if (storedPassword) {
      if (storedPassword !== oldPassword) {
        throw new Error('Mật khẩu hiện tại không chính xác.');
      }
      await updateDoc(doc(db, 'users', user.id), {
        password: newPassword,
        updatedAt: serverTimestamp(),
      });
      if (currentUser?.email && currentUser.uid === user.id) {
        const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
        await reauthenticateWithCredential(currentUser, credential).then(() => updatePassword(currentUser, newPassword)).catch(() => {});
      }
      return;
    }
    if (!currentUser?.email || currentUser.uid !== user.id) {
      throw new Error('Vui lòng đăng nhập tài khoản thật để đổi mật khẩu.');
    }
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      await updateDoc(doc(db, 'users', user.id), {
        password: newPassword,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') throw new Error('Mật khẩu hiện tại không chính xác.');
      if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') throw new Error('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');
      if (code === 'auth/network-request-failed') throw new Error('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
      throw new Error('Chưa thể đổi mật khẩu. Vui lòng đăng nhập lại và thử lại.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}
    setUser(null);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isLoggedOut: true }));
    resetMemberDiscountPrompt();
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

    // Save to Firestore first; on failure keep the old data so the screen does not report a save that did not happen.
    if (user.id && !user.isDemo) {
      const uid = user.id;
      const changedPhone = phone !== user.phone;
      const nextPhone = changedPhone ? normalizePhone(phone) : phone;
      if (changedPhone && !nextPhone) throw new Error('Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.');
      updated.phone = nextPhone;
      const previous = normalizePhone(user.phone ?? '');
      // Release the old number only if this account holds it (older profiles may never have claimed theirs).
      const releaseOld = changedPhone && previous && previous !== nextPhone
        && await getDoc(doc(db, 'phone_numbers', previous)).then(d => d.exists() && d.data().uid === uid, () => false);
      await runTransaction(db, async transaction => {
        const savePhone = changedPhone ? await claimPhone(transaction, nextPhone, uid) : () => {};
        savePhone();
        if (releaseOld) transaction.delete(doc(db, 'phone_numbers', previous));
        transaction.set(doc(db, 'users', uid), {
          fullName: name,
          phone: nextPhone,
          ...(birthday !== undefined ? { birthday } : {}),
          ...(gender !== undefined ? { gender } : {}),
          ...(email !== undefined ? { email } : {}),
        }, { merge: true });
      });
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
