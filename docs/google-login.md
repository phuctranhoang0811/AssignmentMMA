# Google Login trên Firebase

App dùng Firebase JavaScript SDK. Google SDK trên Android/iOS chỉ lấy Google ID token;
`signInWithCredential` đổi token đó thành phiên Firebase hiện có. Web dùng Firebase popup.
Backend payOS/đổi quà tiếp tục nhận Firebase ID token, không nhận Google ID token.

## Test trên điện thoại với Expo Go

Đã bổ sung cách đăng nhập qua trình duyệt, không cần Google SDK native bên trong Expo Go.
Không dùng OAuth redirect về scheme của Expo Go và không dùng proxy OAuth cũ của Expo.

### Chưa có domain HTTPS: dùng tunnel tạm

Không cần mua domain hoặc tạo tài khoản Cloudflare để dùng Quick Tunnel cho bản thử nghiệm.
Trên Windows cài `cloudflared` theo hướng dẫn chính thức, ví dụ:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

Mở terminal mới sau khi cài. Cấu hình `backend/.env` như backend hiện tại, gồm Firebase Admin,
và đảm bảo `.env` gốc có `EXPO_PUBLIC_FIREBASE_API_KEY`. Tại thư mục gốc chạy:

```powershell
npm run google:expo-go
```

Lệnh này tạo một backend thử nghiệm riêng trên loopback và tunnel **chỉ chuyển tiếp các route đăng nhập**.
API đơn hàng, webhook và payOS không được chuyển tiếp ra tunnel. Lệnh không dừng backend đang chạy sẵn.
Lệnh tự gán cấu hình origin/API key cho backend thử nghiệm và cập nhật `EXPO_PUBLIC_GOOGLE_BRIDGE_URL`
trong `.env` gốc; không ghi đè các biến thanh toán.

Sau khi URL và hostname xuất hiện:

1. Thêm hostname được in ra vào Firebase Authentication → Settings → Authorized domains.
2. Bật Google provider nếu chưa bật; thêm Gmail vào Test users nếu consent screen đang Testing.
3. Ở terminal khác chạy `npx expo start --go --clear`, mở app trên điện thoại và bấm Google.

Giữ terminal tunnel chạy. `Ctrl+C` dừng cả tunnel và backend thử nghiệm của lệnh đó.
Hostname đổi mỗi lần khởi chạy; cần thêm hostname mới trong Firebase. Không bật `--allowed-mail` của
Cloudflare cho luồng này vì app cần gọi API không tương tác trong trình duyệt. Các route đăng nhập được
public qua URL tạm, nhưng vẫn kiểm tra khóa thiết bị, khóa trình duyệt và Firebase token như mô tả bên dưới.
Log khởi động nằm tại `.expo/google-bridge.log`, không ghi log body/token của các request đăng nhập.

Tham khảo: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

### Đã có backend HTTPS: cấu hình thủ công

1. Backend đã có trong thư mục `backend/` cần chạy sau một URL **HTTPS** truy cập được từ điện thoại.
   Có thể dùng domain triển khai hoặc HTTPS tunnel do bạn kiểm soát. Không dùng `localhost`,
   `10.0.2.2`, IP LAN HTTP làm URL bridge trên điện thoại thật.
2. Trong `backend/.env`, bổ sung các giá trị của cùng Firebase project:

   ```env
   GOOGLE_BRIDGE_ORIGIN=https://YOUR_BACKEND_HOST
   FIREBASE_WEB_API_KEY=YOUR_FIREBASE_WEB_API_KEY
   FIREBASE_AUTH_DOMAIN=pizzastore-59bad.firebaseapp.com
   ```

   URL không có đường dẫn hoặc dấu `/` cuối. `FIREBASE_WEB_API_KEY` là giá trị công khai tương ứng
   với `EXPO_PUBLIC_FIREBASE_API_KEY` của app, không phải Client Secret hay service account.
   Backend vẫn cần cấu hình Firebase Admin và các cấu hình hiện có trong `backend/.env.example`.
   Firebase Admin cần quyền ký custom token (private key service account hoặc IAM `signBlob`).
