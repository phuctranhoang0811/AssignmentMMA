# Review luồng và checklist kiểm thử Pizza FPT

Ngày review: 28/10/2026. Mốc review ban đầu: `2e5c6ba` trên `feature/firebase-auth-database`. Đã cập nhật theo bản sửa F1–F4 trong workspace.

Tài liệu này mô tả **code đang có**, dùng để test thủ công. Các dòng checklist chưa có nghĩa là đã chạy trên thiết bị. Lint, TypeScript app/backend và 78 test tự động đã đạt trong lần review này; test backend dùng provider giả lập và dữ liệu trong bộ nhớ, không xác nhận kết nối Firebase/payos/Ahamove thật.

## 1. Những điều cần biết trước khi test

| Hạng mục | Hành vi hiện tại |
| --- | --- |
| Guest | Xem menu, tìm món, tùy chỉnh, thêm giỏ và tra cứu bằng SĐT + mã đơn. Phải đăng nhập tài khoản thật để checkout/đặt hàng. |
| Demo | Dùng thử giao diện; không có Firebase session để đặt đơn, thanh toán hoặc đổi quà thật. |
| Khách đã đăng nhập | Đặt COD/payOS, theo dõi đơn của mình, hủy đơn chưa xác nhận, tích điểm và đổi quà. |
| Nhân viên/quản lý/admin | Cùng portal `/staff/orders`; backend chấp nhận role nhân viên trong hồ sơ Firestore (EMPLOYEE, STORE_MANAGER, ADMIN, SUPER_ADMIN) **hoặc** UID trong `STAFF_UIDS`. Chưa có portal quản trị riêng. |
| Menu và voucher | App đọc dữ liệu local trong `src/data/`; backend tính lại tiền bằng catalog Firestore. Hai bên cần cùng dữ liệu để giá khớp. |
| Checkout | Một màn hình `/checkout`. `/checkout/payment` và `/checkout/review` chỉ chuyển về đây. |
| Tổng tiền thông thường | Tiền món gồm size/topping/addon, trừ voucher; hiện không cộng thêm VAT hoặc phí giao thông thường. Ahamove có báo phí riêng. |
| Voucher | COD thường hỗ trợ. payOS và Ahamove chưa hỗ trợ. `WELCOME30` chưa có kiểm tra lịch sử để giới hạn khách đặt lần đầu. |
| Đơn thật | Ghi qua backend vào Firestore; khách xem cập nhật trực tiếp qua Firestore. Staff đọc lại API khi mở, kéo refresh và mỗi 15 giây lúc màn hình hoạt động. |
| Hoàn tiền | Từ chối/hủy đơn đã trả tiền đánh dấu `REFUND_PENDING`; chưa có thao tác tự chuyển tiền hoàn về ngân hàng. |
| Lưu trên thiết bị | Giỏ, lựa chọn checkout, địa chỉ giao và yêu thích dùng local storage. Giỏ được giữ qua đăng nhập; không phải giỏ đồng bộ cloud theo tài khoản. |

`README.md`, `TEAM_GUIDE.md`, `SYSTEM_FLOWS.md` và bảng endpoint trong tài liệu Ahamove có phần đã cũ. Không dùng các mô tả “guest đặt hàng”, “ví demo”, “VAT 10%”, hoặc portal CRUD admin để đánh giá bản hiện tại.

## 2. Cấu hình local được kiểm tra khi review

Chỉ kiểm tra sự có mặt của cấu hình trong các file `.env`, không thử gửi mail, thanh toán hoặc đặt chuyến thật. Chưa đối chiếu các biến có thể được cấp riêng cho tiến trình backend đang chạy.

