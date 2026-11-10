import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { normalizeIdPhotoStyling } from '../providers/idPhotoStyling.js';
import { createNicepayPhotoAdapters, selectNicepayPhotoCandidate } from './nicepay-photo-adapters.js';

const identifier = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw Error('Invalid artifact reference');
  return value;
};
const ownerRequired = owner => { if (typeof owner !== 'string' || !owner || owner.length > 254) throw Error('Verified owner required'); };
const digest = buffer => createHash('sha256').update(buffer).digest('hex');

/** root MUST be outside every static web root. No HTTP routes are mounted here. */
export async function createPrivatePhotoStorage({ creditStore, root, publicRoots }) {
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
  async function read({ artifactId, owner, kind, orderId }) {
    identifier(artifactId); ownerRequired(owner);
    const row = db.prepare('SELECT * FROM nice_photo_artifacts WHERE id=? AND owner=?').get(artifactId, owner);
    if (!row || (kind && row.kind !== kind) || (orderId && row.order_id !== orderId)) throw Error('Private photo unavailable');
    const handle = await fs.open(path.join(realRoot, `${artifactId}.png`), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== row.bytes || stat.size > 20_000_000) throw Error('Private photo integrity failed');
      const buffer = await handle.readFile();
      if (digest(buffer) !== row.sha256) throw Error('Private photo integrity failed');
      return { row, buffer };
    } finally { await handle.close(); }
  }
  return {
    async createWorkspace() { return fs.mkdtemp(path.join(realRoot, 'work-')); },
    async put({ owner, kind, orderId = null, buffer }) {
      ownerRequired(owner);
      if (!['source', 'generated'].includes(kind) || !Buffer.isBuffer(buffer) || buffer.length > 20_000_000) throw Error('Invalid private image');
      if (kind === 'generated') identifier(orderId);
      const pipeline = sharp(buffer, { limitInputPixels: 16_000_000, animated: false });
      const metadata = await pipeline.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) !== 1) throw Error('Single-frame raster image required');
      const normalized = await pipeline.rotate().png().toBuffer(); // Strip EXIF and never trust filenames/MIME.
      if (normalized.length > 20_000_000) throw Error('Normalized photo too large');
      const artifactId = randomUUID();
      const handle = await fs.open(path.join(realRoot, `${artifactId}.png`), 'wx', 0o600);
      try { await handle.writeFile(normalized); await handle.sync(); } finally { await handle.close(); }
      // An orphan file on DB failure conveys no access rights; no retry grants rights.
      db.prepare('INSERT INTO nice_photo_artifacts VALUES(?,?,?,?,?,?)').run(artifactId, owner, kind, orderId, digest(normalized), normalized.length);
      return { artifactId };
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
    const dir = await storage.createWorkspace();
    try {
      const inputPath = path.join(dir, 'source.png');
      await fs.writeFile(inputPath, await storage.read({ artifactId: photoId, owner, kind: 'source' }), { mode: 0o600 });
      const run = provider ?? (await import('../providers/openAiPortraitProvider.js')).generateWithOpenAiImage;
      const result = await run({ ...options, inputPath, storageDir: dir, jobId: identifier(orderId), toolType, candidateCount: count });
      if (!Array.isArray(result?.generated) || result.generated.length !== count) throw Error('Photo count mismatch');
      const artifacts = [];
      const seen = new Set();
      for (const output of result.generated) {
        const filePath = await fs.realpath(output.filePath);
        if (path.dirname(filePath) !== await fs.realpath(dir) || filePath === inputPath || seen.has(filePath)) throw Error('Private output path rejected');
        seen.add(filePath);
        const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
        let buffer;
        try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > 20_000_000) throw Error('Invalid output file'); buffer = await handle.readFile(); }
        finally { await handle.close(); }
        artifacts.push(await storage.put({ owner, kind: 'generated', orderId, buffer }));
      }
      return artifacts;
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
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