3. Trong Firebase Authentication, bật Google provider và thêm **hostname** HTTPS ở bước 1 vào
   Settings → Authorized domains. Nếu consent screen của Google đang Testing, thêm Gmail thử nghiệm.
4. Trong `.env` của app:

   ```env
   EXPO_PUBLIC_GOOGLE_BRIDGE_URL=https://YOUR_BACKEND_HOST
   ```

5. Khởi động lại backend: chạy `npm run dev` trong thư mục `backend/`.
   Chạy `npx expo start --go --clear` tại thư mục gốc, rồi mở app bằng Expo Go trên điện thoại.
6. Bấm Google → đối chiếu mã 6 số → chọn Gmail trên trình duyệt → bấm xác nhận → tự quay lại Expo Go
   bằng trình chuyển ứng dụng → kiểm tra email và xác nhận lần cuối trong app.
   App có nút mở lại trang đăng nhập hoặc hủy yêu cầu đang chờ.

Luồng Expo Go không cần Web/iOS OAuth Client ID trong biến môi trường app; Firebase Google provider
trên trang web quản lý OAuth. Development build tiếp tục dùng cấu hình native ở phần dưới.

### Giới hạn và bảo vệ

- Mã 6 số chỉ để người dùng đối chiếu, không phải khóa nhận phiên. Điện thoại giữ verifier ngẫu nhiên
  256 bit; backend chỉ giữ hash. Trình duyệt giữ một khóa khác trong fragment URL, không trong query.
- Backend chỉ chấp nhận Firebase ID token đã xác minh, provider Google, Gmail đã xác minh và đăng nhập mới.
  Client không được chọn UID, email hay quyền của custom token.
- Phiên hết hạn sau 5 phút, chỉ nhận một lần. Hủy, hết hạn hoặc đã nhận thì không tái sử dụng được.
  Nếu mất phản hồi khi nhận token hoặc ký token thất bại, bắt đầu yêu cầu mới; không mở lại phiên đã nhận.
- Yêu cầu chỉ nằm trong bộ nhớ riêng của **một process backend**, tối đa 500 yêu cầu đang lưu.
  Restart làm mất yêu cầu đang chờ. Dùng private shared store trước khi triển khai nhiều instance.
- Trang đăng nhập không lưu token vào localStorage hoặc URL; app chỉ nhận token qua POST HTTPS.
  Reverse proxy không được ghi log body hoặc header Authorization của các endpoint `/auth/bridge/*`.
- Kiểm tra HTTPS/cert thật trên điện thoại; không bỏ qua cảnh báo chứng chỉ. Code đã được thêm,
  nhưng cần URL HTTPS và cấu hình Firebase thực tế để kiểm chứng đăng nhập trên thiết bị.

## Firebase và Google Cloud

1. Trong Firebase project đang cấu hình cho app, mở Authentication → Sign-in method → Google.
   Bật provider, chọn support email và lưu.
2. Mở Google Cloud Console của cùng project → APIs & Services → Credentials.
   Lấy OAuth Client ID loại **Web application**, đặt trong `.env`:

   ```env
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
   ```

   Đây là ID công khai. Không thêm Client Secret vào app hay repo.
3. Nếu OAuth consent screen còn Testing, thêm Gmail thử nghiệm vào Test users.
   Cấu hình/phát hành consent screen trước khi cho người dùng ngoài danh sách thử nghiệm đăng nhập.

## Android

- Package hiện tại: `com.pizzatime.app` trong `app.json`.
- Tạo/cấu hình OAuth client loại Android trong cùng Google Cloud project, khớp package này và
  SHA-1 của chứng chỉ ký bản build. Thêm SHA-1/SHA-256 vào Firebase Android app tương ứng.
  Chứng chỉ development, preview và Google Play có thể khác nhau; phải đăng ký đúng bản đang chạy.
