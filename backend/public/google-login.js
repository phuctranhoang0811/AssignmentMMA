const message = document.getElementById('message');
const login = document.getElementById('login');
const approve = document.getElementById('approve');
const account = document.getElementById('account');

async function boot() {
  const sessionId = new URLSearchParams(location.search).get('session');
  const browserKey = location.hash.slice(1);
  history.replaceState(null, '', location.pathname + location.search);
  if (!/^[a-f0-9]{64}$/.test(sessionId || '') || !/^[a-f0-9]{64}$/.test(browserKey)) {
    throw new Error('Liên kết không hợp lệ hoặc đã tải lại. Vui lòng tạo yêu cầu mới từ Expo Go.');
  }
  const body = { sessionId, browserKey };
  async function send(path, token) {
    const response = await fetch(`/auth/bridge/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body), cache: 'no-store', credentials: 'omit',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể xác nhận đăng nhập. Vui lòng thử lại.');
    return result;
  }
  const info = await send('info');
  document.getElementById('pairing').textContent = info.pairingCode;
  const configResponse = await fetch('/auth/google/config', { cache: 'no-store' });
  if (!configResponse.ok) throw new Error('Máy chủ chưa cấu hình Google Login.');
  const config = await configResponse.json();
  const [{ initializeApp }, { initializeAuth, inMemoryPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signOut }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),
  ]);
  const auth = initializeAuth(initializeApp(config), { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let user = null;
  login.disabled = false;
  message.textContent = 'Đăng nhập bằng tài khoản @gmail.com của bạn.';
  login.onclick = async () => {
    const signingIn = signInWithPopup(auth, provider);
    login.disabled = true;
    approve.hidden = true;
    account.hidden = true;
    user = null;
    try {
      const result = await signingIn;
      if (!result.user.emailVerified || !/^[^\s@]+@gmail\.com$/i.test(result.user.email || '')) {
        await signOut(auth);
        throw new Error('Vui lòng chọn tài khoản @gmail.com đã được Google xác minh.');
      }
      user = result.user;
      account.textContent = `Tài khoản: ${user.email}`;
      account.hidden = false;
      approve.hidden = false;
      message.textContent = 'Nếu tài khoản và mã đối chiếu đúng, hãy xác nhận bên dưới.';
    } catch (error) {
      const messages = { 'auth/unauthorized-domain': 'Domain này chưa được thêm vào Authorized domains trong Firebase.',
        'auth/operation-not-allowed': 'Google provider chưa được bật trong Firebase.',
        'auth/popup-blocked': 'Vui lòng cho phép cửa sổ đăng nhập Google trong trình duyệt.',
        'auth/popup-closed-by-user': 'Đã hủy chọn tài khoản. Bạn có thể thử lại.' };
      message.textContent = messages[error.code] || error.message || 'Đăng nhập chưa thành công.';
    } finally { login.disabled = false; }
  };
  approve.onclick = async () => {
    if (!user) return;
    approve.disabled = true;
    login.disabled = true;
    try {
      await send('approve', await user.getIdToken());
      approve.hidden = true;
      login.hidden = true;
      await signOut(auth);
      user = null;
      message.textContent = 'Đã xác nhận. Hãy quay lại Expo Go và kiểm tra email để hoàn tất đăng nhập.';
    } catch (error) {
      message.textContent = error.message || 'Chưa thể xác nhận. Vui lòng thử lại.';
      approve.disabled = false;
      login.disabled = false;
    }
  };
}
boot().catch(error => { message.textContent = error.message || 'Không tải được trang đăng nhập. Vui lòng thử lại từ Expo Go.'; });
