# Pizza FPT — Luồng hệ thống và test case kiểm thử thủ công

Cập nhật: 29/10/2026, nhánh `feature/firebase-auth-database` (sau khi gộp `feature/staff-confirm-order` và `feature/admin`, commit `3e7bb7f`).

Tài liệu mô tả **code hiện có**. Mỗi test case ghi kết quả vào cột **KQ**: `PASS` / `FAIL` / `BLOCKED`. Khi FAIL, ghi: nền tảng (Android/iOS/web), tài khoản (không ghi mật khẩu), mã đơn, bước tái hiện, kết quả thật, log terminal backend.

Kiểm tra tự động hiện tại: lint 0 lỗi/0 cảnh báo, TypeScript app + backend sạch, **95/95** test backend pass, và **12/12** test Firestore rules trên Firebase Emulator. Test tự động dùng Firestore giả lập và provider giả lập — **không** thay thế các test thủ công dưới đây.

---

## 1. Chuẩn bị

### 1.1 Việc phải làm một lần

| # | Việc | Lệnh / cách làm | Kiểm tra |
| --- | --- | --- | --- |
| P1 | Deploy Firestore rules (admin cần quyền mới) | `npx firebase-tools deploy --only firestore:rules` | Console Firebase → Firestore → Rules có hàm `isAdmin()` |
| P2 | Đồng bộ catalog + sửa ảnh hỏng | `npm --prefix backend run seed:catalog` | Terminal in `repaired images ST_04, PA003` (lần sau in `none`) |
| P3 | Gán role cho tài khoản test | Firebase Console → `users/{uid}` → field `role` | Xem bảng tài khoản 1.2 |
| P4 | (Tùy chọn) nhận OTP qua Gmail | `SMTP_USER`, `SMTP_PASS` trong `backend/.env` | Không có SMTP: backend dev in `[OTP dev] email: 1234` ra terminal |
| P5 | Đăng nhập bằng SĐT | `FIREBASE_WEB_API_KEY` trong `backend/.env` | Thiếu thì đăng nhập SĐT báo lỗi cấu hình |
| P6 | Giữ chỗ SĐT cho tài khoản cũ (mỗi số một tài khoản) | `npm --prefix backend run backfill:phones` | In số SĐT đã giữ chỗ; danh sách số đang bị nhiều tài khoản dùng chung cần admin xử lý |

### 1.2 Tài khoản test

| Ký hiệu | Role trong `users/{uid}` | Dùng để |
| --- | --- | --- |
| **A** | `USER` | Khách chính: đặt đơn, hủy, điểm, đổi quà |
| **B** | `USER` | Khách thứ 2: kiểm tra không thấy dữ liệu của A |
| **S** | `EMPLOYEE` | Nhân viên bếp: portal `/staff/orders` |
| **M** | `SUPER_ADMIN` (hoặc `ADMIN`, `STORE_MANAGER`) | Admin: portal `/admin` |
| **X** | `USER` → sẽ bị admin khóa | Kiểm tra khóa tài khoản |

Nên dùng 2 trình duyệt/thiết bị riêng: một cho khách, một cho S hoặc M.

### 1.3 Chạy hệ thống

```powershell
# Terminal 1 — backend (mặc định cổng 3001)
npm run dev --prefix backend

# Terminal 2 — app (chọn một)
npm run dev        # Expo Go trên điện thoại
npm run web        # trình duyệt
```

- Kiểm tra backend: mở `http://localhost:3001/health` → `{"ok":true}`.
- Điện thoại phải gọi được địa chỉ backend trong `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_ANDROID_API_URL`. Sửa biến `EXPO_PUBLIC_*` xong phải restart Expo.
- Android emulator: `adb reverse tcp:3001 tcp:3001` để emulator gọi `localhost:3001`.

---

## 2. Luồng hệ thống

### 2.1 Vai trò và màn hình sau đăng nhập

```
Mở app ─► Splash
           ├─ chưa đăng nhập ─► Welcome ─► Trang chủ (khách vãng lai)
           └─ đã đăng nhập ─► theo role:
                 SUPER_ADMIN / ADMIN / STORE_MANAGER ─► /admin/dashboard
                 EMPLOYEE / ROLE_KITCHEN / ROLE_RIDER  ─► /staff/orders
                 USER (và role khác)                   ─► Trang chủ
```