| Hạng mục | Trạng thái | Việc cần làm trước khi test |
| --- | --- | --- |
| API URL của app, Firebase app và backend | Đã có; project ID app/backend khớp; file credential tồn tại | Khởi động backend, kiểm tra `/health`. Chưa xác minh credential/provider còn hoạt động. |
| Quyền staff ở backend | `STAFF_UIDS` và `AHAMOVE_STAFF_UIDS` đang trống | Đặt `STAFF_UIDS=<Firebase UID nhân viên>` trong `backend/.env`, restart backend. Chỉ có role `EMPLOYEE` trong Firestore vẫn nhận 403 nếu UID chưa được cấp. |
| Gửi OTP qua Gmail | `SMTP_USER`/`SMTP_PASS` đang trống | Backend ở chế độ development in `[OTP dev] ...` trong terminal. Dùng mã này để thử; muốn nhận mail thì cấu hình SMTP. Không có SMTP trong production thì endpoint OTP không khả dụng. |
| Google trong Expo Go | Chưa có `EXPO_PUBLIC_GOOGLE_BRIDGE_URL` | Chuẩn bị HTTPS bridge theo [google-login.md](./google-login.md). Có thể dùng script `npm run google:expo-go`, thêm hostname vào Firebase Authorized domains, rồi restart Expo theo tài liệu. |
| Google trên web | Dùng Firebase popup | Bật Google provider và cho phép hostname của app trong Firebase; không cần bridge Expo Go. |
| Ahamove | Cờ app và backend đang tắt, thiếu thông tin hãng/staff | Chưa thể test chuyến staging. Xem [ahamove.md](./ahamove.md); app dùng chính xác `EXPO_PUBLIC_DELIVERY_PROVIDER=ahamove` và backend dùng `AHAMOVE_ENABLED=true`. |

Chuẩn bị 2 tài khoản khách A/B và một tài khoản staff S. Nên dùng 2 thiết bị hoặc 2 phiên trình duyệt riêng cho khách và staff. Lưu UID của S vào backend; role chấp nhận: `EMPLOYEE`, `STORE_MANAGER`, `SUPER_ADMIN`, `ADMIN`.

Chạy từ thư mục gốc, mở các terminal riêng:

```powershell
# Terminal 1: backend
npm run dev --prefix backend

# Terminal 2: ứng dụng trên điện thoại
npm run dev

# Hoặc test giao diện web
npm run web
```

Trên máy backend có thể đọc `http://localhost:3001/health` nếu dùng cổng mặc định; mong đợi `{"ok":true}`. Điện thoại phải dùng địa chỉ backend mà điện thoại truy cập được trong `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_ANDROID_API_URL`. Expo tunnel cho bundle và tunnel đăng nhập Google không tự chuyển tiếp các API đặt hàng/payOS. Restart Expo sau khi sửa biến `EXPO_PUBLIC_*`.

Nếu backend báo món không tồn tại/giá không khớp catalog, đối chiếu `products` trong Firestore với `src/data/mockProducts.ts`. Có lệnh `npm run seed:firebase` để ghi catalog lên database chung; chỉ chạy khi nhóm muốn đồng bộ catalog. Lần review này không chạy seed.

## 3. Bản sửa F1–F4 và các ca test hồi quy

### F1 — Đã sửa: Giữ tùy chọn và ghi chú món

`priceCheckout()` tạo snapshot dùng chung giữ addon IDs/tên addon, raw customization, mô tả topping/đế/sốt và ghi chú bếp. COD, payOS và Ahamove dùng snapshot này; màn staff, theo dõi và tra cứu hiển thị tên addon và mô tả/ghi chú.

Test C06: đặt pizza có topping, extra sauce, addon và ghi chú “Không hành”; đối chiếu đơn bằng cả khách và staff. Đơn mới phải giữ đủ lựa chọn và giá. Test tự động đã kiểm tra COD, payOS và Ahamove với dữ liệu trong bộ nhớ. Không tự khôi phục được thông tin đã mất ở đơn COD cũ.

### F2 — Đã sửa: Giữ giờ hẹn và ghi chú qua payOS

Request payOS giữ `deliveryTime` và `deliveryNote` cho giao thường/nhận tại quầy. Backend chấp nhận các trường tùy chọn, giữ trong fingerprint và đơn sau thanh toán. Đổi giờ/ghi chú phải là checkout mới; retry cùng dữ liệu không tạo thêm đơn. Ahamove vẫn giao ngay và khớp báo phí như trước.

Test D07: chọn giờ nhận tương lai/ghi chú, sau khi xác nhận PAID đối chiếu với staff. Các test tự động đi qua serializer app → schema → reserve → publish của backend; không dùng chuyển khoản thật. Payload cũ không có trường mới vẫn được chấp nhận.

### F3 — Đã sửa: Xác nhận và thông báo trên web

