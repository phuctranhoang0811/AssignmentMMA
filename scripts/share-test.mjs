// One command so the whole team can test: backend + public HTTPS tunnel + Expo (tunnel mode).
// Teammates only install Expo Go and scan the QR code; they need no .env, no keys, no emulator.
// Usage: npm run share        (optional: --lan = same Wi-Fi only, --no-webhook = leave the payOS webhook alone)
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const windows = process.platform === 'win32';
const root = fileURLToPath(new URL('../', import.meta.url));
const backendDir = join(root, 'backend');
const port = Number(process.env.BACKEND_PORT ?? 3001);
const lan = process.argv.includes('--lan');
const skipWebhook = process.argv.includes('--no-webhook') || process.env.PAYOS_TUNNEL === '0';
const children = [];
let stopping = false;

const log = message => console.log(`\x1b[36m[share]\x1b[0m ${message}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // npx runs through a shell on Windows; kill the whole tree or Metro keeps running.
    if (windows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGINT');
  }
  process.exit(code);
}
function fail(message) {
  console.error(`\x1b[31m[share] ${message}\x1b[0m`);
  stop(1);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const find = commands => commands.find(command => spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0);
const healthy = async url => {
  try { return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) })).ok; } catch { return false; }
};

// ---- Preflight: say what is missing before starting anything. ----
const backendEnvPath = join(backendDir, '.env');
if (!existsSync(backendEnvPath)) fail('Thiếu backend/.env. Sao chép backend/.env.example thành backend/.env rồi điền khóa (xem TEAM_GUIDE.md).');
if (!existsSync(join(root, 'node_modules')) || !existsSync(join(backendDir, 'node_modules'))) {
  fail('Chưa cài thư viện. Chạy: npm install && npm --prefix backend install');
}
const backendEnv = parseEnv(await readFile(backendEnvPath, 'utf8'));
const credentials = backendEnv.GOOGLE_APPLICATION_CREDENTIALS;
if (credentials && !existsSync(credentials)) fail(`Không thấy service account Firebase tại ${credentials}. Sửa GOOGLE_APPLICATION_CREDENTIALS trong backend/.env.`);
if (await healthy(`http://127.0.0.1:${port}`)) {
  fail(`Cổng ${port} đang có backend chạy sẵn (có thể là "npm run dev"). Tắt nó rồi chạy lại để backend nhận địa chỉ công khai mới.`);
}
const cloudflared = find(['cloudflared', 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe', 'C:\\Program Files\\cloudflared\\cloudflared.exe']);
if (!cloudflared) fail('Chưa cài cloudflared (tạo link HTTPS công khai cho backend). Windows: winget install --id Cloudflare.cloudflared --exact, rồi mở terminal mới.');

await mkdir(join(root, '.expo'), { recursive: true });
const backendLog = createWriteStream(join(root, '.expo', 'share-backend.log'), { flags: 'w' });

// ---- 1. Public HTTPS address for the backend. ----
log('Đang tạo link công khai cho backend...');
const tunnel = spawn(cloudflared, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { windowsHide: true });
children.push(tunnel);
const origin = await new Promise(resolve => {
  const timer = setTimeout(() => resolve(undefined), 60_000);
  const read = chunk => {
    const found = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk))?.[0];
    if (found) { clearTimeout(timer); resolve(found); }
  };
  tunnel.stdout.on('data', read);
  tunnel.stderr.on('data', read);
  tunnel.once('exit', () => { clearTimeout(timer); resolve(undefined); });
});
if (!origin) fail('Không tạo được link công khai (cloudflared). Kiểm tra mạng rồi chạy lại.');
tunnel.once('exit', code => { if (!stopping) fail(`cloudflared đã dừng (mã ${code}). Chạy lại npm run share.`); });

// ---- 2. Backend, told its own public address (payment return pages, Google login bridge). ----
// Variables set here win over backend/.env, which node only uses for what is still unset.
const loader = new URL('../backend/node_modules/tsx/dist/loader.mjs', import.meta.url).href;
const bridge = backendEnv.FIREBASE_WEB_API_KEY ? { GOOGLE_BRIDGE_ORIGIN: origin } : {};
const backend = spawn(process.execPath, ['--env-file=.env', '--import', loader, 'src/server.ts'], {
  cwd: backendDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', PAYOS_RETURN_URL: `${origin}/payment/return`,
    PAYOS_CANCEL_URL: `${origin}/payment/cancel`, ...bridge },
});
children.push(backend);
backend.stdout.pipe(backendLog, { end: false });
backend.stderr.pipe(backendLog, { end: false });
backend.once('exit', code => { if (!stopping) fail(`Backend đã dừng (mã ${code}). Xem .expo/share-backend.log (thường do sai backend/.env).`); });

log('Đang chờ backend sẵn sàng...');
let ready = false;
for (let i = 0; i < 45 && !ready && !stopping; i++) { // the fresh tunnel hostname needs a few seconds to resolve
  ready = await healthy(origin);
  if (!ready) await sleep(2000);
}
if (!ready) fail('Backend chưa trả lời qua link công khai sau 90 giây. Xem .expo/share-backend.log.');
log(`Backend công khai: ${origin}`);

// ---- 3. payOS only reports a paid QR to a public HTTPS URL. ----
// The webhook is set for the whole payOS channel: it now points at this computer until someone else registers theirs.
if (!skipWebhook) {
  const result = spawnSync('npm', ['--prefix', 'backend', 'run', 'webhook:register', '--', `${origin}/api/webhooks/payos`],
    { cwd: root, encoding: 'utf8', shell: windows, env: { ...process.env, PORT: String(port) } });
  log(result.status === 0 ? 'Webhook payOS đã trỏ về máy này: tiền vào là app báo "đã thanh toán" ngay.'
    : 'Chưa đăng ký được webhook payOS. App vẫn tự kiểm tra thanh toán mỗi 3 giây.');
}

console.log(`
\x1b[1m================ GỬI CHO BẠN BÈ ================\x1b[0m
 1. Cài app "Expo Go" (Android: Google Play, iOS: App Store).
 2. Quét mã QR bên dưới bằng Expo Go (iPhone: quét bằng app Camera).
 3. Vào app, đăng ký/đăng nhập rồi test theo docs/TEST_CHECKLIST.md.
 Lưu ý: dữ liệu là Firebase dùng chung. Thanh toán QR payOS là tiền thật, hãy chọn COD khi test.
${lan ? ' Chế độ --lan: điện thoại phải cùng Wi-Fi với máy này.\n' : ''}${bridge.GOOGLE_BRIDGE_ORIGIN
    ? ` Đăng nhập Google (Expo Go) cần thêm "${new URL(origin).hostname}" vào Firebase > Authentication > Settings > Authorized domains.\n` : ''}\x1b[1m=================================================\x1b[0m
`);

// ---- 4. Expo. EXPO_PUBLIC_* are baked into the bundle, so the tunnel address is passed here and the cache cleared. ----
const expo = spawn('npx', ['expo', 'start', '--go', '--clear', lan ? '--lan' : '--tunnel'], {
  cwd: root, stdio: 'inherit', shell: windows,
  env: { ...process.env, EXPO_PUBLIC_API_URL: origin, EXPO_PUBLIC_ANDROID_API_URL: origin,
    ...(bridge.GOOGLE_BRIDGE_ORIGIN ? { EXPO_PUBLIC_GOOGLE_BRIDGE_URL: origin } : {}) },
});
children.push(expo);
expo.once('exit', code => { if (!stopping) { log(`Expo đã dừng (mã ${code}). Dừng toàn bộ.`); stop(code ?? 1); } });
log('Nhấn Ctrl+C để dừng tất cả. Khi dừng, bạn bè sẽ không vào được app nữa.');
