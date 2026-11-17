import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import express from 'express';
import { CreditStore } from './store.js';
import { installCreditRoutes } from './routes.js';

const secret = 'x'.repeat(40);
const sign = (claim, key = secret) => {
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${body}.${createHmac('sha256', key).update(`manytool-credit-link:${body}`).digest('base64url')}`;
};

test('account handoff links a wallet only for a valid, fresh, gmail-authoritative claim', async t => {
  const store = new CreditStore(':memory:'); store.change('seed', 'buyer@gmail.com', 12, 'seed');
  const app = express(); app.use(express.json());
  installCreditRoutes(app, { store, orders: new Map(), verifyWebhook() {}, env: { CREDIT_LINK_SECRET: secret, PUBLIC_WEB_BASE_URL: 'https://manytool.net' } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(async () => { await new Promise(r => server.close(r)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const link = (token, origin = 'https://manytool.net') => fetch(`${base}/credits/link`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  const now = Math.floor(Date.now() / 1000);
  assert.equal((await link(sign({ email: 'buyer@gmail.com', aud: 'credit-link', exp: now + 60 }), 'https://evil.invalid')).status, 403);
  assert.equal((await link(sign({ email: 'buyer@gmail.com', aud: 'credit-link', exp: now + 60 }, 'y'.repeat(40)))).status, 401);
  assert.equal((await link(sign({ email: 'buyer@gmail.com', aud: 'credit-link', exp: now - 5 }))).status, 401);
  assert.equal((await link(sign({ email: 'buyer@gmail.com', aud: 'credit-link', exp: now + 99999 }))).status, 401);
  assert.equal((await link(sign({ email: 'buyer@corp.invalid', aud: 'credit-link', exp: now + 60 }))).status, 403);
  const ok = await link(sign({ email: 'buyer@gmail.com', aud: 'credit-link', exp: now + 60 }));
  assert.equal(ok.status, 200);
  const session = ok.headers.get('set-cookie').match(/manytool_credit_session=([a-f0-9]+)/)[1];
  assert.equal(store.balance(store.authenticate(session)), 12);
});
