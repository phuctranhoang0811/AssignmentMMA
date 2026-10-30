# Hướng dẫn test cho nhóm — Pizza FPT

## Cách nhanh nhất: pull code và chạy (backend đã deploy trên Render)

```bash
git fetch && git checkout feature/latest-features
npm install
npm start
```

Quét mã QR bằng **Expo Go**. Không cần tạo file `.env`: `.env.development` đã trỏ app tới backend `https://pizza-fpt-backend.onrender.com`.

- Gói free của Render ngủ sau ~15 phút không dùng: lần đầu mở app (hoặc đăng ký/đặt đơn) có thể chờ 30–60 giây. Mở `https://pizza-fpt-backend.onrender.com/health` trước để đánh thức.
- Muốn chạy backend trên máy mình thay vì Render: cần `backend/.env` và service account (hỏi chủ dự án), tạo `.env.development.local` với `EXPO_PUBLIC_API_URL=http://<IP máy>:3001`, rồi `npm run dev:all`.

---

## Cách dự phòng: host chạy backend trên máy mình

Backend (thanh toán, OTP email, đơn hàng) cần khóa bí mật nên **chỉ chạy trên máy của chủ dự án**. Mọi người khác chỉ cần điện thoại + Expo Go.

## Người host (máy có `backend/.env` và file service account Firebase)

Làm một lần:

```bash
npm install
npm --prefix backend install
winget install --id Cloudflare.cloudflared --exact   # chỉ Windows, rồi mở terminal mới
```

Mỗi lần cho nhóm test:

```bash
npm run share
```

Lệnh này tự làm: tạo link HTTPS công khai cho backend, chạy backend với link đó, đăng ký webhook payOS, rồi mở Expo ở chế độ tunnel và in mã QR. **Giữ terminal mở** trong lúc nhóm test; Ctrl+C là dừng tất cả.

- Cùng Wi-Fi, không cần tunnel của Expo: `npm run share -- --lan`
- Không đụng webhook payOS: `npm run share -- --no-webhook`
- Backend lỗi: xem `.expo/share-backend.log`.
- Đã có backend chạy sẵn ở cổng 3001 (`npm run dev`)? Tắt nó trước, vì backend cần nhận link công khai mới.
- Đăng nhập Google trong Expo Go: thêm hostname `*.trycloudflare.com` mà script in ra vào Firebase → Authentication → Settings → Authorized domains (đổi mỗi lần chạy). Đăng ký/đăng nhập bằng email hoặc SĐT không cần bước này.

## Bạn bè trong nhóm

1. Cài **Expo Go** (Google Play / App Store).
2. Quét mã QR host gửi (iPhone: quét bằng app Camera).
3. Đăng ký tài khoản mới (mã OTP gửi về email thật của bạn) rồi test theo [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md).

## Lưu ý khi test

- Dữ liệu là Firebase `pizzastore-59bad` **dùng chung**: đơn, tài khoản bạn tạo ai cũng thấy. Đặt tên rõ ràng, đừng xóa dữ liệu của người khác.
- Thanh toán QR payOS là **tiền thật**. Khi test hãy chọn thanh toán khi nhận hàng (COD).
- Expo Go không nhận được thông báo đẩy (push) và không có Google Sign-In native; các phần này cần development build (`npm run dev:all:client`).
- Tài khoản nhân viên / admin / shipper: host gán `role` trong Firestore `users/{uid}` (xem bảng 1.2 trong TEST_CHECKLIST).
- Admin mới cần deploy rules và seed menu một lần: `npx firebase-tools deploy --only firestore:rules`, `npm run seed:firebase`.
