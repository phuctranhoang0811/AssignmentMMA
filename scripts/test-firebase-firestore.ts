import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

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

async function testFirestoreSave() {
  const testEmail = "testuser@pizzastore.com";
  const testPassword = "Password123!";

  console.log(`Đang đăng nhập vào Firebase Auth với: ${testEmail}...`);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    const user = userCredential.user;
    console.log(`Đã đăng nhập thành công! UID: ${user.uid}`);

    console.log("Đang lưu document vào Firestore (collection 'users')...");
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      fullName: "Nguyễn Văn Test",
      phone: "0901234567",
      role: "USER",
      rewardPoints: 100,
      createdAt: serverTimestamp()
    });

    console.log("===> THÀNH CÔNG: Đã lưu dữ liệu vào Cloud Firestore!");

    // Đọc lại để xác nhận 100%
    console.log("Đang đọc lại dữ liệu vừa lưu từ Cloud Firestore...");
    const snapshot = await getDoc(userDocRef);
    if (snapshot.exists()) {
      console.log("===> DỮ LIỆU ĐỌC ĐƯỢC TỪ FIRESTORE:", JSON.stringify(snapshot.data(), null, 2));
    }
  } catch (error: any) {
    console.error("Lỗi Firestore:", error.code, error.message);
  }
}

testFirestoreSave();
