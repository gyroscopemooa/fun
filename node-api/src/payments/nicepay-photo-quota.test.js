import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { CreditStore } from '../credits/store.js';
import { createPrivatePhotoStorage } from './nicepay-photo-runtime.js';
import { createPhotoQuota } from './nicepay-photo-quota.js';
async function fixture(t, policy = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-quota-'));
  const publicRoot = path.join(dir, 'public'); await fs.mkdir(publicRoot);
  const creditStore = new CreditStore(path.join(dir, 'wallet.db'));
  t.after(async () => { creditStore.close(); await fs.rm(dir, { recursive: true, force: true }); });
  let clock = 1_000_000;
  const now = () => clock;
  const storage = await createPrivatePhotoStorage({ creditStore, root: path.join(dir, 'private'), publicRoots: [publicRoot], quotaPolicy: policy, now });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
  const put = owner => storage.put({ owner, kind: 'source', buffer: png });
  return { dir, storage, creditStore, png, put, now, advance: ms => { clock += ms; } };
}
test('atomic reservations enforce owner/global file and byte caps under concurrent uploads', async t => {
  const f = await fixture(t, { ownerFiles: 1, globalFiles: 2 });
  const attempts = await Promise.allSettled([f.put('owner'), f.put('owner')]);
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(item => item.status === 'rejected').reason.status, 429);
  await f.put('other'); await assert.rejects(f.put('third'), { status: 429 });
  const g = await fixture(t, { fileBytes: 1000, ownerBytes: 1000, globalBytes: 1000 });
  await g.put('owner'); await assert.rejects(g.put('other'), { status: 429 });
});
test('invalid uploads release storage reservations but cannot bypass persistent hourly limit', async t => {
  const f = await fixture(t, { hourlyUploads: 1 });
  await assert.rejects(f.storage.put({ owner: 'owner', kind: 'source', buffer: Buffer.from('invalid') }));
  assert.equal(f.creditStore.db.prepare("SELECT sum(bytes) bytes FROM nice_photo_storage_quota").get().bytes, 0);
  await assert.rejects(f.put('owner'), { status: 429 });
  f.advance(3600001); await f.put('owner');
});
test('retention removes only unbound expired sources, keeps purchased sources and generated outputs', async t => {
  const f = await fixture(t, { unusedSourceMs: 100 });
  const orphan = await f.put('owner'), bound = await f.put('owner');
  const output = await f.storage.put({ owner: 'owner', kind: 'generated', orderId: 'order', buffer: f.png });
  f.creditStore.db.exec('CREATE TABLE nice_photo_purchases(spec TEXT)');
  f.creditStore.db.prepare('INSERT INTO nice_photo_purchases VALUES(?)').run(JSON.stringify({ photoId: bound.artifactId }));
  await assert.rejects(f.storage.removeSource({ owner: 'other', artifactId: orphan.artifactId }));
  await assert.rejects(f.storage.removeSource({ owner: 'owner', artifactId: bound.artifactId }));
  f.advance(101);
  const report = await f.storage.cleanup();
  assert.equal(report.find(row => row.artifactId === orphan.artifactId).removed, true);
  assert.equal(report.find(row => row.artifactId === bound.artifactId).removed, false);
  await assert.rejects(f.storage.read({ artifactId: orphan.artifactId, owner: 'owner' }));
  assert.ok(await f.storage.read({ artifactId: bound.artifactId, owner: 'owner' }));
  assert.ok(await f.storage.read({ artifactId: output.artifactId, owner: 'owner' }));
});
test('deletion claim blocks late write completion and checkout binding after cleanup wins', async t => {
  const f = await fixture(t);
  const quota = createPhotoQuota({ creditStore: f.creditStore, policy: { writingLeaseMs: 100 }, now: f.now });
  quota.reserve({ id: 'stalled', owner: 'owner', kind: 'source' });
  assert.throws(() => quota.claimRemoval('stalled', 'owner'));
  f.advance(101); quota.claimRemoval('stalled', 'owner');
  let insertions = 0;
  assert.throws(() => quota.complete('stalled', 1, () => { insertions++; }));
  assert.equal(insertions, 0); quota.finishRemoval('stalled');
  const source = await f.put('owner');
  quota.claimRemoval(source.artifactId, 'owner');
  assert.throws(() => f.storage.assertActive(source.artifactId));
  await assert.rejects(f.storage.read({ artifactId: source.artifactId, owner: 'owner' }));
});
test('generation reserves full batch before provider calls and failed batches roll back atomically', async t => {
  const { createPrivatePhotoGenerator } = await import('./nicepay-photo-runtime.js');
  const f = await fixture(t, { ownerBytes: 40_000_000 });
  const source = await f.put('owner'); let calls = 0;
  const generate = createPrivatePhotoGenerator({ storage: f.storage, provider: async () => { calls++; return {}; } });
  await assert.rejects(generate({ owner: 'owner', orderId: 'order', photoId: source.artifactId, count: 3, toolType: 'id_photo', options: { provider: 'openai_image' } }), /Photo storage capacity unavailable/);
  assert.equal(calls, 0);
  assert.equal(f.creditStore.db.prepare("SELECT count(*) n FROM nice_photo_storage_quota WHERE state='writing'").get().n, 0);
});
test('abandoned private workspaces are removed after lease, with no generated outputs expired', async t => {
  const f = await fixture(t, { writingLeaseMs: 100 });
  const allocation = await f.storage.prepareGeneration({ owner: 'owner', count: 3 });
  await fs.writeFile(path.join(allocation.dir, 'temporary.png'), f.png);
  f.advance(101); await f.storage.cleanup();
  await assert.rejects(fs.stat(allocation.dir), { code: 'ENOENT' });
  assert.equal(f.creditStore.db.prepare("SELECT coalesce(sum(bytes),0) bytes FROM nice_photo_storage_quota WHERE state!='removed'").get().bytes, 0);
  await allocation.release();
});
test('repeated capacity refusals preserve entitlement and attempt budget, then retry once after space release', async t => {
  const { createPrivatePhotoGenerator } = await import('./nicepay-photo-runtime.js');
  const { createNicepayPhotoAdapters } = await import('./nicepay-photo-adapters.js');
  const { executeNicepayTool } = await import('./nicepay-execution.js');
  const f = await fixture(t, { ownerFiles: 6 });
  const source = await f.put('owner'), extra1 = await f.put('owner'), extra2 = await f.put('owner');
  f.creditStore.db.exec("CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT); INSERT INTO nice_entitlements VALUES('order','owner','base','ready')");
  let calls = 0;
  const generate = createPrivatePhotoGenerator({ storage: f.storage, provider: async args => {
    calls++;
    const generated = [];
    for (let i = 0; i < args.candidateCount; i++) {
      const filePath = path.join(args.storageDir, `${i}.png`); await fs.writeFile(filePath, f.png); generated.push({ filePath });
    }
    return { generated };
  } });
  const adapter = createNicepayPhotoAdapters({ enabled: true, creditStore: f.creditStore,
    resolvePurchase: async () => ({ owner: 'owner', product: 'base', photoId: source.artifactId, toolType: 'id_photo', options: { provider: 'openai_image', outfitType: 'current' } }),
    resolveArtifact: query => f.storage.resolve(query), generate }).base;
  const context = { orderId: 'order', owner: 'owner' };
  const run = async () => { const input = await adapter.validate({ photoId: source.artifactId }, context);
    return executeNicepayTool({ creditStore: f.creditStore, ...context, product: 'base', runner: () => adapter.execute(input, context) }); };
  for (let i = 0; i < 3; i++) {
    await assert.rejects(run(), /capacity unavailable/);
    assert.equal(calls, 0);
    assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_entitlements').get().state, 'ready');
    assert.equal(f.creditStore.db.prepare('SELECT count(*) n FROM nice_photo_jobs').get().n, 0);
    const job = f.creditStore.db.prepare('SELECT state,attempts FROM nice_tool_jobs').get();
    assert.equal(job.state, 'retryable'); assert.equal(job.attempts, 0);
  }
  // The existing unused-refund hold remains available; no cancel/PG call is made.
  const { reserveNicepayFullRefund, releaseUnsentNicepayRefund } = await import('./nicepay-refund.js');
  f.creditStore.db.exec('CREATE TABLE nice_orders(id TEXT PRIMARY KEY,owner TEXT,state TEXT,intent TEXT)');
  f.creditStore.db.prepare("INSERT INTO nice_orders VALUES('order','owner','verified',?)").run(JSON.stringify({ category: 'direct', amount: 1000 }));
  assert.equal(reserveNicepayFullRefund(f.creditStore, 'order', 'owner').state, 'reserved');
  await assert.rejects(run()); assert.equal(calls, 0);
  releaseUnsentNicepayRefund(f.creditStore, 'order', 'owner');
  await f.storage.removeSource({ artifactId: extra1.artifactId, owner: 'owner' });
  await f.storage.removeSource({ artifactId: extra2.artifactId, owner: 'owner' });
  const result = await run(); assert.equal(result.candidates.length, 3); assert.equal(calls, 1);
  assert.deepEqual(await run(), result); assert.equal(calls, 1);
  assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_entitlements').get().state, 'claimed');
  assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_photo_jobs').get().state, 'done');
});
test('provider quota-looking errors cannot forge trusted preflight recovery', async t => {
  const { createPrivatePhotoGenerator } = await import('./nicepay-photo-runtime.js');
  const { isNicepayExecutionDeferred } = await import('./nicepay-preflight.js');
  const f = await fixture(t); const source = await f.put('owner'); let calls = 0;
  const spoof = Object.assign(Error('provider quota'), { status: 429, executionNotStarted: true });
  const generate = createPrivatePhotoGenerator({ storage: f.storage, provider: async () => { calls++; throw spoof; } });
  await assert.rejects(generate({ owner: 'owner', orderId: 'order', photoId: source.artifactId, count: 3, toolType: 'id_photo', options: { provider: 'openai_image' } }), error => {
    assert.equal(error, spoof); assert.equal(isNicepayExecutionDeferred(error), false); return true;
  });
  assert.equal(calls, 1);
});
