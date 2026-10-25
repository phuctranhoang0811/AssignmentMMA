# 📋 TÀI LIỆU ĐẶC TẢ LUỒNG HỆ THỐNG PIZZA FPT (SYSTEM FLOW SPECIFICATION)

> **Tài liệu phân tích nghiệp vụ & kiến trúc hệ thống dành cho:** User (Khách hàng), Employee (Nhân viên vận hành) và Admin (Quản trị viên).  
> **Phiên bản:** 1.0.0  
> **Tác giả:** Senior Software Engineer  
> **Dự án:** Pizza FPT Mobile Application (React Native / Expo Router)

---

## 📑 MỤC LỤC
1. [Kiến Trúc Vận Hành Tổng Thể (System Architecture)](#1-kiến-trúc-vận-hành-tổng-thể)
2. [Luồng Nghiệp Vụ Khách Hàng (User / Customer Flow)](#2-luồng-nghiệp-vụ-khách-hàng-user--customer-flow)
3. [Luồng Nghiệp Vụ Nhân Viên (Employee / Staff Flow)](#3-luồng-nghiệp-vụ-nhân-viên-employee--staff-flow)
4. [Luồng Nghiệp Vụ Quản Trị Viên (Admin / Manager Flow)](#4-luồng-nghiệp-vụ-quản-trị-viên-admin--manager-flow)
5. [Vòng Đời Đơn Hàng (Order State Machine Lifecycle)](#5-vòng-đời-đơn-hàng-order-state-machine-lifecycle)
6. [Ma Trận Phân Quyền Truy Cập (RBAC Matrix)](#6-ma-trận-phân-quyền-truy-cập-rbac-matrix)
7. [Khuyến Nghị Kỹ Thuật Triển Khai (Engineering Blueprint)](#7-khuyến-nghị-kỹ-thuật-triển-khai-engineering-blueprint)
8. [Kiến Trúc Tích Hợp Firebase & CSDL Cloud (Firebase Integration Blueprint)](#8-kiến-trúc-tích-hợp-firebase--csdl-cloud-firebase-integration-blueprint)

---

## 1. KIẾN TRÚC VẬN HÀNH TỔNG THỂ

Hệ thống hoạt động trên một **Database & Event Engine tập trung**, đảm bảo dữ liệu luân chuyển nhất quán giữa 3 đối tượng người dùng:

```
               ┌────────────────────────────────────────────────────────┐
               │                  3. QUẢN TRỊ VIÊN                      │
               │               (ADMIN / STORE MANAGER)                  │
               └──────────────────────────┬─────────────────────────────┘
                                          │
            ┌─────────────────────────────┼────────────────────────────┐
            ▼                             ▼                            ▼
   [Quản trị Thực đơn]           [Giám sát Vận hành]          [Chiến dịch & Khách hàng]
   - CRUD Món, Crust, Size       - Live Order Monitor         - Quản lý Voucher / FPT Reward
   - Bật/Tắt In-Stock            - Override / Hủy đơn         - Quản lý User & Phân quyền
   - Cập nhật giá bán            - Xử lý Khiếu nại/Hoàn tiền  - Phân tích Doanh thu (BI/Report)
            │                             │                            │
            └─────────────────────────────┼────────────────────────────┘
                                          ▼
                      ┌──────────────────────────────────────┐
                      │    CENTRAL DATABASE & SOCKET SYNC    │
                      └───────────────────┬──────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
      ┌───────────────────────────┐               ┌───────────────────────────┐
      │       2. NHÂN VIÊN        │               │       1. KHÁCH HÀNG       │
      │    (EMPLOYEE / STAFF)     │               │     (USER / CUSTOMER)     │
      ├───────────────────────────┤               ├───────────────────────────┤
      │ • Xác nhận / Từ chối đơn  │               │ • Xem thực đơn & tìm kiếm │
      │ • Bếp chế biến món ăn     │ ◀── Event ──▶ │ • Tùy biến món & Giỏ hàng │
      │ • Đóng gói & Bàn giao     │  (Realtime)   │ • Đặt hàng & Thanh toán   │
      │ • Đối soát tiền mặt (COD) │               │ • Theo dõi đơn & Tích điểm│
      └───────────────────────────┘               └───────────────────────────┘
```

---

## 2. LUỒNG NGHIỆP VỤ KHÁCH HÀNG (USER / CUSTOMER FLOW)

Bao gồm 2 phân nhóm: **Khách vãng lai (Guest)** và **Thành viên đã xác thực (Member)**.

### Sơ đồ luồng (User Journey Flowchart)

```
[Khởi động Ứng dụng]
        │
        ▼
[Màn hình Splash (index.tsx)] ──(Tự động chuyển sau 2.2s)──▶ [Màn hình Chào mừng (welcome.tsx)]
                                                                     │
                         ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
                         ▼                                                                                       ▼
            [Đăng nhập / Đăng ký]                                                                   [Tiếp tục với vai trò Khách]
            - /auth/login                                                                           - authService khởi tạo guest
            - /auth/register                                                                                     │
                         │                                                                                       │
                         ▼                                                                                       ▼
         [Khách Hàng Đã Đăng Nhập (Member)]                                                       [Khách Vãng Lai (Guest)]
         - Tích điểm FPT Reward                                                                   - Không tích lũy điểm thưởng
         - Thẻ thành viên QR Code                                                                 - Giới hạn lưu lịch sử / hồ sơ
         - Lưu nhiều địa chỉ giao hàng                                                            - Vẫn được đặt hàng & thanh toán
                         │                                                                                       │
                         └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                                                     ▼
                                                         [Trang Chủ (tabs)/home]
                                                                     │
                                             ┌───────────────────────┴───────────────────────┐
                                             ▼                                               ▼
                                 [Xem Thực Đơn (tabs)/menu]                         [Tìm Kiếm & Lọc (search.tsx)]
                                             │                                               │
                                             └───────────────────────┬───────────────────────┘
                                                                     ▼
                                                       [Chi tiết món product/[id]]
                                                       - Chọn Size (Nhỏ, Vừa, Lớn)
                                                       - Chọn Đế bánh (Mỏng giòn, Dày, Viền phô mai)
                                                       - Chọn Topping / Món ăn kèm (Addons)
                                                       - Nhập ghi chú chế biến
                                                                     │
                                                                     ▼
                                                       [Thêm vào giỏ (CartContext)]
                                                       - Nút Floating Cart xuất hiện với Badge số lượng
                                                                     │
                                                                     ▼
                                                        [Giỏ hàng (tabs)/cart]
                                                       - Xem lại món, điều chỉnh số lượng
                                                       - Kiểm tra tạm tính & phụ phí
                                                                     │
                                                                     ▼
                                                        [Luồng Checkout]
                                                       - Bước 1 (/checkout/index): Nhập thông tin & chọn hình thức (Giao tận nơi / Lấy tại quầy)
                                                       - Bước 2 (/checkout/payment): Chọn phương thức (Tiền mặt COD / Ví Demo) & Áp mã Voucher
                                                       - Bước 3 (/checkout/review): Xác nhận thông tin đơn hàng lần cuối
                                                                     │
                                                                     ▼
                                                       [Bấm Đặt Hàng] ──▶ Tạo đơn hàng (Trạng thái: PENDING_CONFIRMATION)
                                                                     │
                                                                     ▼
                                                       [Đặt hàng thành công order/success]
                                                                     │
                                                                     ▼
                                                       [Theo dõi tiến độ đơn order/[id]]
                                                       - Hiển thị Timeline: Chờ duyệt ➔ Đang làm ➔ Sẵn sàng ➔ Đang giao ➔ Hoàn tất
                                                       - Tích điểm FPT Reward khi đơn chuyển sang COMPLETED
```

---

## 3. LUỒNG NGHIỆP VỤ NHÂN VIÊN (EMPLOYEE / STAFF FLOW)

Màn hình vận hành chính: [`src/app/demo/staff-orders.tsx`](file:///c:/Users/phuct/Desktop/React_Native/AssignmentMMA/src/app/demo/staff-orders.tsx). Nhân viên thực hiện tiếp nhận và chuyển tiếp trạng thái đơn theo vòng đời bếp.

### Sơ đồ các bước xử lý (Staff Task Pipeline)

```
                   [Đơn hàng mới từ Khách hàng]
                                │
                                ▼
         ┌──────────────────────────────────────────────┐
         │ TAB 1: Chờ Duyệt (PENDING_CONFIRMATION)      │
         └──────────────────────┬───────────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
     [Bấm "Từ chối"]                         [Bấm "Xác nhận đơn"]
            │                                       │
            ▼                                       ▼
   Trạng thái: CANCELLED                  Trạng thái: CONFIRMED
   (Hủy đơn & thông báo khách)             (Đơn được đẩy vào khu vực Bếp)
                                                    │
                                                    ▼
         ┌──────────────────────────────────────────────────────────────┐
         │ TAB 2: Bếp & Giao Nhận                                       │
         │ (CONFIRMED ➔ PREPARING ➔ READY ➔ OUT_FOR_DELIVERY)           │
         └──────────────────────────────┬───────────────────────────────┘
                                        │
                                        ├── 1. Bếp nhận đơn: Bấm [Bắt đầu nấu]
                                        │      ➔ Trạng thái: PREPARING
                                        │
                                        ├── 2. Bếp nấu xong: Bấm [Món đã sẵn sàng]
                                        │      ➔ Trạng thái: READY (Đóng hộp kèm dụng cụ)
                                        │
                                        └── 3. Bàn giao & Vận chuyển:
                                               ├── Nếu Lấy tại quầy (PICKUP):
                                               │   ➔ Bấm [Giao khách tại quầy] ➔ COMPLETED
                                               │
                                               └── Nếu Giao tận nơi (DELIVERY):
                                                   ➔ Bấm [Tài xế nhận giao] ➔ OUT_FOR_DELIVERY
                                                   ➔ Shipper giao tới nơi: Bấm [Giao thành công] ➔ COMPLETED
                                                    │
                                                    ▼
         ┌──────────────────────────────────────────────────────────────┐
         │ TAB 3: Đã Xong (COMPLETED | CANCELLED)                       │
         └──────────────────────────────────────────────────────────────┘
         - Xem lại lịch sử các đơn đã hoàn tất trong ca làm việc.
         - Thu tiền và đối soát tiền mặt (COD).
```

---

## 4. LUỒNG NGHIỆP VỤ QUẢN TRỊ VIÊN (ADMIN / MANAGER FLOW)

Admin và Cửa hàng trưởng (Store Manager) đóng vai trò quản trị danh mục, kiểm soát sự cố vận hành, thiết lập chiến dịch kinh doanh và phân tích số liệu.

### 4.1. Quản Trị Danh Mục & Thực Đơn (Catalog & Menu Management)
* **CRUD Sản phẩm & Danh mục**: Thêm mới pizza, thức uống, món khai vị; chỉnh sửa mô tả, giá gốc, hình ảnh đại diện.
* **Cấu hình Tùy chọn (Variants & Addons)**:
  * Quản lý các nhóm kích thước: Size Nhỏ (7"), Size Vừa (9"), Size Lớn (12").
  * Quản lý các loại đế: Đế mỏng giòn, Đế dày xốp, Đế viền phô mai, Đế viền xúc xích.
  * Quản lý danh sách Topping thêm (Phô mai phụ, Thịt xông khói, Dứa, Sốt cay).
* **Công tắc Hết hàng tức thì (In-Stock / Out-of-Stock Toggle)**:
  * Khi nhà bếp hết nguyên liệu đột xuất, Admin gạt tắt trạng thái khả dụng của món.
  * Ứng dụng của khách hàng sẽ ngay lập tức vô hiệu hóa nút "Thêm vào giỏ" cho sản phẩm đó.

### 4.2. Giám Sát Vận Hành & Can Thiệp Khẩn Cấp (Operations Oversight & Exception Handling)
* **Bản đồ / Bảng đơn hàng thời gian thực (Live Order Oversight)**: Theo dõi tiến độ chuẩn bị món của toàn bộ chi nhánh.
* **Quyền Override (Ép can thiệp)**:
  * Khi khách muốn đổi địa chỉ khẩn cấp hoặc yêu cầu hủy đơn giữa chừng: Admin có quyền can thiệp hủy đơn (`CANCELLED`).
  * Kích hoạt hoàn tiền tự động (`REFUND_PENDING` ➔ `REFUNDED_DEMO`) cho các đơn thanh toán trước.
  * Điều phối lại đơn hàng sang chi nhánh khác gần khách hơn nếu chi nhánh hiện tại quá tải.

### 4.3. Marketing, Khuyến Mãi & Tích Điểm FPT Reward
* **Phát hành Mã giảm giá (Coupons)**:
  * Thiết lập mã code (ví dụ: `FPTPIZZA30`), định dạng giảm (phần trăm `%` hoặc tiền mặt cố định).
  * Đặt điều kiện: Giá trị đơn tối thiểu (`minSubtotal`), số tiền giảm tối đa (`maxDiscount`), thời hạn hết hạn (`expiresAt`).
* **Cấu hình Hệ thống Khách hàng Thân thiết (FPT Reward Loyalty)**:
  * Cấu hình tỷ lệ quy đổi điểm chi tiêu (ví dụ: Mỗi 10.000 VNĐ chi tiêu = 1 điểm).
  * Thiết lập ngưỡng thăng hạng thành viên: Thành viên Thường ➔ Bạc ➔ Vàng ➔ Kim Cương và % chiết khấu mặc định tương ứng.

### 4.4. Quản Lý Nhân Sự & Phân Quyền (RBAC Management)
* Tạo và cấp phát tài khoản nội bộ theo vai trò:
  * `ROLE_KITCHEN`: Chỉ xem các đơn đang nấu ở Tab Bếp.
  * `ROLE_CASHIER`: Thu ngân quầy, quét mã QR khách hàng để tích điểm.
  * `ROLE_RIDER`: Shipper, chỉ nhận các đơn đã sẵn sàng để đi giao.
  * `ROLE_STORE_MANAGER`: Toàn quyền quản trị trong phạm vi cửa hàng phụ trách.
* Quản lý danh sách khách hàng, khóa/chặn (blacklist) các số điện thoại thường xuyên boom hàng.

### 4.5. Báo Cáo Doanh Thu & Chỉ Số Hiệu Suất (Analytics & Reporting)
* **Báo cáo tài chính**: Doanh thu thuần, phí giao hàng thu được, giá trị chiết khấu khuyến mại theo ngày/tuần/tháng.
* **Chỉ số bán hàng (AOV & Top Sellers)**: Giá trị đơn hàng trung bình, top 5 món pizza bán chạy nhất, danh mục mang lại doanh thu cao nhất.
* **Chỉ số vận hành (Operational KPIs)**: Thời gian trung bình từ lúc nhận đơn đến khi hoàn thành món, tỷ lệ hủy đơn (Cancellation Rate).

---

## 5. VÒNG ĐỜI ĐƠN HÀNG (ORDER STATE MACHINE LIFECYCLE)

Chi tiết sự luân chuyển trạng thái đơn hàng định nghĩa trong [`src/types/order.ts`](file:///c:/Users/phuct/Desktop/React_Native/AssignmentMMA/src/types/order.ts):

| Trạng thái đơn | Khách hàng (User) thấy gì? | Nhân viên (Employee) thực hiện | Quản trị viên (Admin) kiểm soát |
|---|---|---|---|
| **`PENDING_CONFIRMATION`** | Đơn đang chờ nhà hàng tiếp nhận | Nhận thông báo ➔ Bấm **Xác nhận** hoặc **Từ chối** | Giám sát tỷ lệ tiếp nhận đơn đúng giờ |
| **`CONFIRMED`** | Nhà hàng đã xác nhận đơn | Chuẩn bị nguyên liệu ➔ Bấm **Bắt đầu nấu** | Theo dõi hàng đợi của nhà bếp |
| **`PREPARING`** | Bếp đang làm bánh pizza | Nướng bánh, kiểm tra chất lượng ➔ Bấm **Món đã sẵn sàng** | Đo lường thời gian chế biến của từng đầu bếp |
| **`READY`** | Món đã làm xong, chờ giao | Bàn giao Shipper hoặc gọi khách tại quầy | Phân phối tài xế giao hàng nếu thiếu shipper |
| **`OUT_FOR_DELIVERY`** | Tài xế đang trên đường giao | Shipper di chuyển giao bánh ➔ Bấm **Giao thành công** | Theo dõi vị trí và thời gian giao hàng |
| **`COMPLETED`** | Đơn hoàn tất, tích điểm FPT Reward | Đơn lưu vào lịch sử ca làm việc | Ghi nhận doanh thu vào báo cáo tài chính |
| **`CANCELLED`** | Đơn bị hủy (kèm lý do cụ thể) | Không thực hiện làm bánh | Kích hoạt quy trình hoàn tiền cho khách |

---

## 6. MA TRẬN PHÂN QUYỀN TRUY CẬP (RBAC MATRIX)

| Chức năng hệ thống | Khách vãng lai (Guest) | Khách thành viên (Member) | Nhân viên bếp/giao (Staff) | Quản trị viên (Admin) |
|:---|:---:|:---:|:---:|:---:|
| **Xem Menu, Tìm kiếm & Chi tiết món** | ✅ | ✅ | ✅ | ✅ |
| **Thêm giỏ hàng & Đặt hàng** | ✅ | ✅ | ❌ | ❌ |
| **Quản lý Địa chỉ nhận hàng & Profile** | ❌ | ✅ | ❌ | ❌ |
| **Tích lũy Điểm thưởng & Mã QR Member**| ❌ | ✅ | ❌ | ❌ |
| **Duyệt đơn, Báo nấu & Báo sẵn sàng** | ❌ | ❌ | ✅ | ✅ *(Can thiệp)* |
| **Cập nhật Giao hàng thành công** | ❌ | ❌ | ✅ | ✅ |
| **Bật/Tắt trạng thái Hết món (Out of Stock)**| ❌ | ❌ | ❌ | ✅ |
| **Thêm / Sửa / Xóa món ăn & Đổi giá** | ❌ | ❌ | ❌ | ✅ |
| **Tạo Voucher & Cấu hình FPT Reward** | ❌ | ❌ | ❌ | ✅ |
| **Xem Báo cáo Doanh thu & Phân quyền User**| ❌ | ❌ | ❌ | ✅ |

---

## 7. KHUYẾN NGHỊ KỸ THUẬT TRIỂN KHAI (ENGINEERING BLUEPRINT)

Để đưa hệ thống lên môi trường Production hoàn chỉnh, kiến trúc kỹ thuật cần bổ sung các hạng mục sau:

### 7.1. Cập Nhật Type Phân Quyền (`src/types/user.ts`)
```typescript
export type UserRole = 'CUSTOMER' | 'STAFF' | 'STORE_MANAGER' | 'SUPER_ADMIN';

export type DemoUser = {
  id: string;
  fullname: string;
  email: string;
  phone: string;
  role: UserRole;             // Phân định vai trò truy cập
  branchId?: string;          // Gắn với chi nhánh cụ thể (cho Staff/Store Manager)
  avatar?: string;
  birthday?: string;
  gender?: string;
  isDemo?: boolean;
};
```

### 7.2. Cấu Trúc Thư Mục Điều Hướng Đề Xuất (Expo Router)
```text
src/app/
  ├── (tabs)/                 # Dành cho Khách hàng (Home, Menu, Rewards, Profile)
  ├── demo/
  │   └── staff-orders.tsx    # Giao diện Bếp & Giao nhận của Nhân viên
  └── admin/                  # [Module Quản trị]
      ├── _layout.tsx         # Route Guard: Kiểm tra role Admin/Manager
      ├── dashboard.tsx       # Báo cáo tổng quan, doanh số & biểu đồ
      ├── products/
      │   ├── index.tsx       # Danh sách món ăn kèm công tắc Out-of-Stock
      │   └── [id].tsx        # Form chỉnh sửa món, biến thể size/đế
      ├── promotions.tsx      # Quản lý mã giảm giá & tích điểm
      └── users.tsx           # Danh sách người dùng & phân quyền nội bộ
```

### 7.3. Hook Bảo Vệ Quyền Truy Cập (`src/hooks/useAdminGuard.ts`)
```typescript
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../state/AuthContext';

export function useAdminGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'STORE_MANAGER')) {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading]);

  return { 
    isAdmin: user?.role === 'SUPER_ADMIN' || user?.role === 'STORE_MANAGER', 
    isLoading 
  };
}
```

### 7.4. Cơ Chế Đồng Bộ Đơn Hàng Thời Gian Thực (Real-time Sync)
Thay thế việc lưu trữ cục bộ trong [`OrderContext.tsx`](file:///c:/Users/phuct/Desktop/React_Native/AssignmentMMA/src/state/OrderContext.tsx) bằng kết nối **Firebase Firestore `onSnapshot`**:
* Khi **User** đặt đơn ➔ Tạo document mới trong collection `orders` với trạng thái `PENDING`.
* Khi **Staff** chuyển trạng thái sang `PREPARING` hoặc `OUT_FOR_DELIVERY` ➔ Cập nhật document và tự động phản hồi tức thì lên màn hình của **User** thông qua Firestore real-time listener mà không cần reload.

---

## 8. KIẾN TRÚC TÍCH HỢP FIREBASE & CSDL CLOUD (FIREBASE INTEGRATION BLUEPRINT)

Dự án sử dụng **Google Firebase (Project: `pizzastore-59bad`)** làm hệ thống backend không máy chủ (Serverless BaaS), cung cấp hạ tầng xác thực và cơ sở dữ liệu thời gian thực.

### 8.1. Cấu Trúc Collections Trong Cloud Firestore

```text
Firestore Root
  ├── users/                     # Thông tin người dùng & Phân quyền RBAC
  │     └── {userId}             # Document ID = Firebase Auth UID
  │           ├── email: string
  │           ├── fullName: string
  │           ├── phone: string
  │           ├── role: "USER" | "EMPLOYEE" | "STORE_MANAGER" | "SUPER_ADMIN"
  │           ├── rewardPoints: number
  │           └── createdAt: timestamp
  │
  ├── products/                  # Danh mục thực đơn Pizza & Toppings
  │     └── {productId}
  │           ├── name: string
  │           ├── description: string
  │           ├── basePrice: number
  │           ├── category: "PIZZA" | "DRINK" | "SIDES"
  │           ├── isAvailable: boolean
  │           ├── imageUrl: string
  │           └── sizes: [{ name: "S" | "M" | "L", extraPrice: number }]
  │
  └── orders/                    # Đơn hàng đồng bộ Real-time (User ↔ Staff)
        └── {orderId}
              ├── orderNumber: string (ví dụ: #PF-1082)
              ├── userId: string (Ref to users)
              ├── customerName: string
              ├── customerPhone: string
              ├── deliveryAddress: string
              ├── items: [{ productId, name, size, crust, quantity, price }]
              ├── subtotal: number
              ├── discount: number
              ├── deliveryFee: number
              ├── totalAmount: number
              ├── paymentMethod: "COD" | "MOMO" | "VNPAY"
              ├── paymentStatus: "UNPAID" | "PAID"
              ├── status: "PENDING" | "CONFIRMED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"
              ├── staffId?: string (Nhân viên nhận xử lý)
              ├── createdAt: timestamp
              └── updatedAt: timestamp
```

### 8.2. Điểm Truy Cập Dịch Vụ (`src/services/firebase.ts`)
* **Firebase Auth**: Khởi tạo với `getReactNativePersistence(AsyncStorage)` duy trì đăng nhập bền vững trên thiết bị di động.
* **Firestore**: Xuất instance `db` phục vụ các thao tác đọc ghi dữ liệu (`getDocs`, `addDoc`, `updateDoc`, `onSnapshot`).