| Vai trò | Làm được | Không làm được |
| --- | --- | --- |
| Khách vãng lai | Xem menu, tùy chỉnh pizza, thêm giỏ, áp voucher, tra cứu đơn bằng SĐT + mã đơn | Đặt hàng (bị yêu cầu đăng nhập, giỏ được giữ) |
| USER | Đặt COD/payOS, theo dõi đơn của mình, hủy khi còn chờ xác nhận, tích điểm, đổi quà | Xem đơn người khác, tự đổi role/điểm |
| Nhân viên (S) | Portal bếp: xác nhận → làm → sẵn sàng → giao/khách nhận; từ chối đơn | Trang admin |
| Admin (M) | SUPER_ADMIN/ADMIN: mọi thứ của nhân viên + dashboard, sửa món/giá, voucher, phân quyền/khóa user, hủy đơn, xác nhận hoàn tiền, báo cáo. STORE_MANAGER: như trên nhưng **không** phân quyền/khóa user | Đổi role của chính mình; ADMIN không cấp/gỡ quyền ADMIN, SUPER_ADMIN; sửa điểm thưởng; ghi trực tiếp vào đơn |
| Bị khóa (`BLACKLISTED`) | Đăng nhập, xem đơn cũ | Đặt đơn, tạo thanh toán, lấy phí Ahamove, đổi quà (backend trả 403) |

Quyền thật nằm ở **backend + Firestore rules**, không phải ở giao diện. Backend nhận nhân viên khi role là nhân viên/admin **hoặc** UID nằm trong `STAFF_UIDS`.

### 2.2 Luồng đặt hàng

```
Menu ─► Chi tiết món (size/đế/topping) ─► Giỏ (voucher) ─► [chưa đăng nhập → Đăng nhập → quay lại Checkout]
     ─► Checkout: thông tin, nhận tại quầy / giao hàng, giờ hẹn, ghi chú
         ├─ Tiền mặt (COD) ─► POST /api/orders/cash ─► đơn PENDING_CONFIRMATION, UNPAID
         └─ payOS          ─► POST /api/payments/payos ─► QR ─► webhook/kiểm tra ─► PAID ─► đơn PENDING_CONFIRMATION
```

- **Giá do backend tính lại** từ Firestore `products` + `coupons`; app hiển thị cùng nguồn dữ liệu đó.
- Voucher chỉ dùng với COD thường; payOS và Ahamove chưa hỗ trợ voucher.
- Tổng tiền = tiền món (size + đế + topping + addon) − voucher. Không cộng VAT, không cộng phí giao thường. Ahamove có phí riêng.

### 2.3 Trạng thái đơn

```
PENDING_CONFIRMATION ─► CONFIRMED ─► PREPARING ─► READY ─┬─(nhận tại quầy)──────────────► COMPLETED
         │                  │             │          │   └─(giao thường)─► OUT_FOR_DELIVERY ─► COMPLETED
         │                  └─────────────┴──────────┴─► CANCELLED (nhân viên/admin từ chối)
         └─► CANCELLED (khách tự hủy — chỉ ở bước này)
```

| Quy tắc | Chi tiết |
| --- | --- |
| Khách hủy | Chỉ khi `PENDING_CONFIRMATION` và là chủ đơn |
| Staff/admin từ chối | Trước `OUT_FOR_DELIVERY`, và chưa gọi tài xế Ahamove |
| Hủy đơn đã trả tiền | `paymentStatus` → `REFUND_PENDING`; admin hoàn tiền thủ công rồi bấm xác nhận → `REFUNDED` |
| Điểm thưởng | Khi `COMPLETED`: cộng `floor(total / 10000)` **đúng một lần**; đơn hủy không cộng |
| Ahamove | Sau `READY`, trạng thái do tài xế/webhook Ahamove cập nhật |

### 2.4 Admin thay đổi → khách thấy gì

| Admin làm | Lưu ở | Khách thấy |
| --- | --- | --- |
| Sửa tên/mô tả/giá theo size, bật/tắt còn hàng | `products/{id}` | Menu, giỏ, checkout sau tối đa ~60 giây (hoặc mở lại app); backend tính tiền theo giá mới ngay |
| Thêm món | `products/{id mới}` | Món xuất hiện trong menu |
| Xóa món | xóa `products/{id}` | Món biến mất khỏi menu |
| Tạo/xóa voucher | `coupons/{CODE}` | Trang Ưu đãi, ô nhập mã ở giỏ/checkout; backend chấp nhận mã |
| Đổi role / khóa user | `users/{uid}.role` | App của user nhận role mới ngay khi đang mở; tài khoản khóa không đặt được đơn |

