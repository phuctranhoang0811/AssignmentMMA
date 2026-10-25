# 🍕 HƯỚNG DẪN KIỂM THỬ DÀNH CHO THÀNH VIÊN TRONG NHÓM (TEAM GUIDE)

> **Dự án**: Pizza FPT Mobile App (React Native - Expo SDK)  
> **Cơ sở dữ liệu đám mây chung**: Firebase Project `pizzastore-59bad`

---

## 🚀 1. Khởi Động Dự Án (Chạy Lần Đầu)

Sau khi pull code về máy:

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy ứng dụng với Expo
npm run dev
```

* Nhấn phím `a` trên terminal để mở máy ảo Android.
* Hoặc quét mã QR bằng ứng dụng **Expo Go** trên điện thoại thật.

---

## ⚡ 2. Cấu Hình Cơ Sở Dữ Liệu Dùng Chung (Firebase)

* Dự án đã được cấu hình sẵn trong file [`src/services/firebase.ts`](file:///src/services/firebase.ts). **Tất cả thành viên trong nhóm không cần tạo thêm file `.env` cá nhân** — clone về là kết nối trực tiếp vào database chung của nhóm.
* Quản lý dữ liệu trực tiếp trên Web Console:
  - **Quản lý tài khoản User**: [Firebase Auth Console](https://console.firebase.google.com/u/0/project/pizzastore-59bad/authentication/users)
  - **Quản lý dữ liệu (Menu, Orders)**: [Firestore Database Console](https://console.firebase.google.com/u/0/project/pizzastore-59bad/firestore)

---

## 🍕 3. Khởi Tạo Menu Món Ăn Mẫu (One-Click Seed)

Bất kỳ khi nào muốn cập nhật lại toàn bộ danh mục thực đơn (Pizza, Mì Ý, Sushi, Nước uống) lên Firebase, chỉ cần chạy 1 lệnh:

```bash
npm run seed:firebase
```

Dữ liệu sẽ tự động đồng bộ vào collection `products` trên Cloud Firestore.

---

## 👤 4. Kiểm Thử Đăng Ký / Đăng Nhập

* **Đăng ký tài khoản mới**:
  - Không cần mã OTP xác thực email (tiện lợi cho kiểm thử nhóm).
  - Nhập Email $\rightarrow$ Nhập Họ tên, SĐT $\rightarrow$ Nhập Mật khẩu (tối thiểu 8 ký tự).
  - Dữ liệu tài khoản sẽ tự động lưu vào **Firebase Auth** và tạo hồ sơ người dùng trong collection `users` trên Firestore.
* **Tài khoản test có sẵn**:
  - Email: `testuser@pizzastore.com`
  - Mật khẩu: `Password123!`
* **Đăng nhập nhanh (Quick Demo)**:
  - Có thể bấm nút *"Đăng nhập nhanh với tài khoản Demo"* trên màn hình Đăng nhập để vào ngay app.
