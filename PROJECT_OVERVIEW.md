# Pizza FPT — Tổng quan dự án và luồng hệ thống

Ứng dụng đặt pizza trên di động (Expo / React Native) kèm backend Node.js. Một app phục vụ 4 nhóm người dùng: **khách**, **nhân viên bếp**, **quản trị viên** và **shipper**. Tài liệu chi tiết hơn: [SYSTEM_FLOWS.md](SYSTEM_FLOWS.md) (đặc tả nghiệp vụ), [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md) (test thủ công), [TEAM_GUIDE.md](TEAM_GUIDE.md) (cách cho nhóm test).

## 1. Công nghệ

| Lớp | Công nghệ |
| --- | --- |
| App | Expo SDK 58, React Native 0.88, React 19, Expo Router (file-based), TypeScript |
| Backend | Node ≥ 22, Express 5, Socket.IO, Zod, firebase-admin, nodemailer (`backend/`) |
| Dữ liệu / đăng nhập | Firebase Auth + Cloud Firestore, project `pizzastore-59bad` |
| Thanh toán | payOS (QR chuyển khoản) và tiền mặt (COD) |
| Giao hàng | Shipper của cửa hàng (tự tính phí theo km) và Ahamove staging (tùy chọn) |
| Test | Jest + Testing Library (app), `node:test` (backend), Firebase Emulator (Firestore rules) |

## 2. Kiến trúc

```
 Điện thoại (Expo Go / dev build)
   │  Firebase Auth (đăng nhập)          ┌──────────────────────────┐
   ├────────────────────────────────────►│  Firebase Auth + Firestore│◄──┐
   │  Firestore (đọc menu, voucher,      └──────────────────────────┘   │ firebase-admin
   │  cài đặt cửa hàng — theo rules)                                     │
   │  REST + Socket.IO (Bearer ID token)  ┌──────────────────────────┐   │
   └─────────────────────────────────────►│  Backend Express (3001)  │───┘
                                          │  giá, đơn, OTP, ví shipper│
                                          └───────┬───────────┬──────┘
                                       payOS API  │           │  Ahamove API
                                    (tạo QR, ◄────┘           └──► (tùy chọn)
                                     webhook trả về /api/webhooks/payos)
```

Nguyên tắc: **app không tự quyết giá hay trạng thái đơn**. Mọi thao tác ghi quan trọng (đặt đơn, đổi trạng thái, hoàn tiền, đổi điểm) đi qua backend; backend xác thực ID token Firebase, kiểm tra role, tính lại giá từ Firestore rồi mới ghi. App chỉ đọc trực tiếp Firestore những dữ liệu công khai (menu, voucher), phần còn lại do `firestore.rules` chặn.

## 3. Cấu trúc thư mục

```
src/app/            Màn hình (mỗi file là một route)
  (tabs)/           home, menu, cart, orders, rewards, profile
  auth/ welcome.tsx Đăng nhập, đăng ký (OTP email), quên mật khẩu
  product/ search   Chi tiết món, tìm kiếm
  checkout/         index (giao nhận) → payment → review / payos (QR)
  order/            success, tracking, [id], lookup (tra cứu bằng SĐT + mã đơn)
  profile/          sửa hồ sơ, địa chỉ, đổi mật khẩu, cài đặt
  staff/            Cổng nhân viên bếp (/staff/orders)
  rider/            Cổng shipper (/rider)
  admin/            Dashboard, đơn, món, khuyến mãi, người dùng, shipper, khiếu nại, báo cáo, nhật ký, cửa hàng
src/services/       Gọi backend / Firebase (orderApi, payosService, deliveryService, otpService, googleSignIn...)
src/state/          Context: Auth, Cart, Orders, Favorites, Toast
src/utils/ theme/ components/ data/ types/
backend/src/        app.ts (routes), server.ts (khởi động), store/orders/rewards/delivery/otp/push/sweeper/...
backend/test/       Test backend
scripts/            share-test.mjs, dev-android.mjs, seed, bridge Google, ...
firestore.rules     Quy tắc bảo mật Firestore (test trong firestore-tests/)
render.yaml, Dockerfile.backend   Deploy backend lên Render
```

## 4. Vai trò và nơi họ vào sau khi đăng nhập

