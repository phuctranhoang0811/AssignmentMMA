import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - subpath cho react-native persistence trong Firebase v10/v11
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cấu hình Firebase Console của dự án PizzaStore (pizzastore-59bad)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyCl_P5YOGCQRw05HAyD8nVSkCr9O2fC6B0",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "pizzastore-59bad.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "pizzastore-59bad",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "pizzastore-59bad.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "420822213507",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:420822213507:web:fcd7196e570de017034cb6",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-J47N0E29RV"
};

// Khởi tạo app (tránh khởi tạo trùng lặp khi hot-reload trong React Native)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Khởi tạo Auth với cơ chế lưu phiên đăng nhập cục bộ trên thiết bị (tránh crash khi hot-reload)
let auth: ReturnType<typeof initializeAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// Khởi tạo Cloud Firestore Database
const db = getFirestore(app);

export { app, auth, db };
