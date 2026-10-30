// Checks the local pieces of native Google Sign-In (the parts that live in this repo) and says what is still missing.
// It cannot see the Google Cloud / Firebase console. Run: npm run google:check
import { existsSync, readFileSync } from 'node:fs';

try { process.loadEnvFile('.env'); } catch { /* No .env: every variable below is reported as missing. */ }

const problems = [];
const notes = [];
const env = name => process.env[name]?.trim() ?? '';
const clientId = /^[\w-]+\.apps\.googleusercontent\.com$/;

const web = env('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
if (!web) problems.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID chưa có. Lấy OAuth client loại "Web application" trong Google Cloud → Credentials.');
else if (!clientId.test(web)) problems.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID phải có dạng xxxx.apps.googleusercontent.com.');
else if (web === env('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID')) problems.push('Web client ID và iOS client ID đang trùng nhau; hai OAuth client này phải khác loại.');

const ios = env('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
if (!ios) notes.push('Chưa có EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: bỏ qua nếu chỉ build Android. Build iOS bắt buộc phải có.');
else if (!clientId.test(ios)) problems.push('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID phải có dạng xxxx.apps.googleusercontent.com.');
if (ios && !env('IOS_BUNDLE_IDENTIFIER')) problems.push('Có iOS client ID nhưng thiếu IOS_BUNDLE_IDENTIFIER (phải khớp bundle ID đã đăng ký với client đó).');

const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
if (!app.android?.package) problems.push('app.json chưa có android.package.');
else notes.push(`Android package: ${app.android.package}. Tạo OAuth client loại Android với đúng package này và SHA-1 của khóa ký bản build.`);

if (!existsSync('node_modules/@react-native-google-signin/google-signin')) problems.push('Chưa cài @react-native-google-signin/google-signin (chạy npm install).');
if (!existsSync('node_modules/expo-dev-client')) problems.push('Chưa cài expo-dev-client; Google Sign-In native không chạy trong Expo Go.');

notes.push('Google Sign-In native cần development build (npx expo run:android hoặc eas build --profile development), không chạy trong Expo Go.');
notes.push('Không cần google-services.json cho cách tích hợp hiện tại (Firebase JS SDK + Google ID token).');

for (const line of problems) console.log(`✗ ${line}`);
for (const line of notes) console.log(`• ${line}`);
console.log(problems.length ? `\n${problems.length} việc cần làm trước khi đăng nhập Google native chạy được.` : '\nCấu hình trong repo đã đủ. Phần còn lại nằm ở Google Cloud / Firebase console (SHA-1, OAuth client, Test users).');
process.exitCode = problems.length ? 1 : 0;
