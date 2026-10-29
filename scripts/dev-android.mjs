// One command for a local Android demo: emulator (if none is connected) + backend + Expo Go.
// Usage: npm run android:dev   (optional: AVD=<name> to pick an emulator, BACKEND_PORT=<port>)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const windows = process.platform === 'win32';
const exe = name => (windows ? `${name}.exe` : name);
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  || (windows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(process.env.HOME ?? '', 'Android', 'Sdk'));
// Use the SDK's adb: another adb on PATH (e.g. an npm package) fights over the daemon and drops the device.
const adb = join(sdk, 'platform-tools', exe('adb'));
const emulator = join(sdk, 'emulator', exe('emulator'));
const backendPort = Number(process.env.BACKEND_PORT ?? 3001);
const children = [];

const log = message => console.log(`\x1b[36m[android:dev]\x1b[0m ${message}`);
const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fail(message) {
  console.error(`\x1b[31m[android:dev] ${message}\x1b[0m`);
  process.exit(1);
}

const devices = () => run(adb, ['devices']).stdout.split('\n').slice(1)
  .map(line => line.trim().split('\t')).filter(([, state]) => state === 'device').map(([id]) => id);

async function ensureDevice() {
  if (!existsSync(adb)) fail(`Không thấy adb tại ${adb}. Cài Android SDK hoặc đặt ANDROID_HOME.`);
  run(adb, ['start-server']);
  if (devices().length) return log(`Dùng thiết bị đang kết nối: ${devices().join(', ')}`);

  const avds = run(emulator, ['-list-avds']).stdout?.split('\n').map(s => s.trim()).filter(Boolean) ?? [];
  const avd = process.env.AVD || avds[0];
  if (!avd) fail('Chưa có emulator nào. Tạo một máy ảo trong Android Studio (Device Manager) hoặc cắm điện thoại.');
  log(`Mở emulator ${avd}...`);
  // Detached: the emulator stays open when this script stops, so the next run starts instantly.
  spawn(emulator, ['-avd', avd, '-no-boot-anim'], { detached: true, stdio: 'ignore' }).unref();

  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (devices().length && run(adb, ['shell', 'getprop', 'sys.boot_completed']).stdout.trim() === '1') {
      return log('Emulator đã sẵn sàng.');
    }
    await sleep(3000);
  }
  fail('Emulator chưa khởi động xong sau 4 phút. Mở Android Studio để kiểm tra máy ảo.');
}

async function backendRunning() {
  try {
    return (await fetch(`http://localhost:${backendPort}/health`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

function start(name, command, args) {
  // Inherit the terminal so Expo stays interactive (r = reload, j = debugger) and logs keep their colors.
  const child = spawn(command, args, { stdio: 'inherit', shell: windows, env: { ...process.env, ANDROID_HOME: sdk } });
  child.on('exit', code => {
    if (!stopping) { log(`${name} đã dừng (mã ${code}). Dừng toàn bộ.`); stop(code ?? 1); }
  });
  children.push(child);
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // npm/npx run through a shell on Windows; kill the whole tree or the servers keep running.
    if (windows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGINT');
  }
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

await ensureDevice();
// The emulator reaches the backend and Metro on this computer through "localhost".
for (const port of [backendPort, 8081]) run(adb, ['reverse', `tcp:${port}`, `tcp:${port}`]);
log(`Đã nối cổng ${backendPort} (backend) và 8081 (Metro) từ emulator về máy tính.`);

if (await backendRunning()) log(`Backend đã chạy sẵn ở cổng ${backendPort}, dùng lại.`);
else start('Backend', 'npm', ['--prefix', 'backend', 'run', 'dev']);

start('Expo', 'npx', ['expo', 'start', '--android', '--go']);
log('Nhấn Ctrl+C để dừng backend và Expo (emulator vẫn mở cho lần sau).');
