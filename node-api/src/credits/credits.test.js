import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { CreditStore } from './store.js';
import { PACKS, quoteCredits, readPricing, productKey } from './pricing.js';
import { installCreditRoutes } from './routes.js';
import { calculateRefund, REFUND_POLICY_VERSION } from './refunds.js';

const email = 'buyer@example.com';
const payment = (row, extra = {}) => ({ type: 'order.paid', data: {
  id: `polar-${row.id}`, paid: true, product_id: row.product, currency: 'krw', net_amount: row.amount, discount_amount: 0,
  checkout_id: `checkout-${row.id}`, metadata: { credit_topup_id: row.id }, ...extra
} });
const fund = (store, pack = PACKS[0]) => { const row = store.createTopup(email, pack, 'product'); store.checkout(row.id, `checkout-${row.id}`, 'https://example.com'); store.applyPayment(payment(row)); return row; };
const order = id => ({ id, paymentMode: 'credits', productType: 'calorie', status: 'paid' });

test('delayed purchase replay cannot erase immutable name input or revive a refunded order',()=>{
  const store=new CreditStore(':memory:');
  try{
    fund(store);const stale=store.purchase(email,'name-lock-request-123','fp',2,{...order('name-lock'),productType:'ai_name_premium'});
    store.lockNameInput(stale.id,{given:['A'],gender:'female'});
    store.saveOrder(stale);assert.deepEqual(store.order(stale.id).namePremiumLock,{given:['A'],gender:'female'});
    assert.throws(()=>store.lockNameInput(stale.id,{given:['B'],gender:'female'}));
    assert.doesNotThrow(()=>store.lockNameInput(stale.id,{gender:'female',given:['A']}));
    store.cancel(email,stale.id);store.saveOrder(stale);assert.equal(store.order(stale.id).status,'refunded');
  }finally{store.close();}
});

