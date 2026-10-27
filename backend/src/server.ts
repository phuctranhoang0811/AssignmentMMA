import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PayOS } from '@payos/node';
import { readConfig, readAhamoveConfig } from './config';
import { DeliveryStore } from './delivery';
import { createPaymentServer } from './app';
import { OrderStore } from './store';
import { RewardStore } from './rewards';
import { OrderOpsStore } from './orders';
import { GoogleBridgeStore } from './googleBridgeStore';

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
const { server, io } = createPaymentServer({
  store: new OrderStore(db, !!ahamoveConfig),
  delivery: ahamoveConfig ? new DeliveryStore(db, ahamoveConfig) : undefined,
  rewards: new RewardStore(db),
  // Staff accounts: STAFF_UIDS, falling back to the Ahamove staff list.
  orders: new OrderOpsStore(db, (env.STAFF_UIDS || process.env.AHAMOVE_STAFF_UIDS || '').split(',').map(s => s.trim()).filter(Boolean)),
  googleBridge: env.GOOGLE_BRIDGE_ORIGIN ? {
    store: new GoogleBridgeStore(),
    publicOrigin: env.GOOGLE_BRIDGE_ORIGIN,
    firebase: { apiKey: env.FIREBASE_WEB_API_KEY!, authDomain: env.FIREBASE_AUTH_DOMAIN || `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`, projectId: env.FIREBASE_PROJECT_ID },
    verifyToken: token => getAuth().verifyIdToken(token, true),
    createCustomToken: uid => getAuth().createCustomToken(uid),
  } : undefined,
  payos: new PayOS({ clientId: env.PAYOS_CLIENT_ID, apiKey: env.PAYOS_API_KEY,
    checksumKey: env.PAYOS_CHECKSUM_KEY, timeout: 15000, maxRetries: 1, logLevel: 'off' }),
  verifyToken: token => getAuth().verifyIdToken(token, true),
  origins: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  returnUrl: env.PAYOS_RETURN_URL, cancelUrl: env.PAYOS_CANCEL_URL,
});
server.listen(env.PORT, env.HOST, () => console.log(`Payment backend listening on ${env.PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  io.close();
  server.close(() => process.exit(0));
});
