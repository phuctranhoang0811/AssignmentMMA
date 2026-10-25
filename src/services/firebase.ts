import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - subpath cho react-native persistence trong Firebase v10/v11
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cấu hình Firebase Console của dự án PizzaStore (pizzastore-59bad)
const firebaseConfig = {
  apiKey: "AIzaSyCl_P5YOGCQRw05HAyD8nVSkCr9O2fC6B0",
  authDomain: "pizzastore-59bad.firebaseapp.com",
  projectId: "pizzastore-59bad",
  storageBucket: "pizzastore-59bad.firebasestorage.app",
  messagingSenderId: "420822213507",
  appId: "1:420822213507:web:fcd7196e570de017034cb6",
  measurementId: "G-J47N0E29RV"
};

// Khởi tạo app (tránh khởi tạo trùng lặp khi hot-reload trong React Native)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Khởi tạo Auth với cơ chế lưu phiên đăng nhập cục bộ trên thiết bị
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Khởi tạo Cloud Firestore Database
const db = getFirestore(app);

export { app, auth, db };
