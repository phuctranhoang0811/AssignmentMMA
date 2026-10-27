# Backend thanh toán payOS + Socket.IO

Ahamove v3 staging đã có báo phí, đơn COD/payOS, màn hình bếp, gọi tài xế và webhook. Xem [cấu hình và luồng thử Ahamove](../docs/ahamove.md). Tích hợp được bật riêng qua cấu hình; chưa có production Ahamove.

Google Login cho Expo Go đã được bổ sung tại `/auth/google` và `/auth/bridge/*`.
Xem [hướng dẫn cấu hình HTTPS, Firebase và điện thoại](../docs/google-login.md#test-trên-điện-thoại-với-expo-go).
Các endpoint này không dùng token payOS và không chuyển token qua URL.

Backend chạy riêng bằng Node.js, Express 5, Firebase Admin, payOS SDK 2 và Socket.IO 4. Checkout hiện chỉ có Tiền mặt và payOS; cả checkout chính và checkout nhiều bước đã được nối vào màn hình QR `/checkout/payos`.

## Cấu hình app Expo

Trong `.env` ở thư mục gốc, dùng `EXPO_PUBLIC_API_URL=http://localhost:3001` cho web và `EXPO_PUBLIC_ANDROID_API_URL=http://10.0.2.2:3001` cho Android Emulator. Điện thoại thật cần đổi URL sang IP LAN của máy chạy backend hoặc HTTPS. Khởi động lại Expo bằng `npx expo start --clear` sau khi thay đổi. Các biến này chỉ là URL công khai, không chứa khóa payOS. App cần đăng nhập Firebase thật và backend cần Firebase Admin hợp lệ.

Trên máy ảo Android 17, backend local còn cần quyền truy cập mạng cục bộ của Expo Go. App sẽ xin quyền khi thanh toán; chọn Allow trên hộp thoại hệ thống. Nếu từ chối, app hiển thị hướng dẫn cấp lại quyền thay vì chờ kết nối đến timeout. Backend HTTPS công khai không cần xin quyền mạng cục bộ.

Nhấn đặt đơn với payOS sẽ tạo payment `PENDING`, mở QR với số tiền server xác nhận và nhận `payment:updated`. Có nút mở trang payOS và nút đối soát khi chưa nhận được thông báo. Giỏ hàng được giữ đến khi thanh toán được xác nhận; nếu giỏ đã thay đổi thì không xóa giỏ mới. Key được lưu trên máy để retry không tạo trùng. Tiền mặt tiếp tục tạo đơn `UNPAID`; nếu ghi Firestore thất bại thì không hiển thị đặt đơn thành công.

Khi payOS chuyển sang PAID lần đầu, backend đồng thời tạo đơn trong `orders` với thông tin khách hàng và tổng tiền để màn hình theo dõi/tra cứu Firestore hiện có đọc được. Webhook lặp lại không tạo đơn mới. Lịch sử và theo dõi đơn cùng đọc collection `orders`, lọc theo tài khoản và cập nhật realtime. Điểm tích từ đơn hàng chưa được cộng tự động; số điểm hiện có trong hồ sơ được dùng cho đổi quà.

Coupon chưa hỗ trợ với payOS: app yêu cầu bỏ coupon hoặc chọn tiền mặt, không bỏ giảm giá một cách âm thầm. Giỏ hàng, COD và payOS dùng chung pricing: không cộng thêm thuế vào giá món và tạm không tính phí giao hàng đến khi tích hợp API giao hàng; màn hình QR hiển thị tổng chính thức trước khi khách chuyển tiền.

## Review hệ thống hiện tại

- `src/services/index.ts` export `mockOrderService`. Đơn hàng ở `src/services/mock/orderService.ts` được lưu trên AsyncStorage của từng máy, không phải database server.
- Mock service chỉ tạo đơn COD; gọi nhầm PAYOS vào mock sẽ bị từ chối. Hoàn tất đơn COD trong demo vẫn gán `PAID_DEMO`; trạng thái PAYOS không được cập nhật bởi thao tác demo.
- Nhánh payOS dùng key lưu trong AsyncStorage qua `payosService`; các URL checkout nhiều bước cũ chuyển về checkout chính để tránh tạo đơn trong mock service.
- UI và service đang dùng giá/mock coupon trong bộ nhớ. Backend mới đọc sản phẩm từ Firestore và tính lại tiền bằng hàm pricing dùng chung; không nhận `total`, `userId`, `paymentStatus` từ client.
- AuthContext có cả tài khoản demo và Firebase login. Đăng nhập bằng mật khẩu luôn dùng Firebase Auth trước khi đọc hồ sơ Firestore. Phiên cũ chỉ có user trong AsyncStorage nhưng không có Firebase session tương ứng sẽ yêu cầu đăng nhập lại. Tài khoản demo không thể thanh toán payOS.

## Luồng thanh toán

1. App đăng nhập Firebase, lấy ID token và gọi `POST /api/payments/payos` với `Idempotency-Key`.
2. Server xác thực user, kiểm tra giỏ hàng, đọc giá từ Firestore trong transaction, tạo đơn `PENDING` và orderCode duy nhất.
3. Server tạo link payOS và trả `payment.checkoutUrl`, `payment.qrCode` (chuỗi VietQR, không phải URL ảnh). App mở trang payOS hoặc render chuỗi này bằng thư viện QR.
4. Khách chuyển khoản bằng ứng dụng ngân hàng. payOS gọi `POST /api/webhooks/payos` qua HTTPS công khai.
5. Server dùng SDK kiểm tra chữ ký, kiểm tra orderCode, paymentLinkId, số tiền, rồi commit `PAID` và tạo `orders` trong cùng transaction Firestore. Webhook lặp lại không thay đổi `paidAt` hoặc tạo lại đơn.
6. Sau commit, server phát `payment:updated` vào room `user:<Firebase uid>`. Server tự chọn room từ token; client không có event để tự xác nhận thanh toán hoặc chọn room khác.
7. Sau khi reconnect hoặc quay lại app, đọc `GET /api/orders/:id`. Nếu webhook chưa đến, gọi `POST /api/orders/:id/reconcile` để hỏi payOS. Chỉ phản hồi từ provider đã xác thực với đủ tiền mới chuyển `PAID`.

`returnUrl` và `cancelUrl` chỉ phục vụ điều hướng; query string từ trình duyệt không cập nhật trạng thái tiền.

## Chạy local

Yêu cầu Node >= 22.13 và cài dependency của repo gốc trước vì backend dùng chung pricing/types trong `src/`.

```powershell
# Tại thư mục gốc (theo AGENTS.md)
npx expo install express socket.io firebase-admin @payos/node cors express-rate-limit zod tsx @types/express @types/cors @types/node socket.io-client --npm -- --prefix=backend
Copy-Item backend/.env.example backend/.env
# Điền backend/.env rồi chạy:
npm run dev --prefix backend
```

Điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` từ kênh thanh toán của bạn. `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file service account bên ngoài repo; môi trường cloud có thể dùng Application Default Credentials. Không dùng biến `EXPO_PUBLIC_*` cho các khóa này.

Nếu payOS trả mã `201` (signature không hợp lệ), đối chiếu lại `PAYOS_CHECKSUM_KEY` với đúng kênh của `PAYOS_CLIENT_ID` và `PAYOS_API_KEY` trên dashboard payOS, rồi khởi động lại backend. API trả HTTP 502 với `code: PAYOS_SIGNATURE_INVALID` để app báo lỗi cấu hình thay vì yêu cầu thử lại vô hạn. Không đưa khóa vào chat hoặc commit Git.

Backend cung cấp `/payment/return` và `/payment/cancel`. Hai trang chỉ hướng dẫn quay lại app để kiểm tra trạng thái, không xác nhận tiền từ query string. Với Android Emulator, có thể dùng `http://10.0.2.2:3001/payment/return` và `http://10.0.2.2:3001/payment/cancel`. Production dùng domain HTTPS thật; điện thoại thật dùng URL mà thiết bị truy cập được. `ALLOWED_ORIGINS` là danh sách origin cho web, phân tách bằng dấu phẩy. Native app vẫn phải gửi token.

Nếu chưa có file Firebase Admin: mở Firebase Console → Project settings → Service accounts → Firebase Admin SDK → Generate new private key. Lưu JSON bên ngoài repository rồi điền đường dẫn tuyệt đối vào `GOOGLE_APPLICATION_CREDENTIALS` trong `backend/.env`. Không dùng cấu hình Firebase của app thay cho service account. Backend kiểm tra file tồn tại và lấy access token trước khi mở cổng HTTP; lỗi cấu hình không in giá trị secret.

Quên mật khẩu: từ màn hình đăng nhập, chọn Quên mật khẩu và nhập email đã đăng ký. Firebase gửi liên kết để đặt mật khẩu mới trên trang xác thực; người dùng quay lại app và đăng nhập lại sau khi hoàn tất. Không dùng OTP giả hoặc cập nhật mật khẩu trong Firestore. Đổi mật khẩu trong hồ sơ cũng xác thực lại và cập nhật qua Firebase Auth.

Menu app hiện dùng `src/data/mockProducts.ts`, còn backend định giá từ Firestore. Sau khi kiểm tra `FIREBASE_PROJECT_ID` trong `backend/.env`, chạy `npm run seed:catalog --prefix backend` để bổ sung các món trong menu còn thiếu vào collection `products` bằng Firebase Admin. Lệnh chỉ tạo document thiếu, không ghi đè giá hoặc trạng thái sản phẩm đã được quản lý trên Firestore; chạy lại không tạo trùng. Nếu thiếu document (ví dụ `DR_02`), checkout trả 422 trước khi gọi payOS nên sẽ không có QR. Backend không tự seed khi khởi động và không dùng giá client gửi lên.

Trên payOS, cấu hình webhook `https://<backend-domain>/api/webhooks/payos`. Localhost phải được expose qua HTTPS. Có thể dùng Postman CLI nếu tài khoản đã đăng nhập:

```powershell
postman webhook create --title "Pizza payOS"
postman webhook forward <webhookId> 3001
# Đăng ký https://<webhookId>.webhook.pstmn.io/api/webhooks/payos trên payOS
```

Sau khi forwarding đang chạy, đăng ký URL với đúng kênh PayOS bằng SDK (khóa chỉ đọc từ `backend/.env`):

```powershell
cd backend
npm run webhook:register -- https://<webhookId>.webhook.pstmn.io/api/webhooks/payos
```

Lệnh chỉ báo thành công khi PayOS xác thực được URL bằng webhook mẫu có chữ ký. Mẫu không thuộc đơn hiện có sẽ được xác thực rồi bỏ qua, không tạo đơn thanh toán giả. Postman CLI cần `postman login` trước khi tạo/forward webhook. Giữ backend và forwarding chạy khi thử chuyển khoản; production dùng URL HTTPS backend luôn hoạt động. Không dùng `localhost` hoặc `10.0.2.2` làm Webhook URL trên PayOS.

Khi webhook hợp lệ commit `PAID`, Socket.IO tự chuyển màn hình QR sang giao diện thành công với dấu tích xanh, mã đơn, số tiền và nút Theo dõi đơn hàng. Không cần nhấn nút Kiểm tra thanh toán. Nếu mất socket, app đọc lại trạng thái mỗi 15 giây hoặc khi kết nối lại; khi quay lại từ ứng dụng ngân hàng, app đối soát thêm với PayOS. Sau xác nhận thành công, app ngừng gửi yêu cầu kiểm tra và bỏ qua lỗi từ yêu cầu cũ đang chạy. Không lấy `status=PAID` trong URL làm bằng chứng nhận tiền.

### Phiên thử local ngày 27/10/2026

Postman đã đăng nhập nhưng cả hai workspace hiện có từ chối quyền webhook. Phiên này dùng Cloudflare Quick Tunnel thay thế. PayOS đã gửi mẫu có chữ ký, backend chấp nhận và SDK xác nhận đăng ký thành công URL:

`https://centered-regional-foundations-belief.trycloudflare.com/api/webhooks/payos`

Giữ backend cổng 3001 và tiến trình cloudflared đang chạy khi thử thanh toán. URL này chỉ dùng cho phiên thử, ngừng hoạt động khi tắt đường hầm. Khi cần chạy lại, mở hai terminal:

```powershell
# Terminal 1, tại thư mục gốc dự án
npm start --prefix backend

# Terminal 2, binary chính thức đã tải vào thư mục TEMP của máy hiện tại
& "$env:TEMP\pizza-cloudflared.exe" tunnel --url http://127.0.0.1:3001 --no-autoupdate
```

Cloudflare in URL mới sau mỗi lần tạo đường hầm; trong terminal thứ ba, vào `backend` và chạy `npm run webhook:register -- https://<hostname-moi>.trycloudflare.com/api/webhooks/payos` trước khi thử thanh toán. Production cần domain HTTPS cố định. Đã xác minh đường nhận webhook từ PayOS thật; chưa kiểm chứng giao dịch chuyển tiền ngân hàng và màn hình thành công bằng thanh toán thật.

## Hợp đồng REST

Ngoài `/health` và webhook (xác thực bằng signature), mọi API cần `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Kết quả |
| --- | --- | --- |
| GET | `/health` | `{ "ok": true }`, kiểm tra tiến trình HTTP |
| POST | `/api/payments/payos` | Tạo/tái sử dụng đơn và link thanh toán |
| GET | `/api/orders/:id` | Snapshot thanh toán của chính user |
| POST | `/api/orders/:id/reconcile` | Đối soát payOS; có thêm `providerStatus` |
| POST | `/api/webhooks/payos` | Payload payOS chuẩn + chữ ký, trả `{ "success": true }` |

POST tạo thanh toán cần `Idempotency-Key`: 16–128 ký tự chữ, số, `_` hoặc `-`. Giữ nguyên key và payload khi retry, kể cả sau timeout. Cùng key nhưng payload thay đổi trả 409. Khóa được giới hạn theo user. Cả orderCode và liên kết được lưu bền vững, không phụ thuộc bộ nhớ process.

`needCutlery` là boolean tùy chọn trong body checkout. App lưu lựa chọn muỗng nĩa cùng giỏ hàng và gửi cho cả COD và PayOS. Backend lưu lựa chọn vào đơn `orders` sau khi nhận tiền; nếu không truyền thì hiểu là không lấy muỗng nĩa. Thay đổi lựa chọn là thay đổi checkout, nên app tạo attempt mới thay vì ghi đè đơn đã tạo.

Ví dụ body:

```json
{
  "customer": { "fullname": "Nguyen Van A", "phone": "0901234567" },
  "fulfillmentType": "PICKUP",
  "items": [{ "lineId": "line-1", "productId": "<Firestore product ID>", "variantId": "small", "addonIds": [], "quantity": 1 }]
}
```

`DELIVERY` cần `address`; sản phẩm có variants cần `variantId`. `customization` dùng cấu trúc `PizzaCustomizationState` hiện tại, size phải khớp variant, topping và tùy chọn phải nằm trong bảng giá server. `promoCode` hiện chưa hỗ trợ và trả 400, vì chưa có chính sách coupon tin cậy trên server. Không gửi `paymentMethod`, `userId` hoặc `idempotencyKey` trong body: endpoint này chỉ dành cho payOS, user lấy từ token, key lấy từ header.

Response và event dùng chung snapshot:

```json
{
  "id": "<64-character ID>",
  "orderCode": 1234567890,
  "paymentStatus": "PENDING",
  "total": 100000,
  "pricing": { "subtotal": 100000, "discount": 0, "deliveryFee": 0, "tax": 0, "total": 100000 },
  "items": [],
  "createdAt": "2026-10-27T00:00:00.000Z",
  "paidAt": null,
  "payment": { "paymentLinkId": "...", "checkoutUrl": "https://pay.payos.vn/web/...", "qrCode": "000201..." }
}
```

Nếu khôi phục link sau timeout/crash, `qrCode` có thể là `null`; app mở `checkoutUrl`. Nếu webhook đến trước khi lưu link, snapshot có thể đã `PAID` với `payment: null`; xử lý trạng thái thanh toán trước.

Lỗi: 400 body/key sai; 401 token/signature sai; 404 đơn không tồn tại hoặc không thuộc user; 409 key hoặc thanh toán không khớp; 422 sản phẩm/tùy chọn/số tiền không hợp lệ; 429 giới hạn request; 502 provider không khả dụng, retry cùng key. API không trả secret hoặc thông tin customer qua socket.

## Nối Socket.IO từ app

App đã tích hợp qua `src/services/payosService.ts` và `src/app/checkout/payos.tsx`. Ví dụ rút gọn của kết nối socket:

```ts
const socket = io(API_BASE_URL, {
  auth: async callback => callback({ token: await auth.currentUser?.getIdToken() }),
});
socket.on('payment:updated', snapshot => {
  if (snapshot.id === currentOrderId && snapshot.paymentStatus === 'PAID') {
    // Cập nhật state và điều hướng qua Expo Router.
  }
});
socket.on('connect', () => refreshPaymentById(currentOrderId));
```

Đọc lại trạng thái khi app trở lại foreground, và có nút đối soát khi chờ lâu. Khi token hết hạn, server chủ động disconnect; lấy token mới và reconnect. Gỡ listener và `disconnect()` khi logout hoặc rời luồng thanh toán. Không tạo socket mới mỗi render.

Checkout đã dùng PAYOS và PAID thật, lưu order ID + key để retry và chỉ hiển thị thanh toán thành công khi server trả PAID. API trả snapshot thanh toán riêng, không phải `Order` đầy đủ của mock service, nên không ép kiểu trực tiếp thành `Order`. Backend hiện chưa quản lý trạng thái bếp/giao hàng, COD, hủy link hoặc hoàn tiền.

## Firestore và triển khai

Backend ghi vào `payment_orders`, `payment_codes`, `payment_system`. Cần khóa quyền truy cập trực tiếp của client vào cả ba collection và khóa quyền ghi `products` cho khách hàng. Firebase Admin dùng IAM, bỏ qua client Security Rules. Ghép các điều kiện sau vào rules thật của project trước khi dùng tiền thật:

```text
match /payment_orders/{id} { allow read, write: if false; }
match /payment_codes/{id} { allow read, write: if false; }
match /payment_system/{id} { allow read, write: if false; }
```

Firestore cộng quyền của các `match`: nếu đang có wildcard `allow read, write: if true`, phải sửa wildcard đó; thêm deny riêng không chặn được quyền allow khác. Repo không có rules đang triển khai, nên lần này chưa xác minh hoặc thay đổi rules cloud.

Một instance backend hỗ trợ luồng hiện tại. Nhiều instance cần Socket.IO adapter dùng chung (ví dụ Redis) để webhook và socket ở instance khác nhau vẫn nhận event; polling transport cần cấu hình sticky sessions. Dù mất event, dữ liệu vẫn đọc lại từ Firestore. Backend chưa có job đối soát định kỳ; app có API reconcile để khôi phục. Thanh toán thiếu/thừa tiền bị từ chối đối chiếu và cần xử lý vận hành riêng; không tự hoàn tiền.

## Kiểm thử

```powershell
npm test --prefix backend
npm run typecheck --prefix backend
npx tsc --noEmit
npx expo lint
```

Test chạy HTTP/Socket.IO thật trên localhost, dùng store và provider request giả lập; chữ ký webhook được tạo/xác thực bằng SDK payOS thật với khóa test và payload theo ví dụ chính thức. Chưa kiểm thử giao dịch ngân hàng, payOS live hoặc transaction Firestore với emulator/cloud. Import `postman/payos.postman_collection.json` để thử API khi đã cấu hình backend; điền Firebase token thật và product ID của project.

Tài liệu đối chiếu: [payOS SDK Node](https://github.com/payOSHQ/payos-lib-node), [payOS API](https://payos.vn/docs/api/), [payOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/), [Socket.IO middleware](https://socket.io/docs/v4/middlewares/), [Firebase verify ID token](https://firebase.google.com/docs/auth/admin/verify-id-tokens).


## Đổi quà

Cần khởi động lại backend sau khi cập nhật. Tài khoản demo chỉ xem danh sách; đổi quà yêu cầu Firebase ID token của tài khoản thật.

- `GET /api/rewards`: trả `{ points, gifts }` của tài khoản trong token.
- `POST /api/rewards/redeem`: body `{ "rewardId": "R01" }`, header `Idempotency-Key` dài 16–128 ký tự gồm chữ, số, `_`, `-`. Không nhận giá điểm hoặc userId từ client.
- Giá điểm lấy từ `src/data/rewards.ts`. Giao dịch Firestore cập nhật `users/{uid}.rewardPoints` và tạo `users/{uid}/reward_gifts/{key}` cùng lúc. Retry cùng key không trừ điểm thêm; cùng key cho quà khác trả 409.
- App giữ key khi mất mạng và đối chiếu với quà đã nhận khi tải lại. 400/404/409 là lỗi xác định; không giữ key để chặn lần đổi tiếp theo.
- Rules Firestore ở môi trường triển khai phải chặn client ghi `rewardPoints` và `reward_gifts`; chỉ backend Admin cấp/trừ điểm và tạo quà. Không có rules triển khai trong repo này; cần kiểm tra cấu hình Firebase hiện tại trước khi phát hành.
- Mã quà đã đổi được hiển thị trong Quà của tôi và lịch sử. Việc sử dụng quà tại cửa hàng chưa có luồng xác nhận riêng.

Kiểm tra: `npm test` và `npm run typecheck` trong thư mục backend.