| Vai trò (`users/{uid}.role`) | Màn hình đích | Làm được gì |
| --- | --- | --- |
| `USER` (hoặc chưa đăng nhập, xem menu) | `/(tabs)/home` | Duyệt menu, đặt đơn, theo dõi, hủy, đánh giá, đổi điểm |
| `EMPLOYEE`, `ROLE_KITCHEN` | `/staff/orders` | Xác nhận, nấu, báo sẵn sàng, từ chối đơn |
| `STORE_MANAGER`, `ADMIN`, `SUPER_ADMIN` | `/admin/dashboard` | Mọi việc của nhân viên + quản trị; chỉ `SUPER_ADMIN` đụng được nhóm admin |
| `ROLE_RIDER` | `/rider` | Nhận đơn giao, lấy hàng, giao, báo giao thất bại, xem thu nhập |

## 5. Luồng chính

### 5.1 Đăng ký và đăng nhập

```
Email ─► POST /api/otp/send (mã gửi Gmail) ─► nhập mã ─► họ tên, ngày sinh, SĐT ─► mật khẩu
      ─► tạo tài khoản Firebase Auth + hồ sơ users/{uid} ─► POST /api/account/verify-email
Đăng nhập: email + mật khẩu │ SĐT + mật khẩu (POST /api/auth/phone-login) │ Google
```

- Thiếu `SMTP_USER/SMTP_PASS` thì OTP trả 503, không đăng ký email được.
- Google: dev build dùng module native; Expo Go đi qua "google bridge" (cần HTTPS công khai).
- Mỗi số điện thoại chỉ gắn một tài khoản. Tài khoản bị khóa không đặt được đơn.

### 5.2 Đặt hàng và thanh toán

```
Menu ─► Chi tiết món (size / đế / topping / ghi chú) ─► Giỏ (voucher)
     ─► [chưa đăng nhập → đăng nhập → quay lại]
     ─► Checkout: nhận tại quầy hoặc giao tận nơi, địa chỉ, giờ hẹn
          giao tận nơi: geocode địa chỉ → phí theo km (ngoài vùng thì từ chối)
     ├─ COD   ─► POST /api/orders/cash ─► đơn PENDING_CONFIRMATION, UNPAID
     └─ payOS ─► POST /api/payments/payos ─► QR + checkoutUrl
                  ─► payOS gọi webhook /api/webhooks/payos (hoặc app hỏi lại mỗi 3 giây)
                  ─► PAID ─► đơn PENDING_CONFIRMATION
```

- Backend tính lại giá từ `products` và `coupons`; cửa hàng đóng cửa thì không nhận đơn.
- Voucher chỉ dùng với COD. QR chưa trả sẽ hết hạn do `sweeper` (chạy mỗi 60 giây).

### 5.3 Vòng đời đơn

```
PENDING_CONFIRMATION ─► CONFIRMED ─► PREPARING ─► READY ─┬─ nhận tại quầy ──────────────► COMPLETED
        │                   │            │          │    └─ giao hàng ─► OUT_FOR_DELIVERY ─► COMPLETED
        │                   └────────────┴──────────┴──► CANCELLED (nhân viên / admin từ chối)
        └─► CANCELLED (khách tự hủy, chỉ ở bước này)
```

| Quy tắc | Chi tiết |
| --- | --- |
| Hủy đơn đã trả tiền | `paymentStatus` → `REFUND_PENDING`; admin hoàn tiền thủ công rồi xác nhận → `REFUNDED`, khách được báo |
| Đơn không ai xác nhận | `sweeper` cảnh báo nhân viên, sau đó tự hủy |
| Điểm thưởng | Khi `COMPLETED` cộng `floor(total / 10000)` điểm đúng một lần; đơn hủy không cộng |
| Cập nhật trực tiếp | Socket.IO: phòng `staff` nhận đơn mới/đổi trạng thái, phòng `riders` nhận đơn giao còn trống; khách nhận push (dev build) |

### 5.4 Giao hàng bằng shipper của cửa hàng

```
Đơn giao READY ─► hiện cho mọi shipper (/api/rider/orders) ─► nhận đơn (accept)
   ─► lấy hàng (pickup) ─► giao (deliver) ─► COMPLETED, ghi riderEarned (+ riderCash nếu COD)
   Không giao được: /fail (có lý do).   Nhận nhầm khi chưa lấy hàng: release / staff unassign.
Admin: sổ nợ shipper (/api/admin/riders/ledger) ─► settle để chốt tiền công và tiền mặt đã thu
```

