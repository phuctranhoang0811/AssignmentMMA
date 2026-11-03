import { createServer, request } from 'node:http';
import { createServer as createPortServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const routes = new Map([
  ['/auth/google', 'GET'], ['/auth/google/client.js', 'GET'], ['/auth/google/config', 'GET'],
  ...['start', 'info', 'approve', 'status', 'claim', 'cancel'].map(name => [`/auth/bridge/${name}`, 'POST']),
]);

export function createGoogleLoginProxy(upstreamPort) {
  return createServer((req, res) => {
    let url;
    try { url = new URL(req.url || '/', 'http://localhost'); }
    catch { res.writeHead(400).end(); return; }
    if (routes.get(url.pathname) !== req.method) { res.writeHead(404).end(); return; }
    const headers = { ...req.headers, host: `127.0.0.1:${upstreamPort}`, connection: 'close' };
    delete headers.upgrade;
    const upstream = request({ hostname: '127.0.0.1', port: upstreamPort,
      path: url.pathname + url.search, method: req.method, headers, timeout: 20000 }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Backend đăng nhập chưa sẵn sàng. Vui lòng thử lại.' }));
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  });
}

async function freePort() {
  const server = createPortServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const backendDir = fileURLToPath(new URL('../backend/', import.meta.url));
  const appEnvPath = new URL('../.env', import.meta.url);
  const appText = await readFile(appEnvPath, 'utf8');
  const appEnv = parseEnv(appText);
  const backendEnv = parseEnv(await readFile(new URL('../backend/.env', import.meta.url), 'utf8'));
  if (appEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID && appEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== backendEnv.FIREBASE_PROJECT_ID) {
    throw new Error('Firebase project của app và backend phải khớp nhau.');
  }
  const apiKey = backendEnv.FIREBASE_WEB_API_KEY || appEnv.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Cần EXPO_PUBLIC_FIREBASE_API_KEY trong .env hoặc FIREBASE_WEB_API_KEY trong backend/.env.');
  if (spawnSync('cloudflared', ['--version'], { windowsHide: true, stdio: 'ignore' }).status !== 0) {
    throw new Error('Chưa cài cloudflared. Trên Windows chạy: winget install --id Cloudflare.cloudflared --exact, rồi mở terminal mới.');
  }
  await mkdir(new URL('../.expo/', import.meta.url), { recursive: true });
  const log = createWriteStream(new URL('../.expo/google-bridge.log', import.meta.url), { flags: 'a' });
  const children = [];
  const backendPort = await freePort();
  const proxy = createGoogleLoginProxy(backendPort);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const child of children) child.kill();
    proxy.close();
    log.end();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
    const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${proxy.address().port}`],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(tunnel);
    const origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Không lấy được URL HTTPS sau 60 giây. Xem .expo/google-bridge.log.')), 60000);
      const fail = () => { clearTimeout(timer); reject(new Error('cloudflared đã dừng. Xem .expo/google-bridge.log.')); };
      tunnel.once('error', fail);
      tunnel.once('exit', fail);
      let output = '';
      const capture = data => {
        if (stopped) return;
        log.write(data);
        output = (output + data.toString()).slice(-12000);
        const url = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (url) { clearTimeout(timer); resolve(url[0]); }
      };
      tunnel.stdout.on('data', capture);
      tunnel.stderr.on('data', capture);
    });
    const loader = new URL('../backend/node_modules/tsx/dist/loader.mjs', import.meta.url).href;
    const backend = spawn(process.execPath, ['--env-file=.env', '--import', loader, 'src/server.ts'], {
      cwd: backendDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(backendPort), HOST: '127.0.0.1', GOOGLE_BRIDGE_ORIGIN: origin,
        FIREBASE_WEB_API_KEY: apiKey,
        FIREBASE_AUTH_DOMAIN: backendEnv.FIREBASE_AUTH_DOMAIN || appEnv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${backendEnv.FIREBASE_PROJECT_ID}.firebaseapp.com` },
    });
    children.push(backend);
    backend.stdout.on('data', data => { if (!stopped) log.write(data); });
    backend.stderr.on('data', data => { if (!stopped) log.write(data); });
    for (const child of children) {
      const failed = () => {
        if (!stopped) { console.error('Dịch vụ đã dừng. Xem .expo/google-bridge.log rồi chạy lại.'); process.exitCode = 1; stop(); }
      };
      child.once('error', failed);
      child.once('exit', failed);
    }
    let ready = false;
    for (let i = 0; i < 60 && !stopped; i++) {
      try { ready = (await fetch(`http://127.0.0.1:${backendPort}/health`, { signal: AbortSignal.timeout(1000) })).ok; }
      catch { /* Wait for Firebase Admin startup. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready || stopped) throw new Error('Backend chưa sẵn sàng. Kiểm tra cấu hình backend/.env và .expo/google-bridge.log.');
    const line = `EXPO_PUBLIC_GOOGLE_BRIDGE_URL=${origin}`;
    const updated = /^EXPO_PUBLIC_GOOGLE_BRIDGE_URL=.*$/m.test(appText)
      ? appText.replace(/^EXPO_PUBLIC_GOOGLE_BRIDGE_URL=.*$/m, line) : appText.trimEnd() + '\n' + line + '\n';
    await writeFile(appEnvPath, updated, 'utf8');
    console.log(`HTTPS đăng nhập: ${origin}`);
    console.log(`Thêm hostname vào Firebase Authentication > Settings > Authorized domains: ${new URL(origin).hostname}`);
    console.log('Đã cập nhật .env. Ở terminal khác, chạy: npx expo start --go --clear');
    console.log('Chỉ các đường dẫn đăng nhập được mở qua tunnel. Giữ terminal này chạy; Ctrl+C để dừng.');
  } catch (error) { stop(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