---

## 3. Kịch bản kiểm thử nhanh (smoke test, ~20 phút)

Chạy theo thứ tự; nếu bước nào FAIL thì dừng và ghi lỗi.

| # | Ai | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- | --- |
| 1 | Vãng lai | Mở app → Menu → thêm 1 pizza → Giỏ | Giỏ có món, nút "Đăng nhập để thanh toán" | |
| 2 | Vãng lai → A | Bấm nút đó → đăng nhập A | Về thẳng Checkout, giỏ giữ nguyên | |
| 3 | A | Nhận tại quầy, Tiền mặt, đặt hàng | Có mã `PF-...`, giỏ được xóa, đơn ở "Đang xử lý" | |
| 4 | S | Đăng nhập S | Tự vào `/staff/orders`, đơn ở tab "Chờ duyệt" | |
| 5 | S | Xác nhận → Bắt đầu làm món → Món đã sẵn sàng → Khách đã nhận món | Đơn qua tab "Bếp & Giao" rồi "Đã xong" | |
| 6 | A | Xem đơn | Timeline cập nhật; đơn sang "Lịch sử"; điểm tăng `floor(tổng/10000)` | |
| 7 | M | Đăng nhập M → Khuyến mãi → tạo mã `TEST50K`, giảm cố định 50.000đ, đơn từ 100.000đ | Báo thành công, mã có trong danh sách | |
| 8 | A | Giỏ mới ≥ 100.000đ → nhập `TEST50K` → đặt COD | Giảm 50.000đ ở giỏ và checkout; tổng đơn backend khớp | |
| 9 | M | Món ăn → mở 1 pizza → đổi giá size Vừa +10.000đ → lưu | Báo "Đã lưu thông tin món ăn và giá theo size" | |
| 10 | A | Mở lại app → món đó size Vừa | Giá mới; đặt COD thì tổng đơn theo giá mới | |
| 11 | M | Người dùng → khóa X | Nhãn "Đã khóa" | |
| 12 | X | Đăng nhập X → đặt COD | Báo "Tài khoản đã bị khóa đặt hàng..."; không tạo đơn | |
| 13 | M | Mở khóa X; xóa `TEST50K`; trả giá món về cũ | Dữ liệu trở lại như ban đầu | |

---

## 4. Test case chi tiết

### A. Tài khoản, đăng nhập, phân quyền

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| A01 | Lần đầu mở app, chưa đăng nhập | Vào Welcome → Trang chủ lời chào "Chào mừng bạn đến Pizza FPT"; không tự đăng nhập tài khoản demo | |
| A02 | Đăng ký: nhập email → gửi OTP → nhập sai → nhập đúng | Mã sai bị từ chối; mã đúng chuyển sang bước hồ sơ | |
| A03 | Gửi lại OTP trong 30 giây; nhập mã sau 5 phút; nhập sai 5 lần | Báo chờ gửi lại; mã hết hạn; khóa sau 5 lần sai, phải lấy mã mới | |
| A04 | Đăng ký thiếu tên/SĐT, SĐT sai, mật khẩu yếu, xác nhận không khớp, không tick điều khoản | Không đăng ký được, báo đúng lỗi (web hiện hộp thoại) | |
| A05 | Đăng ký hợp lệ | Tạo tài khoản role `USER`, 100 điểm; đăng nhập được | |
| A06 | Đăng nhập email → đăng xuất → đăng nhập bằng SĐT + cùng mật khẩu | Cùng tài khoản; sai mật khẩu không vào được; SĐT không tồn tại và sai mật khẩu báo **cùng** một thông báo | |
| A07 | Google trên web: chọn Gmail; đóng popup | Gmail đăng nhập được; đóng popup không báo thành công | |
| A08 | Đóng/mở lại app sau khi đăng nhập; đăng xuất rồi mở lại | Giữ phiên; sau đăng xuất không tự vào lại | |
| A09 | Quên mật khẩu → nhập email | Firebase gửi mail đặt lại; đăng nhập bằng mật khẩu mới được | |
| A10 | Đổi mật khẩu: sai mật khẩu cũ / mật khẩu mới yếu / đúng | Sai bị từ chối; đúng thì mật khẩu mới dùng được. Tài khoản chỉ Google không có mục đổi mật khẩu | |
| A11 | Đăng nhập S (EMPLOYEE) | Vào `/staff/orders` | |
| A12 | Đăng nhập M (SUPER_ADMIN) | Vào `/admin/dashboard`; Hồ sơ có cả "Bảng Quản trị Hệ thống" và mục quản lý đơn bếp | |
| A13 | A (USER) gõ `/admin/dashboard` | Bị đưa về Trang chủ | |
| A14 | Vãng lai hoặc A mở `/staff/orders` | Màn "Khu Vực Dành Cho Nhân Viên" + nút đăng nhập | |
| A15 | Tài khoản có email chứa `admin@` nhưng role `USER` | Vẫn là khách thường (quyền theo role, không theo email) | |
| A16 | Đăng ký bằng SĐT đã có tài khoản khác dùng | Báo "Số điện thoại này đã được dùng cho tài khoản khác"; không tạo tài khoản, email đó đăng ký lại được | |
| A17 | Đăng ký nhập SĐT `+84 912 345 678` | Hồ sơ lưu `0912345678`; đăng nhập bằng cả 2 cách viết đều được | |
| A18 | Hai tài khoản cũ cùng một SĐT → mỗi người đăng nhập bằng SĐT + mật khẩu của mình | Cả hai đều vào đúng tài khoản của mình |

