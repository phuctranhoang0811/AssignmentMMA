import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config';

const values = {
  FIREBASE_PROJECT_ID: 'test-project', PAYOS_CLIENT_ID: 'client',
  PAYOS_API_KEY: 'secret-api', PAYOS_CHECKSUM_KEY: 'secret-checksum',
  PAYOS_RETURN_URL: 'http://10.0.2.2:3001/payment/return',
  PAYOS_CANCEL_URL: 'http://10.0.2.2:3001/payment/cancel',
  ALLOWED_ORIGINS: 'http://localhost:8081',
};

test('backend config accepts emulator return URLs and ADC credentials', () => {
  assert.equal(readConfig(values).PORT, 3001);
});

test('missing config reports field names without exposing secrets', () => {
  assert.throws(() => readConfig({ ...values, PAYOS_CLIENT_ID: '', PORT: 'invalid' }), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /PAYOS_CLIENT_ID/);
    assert.match(error.message, /PORT/);
    assert.ok(!error.message.includes(values.PAYOS_API_KEY));
    assert.ok(!error.message.includes(values.PAYOS_CHECKSUM_KEY));
    return true;
  });
});

test('backend rejects nonexistent credential file and example return URLs', () => {
  assert.throws(() => readConfig({ ...values, GOOGLE_APPLICATION_CREDENTIALS: '/missing-pizza-test-key.json' }), /credential file not found/);
  assert.throws(() => readConfig({ ...values, PAYOS_RETURN_URL: 'https://your-domain.example/payment/return' }), /placeholder/);
});

test('Expo Go bridge requires an HTTPS origin and Firebase web API key together', () => {
  assert.throws(() => readConfig({ ...values, GOOGLE_BRIDGE_ORIGIN: 'http://localhost:3001', FIREBASE_WEB_API_KEY: 'public-key' }), /HTTPS/);
  assert.throws(() => readConfig({ ...values, GOOGLE_BRIDGE_ORIGIN: 'https://login.example.com/path', FIREBASE_WEB_API_KEY: 'public-key' }), /HTTPS/);
  assert.throws(() => readConfig({ ...values, GOOGLE_BRIDGE_ORIGIN: 'https://login.example.com' }), /FIREBASE_WEB_API_KEY/);
  assert.equal(readConfig({ ...values, GOOGLE_BRIDGE_ORIGIN: 'https://login.example.com', FIREBASE_WEB_API_KEY: 'public-key' }).GOOGLE_BRIDGE_ORIGIN, 'https://login.example.com');
});

test('empty SMTP values in .env mean "not configured", not an invalid email', () => {
  const env = readConfig({ ...values, SMTP_USER: '', SMTP_PASS: '' });
  assert.equal(env.SMTP_USER, undefined);
  assert.throws(() => readConfig({ ...values, SMTP_USER: 'not-an-email' }), /SMTP_USER/);
});