Khách chỉ thấy tên và SĐT shipper, không thấy tài khoản hay thu nhập. Ahamove là kênh giao thay thế, chỉ bật khi cấu hình staging (`AHAMOVE_ENABLED=true`).

### 5.5 Khách sau khi đặt

Theo dõi đơn thời gian thực, hủy khi còn chờ xác nhận, đánh giá đơn đã xong, báo vấn đề (`/api/orders/:id/issues`), tra cứu đơn không cần đăng nhập bằng SĐT + mã đơn, đổi điểm lấy quà ở tab Rewards.

### 5.6 Quản trị

Món và giá, voucher / khuyến mãi, người dùng (đổi role, khóa), giờ mở cửa và cấu hình phí giao (`store-settings`), duyệt khiếu nại, hoàn tiền, sổ shipper, báo cáo doanh thu và nhật ký thao tác (audit). Thay đổi lưu trong Firestore nên khách thấy sau tối đa khoảng 60 giây.

## 6. API backend (tóm tắt)

| Nhóm | Endpoint |
| --- | --- |
| Hệ thống | `GET /health`, `POST /api/webhooks/payos`, `POST /api/webhooks/ahamove` |
| Tài khoản | `/api/otp/send`, `/api/otp/verify`, `/api/auth/phone-login`, `/api/account/verify-email`, `/auth/*` (Google bridge) |
| Khách | `/api/orders/cash`, `/api/payments/payos`, `/api/orders/:id` (+ `cancel`, `review`, `issues`, `reconcile`), `/api/orders/lookup`, `/api/rewards`, `/api/rewards/redeem`, `/api/push/token` |
| Nhân viên | `/api/staff/orders` (+ `advance`, `reject`, `unassign-rider`) |
| Shipper | `/api/rider/orders`, `/api/rider/earnings`, `/api/rider/orders/:id/:action`, `/fail` |
| Admin | `/api/admin/store-settings`, `/riders/ledger`, `/riders/:uid/settle`, `/orders/:id/refunded`, `/issues`, `/audit` |

Có rate limit cho đăng nhập SĐT, OTP và tra cứu đơn.

## 7. Cấu hình

| File | Nội dung | Commit? |
| --- | --- | --- |
| `.env.development` | `EXPO_PUBLIC_API_URL` trỏ tới backend Render (không bí mật) | Có |
| `.env` (gốc) | `EXPO_PUBLIC_FIREBASE_*`, Google client ID (Firebase đã có giá trị mặc định trong code) | Không (`.env.example` là mẫu) |
| `backend/.env` | `PAYOS_*`, `SMTP_*`, `FIREBASE_WEB_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `STAFF_UIDS`, `AHAMOVE_*` | Không (`backend/.env.example` là mẫu) |
| Service account Firebase | Đặt **ngoài** repo, trỏ bằng `GOOGLE_APPLICATION_CREDENTIALS` | Không |

## 8. Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `npm start` | Chạy app (Expo Go), gọi backend Render qua `.env.development` |
| `npm run share` | Backend local + link công khai + Expo tunnel để cả nhóm quét QR test |
| `npm run dev:all` | Backend + Expo Go trên máy local |
| `npm run android:dev` | Emulator Android + backend + Expo Go |
| `npm run seed:firebase` hoặc `npm --prefix backend run seed:catalog` | Đồng bộ menu mẫu lên Firestore |
| `npm run test:app` / `npm --prefix backend test` | Test app / backend |
| `npm run test:rules` | Test Firestore rules (Firebase Emulator) |
| `npx expo lint`, `npx tsc --noEmit` | Lint, kiểm tra kiểu |

## 9. Hạn chế đã biết

- Expo Go không có push notification và Google Sign-In native; cần development build.
- payOS là tiền thật (không có sandbox), nên test nên dùng COD.
- Backend giữ trạng thái OTP và phiên Google bridge trong bộ nhớ: chạy nhiều instance hoặc khởi động lại sẽ mất.
- Backend chạy trên Render gói free (`https://pizza-fpt-backend.onrender.com`): ngủ sau ~15 phút không dùng, request đầu chậm 30–60 giây.