### B. Menu, chi tiết món, giỏ hàng

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| B01 | Duyệt các danh mục; tìm theo tên/nguyên liệu; tìm từ không có | Kết quả đúng; có trạng thái rỗng | |
| B02 | Pizza: đổi size/đế/sốt, thêm topping, cay, cách nướng, cắt | Giá đổi đúng; tổng topping tối đa 5 phần; đế không hỗ trợ size bị bỏ khi đổi size | |
| B03 | Combo trong danh mục pizza → thêm giỏ → đặt | Không bắt đi qua màn tùy chỉnh pizza; đặt được | |
| B04 | Tăng/giảm số lượng ở chi tiết và giỏ | Trong khoảng 1–20; tiền cập nhật | |
| B05 | Thêm cùng cấu hình 2 lần; thêm cùng món khác cấu hình | Cùng cấu hình gộp 1 dòng; khác cấu hình thành dòng riêng | |
| B06 | Sửa món trong giỏ (đổi size/topping) → lưu | Thay dòng cũ, không nhân đôi | |
| B07 | Xóa dòng → Hủy; xóa thật; xóa dòng cuối | Hủy không mất món; giỏ trống có nút về Menu | |
| B08 | Đóng/mở app khi giỏ có món + voucher | Giỏ và voucher còn nguyên | |
| B09 | Thả tim → Yêu thích; đăng xuất A → đăng nhập B | B không thấy yêu thích của A | |
| B10 | Mở `/product/KHONG_TON_TAI` | Màn "không tìm thấy", không crash | |
| B11 | Món `ST_04`, `PA003` (sau bước P2) | Có ảnh thật, không phải ảnh dự phòng | |
| B12 | Áp `PIZZAFPT` (−40k, đơn từ 100k), `FPT40` (−40k, từ 200k), `PIZZA20` (−20% tối đa 50k, từ 200k), mã sai, đơn dưới ngưỡng | Giảm đúng; mã sai báo không hợp lệ; dưới ngưỡng báo cần tối thiểu | |
| B13 | Giỏ 498.000đ + `FPT40` → checkout COD | Tổng 458.000đ, không cộng VAT/phí giao | |
| B14 | Trang Ưu đãi | Liệt kê mã có sẵn **và** mã admin tạo | |
| B15 | A đặt COD với `PIZZA20` → đặt đơn khác cũng `PIZZA20` | Đơn 2 báo "Bạn đã dùng mã PIZZA20 rồi" | |
| B16 | A hủy đơn đã dùng `PIZZA20` (khi còn chờ xác nhận) → đặt lại với `PIZZA20` | Dùng lại được (hủy đơn trả lại lượt) | |
| B17 | Tài khoản mới dùng `WELCOME30` cho đơn đầu; tài khoản đã có đơn dùng `WELCOME30` | Đơn đầu được giảm; tài khoản đã có đơn (không tính đơn đã hủy) bị từ chối "chỉ áp dụng cho đơn hàng đầu tiên" | |
| B18 | Mã đã hết hạn (admin tạo rồi sửa hạn trong Console về ngày cũ) | Không còn trên trang Ưu đãi; nhập mã báo không hợp lệ; backend báo "đã hết hạn" | |

