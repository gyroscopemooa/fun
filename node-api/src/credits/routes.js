import { createHash, randomUUID } from 'node:crypto';
import { PACKS, readPricing, productKey } from './pricing.js';
import { REFUND_POLICY_VERSION } from './refunds.js';

const COOKIE = 'manytool_credit_session';
const cookieToken = req => /(?:^|;\s*)manytool_credit_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1] ?? '';
const publicOrder = order => ({ orderId: order.id, status: order.status, paid: order.status === 'paid', paymentMode: 'credits', amount: order.amount, currency: 'KRW', credits: order.creditAmount, checkoutUrl: null });
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(error.status ?? 500).json({ error: error.status ? error.message : '크레딧 요청을 처리하지 못했습니다.' }); console.error('[credits]', error.message); } };

export function installCreditRoutes(app, { store, orders, verifyWebhook, env = process.env, fetcher = fetch }) {
  const pricing = readPricing(env.CREDITS_TOOL_PRICING_JSON);
  const webBase = env.PUBLIC_WEB_BASE_URL || 'https://manytool.net';
  const origin = new URL(webBase).origin;
  const secure = new URL(webBase).protocol === 'https:';
  const polarBase = env.POLAR_SERVER === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  const packs = PACKS.map(pack => ({ ...pack, product: env[`POLAR_PRODUCT_CREDITS_${pack.id}`] || '' }));
  const enabled = env.CREDITS_ENABLED === 'true' && env.CREDITS_TOOLS_READY === 'true';
  const email = req => store.authenticate(cookieToken(req));
  const requireOrigin = req => {
    if (req.headers.origin !== origin) throw Object.assign(new Error('허용되지 않은 요청입니다.'), { status: 403 });
  };
  const requireEnabled = () => {
    if (!enabled) throw Object.assign(new Error('크레딧 충전은 준비 중입니다.'), { status: 503 });
  };
  const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const polar = async (path, body) => {
    const response = await fetcher(`${polarBase}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Polar request failed: ${response.status}`);
    return response.json();
  };

  app.get('/credits/config', (_req, res) => res.json({ enabled, walletAvailable: true, refundPolicyVersion: REFUND_POLICY_VERSION, valueKrw: 1000,
    packs: packs.map(({ product, ...pack }) => ({ ...pack, available: enabled && Boolean(product && env.POLAR_ACCESS_TOKEN && env.POLAR_WEBHOOK_SECRET && env.RESEND_API_KEY && Object.keys(pricing).length) })),
    tools: pricing
  }));
  app.post('/credits/login', wrap(async (req, res) => {
    requireOrigin(req);
    const address = String(req.body?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) || address.length > 254) throw Object.assign(new Error('이메일 주소를 확인해주세요.'), { status: 400 });
    store.rateLimit(`ip:${req.ip}`, 20, 3600000);
    store.rateLimit(`email:${address}`, 3, 600000);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw Object.assign(new Error('로그인 이메일 발송 설정이 필요합니다.'), { status: 503 });
    const token = store.token(address, 'login', 15 * 60000);
    const url = `${origin}/credits/#login=${token}`;
    const result = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [address], subject: 'ManyTool 크레딧 로그인', text: `15분 이내에 아래 링크에서 로그인하세요.\n${url}\n요청하지 않았다면 이 메일을 무시하세요.` }), signal: AbortSignal.timeout(15000) });
    if (!result.ok) { store.logout(token); throw new Error('Login email failed'); }
    res.json({ ok: true });
  }));
  app.post('/credits/session', wrap((req, res) => {
    requireOrigin(req);
    const address = store.authenticate(req.body?.token, 'login', true);
    const token = store.token(address, 'session', 30 * 86400000);
    res.setHeader('Set-Cookie', cookie(token, 30 * 86400));
    res.json({ ok: true });
  }));
  app.post('/credits/logout', wrap((req, res) => { requireOrigin(req); store.logout(cookieToken(req)); res.setHeader('Set-Cookie', cookie('', 0)); res.json({ ok: true }); }));
  app.get('/credits/me', wrap((req, res) => {
    const address = email(req);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ email: address, balance: store.balance(address), history: store.history(address), pending: store.pending(address), topups: store.topupHistory(address) });
  }));
  app.post('/credits/topup', wrap(async (req, res) => {
    requireEnabled(); requireOrigin(req);
    const address = email(req);
    if (req.body?.refundPolicyVersion !== REFUND_POLICY_VERSION) throw Object.assign(new Error('충전 환불 기준을 확인해주세요.'), { status: 400 });
    store.rateLimit(`checkout:${address}`, 10, 600000);
    const pack = packs.find(p => p.id === String(req.body?.packId));
    if (!pack?.product || !env.POLAR_ACCESS_TOKEN || !env.POLAR_WEBHOOK_SECRET || !Object.keys(pricing).length) throw Object.assign(new Error('충전 상품과 도구 가격 설정이 필요합니다.'), { status: 503 });
    // Verify provider-side price before accepting money; no USD/KRW substitution.
    const product = await polar(`/v1/products/${encodeURIComponent(pack.product)}`);
    const activePrices = product.prices?.filter(p => !p.is_archived);
    if (product.is_recurring || product.is_archived || activePrices?.length !== 1 || activePrices[0].amount_type !== 'fixed' || activePrices[0].price_currency !== 'krw' || activePrices[0].price_amount !== pack.amount) {
      throw Object.assign(new Error('결제 상품의 원화 가격이 충전 가격과 일치하지 않습니다.'), { status: 503 });
    }
    const topup = store.createTopup(address, pack, pack.product);
    const checkout = await polar('/v1/checkouts', { products: [pack.product], customer_email: address, currency: 'krw', allow_discount_codes: false,
      success_url: `${origin}/credits/?topup=${topup.id}`, return_url: `${origin}/credits/`, metadata: { credit_topup_id: topup.id } });
    if (!checkout.id || !checkout.url || new URL(checkout.url).protocol !== 'https:') throw new Error('Invalid checkout URL');
    store.checkout(topup.id, checkout.id, checkout.url);
    res.status(201).json({ checkoutUrl: checkout.url, topupId: topup.id });
  }));
  app.get('/credits/topup/:id', wrap((req, res) => {
    const row = store.topup(req.params.id);
    if (!row || row.email !== email(req)) throw Object.assign(new Error('충전 주문을 찾을 수 없습니다.'), { status: 404 });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: row.status, credits: row.credits });
  }));
  app.post('/credits/webhook', wrap((req, res) => {
    try { verifyWebhook(req); } catch { throw Object.assign(new Error('Invalid webhook signature'), { status: 401 }); }
    if (['order.paid', 'order.refunded'].includes(req.body?.type)) store.applyPayment(req.body);
    res.json({ ok: true });
  }));
  app.post('/credits/quote', wrap((req, res) => {
    requireEnabled(); requireOrigin(req);
    const quote = pricing[productKey(req.body ?? {})];
    if (!quote) throw Object.assign(new Error('이 상품은 개별구매로 이용해주세요.'), { status: 404 });
    let balance = null;
    try { balance = store.balance(email(req)); } catch { /* login is optional for a quote */ }
    res.json({ ...quote, balance });
  }));
  app.post('/credits/purchase', wrap((req, res) => {
    requireEnabled(); requireOrigin(req);
    const address = email(req);
    const body = req.body ?? {};
    const key = productKey(body);
    const quote = pricing[key];
    if (!quote) throw Object.assign(new Error('이 상품은 개별구매로 이용해주세요.'), { status: 404 });
    if (body.productType === 'detail_page' && (!body.detailPageRequest?.productName || !Array.isArray(body.detailPageRequest.images) || !body.detailPageRequest.images.length)) throw Object.assign(new Error('상품명과 사진을 입력해주세요.'), { status: 400 });
    const fingerprint = createHash('sha256').update(JSON.stringify({ key, request: body.detailPageRequest ?? null })).digest('hex');
    const order = store.purchase(address, body.requestKey ?? '', fingerprint, quote.credits, {
      id: randomUUID(), productType: body.productType, amount: quote.amountKrw, currency: 'KRW', status: 'paid', paymentMode: 'credits', provider: 'credits', creditAmount: quote.credits,
      customerEmail: address, createdAt: new Date().toISOString(), paidAt: new Date().toISOString(), detailPageRequest: body.productType === 'detail_page' ? body.detailPageRequest : null
    });
    orders.set(order.id, order);
    res.status(201).json(publicOrder(order));
  }));
  app.post('/credits/cancel', wrap((req, res) => {
    requireOrigin(req); store.cancel(email(req), req.body?.orderId);
    const order = store.order(req.body.orderId); if (order) orders.set(order.id, order);
    res.json({ ok: true });
  }));
  app.post('/credits/refund/quote', wrap((req, res) => {
    requireOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    res.json(store.refundQuote(email(req), req.body?.topupId));
  }));
  app.post('/credits/refund/request', wrap((req, res) => {
    requireOrigin(req);
    if (req.body?.confirmed !== true) throw Object.assign(new Error('환불 예상액 확인이 필요합니다.'), { status: 400 });
    res.json(store.requestRefund(email(req), req.body?.topupId, req.body));
  }));
}
