import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createGoogleLoginProxy } from '../../scripts/start-google-bridge.mjs';

test('test tunnel forwards only login routes and preserves Google proof headers', async t => {
  let received = [];
  const upstream = createServer((req, res) => {
    received.push(req.url);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ path: req.url, authorization: req.headers.authorization, origin: req.headers.origin }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const proxy = createGoogleLoginProxy(upstream.address().port);
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    proxy.closeAllConnections(); upstream.closeAllConnections();
    await Promise.all([proxy, upstream].map(server => new Promise(resolve => server.close(resolve))));
  });
  const base = `http://127.0.0.1:${proxy.address().port}`;
  for (const path of ['/api/orders/private', '/api/webhooks/payos', '/health', '/auth/unknown', '/auth/google/../api/orders']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  assert.equal((await fetch(base + '/auth/bridge/claim')).status, 404);
  assert.equal((await fetch(base + '/api/webhooks/payos', { method: 'POST', body: '{}' })).status, 404);
  assert.deepEqual(received, []);
  const approval = await fetch(base + '/auth/bridge/approve', { method: 'POST',
    headers: { Authorization: 'Bearer test-token', Origin: 'https://login.example.com', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(approval.status, 200);
  assert.equal(approval.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await approval.json(), { path: '/auth/bridge/approve', authorization: 'Bearer test-token', origin: 'https://login.example.com' });
  assert.equal((await fetch(base + '/auth/google?session=test')).status, 200);
  assert.deepEqual(received, ['/auth/bridge/approve', '/auth/google?session=test']);
});