### C. Checkout và đơn tiền mặt (COD)

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| C01 | Vãng lai bấm thanh toán ở giỏ → đăng nhập | Về Checkout với giỏ cũ; bấm back ở màn đăng nhập về Giỏ | |
| C02 | Bỏ trống tên/SĐT, email sai, giao hàng thiếu địa chỉ, chưa đồng ý điều khoản | Không gửi đơn, báo rõ chỗ cần sửa | |
| C03 | Chọn giờ hẹn rồi để quá giờ mới đặt | Yêu cầu chọn lại giờ (cửa hàng 10:30–21:30, chuẩn bị 45 phút) | |
| C04 | COD nhận tại quầy | Mã `PF-...`, đơn `PENDING_CONFIRMATION`, `UNPAID`, giỏ xóa sau khi backend xác nhận | |
| C05 | COD giao thường có địa chỉ, ghi chú, dụng cụ ăn, voucher | Đơn lưu đủ thông tin; tổng theo backend | |
| C06 | Pizza có topping + addon + ghi chú "Không hành" → COD → S xem đơn | S thấy đủ size, đế, topping, addon, ghi chú bếp | |
| C07 | Bấm "Đặt hàng" liên tục nhiều lần | Chỉ một đơn được tạo | |
| C08 | Tắt backend → đặt → bật lại → đặt lại | Lần đầu báo lỗi, giỏ còn; lần sau tạo đúng một đơn | |
| C09 | Thông tin khách điền sẵn khi đã đăng nhập | Tên/SĐT/email của tài khoản; không có dữ liệu người khác | |
| C10 | Món trong giỏ → M tắt "Đang bán" món đó → A đặt COD | Báo tiếng Việt: Món "…" hiện đã hết hoặc ngừng bán, kèm tên món; không tạo đơn | |
| C11 | Mở checkout → M đổi giá một món trong giỏ → A đặt COD ngay | Màn xác nhận hiện tạm tính/giảm giá/tổng **đúng số backend đã lưu** (giá mới), khớp với đơn trong Lịch sử | |

### D. Thanh toán payOS

Có thể tạo QR ngân hàng thật — chỉ chuyển tiền khi chủ động muốn kiểm tra.

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| D01 | Chọn payOS khi đang có voucher `PIZZA20`, giỏ ≥ 200.000đ | Cho phép; QR đúng số tiền **sau giảm** | |
| D02 | Tạo QR, chưa chuyển tiền | Có QR/link; chưa có đơn trong bếp; giỏ còn | |
| D03 | Hủy/quay lại/QR hết hạn | Không có đơn bếp, giỏ còn | |
| D04 | (Tùy chọn) Chuyển tiền thật → "Kiểm tra thanh toán" | PAID do backend xác nhận; đúng một đơn bếp; giỏ xóa | |
| D05 | Chọn giờ hẹn + ghi chú → payOS → (đã trả) → S xem đơn | S thấy đúng giờ hẹn và ghi chú | |
| D06 | B mở màn thanh toán bằng ID đơn của A | Bị từ chối | |
| D07 | Tạo QR payOS có voucher nhưng chưa trả tiền → đổi sang tiền mặt cùng voucher | Vẫn dùng được mã (lượt dùng chỉ bị tính khi payOS đã thanh toán) | |
| D08 | (Tùy chọn) Trả tiền đơn payOS có `PIZZA20` → đặt đơn mới cùng mã | Đơn mới bị báo "đã dùng mã PIZZA20"; staff từ chối đơn đã trả → mã được trả lại | |
| D09 | Giao Ahamove + voucher | Vẫn bị chặn: gỡ voucher trước khi lấy phí Ahamove | |