Các nơi gọi `Alert.alert` chuyển qua adapter dùng chung. Native giữ Alert của React Native; web dùng hộp thoại trình duyệt. Message vẫn gọi callback sau khi đóng; xác nhận hủy/đăng xuất chỉ chạy thao tác khi đồng ý, chọn Cancel không chạy thao tác.

Test E06, A04 và A11 trên web: có hộp thoại hủy đơn, lỗi form nhìn thấy, xác nhận đổi mật khẩu có thể quay lại. Test tự động kiểm tra message/callback và cả hai lựa chọn xác nhận; vẫn cần kiểm tra giao diện bằng trình duyệt/thiết bị thật.

### F4 — Đã sửa: Tải lại ví Rewards khi quay vào tab

Rewards tải lại ví khi được focus, khi điểm trong hồ sơ thay đổi và khi bấm thử lại. Kết quả của lần tải cũ không được ghi đè lần mới hoặc tài khoản mới.

Test E13: mở Rewards trước, hoàn tất đơn ở staff, quay lại Rewards; điểm phải khớp backend. Test thêm đổi quà, chuyển tab trong lúc đang tải và đăng xuất A → đăng nhập B.

## 4. Luồng cần test đầu tiên

1. Mở app ở phiên guest → duyệt menu → thêm món → giỏ → đăng nhập A → trở về checkout, giữ nguyên món.
2. A đặt **COD nhận tại quầy, món đơn giản chưa tùy chỉnh** → có mã đơn → thấy trong “Đang xử lý”.
3. S mở “Chờ duyệt” → xác nhận → “Bếp & Giao” → bắt đầu làm → sẵn sàng → khách nhận món.
4. A thấy đơn chuyển “Lịch sử”, điểm tăng `floor(total / 10000)` đúng một lần. Kiểm tra hồi quy F4 nếu Rewards đã mở trước.
5. A đặt đơn khác → hủy khi chờ xác nhận trên điện thoại; đơn chuyển lịch sử. Test hồi quy F3 nếu dùng web.
6. Đăng nhập B → không thấy đơn của A. Đăng xuất → tra cứu bằng SĐT + mã đơn A phải cần đủ cả hai giá trị đúng.

Sau khi 6 bước này chạy ổn, test pizza tùy chỉnh, payOS và cuối cùng Ahamove staging. Không dùng bản mock/demo làm bằng chứng một đơn đã ghi vào Firestore hoặc đã thanh toán.

## 5. Checklist chi tiết

Đánh dấu thủ công mỗi dòng: PASS / FAIL / BLOCKED. Với FAIL, ghi nền tảng, tài khoản/UID, mã đơn, bước tái hiện, kết quả thật và log liên quan. Không ghi mật khẩu/token vào biên bản lỗi.

### A. Khởi động, tài khoản và phân quyền

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| A01 | Phiên chưa đăng nhập: mở app → tiếp tục với vai trò khách | Vào trang chủ; hồ sơ không hiển thị như đã đăng nhập demo. |
| A02 | Email hợp lệ → gửi OTP → nhập sai rồi nhập đúng | Sai bị từ chối; đúng chuyển sang nhập hồ sơ. Khi chưa có SMTP, đọc mã ở terminal backend development. |
| A03 | Gửi lại OTP trong 30 giây; chờ trên 5 phút mới nhập mã; nhập sai quá giới hạn | Có thông báo phù hợp, cần mã mới. Có giới hạn gửi theo IP, không spam nút trong các ca khác. |
| A04 | Đăng ký: bỏ tên/SĐT, SĐT sai, mật khẩu yếu, xác nhận không khớp, bỏ điều khoản | Không hoàn tất đăng ký; trên web kiểm tra hộp thoại hiển thị theo F3. |
| A05 | Đăng ký dữ liệu hợp lệ | Có Firebase Auth + hồ sơ `USER`, mặc định 100 điểm; tài khoản đăng nhập được. |
| A06 | Login bằng email, rồi logout và login bằng SĐT + cùng mật khẩu | Cùng UID/hồ sơ; sai mật khẩu không đăng nhập được. SĐT cần backend có `FIREBASE_WEB_API_KEY`. |
| A07 | Google web: chọn Gmail; hủy popup; thử email không phải Gmail | Gmail vào đúng tài khoản; hủy không báo thành công; tài khoản ngoài Gmail bị từ chối theo logic app. |
| A08 | Google trên Expo Go: mở trình duyệt, xác nhận tài khoản/mã đối chiếu, quay lại app; thử hủy | Chỉ nhận đúng phiên đã duyệt; hủy không tự đăng nhập. BLOCKED cho tới khi có HTTPS bridge. |
| A09 | Đóng/mở lại app sau login; logout và mở lại | Phiên hợp lệ được khôi phục; sau logout không tự quay lại tài khoản cũ. |
| A10 | Quên mật khẩu → email hợp lệ; dùng mật khẩu mới sau reset | Có email reset do Firebase gửi; login được sau đổi. Không phụ thuộc SMTP OTP của backend. |
| A11 | Đổi mật khẩu: sai mật khẩu cũ, trùng mật khẩu cũ, mật khẩu mới yếu, dữ liệu đúng | Dữ liệu sai bị từ chối; đổi đúng thì mật khẩu mới dùng được. Tài khoản Google thuần không có nút đổi mật khẩu. Kiểm tra hồi quy F3 trên web. |
| A12 | USER mở `/staff/orders`; S có role đúng nhưng chưa có whitelist; S đã cấp đủ | USER bị chặn; thiếu whitelist nhận 403; đủ role và UID thì tải được đơn. |
| A13 | Login S bằng email/SĐT; đóng/mở lại | Vào portal staff theo role, không phụ thuộc chuỗi email `employee@`. Quản lý cửa hàng cũng vào được. |