test('packs have a fixed 1,000 KRW unit price without volume discounts', () => {
  assert.deepEqual(PACKS.map(p => [p.credits, p.amount]), [[10, 10000], [50, 50000], [300, 300000]]);
});
test('4500 rounds up to five credits and cost floor overrides cheap retail', () => {
  assert.equal(quoteCredits({ retailKrw: 4500, costKrw: 1000 }).credits, 5);
  assert.equal(quoteCredits({ retailKrw: 1000, costKrw: 1000 }).credits, 2);
  assert.equal(quoteCredits({ retailKrw: 4500, costKrw: 4500 }).credits, 7);
  for (const costKrw of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => quoteCredits({ retailKrw: 4500, costKrw }));
  assert.throws(() => quoteCredits({ retailKrw: 4500, costKrw: 1000, marginBps: 0 }));
  assert.throws(() => readPricing('{"unknown":{"retailKrw":4500,"costKrw":1000}}'));
  assert.throws(() => productKey({ productType: 'detail_page', detailPageRequest: { pageCount: 6 } }));
});
test('paid webhook replay only funds once, including across restart', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'manytool-credit-'));
  let store = new CreditStore(path.join(dir, 'test.sqlite'));
  try {
    const row = fund(store); store.applyPayment(payment(row));
    assert.equal(store.balance(email), 10); store.close();
    store = new CreditStore(path.join(dir, 'test.sqlite')); store.applyPayment(payment(row));
    assert.equal(store.balance(email), 10); assert.equal(store.history(email).length, 1);
  } finally { store.close(); rmSync(dir, { recursive: true }); }
});
test('mismatched amount, currency, checkout, product or discount never funds', () => {
  const store = new CreditStore(':memory:');
  try {
    const row = store.createTopup(email, PACKS[0], 'product'); store.checkout(row.id, `checkout-${row.id}`, 'https://example.com');
    for (const patch of [{ net_amount: 1 }, { currency: 'usd' }, { product_id: 'other' }, { checkout_id: 'other' }, { discount_amount: 100 }, { paid: false }]) assert.throws(() => store.applyPayment(payment(row, patch)));
    assert.equal(store.balance(email), 0);
  } finally { store.close(); }
});
test('concurrent wallet connections cannot overspend and request retry is idempotent', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'manytool-credit-'));
  const a = new CreditStore(path.join(dir, 'test.sqlite')), b = new CreditStore(path.join(dir, 'test.sqlite'));
  try {
    fund(a);
    a.purchase(email, 'request-0000000001', 'fingerprint', 6, order('one'));
    assert.equal(b.purchase(email, 'request-0000000001', 'fingerprint', 6, order('two')).id, 'one');
    assert.throws(() => b.purchase(email, 'request-0000000001', 'changed', 1, order('three')));
    assert.throws(() => b.purchase(email, 'request-0000000002', 'different', 6, order('four')));
    assert.equal(a.balance(email), 4);
    a.claim('one'); assert.throws(() => b.claim('one'));
    b.finish('one', false); a.finish('one', false);
    assert.equal(a.balance(email), 10); assert.equal(a.order('one').status, 'refunded');
    assert.throws(() => a.claim('one'));
  } finally { a.close(); b.close(); rmSync(dir, { recursive: true }); }
});
test('completed purchases cannot be cancelled or restored; unused orders are owner-bound', () => {
  const store = new CreditStore(':memory:');
  try {
    fund(store); store.purchase(email, 'request-0000000001', 'x', 5, order('one'));
    assert.throws(() => store.cancel('other@example.com', 'one'));
    store.claim('one'); assert.throws(() => store.cancel(email, 'one'));
    store.finish('one', true); store.restore('one'); assert.equal(store.balance(email), 5);
    store.purchase(email, 'request-0000000002', 'y', 5, order('two'));
    store.cancel(email, 'two'); assert.equal(store.balance(email), 5);
  } finally { store.close(); }
});
test('30-day pet entitlement is issued once and cannot be cancelled as an unused generation', () => {
  const store = new CreditStore(':memory:');
  try {
    fund(store);
    store.purchase(email, 'request-0000000001', 'pet', 5, { ...order('pet'), productType: 'ai_pet_translator' });
    assert.equal(store.state('pet'), 'done');
    assert.throws(() => store.cancel(email, 'pet'));
    store.restore('pet'); assert.equal(store.balance(email), 5);
    assert.equal(store.allOrders()[0].productType, 'ai_pet_translator');
  } finally { store.close(); }
});
test('partial and full refunds are monotonic and spent refunded credit becomes debt', () => {
  const store = new CreditStore(':memory:');
  try {
    const row = fund(store); store.purchase(email, 'request-0000000001', 'x', 10, order('one'));
    const refund = amount => ({ ...payment(row, { refunded_amount: amount }), type: 'order.refunded' });
    store.applyPayment(refund(2000)); store.applyPayment(refund(2000)); assert.equal(store.balance(email), -2);
    store.applyPayment(refund(10000)); store.applyPayment(refund(2000)); store.applyPayment(payment(row));
    assert.equal(store.balance(email), -10);
    assert.throws(() => store.purchase(email, 'request-0000000002', 'y', 1, order('two')));
  } finally { store.close(); }
});
test('refund before payment cannot resurrect credit', () => {
  const store = new CreditStore(':memory:');
  try {
    const row = store.createTopup(email, PACKS[0], 'product');
    store.applyPayment({ ...payment(row, { refunded_amount: 10000 }), type: 'order.refunded' });
    store.applyPayment(payment(row)); assert.equal(store.balance(email), 0);
  } finally { store.close(); }
});
test('login links are single use, expired sessions rejected, logout revokes', () => {
  const store = new CreditStore(':memory:');
  try {
    const token = store.token(email, 'login', 10000);
    assert.equal(store.authenticate(token, 'login', true), email);
    assert.throws(() => store.authenticate(token, 'login', true));
    assert.throws(() => store.authenticate(store.token(email, 'session', -1)));
    const session = store.token(email, 'session', 10000); store.logout(session); assert.throws(() => store.authenticate(session));
    store.rateLimit('email', 1, 60000); assert.throws(() => store.rateLimit('email', 1, 60000));
  } finally { store.close(); }
});

