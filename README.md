# Pizza FPT — Ứng dụng đặt pizza (Expo / React Native)

Ứng dụng đặt món trên di động, gồm app Expo Router và backend Node.js (Express + Socket.IO) dùng Firebase Auth/Firestore và payOS. Một app phục vụ **khách**, **nhân viên bếp**, **quản trị viên** và **shipper**.

## Chạy thử (dành cho cả nhóm)

Backend đã deploy trên Render, app trỏ sẵn tới đó qua `.env.development`. Không cần tạo file `.env`.

```bash
git fetch && git checkout feature/latest-features
npm install
npm start
```

Cài **Expo Go** trên điện thoại rồi quét mã QR. Lần đầu có thể chờ 30–60 giây vì Render gói free "ngủ"; mở `https://pizza-fpt-backend.onrender.com/health` để đánh thức (kết quả đúng: `{"ok":true}`).

Lưu ý khi test:
- Dữ liệu Firebase dùng chung cả nhóm; thanh toán QR payOS là tiền thật, hãy chọn **COD**.
- Expo Go không có push notification và Google Sign-In native (cần development build).

## Tài liệu

| File | Nội dung |
| --- | --- |
| [TEAM_GUIDE.md](TEAM_GUIDE.md) | Cách test cho nhóm, cách host chạy backend trên máy mình |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Kiến trúc, vai trò, luồng chính, API, cấu hình |
| [SYSTEM_FLOWS.md](SYSTEM_FLOWS.md) | Đặc tả nghiệp vụ chi tiết theo vai trò |
| [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md) | Kịch bản và test case kiểm thử thủ công |
| [docs/google-login.md](docs/google-login.md) | Cấu hình đăng nhập Google |
| [docs/ahamove.md](docs/ahamove.md) | Tích hợp Ahamove (staging, tùy chọn) |
| [backend/README.md](backend/README.md) | Backend: cấu hình và chạy |

## Công nghệ

Expo SDK 58, React Native 0.88, React 19, Expo Router, TypeScript · Backend Node ≥ 22, Express 5, Socket.IO, firebase-admin · Firebase Auth + Firestore (`pizzastore-59bad`) · payOS · Jest / `node:test`.

## Cấu trúc

```text
src/app/        Màn hình (Expo Router): (tabs), auth, checkout, order, profile, staff, rider, admin
src/services/   Gọi backend và Firebase
src/state/      Context: Auth, Cart, Orders, Favorites, Toast
src/utils/ components/ theme/ data/ types/
backend/        API, thanh toán, đơn hàng, OTP, shipper (backend/src), test (backend/test)
scripts/        share-test.mjs, dev-android.mjs, seed, kiểm tra Google
firestore.rules Quy tắc bảo mật Firestore (test trong firestore-tests/)
render.yaml     Deploy backend lên Render
```

## Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `npm start` | Chạy app (Expo Go), dùng backend Render |
| `npm run dev:all` | Backend local + Expo Go (cần `backend/.env`) |
| `npm run share` | Backend local + link công khai + Expo tunnel (host cho bạn bè quét QR) |
| `npm run android:dev` | Emulator Android + backend + Expo Go |
| `npm run seed:firebase` | Đồng bộ menu mẫu lên Firestore |
| `npm run test:app` · `npm --prefix backend test` | Test app · test backend |
| `npm run test:rules` | Test Firestore rules (Firebase Emulator) |
| `npx expo lint` · `npx tsc --noEmit` | Lint · kiểm tra kiểu |

## Cấu hình

- `.env.development` (có trong repo): URL backend công khai, không có bí mật.
- `.env`, `backend/.env` (không commit): khóa Firebase, payOS, SMTP. Xem `.env.example` và `backend/.env.example`.
- Service account Firebase đặt ngoài repo; trên Render dùng Secret File `firebase-service-account.json`.
- Muốn dùng backend trên máy mình: tạo `.env.development.local` với `EXPO_PUBLIC_API_URL=http://localhost:3001`.

## Deploy backend

`render.yaml` + `Dockerfile.backend` (Render Blueprint). Biến cần điền: `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `PAYOS_*`, `SMTP_USER`, `SMTP_PASS`, `ALLOWED_ORIGINS`, `STAFF_UIDS`, `PAYOS_RETURN_URL`/`PAYOS_CANCEL_URL` (theo URL Render) và Secret File service account. Đăng ký webhook payOS:

```bash
npm --prefix backend run webhook:register -- https://<tên-service>.onrender.com/api/webhooks/payos
```
