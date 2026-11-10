import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { CreditStore } from '../credits/store.js';
import { NicepayOrderStore } from './nicepay-orders.js';
import { createPrivatePhotoStorage, createPhotoPurchaseSnapshots, createNicepayPhotoRuntime } from './nicepay-photo-runtime.js';
import { createNicepayImageRuntime, createNicepayImageStaging } from './nicepay-image-staging.js';
import { executeNicepayTool } from './nicepay-execution.js';
const policy = { enabled: true, apiConfirmed: true, variant: 'legacy', categories: { direct: { approved: true, methods: ['card'], maxAmountKrw: 10000 } } };
const catalog = { base: { category: 'direct', amount: 1000, currency: 'KRW', recurring: false, goodsName: 'Image' } };
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nice-image-')); const publicRoot = path.join(dir, 'public'); await fs.mkdir(publicRoot);
  const file = path.join(dir, 'wallet.db'); const creditStore = new CreditStore(file), store = new NicepayOrderStore(file);
  t.after(async () => { creditStore.close(); store.close(); await fs.rm(dir, { recursive: true, force: true }); });
  creditStore.db.exec('CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT)');
  const storage = await createPrivatePhotoStorage({ creditStore, root: path.join(dir, 'private'), publicRoots: [publicRoot] });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
  const { artifactId: photoId } = await storage.put({ owner: 'owner', kind: 'source', buffer: png });
  const seen = [];
  const provider = async args => { seen.push(args); const filePath = path.join(args.outputDir, 'result.png'); await fs.writeFile(filePath, png); return { provider: args.provider, mode: args.mode, filePath }; };
  const rights = new Map();
  const runtime = createNicepayImageRuntime({ enabled: true, creditStore, storage, provider, resolveCheckoutRights: async ({ input }) => rights.get(input.choice) });
  const create = () => store.create({ ownerId: 'owner', productId: 'base' }, catalog, policy, 'testmid001');
  async function bind(choice, spec) { rights.set(choice, { photoId, userInput: '', ...spec }); const order = create(); await runtime.adapters.base.bindCheckout({ choice }, { orderId: order.id, owner: 'owner' }); return order; }
  async function run(order, input = { photoId }) {
    const context = { orderId: order.id, owner: 'owner' }; const adapter = runtime.adapters.base;
    const validated = await adapter.validate(input, context);
    creditStore.db.prepare("INSERT OR IGNORE INTO nice_entitlements VALUES(?,'owner','base','ready')").run(order.id);
    return executeNicepayTool({ creditStore, ...context, product: 'base', runner: () => adapter.execute(validated, context) });
  }
  return { dir, publicRoot, creditStore, storage, store, runtime, rights, seen, create, bind, run, photoId, provider, png };
}
test('image generator and product model preserve provider/mode/prompt rights and private one-output delivery', async t => {
  const f = await fixture(t);
  for (const [tool, mode, provider] of [['ai_image', 'figure', 'openai'], ['ai_image', 'free', 'xai'], ['product_model', 'modelcut', 'openai']]) {
    const order = await f.bind(mode, { tool, mode, provider, userInput: 'studio scene' });
    const result = await f.run(order); assert.equal(result.candidates.length, 1); assert.equal(result.tool, tool);
    assert.deepEqual(await f.run(order), result);
    assert.equal(f.seen.at(-1).mode, mode); assert.equal(f.seen.at(-1).provider, provider); assert.equal(f.seen.at(-1).userInput, 'studio scene');
    assert.equal(f.seen.at(-1).mimeType, 'image/png');
    const query = { orderId: order.id, owner: 'owner', candidateId: result.candidates[0].id };
    assert.equal((await sharp(await f.runtime.download(query)).metadata()).format, 'png');
    await assert.rejects(f.runtime.download({ ...query, owner: 'other' }));
    await assert.rejects(f.storage.removeSource({ owner: 'owner', artifactId: f.photoId }));
  }
  assert.equal(f.seen.length, 3);
});
test('client upgrades and cross-tool base reuse are rejected; AI Photoshop maps to headshot rights', async t => {
  const f = await fixture(t); const order = await f.bind('figure', { tool: 'ai_image', mode: 'figure', provider: 'openai' });
  await assert.rejects(f.run(order, { photoId: f.photoId, provider: 'xai' })); assert.equal(f.seen.length, 0);
  const snapshots = createPhotoPurchaseSnapshots({ creditStore: f.creditStore, storage: f.storage });
  let photoInput;
  const photo = createNicepayPhotoRuntime({ enabled: true, creditStore: f.creditStore, storage: f.storage, snapshots, provider: async args => { photoInput = args; const generated = []; for (let i = 0; i < args.candidateCount; i++) { const filePath = path.join(args.storageDir, `headshot-${i}.png`); await fs.writeFile(filePath, f.png); generated.push({ filePath }); } return { generated }; } });
  await assert.rejects(snapshots.bind({ orderId: order.id, owner: 'owner', photoId: f.photoId, toolType: 'headshot', options: { provider: 'openai_image', outfitType: 'current' } }));
  await assert.rejects(photo.adapters.base.validate({ photoId: f.photoId }, { orderId: order.id, owner: 'owner' }));
  const photoshop = f.create();
  await snapshots.bind({ orderId: photoshop.id, owner: 'owner', photoId: f.photoId, toolType: 'headshot', options: { provider: 'openai_image', outfitType: 'current' } });
  assert.equal((await snapshots.resolve({ orderId: photoshop.id, owner: 'owner', product: 'base' })).toolType, 'headshot');
  await assert.rejects(f.runtime.adapters.base.bindCheckout({ choice: 'figure' }, { orderId: photoshop.id, owner: 'owner' }));
  await assert.rejects(f.runtime.adapters.base.validate({ photoId: f.photoId }, { orderId: photoshop.id, owner: 'owner' }));
  const context = { orderId: photoshop.id, owner: 'owner' };
  const validated = await photo.adapters.base.validate({ photoId: f.photoId }, context);
  f.creditStore.db.prepare("INSERT INTO nice_entitlements VALUES(?,'owner','base','ready')").run(photoshop.id);
  const result = await executeNicepayTool({ creditStore: f.creditStore, ...context, product: 'base', runner: () => photo.adapters.base.execute(validated, context) });
  assert.equal(result.candidates.length, 3); assert.equal(photoInput.toolType, 'headshot'); assert.equal(photoInput.outfitType, 'current');
});
test('invalid rights fail closed; one database cannot be attached to multiple artifact roots', async t => {
  const f = await fixture(t);
  for (const spec of [{ tool: 'product_model', mode: 'figure', provider: 'openai' }, { tool: 'ai_image', mode: 'modelcut', provider: 'xai' }, { tool: 'ai_image', mode: 'free', provider: 'openai' }, { tool: 'ai_image', mode: 'figure', provider: 'other' }]) await assert.rejects(f.bind('invalid', spec));
  await assert.rejects(createPrivatePhotoStorage({ creditStore: f.creditStore, root: path.join(f.dir, 'another-private'), publicRoots: [f.publicRoot] }), /One private artifact root/);
  assert.deepEqual(createNicepayImageRuntime(), {});
  assert.throws(() => createNicepayImageRuntime({ enabled: true, creditStore: f.creditStore, storage: f.storage }));
  const disabled = await createNicepayImageStaging(); assert.ok(disabled.router);
});
test('dedicated image HTTP assembly verifies payment and prevents cross-owner delivery or prompt upgrades', async t => {
  const { default: express } = await import('express'); const { createHash } = await import('node:crypto');
  const f = await fixture(t);
  const config = { variant: 'legacy', id: 'testmid001', secret: 'offline-test-not-secret', returnUrl: 'https://manytool.net/image/payment/return' };
  const stage = await createNicepayImageStaging({ enabled: true, creditStore: f.creditStore, store: f.store,
    root: path.join(f.dir, 'private'), publicRoots: [f.publicRoot], config, policy, catalog,
    origin: 'https://manytool.net', authenticate: async req => { if (!req.headers['x-owner']) throw Error(); return req.headers['x-owner']; },
    client: { approve: async (body, order) => ({ verified: true, orderId: order.id, tid: body.TxTid, amount: order.amount, currency: 'KRW' }) }, provider: f.provider,
    resolveCheckoutRights: async ({ input }) => ({ photoId: input.photoId, tool: 'product_model', mode: 'modelcut', provider: 'openai', userInput: 'catalog lighting' }) });
  const app = express(); app.use(stage.router); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, owner = 'owner') => fetch(url + route, { method: 'POST', headers: { Origin: 'https://manytool.net', 'x-owner': owner, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const checkout = await post('/payment/checkout', { productId: 'base', input: { photoId: f.photoId, provider: 'xai' } });
  assert.equal(checkout.status, 200); const orderId = /name="Moid" value="([^"]+)"/.exec(await checkout.text())[1];
  const auth = { AuthResultCode: '0000', MID: config.id, Moid: orderId, Amt: '1000', AuthToken: 'fixture', TxTid: 'b'.repeat(30), PayMethod: 'CARD', NextAppURL: 'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp' };
  auth.Signature = createHash('sha256').update(auth.AuthToken + config.id + auth.Amt + config.secret).digest('hex');
  assert.equal((await fetch(url + '/payment/return', { method: 'POST', body: new URLSearchParams(auth) })).status, 200);
  assert.equal((await post('/payment/execute', { orderId, input: { photoId: f.photoId, mode: 'body' } })).status, 409);
  const executed = await post('/payment/execute', { orderId, input: { photoId: f.photoId } }); assert.equal(executed.status, 200);
  const { result } = await executed.json(); assert.equal(result.mode, 'modelcut'); assert.equal(result.provider, 'openai');
  const query = { orderId, candidateId: result.candidates[0].id };
  assert.equal((await post('/files/download', query, 'other')).status, 404);
  const download = await post('/files/download', query); assert.equal(download.status, 200); assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.equal((await post('/files/delete-source', { artifactId: f.photoId })).status, 409);
  assert.equal((await fetch(url + '/jobs/' + orderId, { headers: { Origin: 'https://manytool.net', 'x-owner': 'owner' } })).status, 200);
  assert.equal(f.seen.length, 1);
});
test('server image variant policy is immutable and never accepts browser provider upgrades', async () => {
  const { createNicepayImageRightsPolicy } = await import('./nicepay-image-staging.js');
  const variants = { garment: { tool: 'product_model', mode: 'modelcut', provider: 'openai' } };
  const resolve = createNicepayImageRightsPolicy(variants); variants.garment.provider = 'xai';
  const query = { product: 'base', input: { photoId: 'photo', variant: 'garment', userInput: '' } };
  assert.equal((await resolve(query)).provider, 'openai');
  await assert.rejects(resolve({ ...query, input: { ...query.input, provider: 'xai' } }));
  await assert.rejects(resolve({ ...query, input: { ...query.input, variant: 'unknown' } }));
});