test('HTTP routes enforce session, origin, server prices, verified product and webhook signatures', async () => {
  const store = new CreditStore(':memory:');
  const app = express(); app.use(express.json());
  let checkoutCalls = 0;
  let priceCurrency = 'krw';
  installCreditRoutes(app, { store, orders: new Map(), verifyWebhook: req => { if (req.headers['test-signature'] !== 'valid') throw Error('signature'); },
    env: { CREDITS_ENABLED: 'true', CREDITS_TOOLS_READY: 'true', PUBLIC_WEB_BASE_URL: 'https://manytool.net', CREDITS_TOOL_PRICING_JSON: '{"calorie":{"retailKrw":4500,"costKrw":1000}}', POLAR_PRODUCT_CREDITS_10: 'product', POLAR_ACCESS_TOKEN: 'test', POLAR_WEBHOOK_SECRET: 'test' },
    fetcher: async (url) => {
      if (url.includes('/products/')) return Response.json({ is_recurring: false, prices: [{ amount_type: 'fixed', price_currency: priceCurrency, price_amount: 10000 }] });
      checkoutCalls++; return Response.json({ id: 'checkout-http', url: 'https://checkout.example.com' });
    }
  });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = store.token(email, 'session', 60000);
  const post = (route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://manytool.net', Cookie: `manytool_credit_session=${session}`, ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/credits/purchase', {}, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/credits/purchase', {}, { Cookie: '' })).status, 401);
    fund(store);
    const purchase = { productType: 'calorie', amount: 1, credits: 0, requestKey: 'request-0000000001' };
    const response = await post('/credits/purchase', purchase); assert.equal(response.status, 201);
    const result = await response.json(); assert.equal(result.credits, 5); assert.equal(result.amount, 5000);
    assert.equal((await (await post('/credits/purchase', purchase)).json()).orderId, result.orderId);
    assert.equal(store.balance(email), 5);
    assert.equal((await post('/credits/topup', { packId: '10' })).status, 400);
    priceCurrency = 'usd'; assert.equal((await post('/credits/topup', { packId: '10', refundPolicyVersion: REFUND_POLICY_VERSION })).status, 503); assert.equal(checkoutCalls, 0);
    priceCurrency = 'krw'; assert.equal((await post('/credits/topup', { packId: '10', refundPolicyVersion: REFUND_POLICY_VERSION })).status, 201); assert.equal(checkoutCalls, 1);
    assert.equal((await post('/credits/webhook', { type: 'order.paid' })).status, 401);
    assert.equal((await post('/credits/cancel', { orderId: result.orderId })).status, 200); assert.equal(store.balance(email), 10);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

test('discount refund uses normal unit price, caps at zero and refunds unused payments fully', () => {
  const quote = usedCredits => calculateRefund({ paidAmount: 290000, totalCredits: 300, usedCredits });
  assert.equal(quote(0).refundAmount, 290000);
  assert.equal(quote(5).refundAmount, 285000);
  assert.equal(quote(10).refundAmount, 280000);
  assert.equal(quote(295).refundAmount, 0);
  assert.equal(calculateRefund({ paidAmount: 49000, totalCredits: 50, usedCredits: 5 }).refundAmount, 44000);
  assert.throws(() => quote(301));
});
test('FIFO attribution restores failed use and settles normal-price refund without residual credits', () => {
  const store = new CreditStore(':memory:');
  try {
    const first = fund(store, { ...PACKS[1], amount: 49000 });
    const second = fund(store, { ...PACKS[2], amount: 290000 });
    store.purchase(email, 'request-refund-001', 'a', 55, order('a')); store.claim('a'); store.finish('a', true);
    assert.equal(store.refundQuote(email, second.id).refundAmount, 285000);
    store.purchase(email, 'request-refund-002', 'b', 5, order('b'));
    assert.throws(() => store.refundQuote(email, second.id));
    store.cancel(email, 'b');
    assert.equal(store.refundQuote(email, second.id).usedCredits, 5);
    const q = store.refundQuote(email, second.id);
    const request = store.requestRefund(email, second.id, q);
    assert.equal(store.balance(email), 0);
    assert.equal(store.requestRefund(email, second.id, q).id, request.id);
    assert.throws(() => store.purchase(email, 'request-refund-003', 'c', 1, order('c')));
    const event = { ...payment(second, { refunded_amount: 285000 }), type: 'order.refunded' };
    store.applyPayment(event); store.applyPayment(event); store.applyPayment(payment(second));
    assert.equal(store.balance(email), 0);
    assert.equal(store.topup(second.id).refunded, 295);
    assert.equal(store.topupHistory(email)[0].refundStatus, 'completed');
    assert.equal(store.refundQuote(email, first.id).refundAmount, 0);
    assert.throws(() => store.refundQuote('other@example.com', second.id));
  } finally { store.close(); }
});
test('stale refund quotes and processing jobs cannot race with spend; mismatched provider refunds freeze review', () => {
  const store = new CreditStore(':memory:');
  try {
    const row = fund(store);
    const old = store.refundQuote(email, row.id);
    store.purchase(email, 'request-refund-001', 'a', 5, order('a')); store.claim('a');
    assert.throws(() => store.requestRefund(email, row.id, old));
    store.finish('a', true);
    assert.throws(() => store.requestRefund(email, row.id, old));
    const q = store.refundQuote(email, row.id);
    store.requestRefund(email, row.id, q);
    fund(store);
    store.applyPayment({ ...payment(row, { refunded_amount: 10000 }), type: 'order.refunded' });
    assert.equal(store.topupHistory(email).find(r => r.id === row.id).refundStatus, 'review');
    assert.throws(() => store.purchase(email, 'request-refund-002', 'b', 1, order('b')));
  } finally { store.close(); }
});

test('real API execution claims once and restores failed generation without external requests', { timeout: 40000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'manytool-credit-api-'));
  const filename = path.join(dir, 'wallet.sqlite');
  const store = new CreditStore(filename);
  fund(store);
  const session = store.token(email, 'session', 60000);
  const preload = path.join(dir, 'no-network.mjs');
  writeFileSync(preload, "globalThis.fetch = async () => { throw new Error('External network disabled by credit integration test'); };\n");
  const port = 19000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, 'node-api/src/server.js'], {
    cwd: new URL('../../../', import.meta.url), windowsHide: true,
    env: { ...process.env, PORT: String(port), CREDITS_DB_PATH: filename, CREDITS_ENABLED: 'true', CREDITS_TOOLS_READY: 'true',
      CREDITS_TOOL_PRICING_JSON: '{"ai_personal_color":{"retailKrw":4500,"costKrw":1000}}', PUBLIC_WEB_BASE_URL: 'https://manytool.net',
      OPENAI_API_KEY: 'test-key', EXTERNAL_AI_ENABLED: 'false', POLAR_ACCESS_TOKEN: '', RESEND_API_KEY: '', PAYMENT_MODE: 'polar' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = ''; child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let n = 0; n < 150; n++) {
      if (child.exitCode !== null) throw new Error(`Test API exited: ${logs.slice(-2000)}`);
      try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, logs.slice(-2000));
    const paid = await fetch(`${base}/credits/purchase`, { method: 'POST', headers: { Origin: 'https://manytool.net', Cookie: `manytool_credit_session=${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ productType: 'ai_personal_color', requestKey: 'integration-request-1', amount: 1 }) });
    assert.equal(paid.status, 201); const purchase = await paid.json();
    assert.equal(store.balance(email), 5);
    const analyze = () => { const form = new FormData(); form.append('orderId', purchase.orderId); form.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png'); return fetch(`${base}/ai-personal-color/analyze`, { method: 'POST', body: form }); };
    const responses = await Promise.all([analyze(), analyze()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [409, 500]);
    assert.equal(store.balance(email), 10);
    assert.equal(store.history(email).filter(row => row.kind === '실패 복구').length, 1);
    assert.equal(store.order(purchase.orderId).status, 'refunded');
    assert.equal((await analyze()).status, 402);
    assert.equal(store.balance(email), 10);
  } finally {
    child.kill(); await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
    store.close(); rmSync(dir, { recursive: true });
  }
});