- App truyền **Web Client ID**, không truyền Android Client ID, vào `GoogleSignin.configure`.
- Cách tích hợp này không khởi tạo Firebase native SDK; Android Google SDK nhận client ID trực tiếp
  và được autolink khi build. Không cần thêm `google-services.json` chỉ để khởi tạo Firebase JS.
- Máy ảo cần image có Google Play Services. Expo Go không chứa native Google SDK.

```powershell
npx eas-cli@latest build --profile development --platform android
npm run dev:client
```

Cài bản development build vừa tạo rồi mở bằng dev server. Sau khi thêm native dependency,
bản development build cũ cũng phải build lại. Không sửa `android/` bằng tay.

## iOS

Đăng ký bundle identifier của app và OAuth client loại iOS trong cùng project. Thêm vào `.env`
và các biến môi trường build EAS tương ứng:

```env
IOS_BUNDLE_IDENTIFIER=YOUR_REGISTERED_BUNDLE_IDENTIFIER
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
```

`app.config.ts` dùng iOS Client ID để cấu hình URL scheme đảo ngược qua Google Sign-In config plugin.
Phải cấu hình các biến này trước khi build iOS và trước khi chạy dev server.

```powershell
npx eas-cli@latest build --profile development --platform ios
npm run dev:client
```

## Web

Thêm domain đang chạy vào Firebase Authentication → Settings → Authorized domains.
Với project mới, cần tự kiểm tra/thêm `localhost`. Cho phép popup của app.
Web dùng provider Google trong Firebase và không cần native SDK hoặc iOS Client ID.

## Hành vi tài khoản

- Chỉ chấp nhận địa chỉ `@gmail.com` đã xác minh và provider Google từ kết quả Firebase.
  Không dùng email người dùng tự nhập để giả lập đăng nhập.
- Lần đầu tạo `users/{firebaseUid}` với vai trò USER, 100 điểm theo chính sách đăng ký hiện tại.
  Transaction không ghi đè hồ sơ đã có; đăng nhập lại không cấp lại điểm hay đổi vai trò.
- Không tự gộp hồ sơ theo email. Firebase quản lý việc liên kết provider trên cùng UID.
  Nếu Firebase báo khác phương thức đăng nhập, dùng phương thức cũ để đăng nhập trước.
- Google thường không cung cấp số điện thoại; checkout vẫn yêu cầu người dùng nhập số hợp lệ.
- Tài khoản chỉ dùng Google không hiện Đổi mật khẩu. Tài khoản có liên kết password vẫn dùng được mục này.
- Hủy cửa sổ chọn tài khoản không điều hướng và không hiện lỗi. Khi cấu hình thiếu, app báo lý do;
  Google Login không chuyển sang tài khoản demo.
- Giới hạn Gmail được kiểm tra trong luồng app. Nếu cần cấm domain khác ở toàn bộ Firebase project,
  phải thêm chính sách phía server/Firebase; UI không thay thế được chính sách đó.

## Kiểm tra sau cấu hình

1. Gmail mới: chọn tài khoản → tạo hồ sơ → về đúng màn đã yêu cầu đăng nhập.
2. Gmail đã có: giữ nguyên UID, điểm, vai trò và thông tin đã sửa; giỏ hàng giữ nguyên.
3. Hủy đăng nhập: ở lại màn đăng nhập, thử lại được.
4. Google Workspace, Gmail chưa xác minh hoặc email giả đuôi Gmail: app từ chối đăng nhập.
5. Đóng/mở app: khôi phục phiên Firebase; backend payOS/đổi quà nhận token của đúng tài khoản.

Test tự động chạy trong `backend`: `node --import tsx --test test/google-auth.test.ts`.
Chưa thay thế được test đăng nhập thật bằng OAuth Client ID và chứng chỉ build của project.
Các test handoff Expo Go: `node --import tsx --test test/google-bridge.test.ts`.

Tài liệu:
- https://docs.expo.dev/guides/google-authentication/
- https://react-native-google-signin.github.io/docs/setting-up/expo
- https://firebase.google.com/docs/auth/web/google-signin