### B. Menu, sản phẩm, địa chỉ và giỏ

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| B01 | Duyệt các danh mục; tìm tên món/nguyên liệu/tag; tìm từ không tồn tại; xóa ô tìm | Danh mục/kết quả phù hợp, có trạng thái rỗng, xóa tìm trở lại danh sách. |
| B02 | Mở pizza; đổi size/đế/sốt, thêm topping, thêm sốt, chọn độ cay/cách nướng/cắt | Giá đổi tương ứng; tổng lượng topping tối đa 5 phần; đổi size không giữ đế không hỗ trợ. |
| B03 | Mở combo nằm trong danh mục pizza và thử đặt | Không ép combo đi qua tùy chỉnh chỉ dành cho pizza thật. |
| B04 | Tăng/giảm số lượng tại chi tiết và giỏ | Giới hạn UI 1–20; tổng tiền/số món cập nhật đúng. |
| B05 | Thêm hai lần cùng cấu hình; thêm cùng món nhưng khác cấu hình/ghi chú | Cùng dòng được gộp; khác lựa chọn là dòng riêng. |
| B06 | Sửa món đã thêm từ giỏ; đổi size/topping; lưu | Thay thế dòng cũ, giữ số lượng; không nhân đôi dòng. Đồ uống/món cố định không hiện sửa không cần thiết. |
| B07 | Xóa một dòng; hủy xác nhận xóa; xóa dòng cuối | Hủy không mất món; xóa đúng dòng; giỏ rỗng có đường trở về menu. |
| B08 | Đóng/mở app khi giỏ có món, voucher và dụng cụ ăn | Các lựa chọn được khôi phục; guest đăng nhập vẫn giữ giỏ. |
| B09 | Thả tim/bỏ tim; xem yêu thích; logout A → login B | Danh sách đổi đúng; không giữ yêu thích của tài khoản A cho B trong cùng phiên chuyển tài khoản. |
| B10 | Nhập địa chỉ thủ công; chọn gợi ý; cho phép và từ chối GPS | Địa chỉ được chọn đúng; từ chối quyền vẫn cho nhập tay. GPS cần thử trên điện thoại thật. |
| B11 | Chọn giao hàng/lấy tại quầy ở màn địa chỉ và trong checkout | Cách nhận nhất quán; giao hàng cần địa chỉ; nhận tại quầy không cần địa chỉ khách. |
| B12 | Mở link món không tồn tại; ảnh món lỗi; back từ chi tiết | Có màn không tìm thấy/ảnh thay thế; app không crash. |
| B13 | Áp `PIZZAFPT`, `FPT40`, `PIZZA20`, mã sai và đơn dưới ngưỡng | `PIZZAFPT`: -40k từ 100k; `FPT40`: -40k từ 200k; `PIZZA20`: -20%, tối đa 50k từ 200k. |
| B14 | Giỏ có tổng 498.000đ, áp `FPT40`, sang checkout COD thường | Tổng 458.000đ; không tự cộng thêm VAT/phí giao thường. |

