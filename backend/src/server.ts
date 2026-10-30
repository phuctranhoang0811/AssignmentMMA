import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PayOS } from '@payos/node';
import { readConfig, readAhamoveConfig } from './config';
import { DeliveryStore } from './delivery';
import { createPaymentServer } from './app';
import { OrderStore } from './store';
import { RewardStore } from './rewards';
import { assertStaffAccess, isBlocked, isUnverified, OrderOpsStore } from './orders';
import { AccountStore } from './accounts';
import { isRiderRole } from '../../src/utils/staff';
import { phoneLogin } from './phoneLogin';
import { OtpStore, otpEmailHtml } from './otp';
import nodemailer from 'nodemailer';
import { GoogleBridgeStore } from './googleBridgeStore';
import { PushStore } from './push';
import { ReviewStore } from './reviews';
import { StoreSettingsStore } from './storeSettings';
import { OrderSweeper } from './sweeper';
import { IssueStore } from './issues';
import { recordReportedAction } from './audit';

let env: ReturnType<typeof readConfig>;
try { env = readConfig(process.env); }
catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid backend configuration.');
  process.exit(1);
}
const credential = applicationDefault();
initializeApp({ credential, projectId: env.FIREBASE_PROJECT_ID });
try { await credential.getAccessToken(); }
catch {
  console.error('Firebase Admin could not authenticate. Check the service account credentials and FIREBASE_PROJECT_ID in backend/.env.');
  process.exit(1);
}
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const ahamoveConfig = readAhamoveConfig(process.env);
// Gmail App Password from backend/.env. Without it, development prints the code here (never to the app).
const mailer = env.SMTP_USER && env.SMTP_PASS
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }) : null;
const sendOtp = mailer
  ? async (to: string, code: string) => { await mailer.sendMail({ from: `"Pizza FPT" <${env.SMTP_USER}>`, to,
      subject: '[Pizza FPT] Mã xác thực đăng ký tài khoản', html: otpEmailHtml(code) }); }
  : process.env.NODE_ENV === 'production' ? null
  : async (to: string, code: string) => { console.log(`[OTP dev] ${to}: ${code}`); };
