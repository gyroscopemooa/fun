import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildNicepayRequest, verifyNicepayAuthentication, verifyNicepayApproval, requireNicepayLive } from './nicepay.js';
const hash = s => createHash('sha256').update(s).digest('hex');
const order = { id: 'offline-order-1', amount: 10000, currency: 'KRW' };
const tid = 'a'.repeat(30);
const secret = 'fake-offline-test-key-not-a-credential';
function fixture(variant) {
  const legacy = variant === 'legacy';
  const config = { variant, id: legacy ? 'fake00000m' : 'fake_client_123', secret, returnUrl: 'https://manytool.net/payments/nicepay/return' };
  const auth = legacy ? { AuthResultCode: '0000', MID: config.id, Moid: order.id, Amt: '10000', AuthToken: 'fakeToken', TxTid: tid, PayMethod: 'CARD', NextAppURL: 'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp' }
    : { authResultCode: '0000', clientId: config.id, orderId: order.id, amount: '10000', authToken: 'fakeToken', tid };
  auth[legacy ? 'Signature' : 'signature'] = hash('fakeToken' + config.id + '10000' + secret);
  const approval = legacy ? { ResultCode: '3001', MID: config.id, Moid: order.id, Amt: '000000010000', TID: tid, PayMethod: 'CARD' }
    : { resultCode: '0000', orderId: order.id, amount: 10000, tid, payMethod: 'card', currency: 'KRW', status: 'paid', ediDate: '2026-11-10T12:00:00+09:00' };
  approval[legacy ? 'Signature' : 'signature'] = hash(legacy ? tid + config.id + approval.Amt + secret : tid + '10000' + approval.ediDate + secret);
  return { config, auth, approval, legacy };
}
for (const variant of ['legacy', 'rest-server']) {
  test(`${variant}: offline request, authentication and verified approval`, () => {
    const f = fixture(variant);
    const request = buildNicepayRequest(order, f.config, '20261110210000');
    assert.ok(!JSON.stringify(request).includes(secret));
    assert.equal(request[f.legacy ? 'PayMethod' : 'method'], f.legacy ? 'CARD' : 'card');
    const auth = verifyNicepayAuthentication(f.auth, order, f.config);
    assert.equal(auth.paid, false);
    assert.equal(verifyNicepayApproval(f.approval, order, auth, f.config).verified, true);
  });
  for (const [name, legacyField, restField, value] of [
    ['amount', 'Amt', 'amount', 1], ['order', 'Moid', 'orderId', 'other'],
    ['identity', 'MID', 'clientId', 'other'], ['signature', 'Signature', 'signature', '0'.repeat(64)],
    ['failure', 'AuthResultCode', 'authResultCode', '9999'], ['tid path injection', 'TxTid', 'tid', '../../secret']
  ]) test(`${variant}: rejects authentication ${name}`, () => {
    const f = fixture(variant); f.auth[f.legacy ? legacyField : restField] = value;
    assert.throws(() => verifyNicepayAuthentication(f.auth, order, f.config));
  });
  for (const [name, legacyField, restField, value] of [
    ['amount', 'Amt', 'amount', 1], ['order', 'Moid', 'orderId', 'other'],
    ['tid', 'TID', 'tid', 'b'.repeat(30)], ['signature', 'Signature', 'signature', '0'.repeat(64)],
    ['failure', 'ResultCode', 'resultCode', '9999'], ['non-card', 'PayMethod', 'payMethod', 'bank']
  ]) test(`${variant}: rejects approval ${name}`, () => {
    const f = fixture(variant); const auth = verifyNicepayAuthentication(f.auth, order, f.config);
    f.approval[f.legacy ? legacyField : restField] = value;
    assert.throws(() => verifyNicepayApproval(f.approval, order, auth, f.config));
  });
}
test('production remains blocked regardless of environment flags', () => {
  process.env.NICEPAY_ENABLED = 'true';
  assert.throws(requireNicepayLive, /not implemented or enabled/);
  delete process.env.NICEPAY_ENABLED;
});
test('legacy rejects arbitrary callback URL even with genuine signature', () => {
  const f = fixture('legacy');
  for (const url of ['http://127.0.0.1/', 'https://dc1-api.nicepay.co.kr.evil.test/webapi/pay_process.jsp', 'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp?leak=1']) {
    f.auth.NextAppURL = url; assert.throws(() => verifyNicepayAuthentication(f.auth, order, f.config));
  }
});
test('REST rejects unpaid and wrong-currency approvals', () => {
  const f = fixture('rest-server'); const auth = verifyNicepayAuthentication(f.auth, order, f.config);
  for (const change of [{status:'ready'}, {status:'cancelled'}, {currency:'USD'}]) {
    assert.throws(() => verifyNicepayApproval({...f.approval, ...change}, order, auth, f.config));
  }
});
test('requests reject invalid amount, currency, protocol and credentials', () => {
  const f = fixture('rest-server');
  for (const amount of [0, -1, 0.1, NaN, '10000', 1000000000000]) assert.throws(() => buildNicepayRequest({...order, amount}, f.config));
  assert.throws(() => buildNicepayRequest({...order,currency:'USD'}, f.config));
  assert.throws(() => buildNicepayRequest(order, {...f.config,returnUrl:'http://manytool.net/'}));
  assert.throws(() => buildNicepayRequest(order, {...f.config,secret:''}));
  assert.throws(() => buildNicepayRequest(order, {...f.config,variant:'rest-client'}));
});
test('direct product label can be supplied only as safe server label', () => {
  for (const variant of ['legacy','rest-server']) {
    const f=fixture(variant);
    const result=buildNicepayRequest({...order,goodsName:'Manytool direct tool'},f.config,'20261110210000');
    assert.equal(result[f.legacy?'GoodsName':'goodsName'],'Manytool direct tool');
    assert.throws(() => buildNicepayRequest({...order,goodsName:'<script>'},f.config,'20261110210000'));
  }
});