### E. Nhân viên, theo dõi đơn, hủy, điểm

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| E01 | A đặt đơn → S mở portal | Đơn ở "Chờ duyệt"; kéo xuống tải lại; tự tải lại mỗi ~15 giây | |
| E02 | S lọc Giao / Tại quầy; tìm theo mã, tên, SĐT | Đúng đơn; không phân biệt hoa thường | |
| E03 | Đơn tại quầy: Xác nhận → Bắt đầu làm món → Món đã sẵn sàng → Khách đã nhận món | Đi qua đủ trạng thái, kết thúc COMPLETED | |
| E04 | Đơn giao thường: … → Sẵn sàng → Bắt đầu giao → Giao thành công | `READY → OUT_FOR_DELIVERY → COMPLETED` | |
| E05 | 2 thiết bị S cùng bấm bước tiếp theo một đơn | Chỉ một lần chuyển; thiết bị kia báo lỗi; điểm cộng một lần | |
| E06 | A hủy đơn đang chờ xác nhận | CANCELLED, vào Lịch sử | |
| E07 | A thử hủy đơn đã CONFIRMED | Không còn nút hủy / backend từ chối | |
| E08 | S từ chối với lý do có sẵn; lý do tự nhập 3–200 ký tự; tự nhập 1–2 ký tự | Hai trường hợp đầu thành CANCELLED có lý do; trường hợp cuối bị từ chối | |
| E09 | S từ chối đơn payOS đã trả | CANCELLED + "CHỜ HOÀN TIỀN" | |
| E10 | A mở màn theo dõi khi S chuyển bước | Cập nhật ngay không cần tải lại | |
| E11 | Đăng xuất → Tra cứu đơn: đúng SĐT + mã; sai một trong hai; tra liên tục > 10 lần/phút | Đúng thì thấy đơn; sai không thấy; quá giới hạn bị chặn tạm | |
| E12 | A và B thay nhau đăng nhập trên cùng máy | Không thấy đơn, địa chỉ, yêu thích của người trước | |
| E13 | Mở Rewards → hoàn tất đơn ở S → quay lại Rewards | Điểm mới hiển thị | |
| E14 | Đơn tiền mặt (tại quầy hoặc giao thường) → S chuyển tới COMPLETED | Thanh toán chuyển "ĐÃ THANH TOÁN" khi hoàn tất; trước đó và khi bị hủy vẫn "CHƯA THANH TOÁN". Đơn tiền mặt qua Ahamove vẫn chưa thanh toán (tài xế giữ tiền) | |
| E15 | Có đơn chờ xác nhận từ lâu + hơn 100 đơn mới hơn đã xong → S mở portal | Đơn chờ cũ vẫn ở tab "Chờ duyệt"; tab "Đã xong" hiện 50 đơn mới nhất | |

### F. Rewards và hồ sơ

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| F01 | Vãng lai mở Rewards | Có nút Đăng nhập | |
| F02 | A đủ điểm đổi quà 30 điểm | Trừ đúng 30, quà vào "Quà của tôi" | |
| F03 | Không đủ điểm; bấm đổi liên tục | Không âm điểm, không trừ nhiều lần | |
| F04 | B đăng nhập sau A | Không thấy quà của A | |
| F05 | Sửa tên/SĐT/ngày sinh/giới tính → đăng xuất/đăng nhập | Dữ liệu được lưu thật | |
| F06 | Tắt mạng → sửa hồ sơ → Lưu | Báo "Không thể lưu thay đổi", màn hình giữ dữ liệu cũ (không báo thành công giả) | |
| F07 | Sửa hồ sơ sang SĐT tài khoản khác đang dùng; sửa sang số mới hợp lệ; nhập số sai định dạng | Lần 1 báo đã được dùng; lần 2 lưu được (số cũ được trả lại để người khác dùng); lần 3 báo cần 10 chữ số | |

### G. Admin — Dashboard, đơn hàng, hoàn tiền

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| G01 | M mở Dashboard | Doanh thu, số đơn chờ, số đơn hoàn tất, số món đang bán **khớp dữ liệu thật**; không có đơn thì hiện 0 | |
| G02 | M → Giám Sát Đơn Hàng, lọc theo trạng thái | Danh sách đơn thật, mới nhất trước; không có đơn mẫu | |
| G03 | M hủy đơn đang chờ/đang làm | Đơn CANCELLED (khách thấy), có lịch sử "Admin can thiệp hủy đơn" | |
| G04 | M thử hủy đơn đang giao/đã xong | Không có nút hủy | |
| G05 | Đơn payOS đã trả bị hủy → M bấm xác nhận hoàn tiền | `REFUND_PENDING → REFUNDED`, nhãn "Đã hoàn tiền" | |
| G06 | S (EMPLOYEE) gọi `POST /api/admin/orders/:id/refunded` | 403 "Chỉ quản trị viên..." | |
| G07 | Tắt mạng / rules chưa deploy → mở Giám Sát Đơn Hàng | Báo "Không tải được đơn hàng", không hiện dữ liệu giả | |
| G08 | M → Báo cáo, chọn Hôm nay / Tuần / Tháng | Số liệu theo đơn thật; không có đơn thì 0 | |

