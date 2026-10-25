import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoUser } from '../types/user';
import { authService } from '../services';
import { demoUser } from '../data/mockUsers';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

interface AuthContextType {
  user: DemoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginDemo: (email?: string, password?: string) => Promise<void>;
  registerDemo: (
    name: string,
    email: string,
    phone: string,
    password?: string,
    extra?: { gender?: string; birthday?: string }
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, phone: string, birthday?: string, gender?: string, email?: string) => Promise<void>;
}

const AUTH_STORAGE_KEY = '@pizza_time_auth_v1';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.isLoggedOut) {
            setUser(null);
          } else {
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
      let targetEmail = trimmed.toLowerCase();

      // Nếu người dùng nhập Số điện thoại (chỉ chứa số hoặc không chứa ký tự '@')
      if (!trimmed.includes('@')) {
        try {
          const cleanPhone = trimmed.replace(/[\s.-]/g, '');
          const q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
          const querySnap = await getDocs(q);

          if (!querySnap.empty) {
            const matchedData = querySnap.docs[0].data();
            if (matchedData.email) {
              targetEmail = matchedData.email.toLowerCase();
            }
          } else {
            // Thử truy vấn phone theo dạng chuỗi gốc
            const qRaw = query(collection(db, 'users'), where('phone', '==', trimmed));
            const querySnapRaw = await getDocs(qRaw);
            if (!querySnapRaw.empty) {
              const matchedData = querySnapRaw.docs[0].data();
              if (matchedData.email) {
                targetEmail = matchedData.email.toLowerCase();
              }
            } else {
              throw new Error('Số điện thoại này chưa được đăng ký tài khoản.');
            }
          }
        } catch (e: any) {
          if (e.message && e.message.includes('chưa được đăng ký')) {
            throw e;
          }
          console.warn('Tra cứu số điện thoại thất bại:', e.message);
        }
      }

      if (password) {
        try {
          const res = await signInWithEmailAndPassword(auth, targetEmail, password);
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
              isDemo: false,
            };
            setUser(u);
            await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
            return;
          }
        } catch (e: any) {
          if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            throw new Error('Mật khẩu không chính xác.');
          } else if (e.code === 'auth/user-not-found') {
            throw new Error('Tài khoản không tồn tại.');
          }
          throw new Error(e.message || 'Đăng nhập không thành công.');
        }
      }

      const u = await authService.login(targetEmail);
      setUser(u);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
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

      // Lưu hồ sơ người dùng vào Cloud Firestore collection 'users'
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          email: trimmedEmail,
          fullName: name.trim(),
          phone: phone.trim(),
          gender: extra?.gender || 'Nam',
          birthday: extra?.birthday || '01/01/2000',
          role: 'USER',
          rewardPoints: 100,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      const newUser: DemoUser = {
        id: uid,
        fullname: name.trim(),
        email: trimmedEmail,
        phone: phone.trim(),
        gender: extra?.gender || 'Nam',
        birthday: extra?.birthday || '01/01/2000',
        role: 'USER',
        rewardPoints: 100,
        isDemo: false,
      };

      setUser(newUser);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
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
        registerDemo,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => useContext(AuthContext);
