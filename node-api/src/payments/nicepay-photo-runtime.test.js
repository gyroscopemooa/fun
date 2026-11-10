import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { CreditStore } from '../credits/store.js';
import { NicepayOrderStore } from './nicepay-orders.js';
import { executeNicepayTool } from './nicepay-execution.js';
import { createPrivatePhotoStorage, createPhotoPurchaseSnapshots, createNicepayPhotoRuntime, createPrivatePhotoGenerator } from './nicepay-photo-runtime.js';

const policy = { enabled: true, apiConfirmed: true, variant: 'legacy', categories: { direct: { approved: true, methods: ['card'], maxAmountKrw: 10000 } } };
const catalog = Object.fromEntries(['base','add2','add3','add7'].map(product => [product, { category: 'direct', amount: 1000, currency: 'KRW', recurring: false, goodsName: product }])); // Test fixtures only; no price catalog changes.
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'private-photo-test-'));
  const publicRoot = path.join(root, 'public'); await fs.mkdir(publicRoot);
  const privateRoot = path.join(root, 'private');
  const filename = path.join(root, 'wallet.sqlite');
  const creditStore = new CreditStore(filename), orders = new NicepayOrderStore(filename);
  t.after(async () => { creditStore.close(); orders.close(); await fs.rm(root, { recursive: true, force: true }); });
  creditStore.db.exec('CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT)');
  const storage = await createPrivatePhotoStorage({ creditStore, root: privateRoot, publicRoots: [publicRoot] });
  const snapshots = createPhotoPurchaseSnapshots({ creditStore, storage });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
  const { artifactId: photoId } = await storage.put({ owner: 'owner', kind: 'source', buffer: png });
  const calls = [];
  const provider = async args => {
    calls.push(args);
    assert.equal((await sharp(args.inputPath).metadata()).format, 'png');
    const generated = [];
    for (let i = 0; i < args.candidateCount; i++) {
      const filePath = path.join(args.storageDir, `${i}.png`); await fs.writeFile(filePath, png); generated.push({ filePath });
    }
    return { generated };
  };
  const runtime = createNicepayPhotoRuntime({ enabled: true, creditStore, storage, snapshots, provider });
  const options = { provider: 'openai_image', outfitType: 'current' };
  async function bind(product = 'base', parentOrderId) {
    const order = orders.create({ ownerId: 'owner', productId: product }, catalog, policy, 'testmid001');
    await snapshots.bind({ orderId: order.id, owner: 'owner', photoId, toolType: 'id_photo', options, parentOrderId });
    return order;
  }
  async function run(order) {
    creditStore.db.prepare("INSERT OR IGNORE INTO nice_entitlements VALUES(?,'owner',?,'ready')").run(order.id, order.productId);
    const context = { orderId: order.id, owner: 'owner' };
    const adapter = runtime.adapters[order.productId];
    const input = await adapter.validate({ photoId }, context);
    return executeNicepayTool({ creditStore, ...context, product: order.productId, runner: () => adapter.execute(input, context) });
  }
  return { root, privateRoot, publicRoot, creditStore, storage, snapshots, runtime, photoId, png, options, bind, run, orders, calls };
}
test('private upload validates pixels and ownership, strips metadata, rejects public storage', async t => {
  const f = await fixture(t);
  await assert.rejects(createPrivatePhotoStorage({ creditStore: f.creditStore, root: path.join(f.publicRoot, 'leak'), publicRoots: [f.publicRoot] }));
  await assert.rejects(f.storage.put({ owner: 'owner', kind: 'source', buffer: Buffer.from('<svg/>') }));
  await assert.rejects(f.storage.read({ owner: 'other', artifactId: f.photoId }));
  await assert.rejects(f.storage.read({ owner: 'owner', artifactId: '../escape' }));
  const metadata = await sharp(await f.storage.read({ owner: 'owner', artifactId: f.photoId })).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.exif, undefined);
  await fs.writeFile(path.join(f.privateRoot, `${f.photoId}.png`), Buffer.from('tamper'));
  await assert.rejects(f.storage.resolve({ owner: 'owner', artifactId: f.photoId }));
});
test('snapshot cannot change after checkout or bind after payment; options are bounded', async t => {
  const f = await fixture(t), order = await f.bind();
  const args = { orderId: order.id, owner: 'owner', photoId: f.photoId, toolType: 'id_photo', options: f.options };
  await assert.rejects(f.snapshots.bind(args));
  const other = f.orders.create({ ownerId: 'owner', productId: 'base' }, catalog, policy, 'testmid001');
  f.orders.claim(other.id, 'T'.repeat(30));
  await assert.rejects(f.snapshots.bind({ ...args, orderId: other.id }));
  await assert.rejects(f.snapshots.bind({ ...args, options: { ...f.options, count: 7 } }));
  await assert.rejects(f.snapshots.resolve({ orderId: order.id, owner: 'other', product: 'base' }));
});
test('actual private file pipeline persists exact base/additional allowances and protects downloads', async t => {
  const f = await fixture(t), base = await f.bind();
  const result = await f.run(base); assert.equal(result.candidates.length, 3);
  assert.deepEqual(await f.run(base), result); assert.equal(f.calls.length, 1);
  for (const count of [2, 3, 7]) {
    const order = await f.bind(`add${count}`, base.id); const extra = await f.run(order);
    assert.equal(extra.candidates.length, count); assert.equal(f.calls.at(-1).candidateCount, count);
    assert.equal(f.calls.at(-1).outfitType, 'current');
  }
  const args = { orderId: base.id, owner: 'owner', candidateId: result.candidates[0].id };
  assert.equal((await sharp(await f.runtime.download(args)).metadata()).format, 'png');
  await assert.rejects(f.runtime.download({ ...args, owner: 'other' }));
  assert.ok(!(await fs.readdir(f.privateRoot)).some(name => name.startsWith('work-')));
  const reopened = new CreditStore(path.join(f.root, 'wallet.sqlite'));
  try {
    const storage = await createPrivatePhotoStorage({ creditStore: reopened, root: f.privateRoot, publicRoots: [f.publicRoot] });
    assert.ok((await storage.read({ artifactId: result.candidates[0].artifactId, owner: 'owner', kind: 'generated', orderId: base.id })).length);
  } finally { reopened.close(); }
});
test('real provider remains disabled unless explicitly opted in; escaping outputs rejected', async t => {
  const f = await fixture(t);
  assert.deepEqual(createNicepayPhotoRuntime(), {});
  assert.throws(() => createNicepayPhotoRuntime({ enabled: true, creditStore: f.creditStore, storage: f.storage, snapshots: f.snapshots }));
  const args = { photoId: f.photoId, owner: 'owner', orderId: 'order', toolType: 'id_photo', options: f.options, count: 3 };
  await assert.rejects(createPrivatePhotoGenerator({ storage: f.storage })(args), /disabled/);
  const run = createPrivatePhotoGenerator({ storage: f.storage, provider: async () => ({ generated: Array(3).fill({ filePath: path.join(f.privateRoot, `${f.photoId}.png`) }) }) });
  await assert.rejects(run(args), /path rejected/);
  assert.ok(!(await fs.readdir(f.privateRoot)).some(name => name.startsWith('work-')));
});
test('checkout hook uses verified server policy and freezes rights before returning a form', async t => {
  const { default: express } = await import('express');
  const { createNicepayStagingRouter } = await import('./nicepay-callback.js');
  const f = await fixture(t);
  const runtime = createNicepayPhotoRuntime({ enabled: true, creditStore: f.creditStore, storage: f.storage, snapshots: f.snapshots,
    provider: async () => { throw Error('No generation during checkout'); },
    resolveCheckoutRights: async ({ input, owner, product }) => {
      assert.equal(owner, 'owner'); assert.equal(product, 'base');
      if (input?.photoId !== f.photoId) throw Error('Unknown source');
      return { photoId: f.photoId, toolType: 'id_photo', options: f.options };
    } });
  const config = { variant: 'legacy', id: 'testmid001', secret: 'offline-test-not-secret', returnUrl: 'https://manytool.net/nice/return' };
  const app = express();
  app.use('/nice', createNicepayStagingRouter({ enabled: true, store: f.orders, creditStore: f.creditStore, config, policy, catalog,
    authenticate: async () => 'owner', origin: 'https://manytool.net', client: {}, toolAdapters: runtime.adapters }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const checkout = input => fetch(`http://127.0.0.1:${server.address().port}/nice/checkout`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://manytool.net' }, body: JSON.stringify({ productId: 'base', input }) });
  const rejected = await checkout({ photoId: 'foreign' }); assert.equal(rejected.status, 400);
  assert.ok(!(await rejected.text()).includes('name="Moid"'));
  const accepted = await checkout({ photoId: f.photoId, fullPackage: true, owner: 'intruder' });
  assert.equal(accepted.status, 200);
  const orderId = /name="Moid" value="([^"]+)"/.exec(await accepted.text())[1];
  const spec = await f.snapshots.resolve({ orderId, owner: 'owner', product: 'base' });
  assert.equal(spec.photoId, f.photoId); assert.equal(spec.options.fullPackage, false);
  assert.equal(f.calls.length, 0);
});
test('unmounted private HTTP routes enforce origin/auth and stream only owned candidates', async t => {
  const { default: express } = await import('express');
  const { createNicepayPrivatePhotoRouter } = await import('./nicepay-photo-router.js');
  const f = await fixture(t), result = await f.run(await f.bind());
  const app = express();
  app.use('/disabled', createNicepayPrivatePhotoRouter());
  app.use('/photo', createNicepayPrivatePhotoRouter({ enabled: true, storage: f.storage, runtime: f.runtime,
    origin: 'https://manytool.net', authenticate: async req => { if (!['owner', 'other'].includes(req.headers['x-test-user'])) throw Error(); return req.headers['x-test-user']; } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url + '/disabled/upload', { method: 'POST' })).status, 503);
  const headers = { Origin: 'https://manytool.net', 'x-test-user': 'owner', 'Content-Type': 'image/png' };
  assert.equal((await fetch(url + '/photo/upload', { method: 'POST', headers: { ...headers, 'x-test-user': '' }, body: f.png })).status, 401);
  assert.equal((await fetch(url + '/photo/upload', { method: 'POST', headers: { ...headers, Origin: 'https://evil.test' }, body: f.png })).status, 403);
  const upload = await fetch(url + '/photo/upload', { method: 'POST', headers, body: f.png });
  assert.equal(upload.status, 201); const uploaded = await upload.json(); assert.deepEqual(Object.keys(uploaded), ['artifactId']);
  const download = user => fetch(url + '/photo/download', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'x-test-user': user },
    body: JSON.stringify({ orderId: result.jobId, candidateId: result.candidates[0].id, owner: 'owner' }) });
  assert.equal((await download('other')).status, 404);
  const output = await download('owner'); assert.equal(output.status, 200); assert.equal(output.headers.get('cache-control'), 'no-store');
  assert.equal(output.headers.get('content-disposition'), 'attachment; filename="photo.png"');
  assert.equal((await sharp(Buffer.from(await output.arrayBuffer())).metadata()).format, 'png');
});
