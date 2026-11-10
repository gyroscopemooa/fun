import { deferNicepayExecution } from './nicepay-preflight.js';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { createPhotoQuota } from './nicepay-photo-quota.js';
import { normalizeIdPhotoStyling } from '../providers/idPhotoStyling.js';
import { createNicepayPhotoAdapters, selectNicepayPhotoCandidate } from './nicepay-photo-adapters.js';

const identifier = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw Error('Invalid artifact reference');
  return value;
};
const ownerRequired = owner => { if (typeof owner !== 'string' || !owner || owner.length > 254) throw Error('Verified owner required'); };
const digest = buffer => createHash('sha256').update(buffer).digest('hex');

/** root MUST be outside every static web root. No HTTP routes are mounted here. */
export async function createPrivatePhotoStorage({ creditStore, root, publicRoots, quotaPolicy, now = Date.now }) {
  if (!path.isAbsolute(root ?? '') || !Array.isArray(publicRoots) || !publicRoots.length) throw Error('Explicit private and public storage roots required');
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const realRoot = await fs.realpath(root);
  if ((await fs.stat(realRoot)).mode & 0o077) throw Error('Private photo root must be owner-only');
  for (const publicRoot of publicRoots) {
    const realPublic = await fs.realpath(publicRoot);
    const relative = path.relative(realPublic, realRoot);
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw Error('Photo storage must not be publicly served');
  }
  const db = creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_photo_artifacts(id TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,
    order_id TEXT,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL);`);
  db.exec('CREATE TABLE IF NOT EXISTS nice_photo_workspaces(id TEXT PRIMARY KEY,owner TEXT NOT NULL,directory TEXT NOT NULL,created INTEGER NOT NULL)');
  const quota = createPhotoQuota({ creditStore, policy: quotaPolicy, now });
  async function read({ artifactId, owner, kind, orderId }) {
    identifier(artifactId); ownerRequired(owner);
    const row = db.prepare('SELECT * FROM nice_photo_artifacts WHERE id=? AND owner=?').get(artifactId, owner);
    if (!row || (kind && row.kind !== kind) || (orderId && row.order_id !== orderId)) throw Error('Private photo unavailable');
    quota.assertActive(artifactId);
    const handle = await fs.open(path.join(realRoot, `${artifactId}.png`), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== row.bytes || stat.size > 20_000_000) throw Error('Private photo integrity failed');
      const buffer = await handle.readFile();
      if (digest(buffer) !== row.sha256) throw Error('Private photo integrity failed');
      return { row, buffer };
    } finally { await handle.close(); }
  }
  async function remove(artifactId, owner, options) {
    identifier(artifactId); ownerRequired(owner);
    const claim = quota.claimRemoval(artifactId, owner, options);
    if (!claim) { await fs.rm(path.join(realRoot, `${artifactId}.png`), { force: true }); return; }
    await fs.rm(path.join(realRoot, `${artifactId}.png`), { force: true });
    quota.finishRemoval(artifactId);
  }
  return {
    assertActive: id => quota.assertActive(id),
    async removeSource({ artifactId, owner }) { await remove(artifactId, owner); },
    async cleanup() {
      const results = [];
      for (const workspace of db.prepare('SELECT * FROM nice_photo_workspaces WHERE created<=?').all(now() - quota.limits.writingLeaseMs)) {
        try {
          quota.claimRemoval(workspace.id, workspace.owner, { expiredOnly: true });
          await fs.rm(path.join(realRoot, workspace.directory), { recursive: true, force: true });
          quota.finishRemoval(workspace.id);
          db.prepare('DELETE FROM nice_photo_workspaces WHERE id=?').run(workspace.id);
        } catch { /* Keep accounting and retry an uncertain cleanup. */ }
      }
      for (const row of quota.candidates()) {
        try { await remove(row.id, row.owner, { expiredOnly: true }); results.push({ artifactId: row.id, removed: true }); }
        catch { results.push({ artifactId: row.id, removed: false }); }
      }
      return results;
    },
    async prepareGeneration({ owner, count }) {
      ownerRequired(owner);
      if (![2, 3, 7].includes(count)) throw Error('Invalid generation allowance');
      const outputIds = Array.from({ length: count }, () => randomUUID());
      const workspaceId = randomUUID(), copyId = randomUUID();
      // Reserve outputs plus source/copy working space before any provider request.
      quota.reserveBatch([...outputIds.map(id => ({ id, owner, kind: 'generated' })),
        { id: workspaceId, owner, kind: 'workspace' }, { id: copyId, owner, kind: 'workspace' }]);
      const directory = `work-${workspaceId}`;
      db.prepare('INSERT INTO nice_photo_workspaces VALUES(?,?,?,?)').run(workspaceId, owner, directory, now());
      const dir = path.join(realRoot, directory);
      await fs.mkdir(dir, { mode: 0o700 });
      return { dir, outputIds, async release() {
        await fs.rm(dir, { recursive: true, force: true });
        db.prepare('DELETE FROM nice_photo_workspaces WHERE id=?').run(workspaceId);
        for (const id of [...outputIds, workspaceId, copyId]) {
          const row = db.prepare('SELECT state FROM nice_photo_storage_quota WHERE id=?').get(id);
          if (row?.state === 'writing') await remove(id, owner, { failedWrite: true });
        }
      } };
    },
    async put({ owner, kind, orderId = null, buffer, reservationId }) {
      ownerRequired(owner);
      if (!['source', 'generated'].includes(kind) || !Buffer.isBuffer(buffer) || buffer.length > 20_000_000) throw Error('Invalid private image');
      if (kind === 'generated') identifier(orderId);
      const artifactId = reservationId ?? randomUUID();
      if (reservationId) { identifier(reservationId); quota.assertWriting(reservationId, owner, kind); }
      else quota.reserve({ id: artifactId, owner, kind });
      try {
      const pipeline = sharp(buffer, { limitInputPixels: 16_000_000, animated: false });
      const metadata = await pipeline.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) !== 1) throw Error('Single-frame raster image required');
      const normalized = await pipeline.rotate().png().toBuffer(); // Strip EXIF and never trust filenames/MIME.
      if (normalized.length > 20_000_000) throw Error('Normalized photo too large');
      const handle = await fs.open(path.join(realRoot, `${artifactId}.png`), 'wx', 0o600);
      try { await handle.writeFile(normalized); await handle.sync(); } finally { await handle.close(); }
      // An orphan file on DB failure conveys no access rights; no retry grants rights.
      quota.complete(artifactId, normalized.length, () => db.prepare('INSERT INTO nice_photo_artifacts VALUES(?,?,?,?,?,?)').run(artifactId, owner, kind, orderId, digest(normalized), normalized.length));
      return { artifactId };
      } catch (error) {
        try { await remove(artifactId, owner, { failedWrite: true }); } catch { /* Retain the reservation until cleanup succeeds. */ }
        throw error;
      }
    },
    async resolve(query) { const { row } = await read(query); return { id: row.id, owner: row.owner, orderId: row.order_id }; },
    async read(query) { return (await read(query)).buffer; }
  };
}

/** Bind only a created, unpaid order. Immutable snapshots cannot be replaced on replay.
 * options are trusted checkout policy output, not unvalidated browser request fields.
 */
export function createPhotoPurchaseSnapshots({ creditStore, storage }) {
  const db = creditStore.db;
  db.exec('CREATE TABLE IF NOT EXISTS nice_photo_purchases(order_id TEXT PRIMARY KEY,owner TEXT NOT NULL,product TEXT NOT NULL,spec TEXT NOT NULL)');
  return {
    async bind({ orderId, owner, photoId, toolType, options = {}, parentOrderId }) {
      identifier(orderId); identifier(photoId); ownerRequired(owner);
      if (!['id_photo', 'passport_photo', 'headshot'].includes(toolType) || options.provider !== 'openai_image'
        || !['current', 'suit'].includes(options.outfitType)) throw Error('Explicit supported photo rights required');
      const allowed = ['provider', 'outfitType', 'groomingMode', 'hairOptions', 'retouchEnabled', 'fullPackage', 'beautyOptions'];
      if (Object.keys(options).some(key => !allowed.includes(key))) throw Error('Unsupported photo options');
      if (toolType !== 'id_photo' && Object.keys(options).some(key => !['provider', 'outfitType'].includes(key))) throw Error('Styling is only supported for ID photos');
      const normalized = toolType === 'id_photo' ? { ...options, ...normalizeIdPhotoStyling(options) } : options;
      await storage.resolve({ artifactId: photoId, owner, kind: 'source' });
      return creditStore.tx(() => {
        storage.assertActive(photoId); // Atomic with retention deletion claim.
        const order = db.prepare('SELECT * FROM nice_orders WHERE id=? AND owner=?').get(orderId, owner);
        if (!order || order.state !== 'created' || order.expires <= Date.now()) throw Error('Unpaid owned order required');
        const intent = JSON.parse(order.intent), product = intent.productId;
        if (intent.category !== 'direct' || !['base', 'add2', 'add3', 'add7'].includes(product)) throw Error('Photo product not supported');
        if (product !== 'base') {
          identifier(parentOrderId);
          const parent = db.prepare(`SELECT p.spec FROM nice_photo_purchases p JOIN nice_photo_jobs j ON j.order_id=p.order_id
            JOIN nice_entitlements e ON e.order_id=j.order_id WHERE p.order_id=? AND p.owner=? AND p.product='base'
            AND j.state='done' AND e.state='claimed'`).get(parentOrderId, owner);
          if (!parent) throw Error('Owned completed photo parent required');
          const prior = JSON.parse(parent.spec);
          if (prior.photoId !== photoId || prior.toolType !== toolType || JSON.stringify(prior.options) !== JSON.stringify(normalized)) throw Error('Photo parent rights mismatch');
        }
        const spec = { owner, product, photoId, toolType, options: normalized, ...(product === 'base' ? {} : { parentOrderId }) };
        db.prepare('INSERT INTO nice_photo_purchases VALUES(?,?,?,?)').run(orderId, owner, product, JSON.stringify(spec));
        return spec;
      });
    },
    async resolve({ orderId, owner, product }) {
      const row = db.prepare('SELECT spec FROM nice_photo_purchases WHERE order_id=? AND owner=? AND product=?').get(orderId, owner, product);
      if (!row) throw Error('Photo checkout snapshot required');
      return JSON.parse(row.spec);
    }
  };
}

export function createPrivatePhotoGenerator({ storage, allowPaidGeneration = false, provider }) {
  // Injected providers are for offline tests. The real provider is never called by default.
  return async ({ photoId, owner, orderId, toolType, options, count }) => {
    if (!provider && !allowPaidGeneration) throw Error('Paid photo generation disabled');
    if (options.provider !== 'openai_image' || ![2, 3, 7].includes(count)) throw Error('Photo provider/count mismatch');
    let allocation;
    try { allocation = await storage.prepareGeneration({ owner, count }); }
    catch (error) {
      // This boundary is before source materialization and before invoking a provider.
      // Quota admission is atomic, so a refusal reserved no partial batch.
      if (error?.status === 429) throw deferNicepayExecution('Photo storage capacity unavailable', error);
      throw error;
    }
    const { dir } = allocation;
    try {
      const inputPath = path.join(dir, 'source.png');
      await fs.writeFile(inputPath, await storage.read({ artifactId: photoId, owner, kind: 'source' }), { mode: 0o600 });
      const run = provider ?? (await import('../providers/openAiPortraitProvider.js')).generateWithOpenAiImage;
      const result = await run({ ...options, inputPath, storageDir: dir, jobId: identifier(orderId), toolType, candidateCount: count });
      if (!Array.isArray(result?.generated) || result.generated.length !== count) throw Error('Photo count mismatch');
      const artifacts = [];
      const seen = new Set();
      for (const [index, output] of result.generated.entries()) {
        const filePath = await fs.realpath(output.filePath);
        if (path.dirname(filePath) !== await fs.realpath(dir) || filePath === inputPath || seen.has(filePath)) throw Error('Private output path rejected');
        seen.add(filePath);
        const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
        let buffer;
        try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > 20_000_000) throw Error('Invalid output file'); buffer = await handle.readFile(); }
        finally { await handle.close(); }
        artifacts.push(await storage.put({ owner, kind: 'generated', orderId, buffer, reservationId: allocation.outputIds[index] }));
        await fs.rm(filePath);
      }
      return artifacts;
    } finally { await allocation.release(); }
  };
}

export function createNicepayPhotoRuntime({ enabled = false, creditStore, storage, snapshots, resolveCheckoutRights, allowPaidGeneration = false, provider } = {}) {
  if (!enabled) return {};
  if (!provider && !allowPaidGeneration) throw Error('Photo generator is disabled');
  const adapters = createNicepayPhotoAdapters({ enabled, creditStore, resolvePurchase: query => snapshots.resolve(query),
    resolveArtifact: query => storage.resolve(query), generate: createPrivatePhotoGenerator({ storage, allowPaidGeneration, provider }) });
  for (const [product, adapter] of Object.entries(adapters)) {
    adapter.bindCheckout = async (input, { orderId, owner }) => {
      if (typeof resolveCheckoutRights !== 'function') throw Error('Approved photo checkout policy required');
      // This trusted policy must map input choices to the purchased catalog rights.
      const rights = await resolveCheckoutRights({ input, owner, product });
      if (!rights || typeof rights !== 'object') throw Error('Photo checkout rights unavailable');
      return snapshots.bind({ ...rights, orderId, owner });
    };
  }
  return { adapters, async download({ orderId, owner, candidateId }) {
    const reference = selectNicepayPhotoCandidate({ creditStore, orderId, owner, candidateId });
    return storage.read({ ...reference, kind: 'generated' });
  } };
}