### C. Checkout và đơn COD

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| C01 | Guest/demo nhấn thanh toán ở giỏ; login khách thật | Đăng nhập trước checkout, giữ giỏ và đi tiếp đúng màn. |
| C02 | Bỏ họ tên/SĐT, email sai, địa chỉ giao trống, chưa đồng ý điều khoản | Không gửi đơn; chỉ rõ dữ liệu cần sửa. Web cũng phải hiện thông báo, theo bản sửa F3. |
| C03 | Chọn khung giờ còn hiệu lực; để khung giờ trôi qua rồi đặt | Khung giờ cũ bị yêu cầu chọn lại. Giờ cửa hàng hiện dùng múi giờ Việt Nam, 10:30–21:30, lead time 45 phút. |
| C04 | COD nhận tại quầy, món đơn giản | Một mã `PF-...`, đơn `PENDING_CONFIRMATION`, tiền `UNPAID`; giỏ được xóa sau khi backend xác nhận tạo đơn. |
| C05 | COD giao thường, có địa chỉ/ghi chú giao/dụng cụ ăn/voucher | Backend lưu đúng thông tin, tính lại tổng. Không mong đợi tài xế Ahamove khi tính năng đang tắt. |
| C06 | Pizza có topping + ghi chú “Không hành” → đặt COD → staff mở đơn | Tùy chọn, ghi chú phải còn nguyên. **Test hồi quy F1**: đơn mới phải đủ dữ liệu cho bếp. |
| C07 | Nhấn đặt nhanh nhiều lần; mất phản hồi rồi thử lại cùng giỏ | Không tạo nhiều đơn; retry cùng nội dung dùng lại yêu cầu cũ. Kiểm tra số đơn trong Firestore/staff. |
| C08 | Dừng backend khi đặt; sau đó chạy lại và retry | Không xóa giỏ khi thất bại; có thể thử lại. Web phải hiện thông báo theo F3. |
| C09 | Giá/stock Firestore khác dữ liệu app | Backend dùng giá/stock thật; món không khả dụng bị từ chối. Đây là ca kiểm tra catalog, không tự sửa database chung trong lúc người khác đang test. |

### D. payOS

payOS trong project có thể tạo QR ngân hàng thật. Các test tự động đã giả lập provider; chưa chuyển khoản thật trong lần review. Chỉ thanh toán khi bạn chủ động muốn kiểm tra tích hợp thực tế.

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| D01 | Chọn payOS khi đang có voucher | Không cho xác nhận phương thức; gỡ mã rồi chọn lại. |
| D02 | Tạo QR, chưa chuyển tiền | Có link/QR hoặc thông báo cấu hình/provider; không báo PAID chỉ vì đã mở trang thanh toán. Giỏ chưa bị xóa. |
| D03 | Quay lại/hủy/QR hết hạn khi chưa trả tiền | Không xuất đơn đã trả vào bếp; không xóa giỏ. |
| D04 | Khi chủ động thanh toán: dùng “Kiểm tra thanh toán”/quay lại app | PAID chỉ do backend xác nhận; đúng một đơn vận hành được tạo; giỏ tương ứng mới được xóa. |
| D05 | Mất webhook hoặc kết nối rồi dùng “Kiểm tra thanh toán” | Backend reconcile với provider; không cần khách gửi trạng thái PAID. Có thể mô phỏng bằng test backend thay cho chuyển tiền. |
| D06 | Thêm món khác vào giỏ sau khi tạo QR rồi xác nhận đơn cũ đã trả | Không xóa giỏ mới khác nội dung đơn đã thanh toán. |
| D07 | Đặt giờ nhận tương lai/ghi chú giao thường trước payOS | Staff phải thấy đúng thông tin; **test hồi quy F2**. |
| D08 | A đăng xuất; B thử mở màn thanh toán với ID của A | API từ chối; không thấy thông tin thanh toán của A. |

