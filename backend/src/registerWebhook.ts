import { PayOS } from '@payos/node';
import { readConfig } from './config';

// Registration sends a signed provider probe; it never settles an existing order manually.
try {
  const url = new URL(process.argv[2] ?? '');
  if (url.protocol !== 'https:' || url.pathname !== '/api/webhooks/payos' ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid webhook URL');
  }
  const env = readConfig(process.env);
  const payos = new PayOS({ clientId: env.PAYOS_CLIENT_ID, apiKey: env.PAYOS_API_KEY,
    checksumKey: env.PAYOS_CHECKSUM_KEY, timeout: 15000, maxRetries: 0, logLevel: 'off' });
  await payos.webhooks.confirm(url.toString());
  console.log(`Webhook verified and registered: ${url}`);
} catch {
  console.error('Webhook registration failed. Use an HTTPS URL ending in /api/webhooks/payos; check forwarding, backend and payment channel credentials.');
  process.exitCode = 1;
}
