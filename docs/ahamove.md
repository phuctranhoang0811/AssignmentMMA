# Ahamove v3 — tích hợp staging

Luồng đã có: báo phí tại checkout → tạo đơn COD hoặc thanh toán payOS → nhân viên xác nhận/làm món → READY → gọi tài xế → webhook cập nhật Firestore → app theo dõi realtime.

Chỉ kết nối `https://partner-apistg.ahamove.com`. Không có chế độ production trong implementation này. Tạo tài khoản staging theo [hướng dẫn Ahamove](https://developers.ahamove.com/en/business/admin/integrations). Không dùng khóa production.

## 1. Chọn điểm lấy món mẫu

`src/data/mockStores.ts` chứa địa chỉ thực tế dùng làm dữ liệu demo:

| AHAMOVE_DEMO_STORE_ID | Điểm lấy mẫu |
| --- | --- |
| `demo-le-thanh-ton` (mặc định) | Pizza 4P’s Lê Thánh Tôn — 8/15 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM |
| `demo-ben-thanh` | Pizza 4P’s Bến Thành — 8 Thủ Khoa Huân, Bến Thành, Quận 1, TP.HCM |
| `demo-saigon-centre` | Pizza 4P’s Saigon Centre — Tầng 6, 65 Lê Lợi, Bến Nghé, Quận 1, TP.HCM |

Nguồn: [Lê Thánh Tôn](https://pizza4ps.com/vn/location/931/), [danh sách địa điểm chính thức](https://pizza4ps.com/vn/career_findjobs_post/?job_id=49705). Giữ cách ghi địa chỉ của nguồn. Đây không phải các chi nhánh Pizza FPT hoặc quan hệ hợp tác với nhà hàng. Không sử dụng số điện thoại nhà hàng thật: liên hệ lấy món mặc định là tài khoản Ahamove staging của bạn.

Một backend dùng một điểm lấy đang cấu hình. Đổi preset rồi lấy báo phí mới để thử địa điểm khác. Đơn đã chốt giữ nguyên địa chỉ, tên, số điện thoại và service ID tại thời điểm báo phí; chưa có chọn chi nhánh/gán cửa hàng gần nhất tự động.

## 2. Cấu hình

Điền trực tiếp trong `backend/.env`, theo `backend/.env.example`:

```dotenv
AHAMOVE_ENABLED=true
AHAMOVE_API_KEY=<khóa staging được Ahamove cấp>
AHAMOVE_ACCOUNT_MOBILE=<số tài khoản staging dạng 849xxxxxxxx>
AHAMOVE_SERVICE_ID=SGN-BIKE
AHAMOVE_WEBHOOK_SECRET=<chuỗi ngẫu nhiên ít nhất 32 ký tự>
AHAMOVE_STAFF_UIDS=<Firebase Auth UID nhân viên>,<UID quản lý>
AHAMOVE_DEMO_STORE_ID=demo-le-thanh-ton
```

`SGN-BIKE` là service ví dụ trong tài liệu; xác nhận service được cấp cho tài khoản staging. Có thể override `AHAMOVE_PICKUP_ADDRESS`, `AHAMOVE_PICKUP_NAME`, `AHAMOVE_PICKUP_MOBILE` nếu dùng cửa hàng riêng. Không đặt API key hoặc webhook secret trong biến `EXPO_PUBLIC_*`.

Trong `.env` gốc:

```dotenv
EXPO_PUBLIC_DELIVERY_PROVIDER=ahamove
```

Giữ cấu hình API URL/Firebase/payOS đang dùng. Khởi động lại backend và Expo sau khi đổi biến môi trường. Bỏ biến public để quay lại checkout cũ; `AHAMOVE_ENABLED=false` tắt endpoint giao hàng. Khi bật backend Ahamove, mọi checkout payOS DELIVERY mới phải có báo phí backend hợp lệ.

Quyền staff lấy từ danh sách UID phía server, không tin role từ app/Firestore profile. Profile có role EMPLOYEE/ADMIN/SUPER_ADMIN sẽ hiển thị nút “Bếp & giao Ahamove”; cũng có thể mở route `/staff/deliveries`. Không nằm trong allowlist thì API trả 403 dù mở được màn hình.

## 3. Firestore

Giữ catalog `products` đã seed để backend tính giá, thay vì tin giá gửi từ app.

Tạo composite index trong `backend/firestore.indexes.json` cho `orders`: `delivery.provider ASC`, `createdAt DESC`. Ghép vào cấu hình Firebase hiện có hoặc tạo index bằng link Firestore trả về nếu danh sách staff báo lỗi thiếu index. File index chưa tự triển khai lên cloud.

Ghép các ràng buộc sau vào **rules đang triển khai** trước khi dùng staging từ app kết nối Firebase thật:

- Client không đọc/ghi `delivery_quotes`, `delivery_operations`, `delivery_shipments`, `payment_orders`, `payment_codes`, `payment_system`.
- Đơn có trường `delivery` hoặc `deliveryQuoteId` chỉ backend Admin được tạo/cập nhật/xóa. Client chỉ đọc đơn thuộc `request.auth.uid == resource.data.userId`.
- Không cho client gắn trường giao hàng vào đơn legacy, xóa trường đó, hoặc sửa chủ đơn để vượt kiểm tra trên. Cả `resource.data` lẫn `request.resource.data` đều phải được kiểm tra khi update.
- Không cho khách ghi catalog giá bán. Quyền staff đọc danh sách trong bản này đi qua backend.

Lưu ý Firestore cộng quyền của các `match`: wildcard đang cho phép toàn bộ sẽ vô hiệu hóa deny riêng. Repo không có rules cloud thực tế; chưa xác minh hoặc deploy rules/index cloud trong lần thay đổi này.

## 4. Webhook

Đăng ký URL HTTPS công khai của backend:

```text
POST https://<backend>/api/webhooks/ahamove
Authorization: Bearer <AHAMOVE_WEBHOOK_SECRET>
```

Chọn BEARER-TOKEN trong Ahamove Portal. Webhook được đặt trước middleware Firebase, có xác thực riêng; không gửi Firebase ID token cho Ahamove. URL localhost hoặc `10.0.2.2` không nhận callback từ hãng. Tunnel Google Login hiện có chỉ forward route login, không dùng tunnel đó cho webhook giao hàng nếu chưa cấu hình route tương ứng.

Backend đọc lại chi tiết chuyến từ Ahamove, kiểm tra mã nội bộ tại điểm giao, rồi cập nhật transaction. Callback trùng/sai thứ tự không được phép làm lùi bước đã lấy món hoặc trạng thái cuối. Callback đến trước lúc lưu mã chuyến trả 503 để hãng gửi lại; nút kiểm tra chuyến giúp phục hồi nếu callback bị mất. Với một điểm giao, chỉ hoàn tất pizza khi `path[1].status == COMPLETED`, không chỉ dựa vào trạng thái chung của chuyến.

## 5. Thử luồng từ app

1. Đăng nhập Firebase thật; demo/guest chưa được đặt Ahamove. Thêm món, vào checkout, nhập địa chỉ nhận đầy đủ ở TP.HCM.
2. Chọn giao ngay, bỏ voucher, nhập liên hệ. Nhấn “Lấy phí”. Báo phí lưu 5 phút ở backend; đây là thời hạn do app áp dụng cho **ước tính**, không phải cam kết khóa giá từ Ahamove.
3. COD: backend ghi đơn và giữ tiền phải thu. payOS: tổng thanh toán gồm phí; chỉ sau khi xác nhận thanh toán mới xuất hiện đơn vận hành.
4. Dùng tài khoản trong `AHAMOVE_STAFF_UIDS`, mở Hồ sơ → Bếp & giao Ahamove. Xác nhận → bắt đầu làm món → món sẵn sàng → gọi tài xế staging.
5. Dùng công cụ testing/app tài xế staging được Ahamove cấp để nhận, lấy và giao món. App khách cập nhật qua Firestore, có nút đọc lại trạng thái chuyến.

Phí hãng dùng `BALANCE` do người gửi trả. COD thu tổng tiền khách đã xác nhận, gồm tiền món và phí app; payOS đã trả thì COD bằng 0. Mặc định cửa hàng chịu chênh lệch phí giữa ước tính và lúc đặt chuyến; backend giữ `actualFee` nếu response hãng có trường phí đó, không sửa tổng đã chốt.

Hoàn tất COD staging ghi `codCollectionStatus=COLLECTED_STAGING`; không tự đánh dấu đã nhận tiền thật hoặc đã đối soát về cửa hàng. Thanh toán payOS hiện tại vẫn là tích hợp payOS hiện có: Ahamove staging **không biến QR payOS thành giao dịch ngân hàng giả lập**.

Khi gọi tài xế bị timeout, cùng mã đơn chỉ được **tra cứu** chuyến cũ, không gửi lại POST tạo chuyến. Nếu chắc chắn thất bại mà chưa tìm thấy chuyến, cần đối chiếu portal/hỗ trợ trước khi reset operation bằng công cụ quản trị. Chưa có nút tự reset, hủy chuyến hay đặt lại chuyến đã hủy/giao thất bại.

## 6. API và kiểm thử

Import `backend/postman/ahamove.postman_collection.json`. Điền Firebase token khách/nhân viên và product/variant tồn tại. Các endpoint thông thường cần Firebase Bearer token:

| Endpoint | Công dụng |
| --- | --- |
| `POST /api/delivery/quotes` | `{ checkout, paymentMethod: COD hoặc PAYOS }` → báo phí và tổng backend |
| `POST /api/delivery/orders` | COD `{ quoteId }`, kèm `Idempotency-Key` |
| `POST /api/payments/payos` | Checkout kèm `deliveryQuoteId`, dùng key payOS đang có |
| `GET /api/delivery/staff/orders` | Staff: tối đa 50 đơn mới nhất |
| `POST /api/delivery/orders/:id/advance` | Staff: chuyển bước bếp |
| `POST /api/delivery/orders/:id/dispatch` | Staff: gọi/đối chiếu tài xế |
| `POST /api/delivery/orders/:id/refresh` | Chủ đơn hoặc staff: kiểm tra hãng |
| `POST /api/webhooks/ahamove` | Callback có Bearer secret riêng |

```powershell
npm test --prefix backend
npm run typecheck --prefix backend
npx tsc --noEmit
npx expo lint
```

Các test mới dùng HTTP thật trên localhost, provider giả lập và fixture transaction trong bộ nhớ. Không gọi Ahamove, payOS live hay Firestore cloud/emulator. Chưa kiểm chứng tài khoản staging, hạn mức COD, số dư và quá trình tài xế thật của staging. Chưa có giao hẹn giờ, voucher Ahamove, production, hoàn tiền hoặc tích hợp nhiều hãng.

Tài liệu đã đối chiếu: [Token](https://developers.ahamove.com/docs/api-reference/account-apis/authenticate-token), [ước tính phí](https://developers.ahamove.com/docs/api-reference/order-apis/estimate-order-fee), [tạo đơn](https://developers.ahamove.com/docs/api-reference/order-apis/create-order), [tra cứu mã nội bộ](https://developers.ahamove.com/docs/api-reference/order-apis/get-order-list-by-tracking-number), [trạng thái](https://developers.ahamove.com/docs/order-status-flow), [webhook](https://developers.ahamove.com/docs/webhook).