### H. Admin — Món ăn và voucher

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| H01 | Mở chi tiết 1 pizza | Có mục "Giá theo lựa chọn" (từng size) và bảng phụ thu đế (chỉ xem) | |
| H02 | Đổi giá size Vừa → lưu → A mở lại app | Menu/giỏ/checkout hiện giá mới; tổng đơn backend theo giá mới | |
| H03 | Nhập giá size = 0 → lưu | Báo "Giá mỗi size phải lớn hơn 0", không lưu | |
| H04 | Tắt "Đang bán" một món → A mở chi tiết món đó | Có thông báo hết món, nút thêm giỏ bị khóa; món đã nằm trong giỏ từ trước thì backend từ chối khi đặt | |
| H05 | Bật/tắt còn hàng ở danh sách khi mất mạng | Báo lỗi và công tắc trở về như cũ | |
| H06 | Thêm món mới giá 100.000đ | Size Vừa 100.000đ, size Lớn 160.000đ (không có size 0đ); món hiện ở menu khách | |
| H07 | Xóa một món | Món biến mất khỏi menu khách | |
| H08 | Tạo voucher % (có giảm tối đa) và voucher giảm cố định | Cả hai tạo được | |
| H09 | Tạo mã trùng (`PIZZA20` hoặc mã vừa tạo) | Báo "Mã đã tồn tại" | |
| H10 | A dùng voucher mới ở giỏ → đặt COD | Giảm đúng ở app và trong đơn backend | |
| H11 | Gỡ voucher admin tạo → A nhập lại mã | Mã không còn hợp lệ | |
| H12 | Gỡ voucher có sẵn (`PIZZA20`) | Báo đây là mã mặc định, không gỡ được | |
| H13 | Tạo voucher có hạn dùng sai định dạng hoặc ngày đã qua | Báo "Hạn dùng phải là ngày trong tương lai, dạng dd/mm/yyyy" | |
| H14 | Tạo voucher tổng 2 lượt → 2 khách khác nhau dùng → khách thứ 3 dùng | Danh sách hiện "Đã dùng: 2/2"; khách thứ 3 bị báo "đã hết lượt sử dụng" | |

### I. Admin — Người dùng, phân quyền, khóa tài khoản

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| I01 | M mở Người dùng | Danh sách user thật | |
| I02 | B đang mở app → M đổi B sang `EMPLOYEE` | App của B nhận role mới ngay (không cần đăng nhập lại): Hồ sơ có mục quản lý đơn bếp; đóng/mở app thì vào thẳng portal nhân viên | |
| I03 | B đang mở portal nhân viên → M đổi B về `USER` | Portal của B chuyển sang màn chặn "Khu Vực Dành Cho Nhân Viên"; gọi API nhân viên bị 403 | |
| I04 | M thử đổi role của chính mình | Bị từ chối (rules) | |
| I05 | M khóa X → X đặt COD / payOS / đổi quà | Cả ba bị từ chối với thông báo tài khoản bị khóa | |
| I06 | X vẫn đăng nhập và xem đơn cũ | Được | |
| I07 | M mở khóa X → X đặt đơn | Đặt được | |
| I08 | A (USER) cố ghi Firestore trực tiếp (vd. sửa `role` của mình qua console trình duyệt) | Bị rules từ chối | |
| I09 | Đăng nhập STORE_MANAGER → Người dùng | Xem được danh sách, **không** có nút Đổi quyền/Khóa | |
| I10 | Đăng nhập ADMIN → đổi quyền một user | Danh sách quyền không có Admin; không có nút trên tài khoản SUPER_ADMIN/ADMIN khác | |
| I11 | Đăng nhập SUPER_ADMIN → cấp ADMIN cho B | Được | |

### J. Ahamove (chỉ khi đã cấu hình staging)

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| J01 | Bật `EXPO_PUBLIC_DELIVERY_PROVIDER=ahamove` + `AHAMOVE_ENABLED=true` | Checkout giao hàng có nút lấy phí | |
| J02 | Lấy phí (bỏ voucher, giao ngay) | Báo giá = tiền món + phí, hết hạn ~5 phút | |
| J03 | Dùng báo giá hết hạn / đổi giỏ sau khi lấy phí | Không đặt được, yêu cầu lấy phí lại | |
| J04 | COD Ahamove → S xác nhận/làm/sẵn sàng → Gọi tài xế Ahamove | Đúng một chuyến; chỉ gọi được khi READY | |
| J05 | Tài xế staging nhận/lấy/giao | Trạng thái chỉ tiến, COMPLETED cộng điểm một lần | |

