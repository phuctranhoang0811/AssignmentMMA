// Firestore security rules (../firestore.rules) against the local emulator. Run: npm run test:rules (needs Java 11+).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, collection } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-pf',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8180 } });
const seed = async () => env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  const put = (path, data) => setDoc(doc(db, path), data);
  await put('users/super', { role: 'SUPER_ADMIN', phone: '' });
  await put('users/admin', { role: 'ADMIN', phone: '' });
  await put('users/manager', { role: 'STORE_MANAGER', phone: '' });
  await put('users/a', { role: 'USER', rewardPoints: 100, phone: '0900000001', fullName: 'A' });
  await put('users/b', { role: 'USER', rewardPoints: 100, phone: '0900000002', fullName: 'B' });
  await put('users/legacy', { role: 'USER', rewardPoints: 100, phone: '0911 111 111', fullName: 'Legacy' });
  await put('phone_numbers/0900000001', { uid: 'a' });
  await put('phone_numbers/0900000002', { uid: 'b' });
  await put('orders/oa', { userId: 'a', total: 1 });
  await put('orders/ob', { userId: 'b', total: 1 });
  await put('products/p1', { name: 'P', basePrice: 1 });
  await put('coupon_usages/X_a', { uid: 'a' });
});
const as = uid => env.authenticatedContext(uid).firestore();
let pass = 0, fail = 0;
async function check(name, fn) {
  try { await env.clearFirestore(); await seed(); await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '-', String(e.message).split('\n')[0]); }
}

await check('khach doc don cua minh, khong doc don nguoi khac, khong ghi don', async () => {
  const db = as('a');
  await assertSucceeds(getDoc(doc(db, 'orders/oa')));
  await assertFails(getDoc(doc(db, 'orders/ob')));
  await assertFails(updateDoc(doc(db, 'orders/oa'), { total: 0 }));
});
await check('khach tu sua role/diem bi chan; sua ten duoc', async () => {
  const db = as('a');
  await assertFails(updateDoc(doc(db, 'users/a'), { role: 'SUPER_ADMIN' }));
  await assertFails(updateDoc(doc(db, 'users/a'), { rewardPoints: 999 }));
  await assertSucceeds(updateDoc(doc(db, 'users/a'), { fullName: 'A2' }));
});
await check('dang ky moi: phai giu cho SDT trong cung lan ghi', async () => {
  const db = as('c');
  const profile = { role: 'USER', rewardPoints: 100, phone: '0900000003', fullName: 'C' };
  await assertFails(setDoc(doc(db, 'users/c'), profile));
  const batch = writeBatch(db);
  batch.set(doc(db, 'phone_numbers/0900000003'), { uid: 'c' });
  batch.set(doc(db, 'users/c'), profile);
  await assertSucceeds(batch.commit());
});
await check('dang ky bang SDT da co chu: doc bi tu choi, ghi bi tu choi', async () => {
  const db = as('c');
  await assertFails(getDoc(doc(db, 'phone_numbers/0900000001')));
  await assertSucceeds(getDoc(doc(db, 'phone_numbers/0900000009')));
  const batch = writeBatch(db);
  batch.set(doc(db, 'phone_numbers/0900000001'), { uid: 'c' });
  batch.set(doc(db, 'users/c'), { role: 'USER', rewardPoints: 100, phone: '0900000001' });
  await assertFails(batch.commit());
});
await check('dang ky Google khong co SDT van duoc', async () => {
  await assertSucceeds(setDoc(doc(as('g'), 'users/g'), { role: 'USER', rewardPoints: 100, phone: '' }));
});
await check('doi SDT: can giu cho so moi, nha so cu; khong nha so dang dung', async () => {
  const db = as('a');
  await assertFails(updateDoc(doc(db, 'users/a'), { phone: '0900000004' }));
  await assertFails(deleteDoc(doc(db, 'phone_numbers/0900000001')));
  const batch = writeBatch(db);
  batch.set(doc(db, 'phone_numbers/0900000004'), { uid: 'a' });
  batch.delete(doc(db, 'phone_numbers/0900000001'));
  batch.update(doc(db, 'users/a'), { phone: '0900000004' });
  await assertSucceeds(batch.commit());
});
await check('doi sang SDT cua nguoi khac bi chan; SDT sai dinh dang khong giu cho duoc', async () => {
  const db = as('a');
  await assertFails(updateDoc(doc(db, 'users/a'), { phone: '0900000002' }));
  await assertFails(setDoc(doc(db, 'phone_numbers/0900 000 005'), { uid: 'a' }));
  await assertFails(setDoc(doc(db, 'phone_numbers/0900000005'), { uid: 'b' }));
});
await check('ho so cu (SDT chua giu cho) van sua ten duoc', async () => {
  await assertSucceeds(updateDoc(doc(as('legacy'), 'users/legacy'), { fullName: 'L2', phone: '0911 111 111' }));
});
await check('SUPER_ADMIN: doc moi user/don, cap moi quyen, khong tu doi quyen minh', async () => {
  const db = as('super');
  await assertSucceeds(getDocs(collection(db, 'users')));
  await assertSucceeds(getDoc(doc(db, 'orders/ob')));
  await assertSucceeds(updateDoc(doc(db, 'users/b'), { role: 'ADMIN' }));
  await assertSucceeds(updateDoc(doc(db, 'users/admin'), { role: 'USER' }));
  await assertFails(updateDoc(doc(db, 'users/super'), { role: 'USER' }));
  await assertFails(updateDoc(doc(db, 'users/b'), { role: 'GOD' }));
  await assertFails(updateDoc(doc(db, 'users/b'), { role: 'EMPLOYEE', rewardPoints: 5 }));
});
await check('ADMIN: cap nhan vien/khoa duoc; khong dung toi cap admin', async () => {
  const db = as('admin');
  await assertSucceeds(updateDoc(doc(db, 'users/b'), { role: 'EMPLOYEE' }));
  await assertSucceeds(updateDoc(doc(db, 'users/a'), { role: 'BLACKLISTED' }));
  await assertSucceeds(updateDoc(doc(db, 'users/a'), { role: 'STORE_MANAGER' }));
  await assertFails(updateDoc(doc(db, 'users/b'), { role: 'ADMIN' }));
  await assertFails(updateDoc(doc(db, 'users/super'), { role: 'USER' }));
});
await check('STORE_MANAGER: sua mon/voucher, xem user; KHONG doi quyen', async () => {
  const db = as('manager');
  await assertSucceeds(updateDoc(doc(db, 'products/p1'), { basePrice: 2 }));
  await assertSucceeds(setDoc(doc(db, 'coupons/NEW'), { code: 'NEW' }));
  await assertSucceeds(getDocs(collection(db, 'users')));
  await assertFails(updateDoc(doc(db, 'users/b'), { role: 'EMPLOYEE' }));
  await assertFails(updateDoc(doc(db, 'users/a'), { role: 'BLACKLISTED' }));
});
await check('khach khong sua mon/voucher, khong doc coupon_usages; ai cung xem duoc mon', async () => {
  const db = as('a');
  await assertFails(updateDoc(doc(db, 'products/p1'), { basePrice: 0 }));
  await assertFails(setDoc(doc(db, 'coupons/FREE'), { code: 'FREE' }));
  await assertFails(getDoc(doc(db, 'coupon_usages/X_a')));
  await assertSucceeds(getDoc(doc(as('anyone'), 'products/p1')));
});

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
