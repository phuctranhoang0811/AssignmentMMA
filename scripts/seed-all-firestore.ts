/**
 * seed-all-firestore.ts
 * Seed toàn bộ dữ liệu demo lên Cloud Firestore:
 *   - products  (từ mockProducts)
 *   - orders    (từ initialMockOrders)
 *   - coupons   (từ mockCoupons)
 *
 * Chạy: npx ts-node -e "require('./scripts/seed-all-firestore.ts')"
 * Hoặc: npx tsx scripts/seed-all-firestore.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { mockProducts } from '../src/data/mockProducts';
import { initialMockOrders } from '../src/data/mockOrders';
import { mockCoupons } from '../src/data/mockPromotions';

const firebaseConfig = {
  apiKey: 'AIzaSyCl_P5YOGCQRw05HAyD8nVSkCr9O2fC6B0',
  authDomain: 'pizzastore-59bad.firebaseapp.com',
  projectId: 'pizzastore-59bad',
  storageBucket: 'pizzastore-59bad.firebasestorage.app',
  messagingSenderId: '420822213507',
  appId: '1:420822213507:web:fcd7196e570de017034cb6',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeObj(obj: any): any {
  // Loại bỏ undefined, convert Date sang ISO string
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    v instanceof Date ? v.toISOString() : v === undefined ? null : v
  ));
}

async function clearCollection(name: string) {
  const snap = await getDocs(collection(db, name));
  const batch: Promise<void>[] = [];
  snap.forEach(d => batch.push(deleteDoc(d.ref)));
  await Promise.all(batch);
  console.log(`   ↳ Đã xóa ${snap.size} document cũ trong '${name}'`);
}

// ─── Seed Products ───────────────────────────────────────────────────────────

async function seedProducts() {
  console.log(`\n📦 PRODUCTS — seed ${mockProducts.length} món ăn...`);
  await clearCollection('products');

  for (const p of mockProducts) {
    const ref = doc(db, 'products', p.id);
    await setDoc(ref, safeObj({ ...p, updatedAt: new Date().toISOString() }), { merge: true });
    console.log(`   ✅ [${p.id}] ${p.name} — ${p.basePrice.toLocaleString()}₫`);
  }
}

// ─── Seed Orders ─────────────────────────────────────────────────────────────

async function seedOrders() {
  console.log(`\n🧾 ORDERS — seed ${initialMockOrders.length} đơn hàng...`);
  await clearCollection('orders');

  for (const o of initialMockOrders) {
    const ref = doc(db, 'orders', o.id);
    await setDoc(
      ref,
      safeObj({
        userId: o.userId,
        customerName: o.customer.fullname,
        customerPhone: o.customer.phone,
        customer: o.customer,
        fulfillmentType: o.fulfillmentType,
        deliveryAddress: o.address,
        address: o.address,
        items: o.items,
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        subtotal: o.subtotal,
        discount: o.discount,
        deliveryFee: o.deliveryFee,
        tax: o.tax,
        totalAmount: o.total,
        total: o.total,
        statusHistory: o.statusHistory,
        createdAt: o.createdAt,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    console.log(`   ✅ [${o.id}] ${o.customer.fullname} — ${o.status} — ${o.total.toLocaleString()}₫`);
  }
}

// ─── Seed Coupons ─────────────────────────────────────────────────────────────

async function seedCoupons() {
  console.log(`\n🎟️  COUPONS — seed ${mockCoupons.length} voucher...`);
  await clearCollection('coupons');

  for (const c of mockCoupons) {
    const ref = doc(db, 'coupons', c.code); // dùng code làm document ID
    await setDoc(
      ref,
      safeObj({ ...c, createdAt: new Date().toISOString() }),
      { merge: true }
    );
    console.log(`   ✅ [${c.code}] ${c.description}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('🔥 SEED DATA → Cloud Firestore (pizzastore-59bad)');
  console.log('══════════════════════════════════════════════════');

  await seedProducts();
  await seedOrders();
  await seedCoupons();

  console.log('\n══════════════════════════════════════════════════');
  console.log('🎉 HOÀN TẤT! Dữ liệu đã được đẩy lên Firestore.');
  console.log('   Mở Firebase Console để kiểm tra:');
  console.log('   https://console.firebase.google.com/project/pizzastore-59bad/firestore');
  console.log('══════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi seed:', err?.message || err);
  process.exit(1);
});

