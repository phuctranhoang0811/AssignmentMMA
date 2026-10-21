# Pizza Time — Mobile Frontend (React Native + Expo Router)

Ứng dụng đặt món ăn di động **Pizza Time Mobile** phong cách **Minimal Modern & Clean**, xây dựng theo tài liệu đặc tả `PIZZA TIME — MOBILE FRONTEND SPECIFICATION v1.0`.

Hệ thống hoạt động theo nguyên tắc **Frontend-first**, toàn bộ luồng người dùng (Customer Order Journey) từ duyệt menu, xem chi tiết món ăn, chọn size/topping, thêm giỏ, thanh toán 3 bước, tạo đơn hàng đến theo dõi đơn hàng thời gian thực đều hoạt động hoàn chỉnh bằng **Mock Data & Async Storage**, **không bắt buộc kết nối backend**.

---

## 📱 Điểm nổi bật & Các màn hình đã hoàn thiện

| Mã màn hình | Tên màn hình & Luồng | Mô tả chức năng |
|---|---|---|
| **F01** | Trang chủ (`/(tabs)/home`) | Header thương hiệu, vị trí giao, thanh tìm kiếm nhanh, hero banner món nướng củi, danh mục chips, Best Sellers ngang, thanh ưu đãi và gợi ý món ngon |
| **F02** | Thực đơn (`/(tabs)/menu`) | Duyệt món 2 cột, thanh danh mục, bộ lọc sắp xếp (Phổ biến, Giá thấp-cao, Giá cao-thấp), lọc theo tình trạng còn hàng |
| **F03** | Chi tiết món ăn (`/product/[id]`) | Ảnh món lớn, radio chọn kích cỡ (S/M/L) bắt buộc, checkbox chọn topping phụ phí, ô ghi chú bếp (tối đa 200 ký tự), bộ tăng giảm số lượng (1-20), thanh CTA cố định kèm tổng giá |
| **F04** | Tìm kiếm (`/search`) | Ô tìm kiếm tự động focus, từ khóa gợi ý và lịch sử gần đây, tìm kiếm thời gian thực theo tên, nguyên liệu, tag |
| **F05** | Giỏ hàng (`/(tabs)/cart`) | Danh sách món kèm tùy chọn/ghi chú, bộ đếm số lượng, tính tạm tính, thuế VAT giả lập 10%, phí giao hàng, xác nhận xóa giỏ |
| **F06** | Giao nhận (`/checkout/index`) | Bước 1: Chọn hình thức (Giao tận nơi hoặc Đến lấy tại quầy - miễn phí ship), thông tin người nhận, địa chỉ, áp dụng mã voucher (`PIZZA20`, `WELCOME30`) |
| **F07** | Phương thức thanh toán (`/checkout/payment`) | Bước 2: Thanh toán khi nhận hàng (COD) hoặc Ví điện tử MoMo/ZaloPay (Gắn nhãn `DEMO`, không yêu cầu số thẻ/CVV thật) |
| **F08** | Xác nhận đặt đơn (`/checkout/review`) | Bước 3: Kiểm tra toàn bộ đơn hàng, chống bấm trùng (idempotency), xử lý lỗi giả lập an toàn không mất giỏ hàng |
| **F09** | Đặt hàng thành công (`/order/success`) | Hiển thị mã đơn `PT-2026-XXXX`, trạng thái chờ xác nhận, nút theo dõi đơn |
| **F10** | Theo dõi đơn hàng (`/order/[id]`) | Stepper tiến trình (`Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Sẵn sàng → Đang giao → Hoàn thành`), nút Hủy đơn (khi chờ duyệt), Đặt lại món, và bộ điều khiển Developer Demo để nhảy trạng thái |
| **F11** | Danh sách đơn hàng (`/(tabs)/orders`) | Phân loại tab `Đang xử lý` và `Lịch sử`, hiển thị tóm tắt đơn, kéo để làm mới |
| **F12** | Đăng nhập (`/auth/login`) | Form đăng nhập có nút `Đăng nhập nhanh với tài khoản Demo`, bảo lưu giỏ hàng của khách sau khi đăng nhập |
| **F13** | Đăng ký (`/auth/register`) | Đăng ký tài khoản mẫu, kiểm tra tính hợp lệ dữ liệu |
| **F14** | Tài khoản (`/(tabs)/profile`) | Thông tin người dùng, điều hướng các tiện ích |
| **F15** | Sửa hồ sơ (`/profile/edit`) | Cập nhật họ tên và số điện thoại |
| **F16** | Sổ địa chỉ (`/profile/addresses`) | Thêm, xóa, đặt địa chỉ mặc định (lưu trữ cục bộ) |
| **F17** | Cài đặt & Sandbox (`/profile/settings`) | Bật tắt thông báo, bật giả lập lỗi mạng để test retry giỏ hàng, nút khôi phục dữ liệu demo gốc |
| **F18** | Món yêu thích (`/favorites`) | Danh sách món ăn được thả tim |
| **F19** | Mã ưu đãi & Voucher (`/offers`) | Danh sách coupon đang kích hoạt, 1 chạm áp dụng |
| **F20** | Quản lý bếp Staff Demo (`/demo/staff-orders`) | Màn hình mô phỏng nhân viên nhà hàng: Duyệt đơn, Bắt đầu nấu, Báo món sẵn sàng, Xuất giao hàng |

