import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = process.env.CREDITS_TEST_URL || 'http://127.0.0.1:4339';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
let enabled = false;
let purchases = 0;
let balance = 10;
let lastPurchase = null;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = body => route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true' } });
    if (url.pathname === '/credit-checkout.js') return route.fulfill({ contentType: 'application/javascript', body: readFileSync(new URL('../public/credit-checkout.js', import.meta.url), 'utf8') });
    if (url.pathname === '/credits/config') return json({ enabled, valueKrw: 1000, packs: [10, 50, 300].map(n => ({ id: String(n), credits: n, amount: n * 1000, available: enabled })), tools: enabled ? { calorie: { label: '칼로리 분석', credits: 5, amountKrw: 5000 } } : {} });
    if (url.pathname === '/credits/me') return json({ email: 'test@example.com', balance, history: [{ delta: 10, kind: '충전', created: Date.now() }], pending: [] });
    if (url.pathname === '/credits/quote') return json({ label: '칼로리 분석', credits: 5, amountKrw: 5000, balance });
    if (url.pathname === '/credits/purchase') { purchases++; lastPurchase = route.request().postDataJSON(); return json({ orderId: 'ui-test-order', paid: true, status: 'paid', credits: 5 }); }
    if (url.pathname === '/checkout') return json({ orderId: 'single-order', checkoutUrl: 'https://example.invalid' });
    if (url.origin === base) return route.continue();
    return route.abort();
  });
  await page.goto(`${base}/credits/`, { waitUntil: 'domcontentloaded' });
  await page.getByText('크레딧 충전은 준비 중입니다. 지금은 기존 개별구매를 이용해주세요.').waitFor();
  assert.equal(await page.locator('[data-credit-pack]:disabled').count(), 3);
  assert.equal(await page.locator('[data-credit-pack="300"]').locator('..').textContent().then(s => s.includes('300,000원')), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  enabled = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('test@example.com').waitFor();
  assert.equal(await page.locator('[data-credit-pack]:disabled').count(), 3);
  await page.locator('#credit-policy-accepted').check();
  assert.equal(await page.locator('[data-credit-pack]:enabled').count(), 3);
  assert.equal(await page.locator('#credit-balance').textContent(), '10');
  const checkout = page.evaluate(async () => {
    const response = await window.manytoolCreditCheckout(`${location.origin}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productType: 'calorie', amount: 99, currency: 'USD' }) });
    return response.json();
  });
  await page.getByRole('button', { name: '5 크레딧 사용', exact: true }).click();
  assert.equal((await checkout).orderId, 'ui-test-order');
  assert.equal(purchases, 1); assert.ok(lastPurchase.requestKey);
  balance = 0;
  const fallback = page.evaluate(async () => (await window.manytoolCreditCheckout(`${location.origin}/checkout`, { method: 'POST', body: JSON.stringify({ productType: 'calorie' }) })).json());
  await page.getByRole('button', { name: '5 크레딧 사용', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '5 크레딧 사용', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: '기존 가격으로 개별구매' }).click();
  assert.equal((await fallback).orderId, 'single-order'); assert.equal(purchases, 1);
  await page.screenshot({ path: 'tmp/credits-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'tmp/credits-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: disabled/enabled wallet, 10/50/300 pricing, mobile overflow, credit checkout, insufficient balance and single-purchase fallback');
} finally { await browser.close(); }