### E. Staff, theo dõi, hủy đơn và điểm

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| E01 | Khách A tạo đơn; S mở portal | Có đơn ở “Chờ duyệt”; refresh tải lại ngay, tự tải lại khoảng 15 giây khi đang hoạt động. |
| E02 | S lọc Giao/Tại quầy, tìm mã/tên/SĐT ở các tab | Đúng tập đơn; mã và tên không phân biệt hoa thường; backend hiện chỉ trả 100 đơn mới nhất. |
| E03 | S xác nhận → bắt đầu làm món → sẵn sàng → khách nhận món với đơn tại quầy | `PENDING_CONFIRMATION → CONFIRMED → PREPARING → READY → COMPLETED`; đơn sang “Đã xong”. |
| E04 | S xử lý giao thường tới sẵn sàng → bắt đầu giao → giao thành công | `READY → OUT_FOR_DELIVERY → COMPLETED`. |
| E05 | Nhấn lặp thao tác hoặc 2 staff xử lý cùng đơn | Không cập nhật trạng thái dựa trên dữ liệu cũ không hợp lệ; server quyết định bước hiện tại. Cộng điểm tối đa một lần. |
| E06 | A hủy đơn đang chờ xác nhận | Đơn CANCELLED; sang lịch sử. Sau CONFIRMED, không còn quyền hủy của khách. Web phải có xác nhận và hủy được theo F3. |
| E07 | S từ chối với lý do có sẵn/tự nhập | Đơn CANCELLED và có lịch sử/lý do. Lý do tự nhập phải 3–200 ký tự theo API; UI hiện cho nhập tối đa 300 nên giá trị ngoài khoảng bị server từ chối. |
| E08 | S từ chối một đơn payOS đã trả | `paymentStatus=REFUND_PENDING`, không mong đợi hoàn tiền tự động. |
| E09 | A đang mở theo dõi khi staff chuyển bước | Khách thấy cập nhật qua Firestore; timeline phân biệt giao hàng/nhận tại quầy; lịch sử có cả COMPLETED/CANCELLED. |
| E10 | Đăng xuất → tra cứu đúng SĐT + mã đơn; sai SĐT/mã; tìm liên tục | Đúng thấy đơn; sai không thấy; trên 10 lượt/phút/IP có giới hạn. Tra cứu là snapshot, không phải màn realtime. |
| E11 | A/B thay phiên login trên cùng thiết bị | Lịch sử/chi tiết đơn và hồ sơ liên hệ không hiện dữ liệu tài khoản trước. |
| E12 | Hoàn tất đơn tổng T; refresh/chuyển trạng thái lại | Điểm tăng `floor(T/10000)` một lần; đơn hủy không cộng. COD chưa có bước đối soát tiền thật riêng. |
| E13 | Mở Rewards trước → hoàn tất đơn mới → quay lại Rewards | Phải thấy số điểm mới; **test hồi quy F4**. |

### F. Rewards và hồ sơ

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| F01 | Guest mở Rewards; demo mở Rewards | Guest được yêu cầu login; demo không đổi quà thật. |
| F02 | A đủ điểm đổi Pepsi 30 điểm | Trừ đúng 30, thêm một quà vào “Quà của tôi”/lịch sử. |
| F03 | Chưa đủ điểm; nhấn đổi lặp; mất kết nối rồi retry | Không âm điểm, không trừ nhiều lần cho cùng yêu cầu; backend có kiểm tra giao dịch. |
| F04 | B login sau A đã đổi quà | Không thấy quà của A. |
| F05 | Sửa tên/SĐT/ngày sinh/giới tính/email; đóng mở lại, logout/login | Kiểm tra dữ liệu thật sau đăng nhập lại, không chỉ toast thành công; email hồ sơ hiện không đồng nghĩa đổi email Firebase Auth. |
| F06 | QR thành viên | Mở/đóng được QR; đây là hiển thị mã thành viên, chưa có luồng thu ngân quét để áp quyền lợi. |

### G. Ahamove staging — chỉ test sau khi cấu hình

