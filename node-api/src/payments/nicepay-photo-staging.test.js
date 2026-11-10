import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import express from 'express';
import sharp from 'sharp';
import { CreditStore } from '../credits/store.js';
import { NicepayOrderStore } from './nicepay-orders.js';
import { createNicepayPhotoStaging } from './nicepay-photo-staging.js';
const hash = value => createHash('sha256').update(value).digest('hex');
test('assembled private staging runs signed mocked payment through owned download without live calls', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-stage-'));
  const publicRoot = path.join(dir, 'public'); await fs.mkdir(publicRoot);
  const file = path.join(dir, 'db.sqlite'), creditStore = new CreditStore(file), store = new NicepayOrderStore(file);
  t.after(async () => { creditStore.close(); store.close(); await fs.rm(dir, { recursive: true, force: true }); });
  const config = { variant: 'legacy', id: 'testmid001', secret: 'test-only-offline-secret', returnUrl: 'https://manytool.net/photo/payment/return' };
  const policy = { enabled: true, apiConfirmed: true, variant: 'legacy', categories: { direct: { approved: true, methods: ['card'], maxAmountKrw: 10000 } } };
  const catalog = { base: { category: 'direct', amount: 1000, currency: 'KRW', recurring: false, goodsName: 'Photo' } }; // Offline fixture, not a price change.
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
  let calls = 0, approvals = 0;
  const dependencies = { enabled: true, creditStore, store, root: path.join(dir, 'private'), publicRoots: [publicRoot],
    config, policy, catalog, origin: 'https://manytool.net', authenticate: async req => { if (!req.headers['x-owner']) throw Error(); return req.headers['x-owner']; },
    client: { approve: async (_body, order) => { approvals++; return { verified: true, orderId: order.id, tid: _body.TxTid, amount: order.amount, currency: 'KRW' }; } },
    resolveCheckoutRights: async ({ input }) => ({ photoId: input?.photoId, toolType: 'id_photo', options: { provider: 'openai_image', outfitType: 'current' } }),
    provider: async args => { calls++; const generated = []; for (let i = 0; i < args.candidateCount; i++) { const filePath = path.join(args.storageDir, `${i}.png`); await fs.writeFile(filePath, png); generated.push({ filePath }); } return { generated }; } };
  await assert.rejects(createNicepayPhotoStaging({ ...dependencies, catalog: { passport_addon: catalog.base } }));
  await assert.rejects(createNicepayPhotoStaging({ ...dependencies, resolveCheckoutRights: undefined }));
  const stage = await createNicepayPhotoStaging(dependencies), disabled = await createNicepayPhotoStaging();
  const app = express(); app.use('/photo', stage.router); app.use('/disabled', disabled.router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'https://manytool.net', 'x-owner': 'owner' };
  const post = (route, body, owner = 'owner') => fetch(url + '/photo' + route, { method: 'POST', headers: { ...headers, 'x-owner': owner, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(url + '/disabled/files/upload', { method: 'POST' })).status, 503);
  const upload = await fetch(url + '/photo/files/upload', { method: 'POST', headers: { ...headers, 'Content-Type': 'image/png' }, body: png });
  assert.equal(upload.status, 201); const { artifactId: photoId } = await upload.json();
  const checkout = await post('/payment/checkout', { productId: 'base', input: { photoId, outfitType: 'suit' } });
  assert.equal(checkout.status, 200); const orderId = /name="Moid" value="([^"]+)"/.exec(await checkout.text())[1];
  assert.equal((await post('/files/delete-source', { artifactId: photoId })).status, 409);
  const tid = 'a'.repeat(30), auth = { AuthResultCode: '0000', MID: config.id, Moid: orderId, Amt: '1000', AuthToken: 'test-token', TxTid: tid, PayMethod: 'CARD', NextAppURL: 'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp' };
  auth.Signature = hash(auth.AuthToken + config.id + auth.Amt + config.secret);
  for (let i = 0; i < 2; i++) assert.equal((await fetch(url + '/photo/payment/return', { method: 'POST', body: new URLSearchParams(auth) })).status, 200);
  assert.equal(approvals, 1);
  const execute = () => post('/payment/execute', { orderId, input: { photoId } });
  const result = (await (await execute()).json()).result; assert.equal(result.candidates.length, 3);
  assert.equal((await execute()).status, 200); assert.equal(calls, 1);
  const job = await fetch(url + '/photo/jobs/' + orderId, { headers }); assert.equal((await job.json()).status, 'done');
  assert.equal((await fetch(url + '/photo/jobs/' + orderId, { headers: { ...headers, 'x-owner': 'other' } })).status, 404);
  const downloadBody = { orderId, candidateId: result.candidates[0].id };
  assert.equal((await post('/files/download', downloadBody, 'other')).status, 404);
  const download = await post('/files/download', downloadBody); assert.equal(download.status, 200); assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.equal((await sharp(Buffer.from(await download.arrayBuffer())).metadata()).format, 'png');
});
test('upload admission bounds work before body parsing and releases after failed work', async t => {
  const { createNicepayPrivatePhotoRouter } = await import('./nicepay-photo-router.js');
  let started, release;
  const beginning = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const storage = { put: async () => { calls++; if (calls === 1) { started(); await pending; throw Error('test failure'); } return { artifactId: 'fixture' }; } };
  const app = express(); app.use(createNicepayPrivatePhotoRouter({ enabled: true, storage, runtime: {}, origin: 'https://manytool.net', authenticate: async () => 'owner', maxOwnerUploads: 1 }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const upload = () => fetch(`http://127.0.0.1:${server.address().port}/upload`, { method: 'POST', headers: { Origin: 'https://manytool.net', 'Content-Type': 'image/png' }, body: Buffer.from('fixture') });
  const first = upload(); await beginning;
  assert.equal((await upload()).status, 429); assert.equal(calls, 1);
  release(); assert.equal((await first).status, 400);
  assert.equal((await upload()).status, 201); assert.equal(calls, 2);
});
