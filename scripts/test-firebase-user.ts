import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

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
const auth = getAuth(app);
const db = getFirestore(app);

async function testCreateAccount() {
  const testEmail = "testuser@pizzastore.com";
  const testPassword = "Password123!";

  console.log(`Đang tiến hành tạo tài khoản thử nghiệm trên Firebase: ${testEmail}...`);

  try {
    // 1. Tạo tài khoản trong Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    const user = userCredential.user;
    console.log("===> THÀNH CÔNG: Tài khoản đã được tạo trên Firebase Authentication!");
    console.log(`UID: ${user.uid}`);
    console.log(`Email: ${user.email}`);

    // 2. Lưu document người dùng vào Firestore (Collection: users)
    console.log("Đang lưu thông tin chi tiết vào Cloud Firestore (collection: users)...");
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      fullName: "Nguyễn Văn Test",
      phone: "0901234567",
      role: "USER",
      rewardPoints: 100,
      createdAt: serverTimestamp()
    });

    console.log("===> THÀNH CÔNG: Dữ liệu user đã được lưu vào Firestore collection 'users'!");
    console.log("\n--- KẾT QUẢ KIỂM TRA ---");
    console.log(`Email đăng nhập: ${testEmail}`);
    console.log(`Mật khẩu: ${testPassword}`);
    console.log(`Firebase UID: ${user.uid}`);
  } catch (error: any) {
    console.error("Lỗi khi tạo tài khoản trên Firebase:", error.code, error.message);
  }
}

testCreateAccount();