| ID | Thao tác | Kết quả mong đợi / lưu ý |
| --- | --- | --- |
| G01 | Bật app `ahamove`, backend `true`, thông tin staging và UID giao hàng | Có nút lấy phí trên checkout giao hàng; role/UID staff được cấp cho cả API đơn và API giao hàng. |
| G02 | Nhập địa chỉ/khách, bỏ voucher, chọn Sớm nhất → Lấy phí | Quote gồm giá backend + phí, hết hạn sau khoảng 5 phút; sửa giỏ/liên hệ/địa chỉ cần quote phù hợp mới. |
| G03 | Dùng quote hết hạn hoặc đổi giỏ, chọn giờ hẹn/voucher | Không đặt được; yêu cầu lấy lại phí/bỏ voucher/chọn giao ngay. |
| G04 | COD Ahamove → staff xác nhận/làm/sẵn sàng → gọi tài xế | Một đơn nội bộ, tối đa một yêu cầu booking không rõ kết quả; gọi tài xế chỉ khi READY. |
| G05 | payOS Ahamove | Chỉ sau PAID mới có đơn vận hành; tài xế không thu lại tiền món đã trả. |
| G06 | Driver staging nhận/lấy/giao; callback lặp hoặc đến trễ | Trạng thái không lùi; giao xong cập nhật đơn/điểm đúng một lần. Có “Kiểm tra chuyến” để đối chiếu. |
| G07 | Booking timeout | Không gửi lặp POST tạo chuyến; đối chiếu chuyến cũ. Không tự reset/đặt lại chuyến nếu chưa biết hãng đã tạo hay chưa. |
| G08 | Chuyến thất bại/hủy; COD staging giao xong | Không tự coi là thu/đối soát tiền thật. Chưa có UI hủy/đặt lại chuyến; cần xử lý vận hành riêng. |

### H. Giao diện và thiết bị

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| H01 | Android rộng 320/360dp, điện thoại lớn; iPhone; web 320px | Không tràn ngang; thao tác chính nhìn thấy; giá/tên dài không đè nhau. |
| H02 | Mở bàn phím tại checkout, OTP, tìm kiếm, lý do từ chối | Không che trường đang nhập/nút cần thiết; có thể cuộn và đóng bàn phím. |
| H03 | Tablet/xoay màn hình; quay về từ app ngân hàng/trình duyệt | Layout giữ chiều rộng hợp lý; app đọc lại trạng thái khi trở về. |
| H04 | Giỏ nổi, thanh tab và vùng safe area | Không che món cuối/nút thao tác; nút back và tab hoạt động. |
| H05 | Mất mạng/khôi phục khi theo dõi đơn hoặc staff đang mở | Có thông báo/tải lại; không báo thành công giả và không nhân đôi đơn. |

## 6. Tra cứu function và API chính

| Nhóm | Function/file | Điều cần đối chiếu |
| --- | --- | --- |
| Phiên đăng nhập | `loginDemo`, `loginGoogle`, `registerDemo`, `logout`, `resetPassword`, `changePassword`, `updateProfile` — `src/state/AuthContext.tsx` | Firebase session, hồ sơ, role, điểm, dữ liệu sau logout. `loginDemo` có mật khẩu thực tế dùng Firebase, không chỉ là demo. |
| Điều hướng login | `loginDestination`, `isStaffRole` — `src/utils/staff.ts` | Checkout/rewards quay lại đúng; staff vào portal theo role. |
| OTP | `sendOtpToEmail`, `verifyOtp` — `src/services/otpService.ts`; `OtpStore.start/verify` — `backend/src/otp.ts` | Sinh/kiểm tra mã tại backend, hết hạn, gửi lại và giới hạn thử. |
| Menu | `productService.list/getById` — `src/services/mock/productService.ts` | Dữ liệu local; tên/giá/cấu hình dùng chung với catalog seed. |
| Giỏ | `addItem`, `updateItem`, `removeItem`, `updateQuantity`, `clearCart` — `src/state/CartContext.tsx` | Gộp/tách dòng, giữ cấu hình, số lượng, khôi phục storage. |
| Giá | `getItemLineUnitPrice`, `calculateOrderTotals` — `src/utils/calculateTotals.ts`; `priceCheckout` — `backend/src/domain.ts` | Giá hiển thị và giá server; F1 kiểm tra snapshot đủ lựa chọn. |
| Pizza | `isCustomizablePizza`, `calculateCustomizationExtra`, `formatCustomizationSummary` — `src/types/pizzaCustomization.ts` | Combo không bị ép customize; tổng phụ thu và mô tả món. |
| COD | `createCashOrder` — `src/services/orderApi.ts`; `OrderOpsStore.createCash` | Token, giá server, chống đơn trùng và thông tin bếp. |
| payOS | `createPayosPayment`, `getPayosPayment`, `reconcilePayosPayment`, `finishPayosCart`, `watchPayosPayments` | QR, trạng thái tiền, reconnect và xóa đúng giỏ. |
| Staff | `filterStaffOrders`, `staffOrderAction`, `canRejectStaffOrder`; `OrderOpsStore.list/advance/reject` | Bộ lọc và quyền thao tác khớp backend. |
| Điểm | `transition`, `rewardPointsFor` — `backend/src/orders.ts`; `RewardStore.wallet/redeem` | Cộng một lần, không âm điểm; F4 kiểm tra ví khi quay lại màn hình. |
| Tra cứu/hủy | `lookupOrder`, `cancelOrder` — `src/services/orderApi.ts`; `OrderOpsStore.lookup/cancel` | SĐT + mã, sở hữu đơn và điều kiện hủy. |
| Giao hàng | `getDeliveryQuote`, `createAhamoveCod`, `resumeAhamoveCod`, `updateDeliveryOrder`; `DeliveryStore` | Quote, chống booking trùng, callback và driver staging. |

