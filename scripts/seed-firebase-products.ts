import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { mockProducts } from '../src/data/mockProducts';

const firebaseConfig = {
  apiKey: "AIzaSyCl_P5YOGCQRw05HAyD8nVSkCr9O2fC6B0",
  authDomain: "pizzastore-59bad.firebaseapp.com",
  projectId: "pizzastore-59bad",
  storageBucket: "pizzastore-59bad.firebasestorage.app",
  messagingSenderId: "420822213507",
  appId: "1:420822213507:web:fcd7196e570de017034cb6",
  measurementId: "G-J47N0E29RV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedProducts() {
  console.log(`Bắt đầu đồng bộ ${mockProducts.length} món ăn lên Cloud Firestore (collection 'products')...`);

  for (const product of mockProducts) {
    const productRef = doc(db, 'products', product.id);
    await setDoc(productRef, {
      ...product,
      updatedAt: new Date(),
    }, { merge: true });
    console.log(` -> Đã lưu: [${product.id}] ${product.name}`);
  }

  console.log('\n===> THÀNH CÔNG: Đã khởi tạo đầy đủ dữ liệu thực đơn lên Cloud Firestore!');
  process.exit(0);
}

seedProducts().catch((err) => {
  console.error('Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
