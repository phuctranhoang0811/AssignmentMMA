import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";

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

async function viewFirebaseData() {
  console.log("==================================================");
  console.log("🔥 ĐANG KẾT NỐI VÀ LẤY DỮ LIỆU TỪ FIREBASE CLOUD...");
  console.log("==================================================\n");

  // 1. Xem Users
  try {
    const usersCol = collection(db, "users");
    const userSnapshot = await getDocs(query(usersCol, limit(10)));
    console.log(`👤 COLLECTION 'users': (${userSnapshot.size} tài khoản)`);
    userSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`  - [ID: ${doc.id}]`);
      console.log(`    Họ tên: ${data.fullName || data.fullname || 'Chưa cập nhật'}`);
      console.log(`    Email:  ${data.email || 'Không có'}`);
      console.log(`    SĐT:    ${data.phone || 'Không có'}`);
      console.log(`    Điểm:   ${data.rewardPoints ?? 0} pts`);
    });
  } catch (err: any) {
    console.log("Lỗi đọc collection users:", err.message);
  }

  console.log("\n--------------------------------------------------");

  // 2. Xem Products
  try {
    const productsCol = collection(db, "products");
    const productSnapshot = await getDocs(query(productsCol, limit(10)));
    console.log(`🍕 COLLECTION 'products': (${productSnapshot.size} sản phẩm)`);
    productSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`  - [${doc.id}] ${data.name} | Giá: ${data.basePrice?.toLocaleString()} đ | Danh mục: ${data.categoryId}`);
    });
  } catch (err: any) {
    console.log("Lỗi đọc collection products:", err.message);
  }

  console.log("\n--------------------------------------------------");

  // 3. Xem Orders
  try {
    const ordersCol = collection(db, "orders");
    const orderSnapshot = await getDocs(query(ordersCol, limit(5)));
    console.log(`📦 COLLECTION 'orders': (${orderSnapshot.size} đơn hàng)`);
    orderSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`\n  🧾 ĐƠN HÀNG [ID: ${doc.id}] - Mã: #${data.orderCode || 'N/A'}`);
      console.log(`     Khách hàng: ${data.customer?.fullname || 'Chưa cập nhật'} | SĐT: ${data.customer?.phone || 'N/A'}`);
      console.log(`     Địa chỉ:    ${data.address || 'Tại quán'}`);
      console.log(`     Hẹn giờ nhận: ${data.deliveryTime || 'Càng sớm càng tốt'}`);
      console.log(`     Thời gian đặt: ${data.createdAtFormatted || 'Vừa xong'}`);
      console.log(`     Thanh toán: ${data.paymentName || data.paymentMethod || 'Tiền mặt'} (${data.paymentStatus})`);
      console.log(`     Trạng thái: 🟢 ${data.status}`);
      console.log(`     Tổng thanh toán: ${data.total?.toLocaleString()} đ (Tạm tính: ${data.subtotal?.toLocaleString()} đ, Ship: ${data.deliveryFee?.toLocaleString()} đ)`);
      if (Array.isArray(data.items) && data.items.length > 0) {
        console.log(`     🍽️ Các món đã đặt (${data.items.length} món):`);
        data.items.forEach((item: any, i: number) => {
          console.log(`        ${i + 1}. ${item.productName} (x${item.quantity}) - ${item.variantName || ''} - ${item.lineTotal?.toLocaleString()} đ`);
        });
      }
    });
  } catch (err: any) {
    console.log("Lỗi đọc collection orders:", err.message);
  }

  console.log("\n==================================================");
  console.log("✅ ĐÃ ĐỒNG BỘ TRỰC TIẾP TỪ CLOUD FIRESTORE THÀNH CÔNG!");
  console.log("==================================================");
}

viewFirebaseData();
