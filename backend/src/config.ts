import { existsSync } from 'node:fs';
import { z } from 'zod';
import type { AhaConfig } from './ahamove';
import { mockStores } from '../../src/data/mockStores';

export function readAhamoveConfig(values: NodeJS.ProcessEnv): AhaConfig | undefined {
  if (values.AHAMOVE_ENABLED !== 'true') return undefined;
  const preset = mockStores.find(store => store.id === (values.AHAMOVE_DEMO_STORE_ID || mockStores[0].id));
  if (!preset) throw new Error('AHAMOVE_DEMO_STORE_ID does not match a demo pickup store.');
  const parsed = z.object({
    AHAMOVE_API_KEY: z.string().trim().min(1),
    AHAMOVE_ACCOUNT_MOBILE: z.string().regex(/^84[35789]\d{8}$/),
    AHAMOVE_SERVICE_ID: z.string().regex(/^[A-Z0-9-]+$/),
    AHAMOVE_WEBHOOK_SECRET: z.string().min(32),
    AHAMOVE_PICKUP_ADDRESS: z.string().trim().min(15).max(500),
    AHAMOVE_PICKUP_NAME: z.string().trim().min(1).max(100),
    AHAMOVE_PICKUP_MOBILE: z.string().regex(/^(0|84)[35789]\d{8}$/),
    AHAMOVE_STAFF_UIDS: z.string().trim().min(1),
  }).safeParse({ ...values, AHAMOVE_PICKUP_ADDRESS: values.AHAMOVE_PICKUP_ADDRESS || preset.address,
    AHAMOVE_PICKUP_NAME: values.AHAMOVE_PICKUP_NAME || preset.name,
    AHAMOVE_PICKUP_MOBILE: values.AHAMOVE_PICKUP_MOBILE || values.AHAMOVE_ACCOUNT_MOBILE });
  if (!parsed.success) throw new Error(`Ahamove staging configuration missing or invalid: ${[...new Set(parsed.error.issues.map(issue => issue.path.join('.')))].join(', ')}. Check backend/.env.`);
  const env = parsed.data;
  const staffUids = env.AHAMOVE_STAFF_UIDS.split(',').map(value => value.trim()).filter(Boolean);
  if (!staffUids.length) throw new Error('AHAMOVE_STAFF_UIDS needs at least one Firebase UID.');
  return { apiKey: env.AHAMOVE_API_KEY, mobile: env.AHAMOVE_ACCOUNT_MOBILE, serviceId: env.AHAMOVE_SERVICE_ID,
    webhookSecret: env.AHAMOVE_WEBHOOK_SECRET, staffUids,
    pickup: { address: env.AHAMOVE_PICKUP_ADDRESS, name: env.AHAMOVE_PICKUP_NAME, mobile: env.AHAMOVE_PICKUP_MOBILE } };
}

export function readConfig(values: NodeJS.ProcessEnv) {
  const parsed = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('0.0.0.0'),
    FIREBASE_PROJECT_ID: z.string().trim().min(1),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().trim().min(1).optional(),
    PAYOS_CLIENT_ID: z.string().trim().min(1),
    PAYOS_API_KEY: z.string().trim().min(1),
    PAYOS_CHECKSUM_KEY: z.string().trim().min(1),
    PAYOS_RETURN_URL: z.url(), PAYOS_CANCEL_URL: z.url(),
    ALLOWED_ORIGINS: z.string().trim().min(1),
    STAFF_UIDS: z.string().trim().optional(),
    GOOGLE_BRIDGE_ORIGIN: z.url().optional(),
    FIREBASE_WEB_API_KEY: z.string().trim().min(1).optional(),
    FIREBASE_AUTH_DOMAIN: z.string().regex(/^[a-zA-Z0-9.-]+$/).optional(),
  }).safeParse(values);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))];
    throw new Error(`Backend configuration missing or invalid: ${fields.join(', ')}. Check backend/.env.`);
  }
  const env = parsed.data;
  if (env.GOOGLE_BRIDGE_ORIGIN) {
    const url = new URL(env.GOOGLE_BRIDGE_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== env.GOOGLE_BRIDGE_ORIGIN || !env.FIREBASE_WEB_API_KEY) {
      throw new Error('Google bridge needs GOOGLE_BRIDGE_ORIGIN as an HTTPS origin without a path/trailing slash, and FIREBASE_WEB_API_KEY.');
    }
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS && !existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
    throw new Error('Firebase Admin credential file not found. Set GOOGLE_APPLICATION_CREDENTIALS in backend/.env to your service account JSON file outside the repository.');
  }
  for (const field of ['PAYOS_RETURN_URL', 'PAYOS_CANCEL_URL'] as const) {
    if (new URL(env[field]).hostname.endsWith('.example')) {
      throw new Error(`${field} is a placeholder. Set a reachable payment return/cancel URL in backend/.env.`);
    }
  }
  return env;
}
