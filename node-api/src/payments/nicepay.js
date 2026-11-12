import { createHash, timingSafeEqual } from 'node:crypto';

// Contract preparation only. No network transport, HTTP route or wallet mutation.
// Do not replace this guard with an environment toggle before the rollout checklist.
export function requireNicepayLive() {
  throw new Error('NICEPAY live approval is not implemented or enabled');
}
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
const fail = () => { throw new Error('Invalid NICEPAY payment data'); };
const text = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : fail();
const amountText = value => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value);
  text(value, /^\d{1,12}$/);
  if (Number(value) <= 0) fail();
  return value;
};
const equalSignature = (actual, expected) => {
  text(actual, /^[a-fA-F0-9]{64}$/);
  if (!timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))) fail();
};
const orderFields = order => {
  text(order.id, /^[a-zA-Z0-9_-]{1,64}$/);
  amountText(order.amount);
  if (order.currency !== 'KRW' || !Number.isSafeInteger(order.amount)) fail();
};
const returnUrl = value => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail();
  return url.href;
};
const identity = (config, variant) => {
  if (config.variant !== variant || typeof config.secret !== 'string' || config.secret.length < 16) fail();
  return text(config.id, variant === 'legacy' ? /^[a-zA-Z0-9]{10}$/ : /^[a-zA-Z0-9_-]{10,50}$/);
};

// Choose only after the merchant's contracted integration type is confirmed.
export function buildNicepayRequest(order, config, timestamp) {
  orderFields(order);
  const url = returnUrl(config.returnUrl);
  const goodsName = order.goodsName ?? 'Manytool credits';
  text(goodsName, /^[a-zA-Z0-9 _-]{1,40}$/);
  if (config.variant === 'legacy') {
    const mid = identity(config, 'legacy');
    text(timestamp, /^\d{14}$/);
    return { MID: mid, Moid: order.id, Amt: String(order.amount), GoodsName: goodsName,
      PayMethod: 'CARD', EdiDate: timestamp, CharSet: 'utf-8', ReturnURL: url,
      SignData: hash(timestamp + mid + order.amount + config.secret) };
  }
  const clientId = identity(config, 'rest-server');
  return { clientId, orderId: order.id, amount: order.amount, goodsName,
    method: 'card', currency: 'KRW', returnUrl: url };
}

export function verifyNicepayAuthentication(body, order, config) {
  orderFields(order);
  const id = identity(config, config.variant);
  const legacy = config.variant === 'legacy';
  if (!legacy && config.variant !== 'rest-server') fail();
  const amount = amountText(legacy ? body.Amt : body.amount);
  const token = text(legacy ? body.AuthToken : body.authToken, /^[a-zA-Z0-9_-]{1,200}$/);
  const tid = text(legacy ? body.TxTid : body.tid, /^[a-zA-Z0-9]{30}$/);
  if ((legacy ? body.AuthResultCode : body.authResultCode) !== '0000'
      || (legacy ? body.MID : body.clientId) !== id
      || (legacy ? body.Moid : body.orderId) !== order.id
      || Number(amount) !== order.amount || (legacy && body.PayMethod !== 'CARD')) fail();
  equalSignature(legacy ? body.Signature : body.signature, hash(token + id + amount + config.secret));
  // Never trust callback-supplied destination URLs, including validly signed callbacks.
  if (legacy && !['https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp',
    'https://dc2-api.nicepay.co.kr/webapi/pay_process.jsp'].includes(body.NextAppURL)) fail();
  return { tid, amount: order.amount, orderId: order.id, authenticated: true, paid: false };
}

export function verifyNicepayApproval(body, order, auth, config) {
  orderFields(order);
  const id = identity(config, config.variant);
  const legacy = config.variant === 'legacy';
  if (!legacy && config.variant !== 'rest-server') fail();
  const amount = amountText(legacy ? body.Amt : body.amount);
  const tid = text(legacy ? body.TID : body.tid, /^[a-zA-Z0-9]{30}$/);
  if (auth.orderId !== order.id || auth.amount !== order.amount || !auth.authenticated
      || tid !== auth.tid || Number(amount) !== order.amount
      || (legacy ? body.Moid : body.orderId) !== order.id
      || (legacy ? body.ResultCode : body.resultCode) !== (legacy ? '3001' : '0000')
      || (legacy ? body.PayMethod : body.payMethod) !== (legacy ? 'CARD' : 'card')) fail();
  if (legacy) {
    if (body.MID !== id) fail();
    // CARD alone does not establish domestic, non-easy-payment scope. Quarantine
    // explicitly unsupported receipts; missing optional fields are not proof of
    // merchant eligibility and do not replace the launch-time MID review.
    if (body.CardType != null && !['01','02'].includes(body.CardType)) fail();
    if (body.ClickpayCl != null && body.ClickpayCl !== '') fail();
    if (body.MultiCl != null && !['','0'].includes(body.MultiCl)) fail();
    equalSignature(body.Signature, hash(tid + id + amount + config.secret));
  } else {
    if (body.status !== 'paid' || body.currency !== 'KRW') fail();
    text(body.ediDate, /^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]{8,40}$/);
    equalSignature(body.signature, hash(tid + amount + body.ediDate + config.secret));
  }
  // Validating data is NOT ledger fulfillment. Persist/order-lock/reconcile before crediting.
  return { orderId: order.id, tid, amount: order.amount, currency: 'KRW', verified: true };
}