const staffUids = (env.STAFF_UIDS || process.env.AHAMOVE_STAFF_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
const otp = sendOtp ? new OtpStore(sendOtp) : undefined;
const push = new PushStore(db);
const storeSettings = new StoreSettingsStore(db);
const shippingConfig = async () => (await storeSettings.get()).delivery;
const orderStore = new OrderStore(db, !!ahamoveConfig, shippingConfig);
const payos = new PayOS({ clientId: env.PAYOS_CLIENT_ID, apiKey: env.PAYOS_API_KEY,
  checksumKey: env.PAYOS_CHECKSUM_KEY, timeout: 15000, maxRetries: 1, logLevel: 'off' });
const { server, io } = createPaymentServer({
  push,
  reviews: new ReviewStore(db),
  storeSettings,
  audit: (uid, input) => recordReportedAction(db, uid, input),
  issues: new IssueStore(db, issue => { void push.notifyIssueResolved(issue as never, String(issue.orderId)).catch(() => console.error('Issue notice failed')); }),
  store: orderStore,
  delivery: ahamoveConfig ? new DeliveryStore(db, ahamoveConfig) : undefined,
  rewards: new RewardStore(db),
  otp,
  accounts: otp ? new AccountStore(db, otp) : undefined,
  phoneLogin: env.FIREBASE_WEB_API_KEY
    ? (phone, password) => phoneLogin({ db, apiKey: env.FIREBASE_WEB_API_KEY!, createCustomToken: uid => getAuth().createCustomToken(uid) }, phone, password)
    : undefined,
  // Staff accounts: STAFF_UIDS, falling back to the Ahamove staff list.
  orders: new OrderOpsStore(db, staffUids, order => { void push.notifyRefund(order, order.id).catch(() => console.error('Refund notice failed')); }, shippingConfig),
  googleBridge: env.GOOGLE_BRIDGE_ORIGIN ? {
    store: new GoogleBridgeStore(),
    publicOrigin: env.GOOGLE_BRIDGE_ORIGIN,
    firebase: { apiKey: env.FIREBASE_WEB_API_KEY!, authDomain: env.FIREBASE_AUTH_DOMAIN || `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`, projectId: env.FIREBASE_PROJECT_ID },
    verifyToken: token => getAuth().verifyIdToken(token, true),
    createCustomToken: uid => getAuth().createCustomToken(uid),
  } : undefined,
  payos,
  verifyToken: token => getAuth().verifyIdToken(token, true),
  isBlocked: uid => isBlocked(db, uid),
  isUnverified: uid => isUnverified(db, uid),
  isStaff: uid => assertStaffAccess(db, staffUids, uid).then(() => true, () => false),
  isRider: async uid => isRiderRole((await db.collection('users').doc(uid).get()).data()?.role),
  origins: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  returnUrl: env.PAYOS_RETURN_URL, cancelUrl: env.PAYOS_CANCEL_URL,
});
// Tell staff the moment an open order appears or moves (new paid/cash order, status change, finished), and push
// the new status to the customer's phone. Only open orders are watched, so the listener stays small however many
// orders have been completed.
let watching = false;
const lastStatus = new Map<string, string>();
db.collection('orders').where('status', 'in', ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'])
  .onSnapshot(snapshot => {
    const first = !watching;
    watching = true;
    for (const change of snapshot.docChanges()) {
      const data = change.doc.data();
      // A rider taking a READY order changes no status, but the customer should still hear about it.
      const key = (order: { status?: string; rider?: { uid?: string } | null }) => `${order.status}:${order.rider?.uid ?? ''}`;
      if (first) { lastStatus.set(change.doc.id, key(data)); continue; }
      io.to('staff').emit('staff:orders', { id: change.doc.id, orderCode: data.orderCode, status: data.status,
        kind: change.type === 'added' && data.status === 'PENDING_CONFIRMATION' ? 'new' : 'updated' });
      // Riders hear only about store-delivery orders that are free to take, and when one is taken or gone.
      if (data.fulfillmentType === 'delivery' && !data.delivery && ['READY', 'OUT_FOR_DELIVERY'].includes(data.status) || change.type === 'removed') {
        io.to('riders').emit('rider:orders', { id: change.doc.id, status: data.status, available: data.status === 'READY' && !data.rider });
      }
      void (async () => {
        // A finished order leaves this query, so read its final state before telling the customer.
        const order = change.type === 'removed' ? (await change.doc.ref.get()).data() : data;
        const previous = lastStatus.get(change.doc.id);
        if (!order || previous === key(order)) return;
        lastStatus.set(change.doc.id, key(order));
        if (change.type === 'added') return;
        if (previous?.startsWith(`${order.status}:`)) { if (order.rider) await push.notifyRiderAssigned(order, change.doc.id); }
        else await push.notifyStatus(order, change.doc.id);
      })().catch(() => console.error('Push notification failed'));
    }
  }, error => console.error('Order watcher stopped', error instanceof Error ? error.name : 'UnknownError'));
// Nothing waits forever: unpaid QR codes expire and unconfirmed orders escalate, then cancel.
const sweeper = new OrderSweeper(db, payos, data => orderStore.pay(data), alert => io.to('staff').emit('staff:alert', alert));
let sweeping = false;
const sweepTimer = setInterval(() => {
  if (sweeping) return;
  sweeping = true;
  void sweeper.run().catch(() => console.error('Order sweep failed')).finally(() => { sweeping = false; });
}, 60_000);
sweepTimer.unref();
server.listen(env.PORT, env.HOST, () => console.log(`Payment backend listening on ${env.PORT}`));
// A stray rejection must not take payments offline silently; log it where the host's log viewer (or Sentry later) sees it.
for (const event of ['unhandledRejection', 'uncaughtException'] as const) {
  process.on(event, error => console.error(event, error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error'));
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(sweepTimer);
  io.close();
  server.close(() => process.exit(0));
});
