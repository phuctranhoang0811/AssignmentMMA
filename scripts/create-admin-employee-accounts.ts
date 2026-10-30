import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCl_P5YOGCQRw05HAyD8nVSkCr9O2fC6B0",
  authDomain: "pizzastore-59bad.firebaseapp.com",
  projectId: "pizzastore-59bad",
  storageBucket: "pizzastore-59bad.firebasestorage.app",
  messagingSenderId: "420822213507",
  appId: "1:420822213507:web:fcd7196e570de017034cb6",
  measurementId: "G-J47N0E29RV",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ACCOUNTS = [
  {
    email: "admin@pizzastore.com",
    password: "Password123!",
    fullName: "Quản Trị Viên (Admin)",
    phone: "0909000001",
    role: "SUPER_ADMIN",
    gender: "Nam",
    birthday: "01/01/1990",
    rewardPoints: 9999,
  },
  {
    email: "employee@pizzastore.com",
    password: "Password123!",
    fullName: "Nhân Viên Cửa Hàng (Staff)",
    phone: "0909000002",
    role: "EMPLOYEE",
    gender: "Nữ",
    birthday: "15/05/1998",
    rewardPoints: 500,
  },
  {
    email: "rider@pizzastore.com",
    password: "Password123!",
    fullName: "Tài Xế Giao Hàng (Rider)",
    phone: "0909000003",
    role: "ROLE_RIDER",
    gender: "Nam",
    birthday: "20/08/1995",
    rewardPoints: 0,
  },
];

async function createOrUpdateAccount(acc: typeof ACCOUNTS[0]) {
  console.log(`\n--------------------------------------------------`);
  console.log(`🚀 Đang xử lý tài khoản: ${acc.email} [Role: ${acc.role}]...`);

  let uid: string;

  try {
    const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.password);
    uid = cred.user.uid;
    console.log(`✅ Đã tạo mới trên Firebase Authentication với UID: ${uid}`);
  } catch (err: any) {
    if (err.code === "auth/email-already-in-use") {
      console.log(`ℹ️ Email ${acc.email} đã tồn tại trên Auth. Đang đăng nhập để lấy UID...`);
      try {
        const loginCred = await signInWithEmailAndPassword(auth, acc.email, acc.password);
        uid = loginCred.user.uid;
        console.log(`✅ Đã đăng nhập và lấy UID: ${uid}`);
      } catch (loginErr: any) {
        console.warn(`⚠️ Đăng nhập không thành công (${loginErr.message}). Tạo ID dự phòng...`);
        uid = `USR-${acc.role.toLowerCase()}-${Date.now()}`;
      }
    } else {
      console.error(`❌ Lỗi Firebase Auth:`, err.code, err.message);
      uid = `USR-${acc.role.toLowerCase()}-${Date.now()}`;
    }
  }

  // Lưu/Cập nhật document Firestore collection 'users'
  const userRef = doc(db, "users", uid);
  const existingDoc = await getDoc(userRef);

  await setDoc(
    userRef,
    {
      uid,
      email: acc.email,
      fullName: acc.fullName,
      phone: acc.phone,
      role: acc.role,
      gender: acc.gender,
      birthday: acc.birthday,
      rewardPoints: acc.rewardPoints,
      updatedAt: serverTimestamp(),
      ...(existingDoc.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  console.log(`✅ Đã lưu thông tin người dùng vào Firestore: collection 'users' [doc: ${uid}]`);
  console.log(`   - Email:    ${acc.email}`);
  console.log(`   - SĐT:      ${acc.phone}`);
  console.log(`   - Họ tên:   ${acc.fullName}`);
  console.log(`   - Quyền:    ${acc.role}`);
  console.log(`   - Mật khẩu: (không lưu trong database)`);
}

async function main() {
  console.log("==================================================");
  console.log("🔥 BẮT ĐẦU TẠO TÀI KHOẢN ADMIN, EMPLOYEE VÀ RIDER TRONG DATABASE...");
  console.log("==================================================");

  for (const acc of ACCOUNTS) {
    await createOrUpdateAccount(acc);
  }

  console.log("\n==================================================");
  console.log(`🎉 HOÀN TẤT TẠO ${ACCOUNTS.length} TÀI KHOẢN TRONG DATABASE FIREBASE!`);
  console.log("==================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Lỗi chương trình:", err);
  process.exit(1);
});