### K. Giao diện và thiết bị

| ID | Thao tác | Kết quả mong đợi | KQ |
| --- | --- | --- | --- |
| K01 | Android 320/360dp, điện thoại lớn, iPhone, web 320px | Không tràn ngang; chữ dài không đè nhau | |
| K02 | Bàn phím ở checkout, OTP, tìm kiếm, lý do từ chối | Không che ô đang nhập | |
| K03 | Tablet / web màn rộng | App hiển thị dạng cột giữa | |
| K04 | Giỏ nổi + thanh tab | Không che món cuối và nút | |
| K05 | Hộp thoại xác nhận trên web (hủy đơn, đăng xuất, xóa) | Hiện hộp thoại trình duyệt; bấm Hủy thì không thực hiện | |

---

## 5. API backend

| Endpoint | Quyền / mục đích |
| --- | --- |
| `GET /health` | Công khai — kiểm tra backend |
| `POST /api/otp/send`, `/api/otp/verify` | Công khai, giới hạn tần suất — OTP đăng ký |
| `POST /api/auth/phone-login` | Công khai, giới hạn — SĐT + mật khẩu → custom token |
| `GET /api/orders/lookup?phone=&code=` | Công khai, 10 lần/phút — tra cứu đơn |
| `POST /api/orders/cash` | Khách (không bị khóa), header `Idempotency-Key` — tạo đơn COD |
| `POST /api/orders/:id/cancel` | Chủ đơn, khi đang chờ xác nhận |
| `GET /api/staff/orders?status=` | Nhân viên/admin — 100 đơn mới nhất |
| `POST /api/staff/orders/:id/advance` | Nhân viên/admin — bước tiếp theo |
| `POST /api/staff/orders/:id/reject` | Nhân viên/admin — body `{ "reason": "3–200 ký tự" }` |
| `POST /api/admin/orders/:id/refunded` | **Chỉ admin** — `REFUND_PENDING → REFUNDED` |
| `POST /api/payments/payos` | Khách (không bị khóa), `Idempotency-Key` — tạo QR |
| `GET /api/orders/:id`, `POST /api/orders/:id/reconcile` | Chủ thanh toán payOS — trạng thái / đối soát |
| `GET /api/rewards`, `POST /api/rewards/redeem` | Khách; đổi quà cần không bị khóa + `Idempotency-Key` |
| `POST /api/delivery/quotes`, `/api/delivery/orders` | Ahamove — báo phí / tạo đơn COD (không bị khóa) |
| `POST /api/delivery/orders/:id/dispatch`, `/refresh` | Nhân viên/admin — gọi / đối chiếu chuyến |
| `POST /api/webhooks/payos`, `/api/webhooks/ahamove` | Provider gọi, có xác minh chữ ký |

Mọi route `/api/*` (trừ các route công khai) cần header `Authorization: Bearer <Firebase ID token>`.

## 6. Chạy lại kiểm tra tự động

```powershell
npx expo lint
npx tsc --noEmit
npm run typecheck --prefix backend
npm test --prefix backend
npm run test:rules   # Firestore rules trên emulator, cần Java 11+ (lần đầu tự cài công cụ test)
```

Kỳ vọng: lint 0 lỗi/0 cảnh báo, TypeScript sạch, 95/95 test backend pass, 12/12 test rules.

## 7. Giới hạn hiện tại (không tính là lỗi khi test)

- Voucher chưa dùng được với Ahamove (báo phí tính trước khi giảm). Mỗi khách dùng mỗi mã một lần; với payOS, lượt dùng được ghi khi đã thanh toán.
- Portal nhân viên: tab "Đã xong" chỉ hiện 50 đơn hoàn tất/hủy mới nhất; lịch sử đầy đủ xem ở trang admin.
- Phụ thu loại đế là giá chung trong code, admin chưa chỉnh được.
- Hoàn tiền là thủ công: hệ thống chỉ ghi nhận trạng thái, không tự chuyển tiền.
- App lưu giá/voucher tạm ~60 giây; thay đổi của admin có thể cần mở lại app mới thấy.
- Chưa có push notification, đối soát COD, đồng bộ giỏ/địa chỉ giữa nhiều thiết bị.
- Các màn cũ `/order/[id]`, `/order/success`, `/profile/addresses`, `/profile/settings` còn dữ liệu cục bộ/demo — không dùng làm bằng chứng luồng đơn thật.
