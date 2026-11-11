import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreditStore } from '../credits/store.js';
import { executeNicepayTool } from './nicepay-execution.js';
import { createNicepayPhotoAdapters, selectNicepayPhotoCandidate } from './nicepay-photo-adapters.js';
function fixture(t, filename = ':memory:', overrides = {}) {
  const creditStore = new CreditStore(filename);
  t.after(() => creditStore.close());
  creditStore.db.exec('CREATE TABLE IF NOT EXISTS nice_entitlements(order_id TEXT PRIMARY KEY, owner TEXT, product TEXT, state TEXT)');
  let calls = 0;
  const specs = new Map();
  const dependencies = { enabled: true, creditStore,
    resolvePurchase: async ({ orderId }) => specs.get(orderId),
    resolveArtifact: async ({ artifactId, owner, orderId }) => ({ id: artifactId, owner, orderId }),
    generate: async ({ count, orderId }) => { calls++; return Array.from({ length: count }, (_, i) => ({ artifactId: `${orderId}-file-${i}` })); },
    ...overrides };
  const adapters = createNicepayPhotoAdapters(dependencies);
  function add(orderId, product = 'base', extra = {}) {
    creditStore.db.prepare("INSERT INTO nice_entitlements VALUES(?,'owner',?,'ready')").run(orderId, product);
    specs.set(orderId, { owner: 'owner', product, photoId: 'photo', toolType: 'id_photo', ...extra });
    const context = { orderId, owner: 'owner' };
    return async (input = { photoId: 'photo' }) => {
      const value = await adapters[product].validate(input, context);
      return executeNicepayTool({ creditStore, ...context, product, runner: () => adapters[product].execute(value, context) });
    };
  }
  return { creditStore, add, adapters, specs, dependencies, calls: () => calls };
}
test('photo adapters are disabled by default and require private dependencies', () => {
  assert.deepEqual(createNicepayPhotoAdapters(), {});
  assert.throws(() => createNicepayPhotoAdapters({ enabled: true }));
});
test('base generates 3 durable owned candidates, selects safely and replays once', async t => {
  const f = fixture(t); const run = f.add('base'); const result = await run();
  assert.equal(result.candidates.length, 3); assert.deepEqual(await run(), result); assert.equal(f.calls(), 1);
  const select = extra => selectNicepayPhotoCandidate({ creditStore: f.creditStore, orderId: 'base', owner: 'owner', candidateId: result.candidates[0].id, ...extra });
  assert.equal(select().artifactId, 'base-file-0');
  assert.throws(() => select({ owner: 'other' })); assert.throws(() => select({ candidateId: 'foreign' }));
});
test('exact extra allowance binds to completed base, same photo, tool and options', async t => {
  const f = fixture(t); await f.add('base')();
  for (const count of [2, 3, 7]) {
    const run = f.add(`extra${count}`, `add${count}`, { parentOrderId: 'base' });
    assert.equal((await run()).candidates.length, count); await run();
  }
  assert.equal(f.calls(), 4);
  for (const [suffix, extra] of Object.entries({ foreign: { parentOrderId: 'unknown' }, photo: { photoId: 'another' }, tool: { toolType: 'headshot' }, option: { options: { fullPackage: true } } })) {
    const run = f.add(suffix, 'add2', { parentOrderId: 'base', ...extra });
    await assert.rejects(run({ photoId: extra.photoId ?? 'photo' }));
    assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_entitlements WHERE order_id=?').get(suffix).state, 'ready');
  }
});
test('client upgrades, unknown legacy addon rights and ownerless uploads fail before claiming', async t => {
  const f = fixture(t); const run = f.add('base');
  for (const input of [{ photoId: 'other' }, { photoId: 'photo', toolType: 'headshot' }, { photoId: 'photo', count: 99 }, { photoId: '../photo' }]) await assert.rejects(run(input));
  assert.equal(f.calls(), 0);
  await run();
  for (const product of ['passport_addon', 'headshot_addon']) await assert.rejects(f.add(product, product, { parentOrderId: 'base' })());
  const g = fixture(t, ':memory:', { resolveArtifact: async () => ({ id: 'photo' }) });
  await assert.rejects(g.add('ownerless')()); assert.equal(g.calls(), 0);
});
test('unknown provider outcomes never grant new retries, including provider retry hints', async t => {
  let calls = 0;
  const f = fixture(t, ':memory:', { generate: async () => { calls++; throw Object.assign(Error('timeout'), { executionNotStarted: true }); } });
  const run = f.add('base'); await assert.rejects(run()); await assert.rejects(run());
  assert.equal(calls, 1);
  assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_photo_jobs').get().state, 'uncertain');
  assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_entitlements').get().state, 'claimed');
});
test('wrong candidate counts, duplicate files and cross-owner outputs are quarantined', async t => {
  for (const generate of [async () => [], async () => Array(3).fill({ artifactId: 'duplicate' })]) {
    const f = fixture(t, ':memory:', { generate }); await assert.rejects(f.add('base')());
    assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_photo_jobs').get().state, 'uncertain');
  }
  const f = fixture(t, ':memory:', { resolveArtifact: async ({ artifactId, owner, kind, orderId }) => ({ id: artifactId, owner: kind === 'source' ? owner : 'intruder', orderId }) });
  await assert.rejects(f.add('base')());
});
test('durable candidates survive database reopen without regenerating files', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'nice-photo-'));
  const filename = join(dir, 'wallet.sqlite'); const f = fixture(t, filename);
  // after hooks run in registration order: close SQLite before deleting on Windows.
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = await f.add('base')();
  const reopened = new CreditStore(filename);
  try {
    createNicepayPhotoAdapters({ ...f.dependencies, creditStore: reopened });
    assert.equal(selectNicepayPhotoCandidate({ creditStore: reopened, orderId: 'base', owner: 'owner', candidateId: result.candidates[1].id }).artifactId, 'base-file-1');
  } finally { reopened.close(); }
});