Các endpoint **đang tồn tại**:

| Endpoint | Quyền / mục đích |
| --- | --- |
| `GET /health` | Kiểm tra backend, không cần token. |
| `POST /api/otp/send`, `/api/otp/verify` | Công khai, có giới hạn; đăng ký. |
| `POST /api/auth/phone-login` | SĐT + mật khẩu → Firebase custom token, có giới hạn. |
| `GET /api/orders/lookup?phone=...&code=...` | Tra cứu không cần login, có giới hạn. |
| `POST /api/orders/cash` | Khách thật, có `Idempotency-Key`. |
| `POST /api/orders/:id/cancel` | Chủ đơn đang chờ xác nhận. |
| `GET /api/staff/orders` | UID được cấp; tùy chọn `?status=...`. |
| `POST /api/staff/orders/:id/advance`, `.../reject` | Staff; reject body `{ "reason": "..." }`. |
| `POST /api/payments/payos` | Khách thật, có `Idempotency-Key`; nhận giờ hẹn/ghi chú tùy chọn, chưa nhận voucher. |
| `GET /api/orders/:id`, `POST /api/orders/:id/reconcile` | Trạng thái **payment order payOS**, không phải endpoint xem mọi đơn COD. |
| `GET /api/rewards`, `POST /api/rewards/redeem` | Khách thật; đổi quà có `Idempotency-Key`. |
| `POST /api/delivery/quotes`, `/api/delivery/orders` | Ahamove đã bật; COD create có `Idempotency-Key`. |
| `POST /api/delivery/orders/:id/dispatch`, `.../refresh` | Gọi/đối chiếu chuyến; quyền theo backend. |
| `POST /api/webhooks/payos`, `/api/webhooks/ahamove` | Callback provider, xác minh chữ ký/secret; không dùng token khách để giả lập thanh toán. |

`GET /api/delivery/staff/orders` và `POST /api/delivery/orders/:id/advance` xuất hiện trong tài liệu/collection Ahamove cũ nhưng hiện không có route tương ứng. Dùng `/api/staff/orders` và `/api/staff/orders/:id/advance` cho bếp. Không gọi một URL không còn tồn tại rồi kết luận tính năng staff bị hỏng.

## 7. Chạy lại kiểm tra tự động

Từ thư mục gốc:

```powershell
npx expo lint
npx tsc --noEmit
npm run typecheck --prefix backend
npm test --prefix backend
```

Kết quả tại lần review: lint đạt, TypeScript app/backend đạt, 78/78 test đạt. Bộ test đã kiểm tra nhiều ràng buộc thanh toán, auth, staff, giá, điểm và webhook giả lập; đã bổ sung regression test cho dữ liệu đơn/payOS và xác nhận web; F1–F4 vẫn cần chạy checklist trên giao diện thực tế. Chưa test UI thực tế trên Android/iOS/web, chưa kiểm chứng giao dịch ngân hàng, mail thật, Firebase cloud hoặc driver staging.

Ngoài phạm vi luồng hiện có: CRUD menu/voucher/user, dashboard doanh thu riêng cho admin, tự hoàn tiền ngân hàng, push notification thật, đối soát COD, dùng quà tại cửa hàng và đồng bộ sổ địa chỉ nhiều thiết bị. Các route legacy như `/order/[id]`, `/order/success`, `/profile/addresses`, `/profile/settings` còn code demo/cục bộ và không phải bằng chứng luồng đơn thật đã hoàn thành.