---

## 🎨 Hệ thống Thiết kế (Design Tokens)

- **Primary Color:** `#C84A30` (Đỏ cà chua nướng đặc trưng)
- **Primary Soft:** `#FFF0E9`
- **Background:** `#FAFAF8` (Tone sáng nhẹ, ấm áp, tối giản)
- **Surface:** `#FFFFFF`
- **Text Primary:** `#1F1F1F` | **Text Secondary:** `#6B7280`
- **Bo góc chuẩn:** Card: `16px`, Button: `12px`, Chip: `999px`
- **Tiền tệ:** Định dạng chuẩn Việt Nam `vi-VN` (VD: `129.000 ₫`)

---

## 🛠 Hướng dẫn Cài đặt & Chạy ứng dụng

### Yêu cầu môi trường
- Node.js >= 18
- npm hoặc yarn

### 1. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 2. Chạy trên trình duyệt Web (Xem nhanh Demo)
```bash
npm run web
# hoặc
npx expo start --web
```
Ứng dụng sẽ mở tại `http://localhost:8081` với giao diện khung điện thoại chuẩn mobile responsive.

### 3. Chạy trên thiết bị di động (Expo Go)
```bash
npx expo start
```
Mở ứng dụng **Expo Go** trên điện thoại Android hoặc Camera trên iPhone quét mã QR trên terminal.

### 4. Kiểm tra mã nguồn (TypeScript Typecheck)
```bash
npx tsc --noEmit
```

---

## 📂 Cấu trúc Thư mục

```text
Project-assignment/
├── src/
│   ├── app/                         # Expo Router screens
│   │   ├── _layout.tsx              # Root Stack & Context Providers
│   │   ├── index.tsx                # Redirect to home
│   │   ├── (tabs)/                  # 5 Tabs: home, menu, cart, orders, profile
│   │   ├── product/[id].tsx         # Chi tiết món ăn (F03)
│   │   ├── search.tsx               # Tìm kiếm (F04)
│   │   ├── checkout/                # 3 bước đặt hàng (F06, F07, F08)
│   │   ├── order/                   # Thành công & Theo dõi đơn (F09, F10)
│   │   ├── auth/                    # Đăng nhập & Đăng ký (F12, F13)
│   │   ├── profile/                 # Sửa thông tin, Địa chỉ, Cài đặt (F15, F16, F17)
│   │   ├── favorites.tsx            # Yêu thích (F18)
│   │   ├── offers.tsx               # Khuyến mãi (F19)
│   │   └── demo/staff-orders.tsx    # Quy trình bếp & giao (F20)
│   ├── components/
│   │   ├── ui/                      # AppButton, AppInput, AppCard, PriceText, Chip, etc.
│   │   ├── product/                 # ProductCard, VariantSelector, AddonSelector
│   │   └── order/                   # OrderCard, OrderTimeline
│   ├── data/                        # Dữ liệu mẫu (mockProducts, mockOrders, mockUsers...)
│   ├── services/                    # Service layer (mockProductService, mockOrderService...)
│   ├── state/                       # Contexts (AuthContext, CartContext, OrderContext...)
│   ├── theme/                       # Colors, Spacing, Typography
│   ├── types/                       # TypeScript interfaces
│   └── utils/                       # formatCurrency, calculateTotals, validators...
├── app.json
├── package.json
└── tsconfig.json
```

---

## 🔄 Nơi chỉnh sửa dữ liệu mẫu (Mock Data)

Khi cần thay đổi thực đơn, hình ảnh món ăn hoặc chính sách giá:
- **Sản phẩm:** `src/data/mockProducts.ts` (Thêm món, sửa ảnh, size, topping, giá)
- **Đơn hàng mẫu:** `src/data/mockOrders.ts` (4 đơn hạt giống khởi tạo)
- **Mã giảm giá:** `src/data/mockPromotions.ts` (`PIZZA20`, `WELCOME30`)
- **Tài khoản test:** `src/data/mockUsers.ts` (`USR-DEMO-001`, `demo@pizzatime.local`)
- **Cấu hình phí ship & thuế:** `src/data/mockConfig.ts` (Thuế 10%, phí ship 20k, ngưỡng freeship 299k)

Khi tích hợp REST API thật (Express, NestJS, Supabase), chỉ cần triển khai adapter mới theo các interface trong `src/services/contracts.ts` mà không phải thay đổi bất kỳ dòng code giao diện nào.
