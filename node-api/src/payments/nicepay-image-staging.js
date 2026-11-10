import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import express from 'express';
import { assertMode, assertProvider, sanitizeUserInput } from '../commerce/aiImageGenerator.js';
import { createPrivatePhotoStorage } from './nicepay-photo-runtime.js';
import { createNicepayPrivatePhotoRouter } from './nicepay-photo-router.js';
import { createNicepayStagingRouter } from './nicepay-callback.js';
import { deferNicepayExecution } from './nicepay-preflight.js';

function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw Error('Invalid image reference'); return value; }
const exists = (db, table) => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);

// An explicit server variant list resolves the legacy shared base product without
// letting checkout callers select arbitrary provider/mode rights. Prices stay elsewhere.
export function createNicepayImageRightsPolicy(variants) {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants) || !Object.keys(variants).length) throw Error('Explicit image variants required');
  const choices = new Map(Object.entries(variants).map(([key, value]) => {
    id(key);
    if (!value || !['ai_image', 'product_model'].includes(value.tool)
      || (value.tool === 'product_model') !== (value.mode === 'modelcut')) throw Error('Invalid image variant rights');
    return [key, Object.freeze({ tool: value.tool, mode: assertMode(value.mode), provider: assertProvider(value.provider) })];
  }));
  return async ({ input, product }) => {
    if (product !== 'base' || !input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['photoId', 'variant', 'userInput'].includes(key))) throw Error('Invalid image checkout selection');
    const variant = choices.get(input.variant);
    if (!variant || typeof input.userInput !== 'string' || input.userInput.length > 50) throw Error('Image variant unavailable');
    return { ...variant, photoId: id(input.photoId), userInput: input.userInput };
  };
}

export function createNicepayImageRuntime({ enabled = false, creditStore, storage, resolveCheckoutRights, provider, allowPaidGeneration = false } = {}) {
  if (!enabled) return {};
  if (typeof resolveCheckoutRights !== 'function' || (!provider && !allowPaidGeneration)) throw Error('Explicit image rights and provider required');
  const db = creditStore.db;
  db.exec('CREATE TABLE IF NOT EXISTS nice_image_purchases(order_id TEXT PRIMARY KEY,owner TEXT NOT NULL,spec TEXT NOT NULL)');
  function purchase(orderId, owner) {
    const row = db.prepare('SELECT spec FROM nice_image_purchases WHERE order_id=? AND owner=?').get(orderId, owner);
    if (!row) throw Error('Bound owned image purchase required');
    return JSON.parse(row.spec);
  }
  const adapter = {
    async bindCheckout(input, { orderId, owner }) {
      const rights = await resolveCheckoutRights({ input, owner, product: 'base' });
      if (!rights || !['ai_image', 'product_model'].includes(rights.tool)) throw Error('Image tool rights required');
      const photoId = id(rights.photoId), mode = assertMode(rights.mode), imageProvider = assertProvider(rights.provider);
      if ((rights.tool === 'product_model') !== (mode === 'modelcut')) throw Error('Modelcut requires product-model rights');
      if (typeof rights.userInput !== 'string' || rights.userInput.length > 50) throw Error('Image request exceeds existing limit');
      const userInput = sanitizeUserInput(rights.userInput);
      if (mode === 'free' && !userInput) throw Error('Free image mode requires prompt');
      await storage.resolve({ artifactId: photoId, owner, kind: 'source' });
      creditStore.tx(() => {
        storage.assertActive(photoId);
        const order = db.prepare("SELECT * FROM nice_orders WHERE id=? AND owner=? AND state='created' AND expires>?").get(orderId, owner, Date.now());
        if (!order) throw Error('Owned unpaid order required');
        const intent = JSON.parse(order.intent);
        if (intent.productId !== 'base' || intent.category !== 'direct') throw Error('Image base purchase required');
        if (exists(db, 'nice_photo_purchases') && db.prepare('SELECT 1 FROM nice_photo_purchases WHERE order_id=?').get(orderId)) throw Error('Order already bound to portrait');
        db.prepare('INSERT INTO nice_image_purchases VALUES(?,?,?)').run(orderId, owner, JSON.stringify({ photoId, tool: rights.tool, mode, provider: imageProvider, userInput }));
      });
    },
    async validate(input, { orderId, owner }) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'photoId')) throw Error('Only purchased image reference allowed');
      const spec = purchase(orderId, owner);
      if (id(input.photoId) !== spec.photoId) throw Error('Purchased image changed');
      await storage.resolve({ artifactId: spec.photoId, owner, kind: 'source' });
      return { photoId: spec.photoId };
    },
    async execute(input, { orderId, owner }) {
      const spec = purchase(orderId, owner);
      if (spec.photoId !== input.photoId || !db.prepare("SELECT 1 FROM nice_entitlements WHERE order_id=? AND owner=? AND product='base' AND state='claimed'").get(orderId, owner)) throw Error('Claimed image rights required');
      let allocation;
      try { allocation = await storage.prepareGeneration({ owner, count: 1 }); }
      catch (error) { if (error?.status === 429) throw deferNicepayExecution('Image storage capacity unavailable', error); throw Error('Image preparation needs reconciliation'); }
      try {
        const imageBuffer = await storage.read({ artifactId: spec.photoId, owner, kind: 'source' });
        const run = provider ?? (await import('../commerce/aiImageGenerator.js')).generateAiImageOnce;
        const result = await run({ id: id(orderId), provider: spec.provider, mode: spec.mode, userInput: spec.userInput,
          imageBuffer, mimeType: 'image/png', originalFilename: 'source.png', outputDir: allocation.dir });
        if (result?.provider !== spec.provider || result?.mode !== spec.mode) throw Error('Image provider/mode changed');
        const filePath = await fs.realpath(result.filePath);
        if (path.dirname(filePath) !== await fs.realpath(allocation.dir)) throw Error('Private image output required');
        const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
        let buffer;
        try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > 20_000_000) throw Error('Image output too large'); buffer = await handle.readFile(); }
        finally { await handle.close(); }
        const artifact = await storage.put({ owner, kind: 'generated', orderId, buffer, reservationId: allocation.outputIds[0] });
        return { jobId: orderId, tool: spec.tool, mode: spec.mode, provider: spec.provider, status: 'done', candidates: [{ id: artifact.artifactId, artifactId: artifact.artifactId }] };
      } catch (error) {
        // Never accept retry flags from a provider, even a quota-looking error.
        throw Error('Image generation needs reconciliation', { cause: error });
      } finally { await allocation.release(); }
    }
  };
  return { adapters: { base: adapter }, async download({ orderId, owner, candidateId }) {
    purchase(orderId, owner);
    if (!exists(db, 'nice_tool_jobs')) throw Error('Image not complete');
    const job = db.prepare(`SELECT j.result FROM nice_tool_jobs j JOIN nice_entitlements e ON e.order_id=j.order_id
      WHERE j.order_id=? AND j.state='done' AND e.owner=? AND e.product='base' AND e.state='claimed'`).get(orderId, owner);
    const candidate = job && JSON.parse(job.result).candidates?.find(item => item.id === candidateId);
    if (!candidate) throw Error('Owned image output required');
    return storage.read({ artifactId: candidate.artifactId, owner, orderId, kind: 'generated' });
  }, status({ orderId, owner }) {
    purchase(orderId, owner);
    const row = exists(db, 'nice_tool_jobs') && db.prepare('SELECT state,result FROM nice_tool_jobs WHERE order_id=?').get(orderId);
    return { orderId, status: row?.state ?? 'not_started', ...(row?.state === 'done' ? { result: JSON.parse(row.result) } : {}) };
  } };
}

export async function createNicepayImageStaging({ enabled = false, creditStore, store, root, publicRoots, quotaPolicy,
  config, policy, catalog, origin, authenticate, client, resolveCheckoutRights, provider, allowPaidGeneration = false } = {}) {
  const router = express.Router();
  if (!enabled) { router.use((_req, res) => res.status(503).set('Cache-Control', 'no-store').json({ error: 'NICE image disabled' })); return { router }; }
  if (Object.keys(catalog ?? {}).length !== 1 || !Object.hasOwn(catalog ?? {}, 'base') || catalog?.base?.category !== 'direct') throw Error('Dedicated base image catalog required');
  const common = { enabled, creditStore, store, config, policy, catalog, origin, authenticate, client };
  createNicepayStagingRouter(common);
  if (typeof resolveCheckoutRights !== 'function' || (!provider && !allowPaidGeneration)) throw Error('Explicit image rights and provider required');
  const storage = await createPrivatePhotoStorage({ creditStore, root, publicRoots, quotaPolicy });
  const runtime = createNicepayImageRuntime({ enabled, creditStore, storage, resolveCheckoutRights, provider, allowPaidGeneration });
  router.use('/files', createNicepayPrivatePhotoRouter({ enabled, storage, runtime, authenticate, origin }));
  router.use('/payment', createNicepayStagingRouter({ ...common, toolAdapters: runtime.adapters }));
  router.get('/jobs/:orderId', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin !== origin) return res.status(403).json({ error: 'Origin rejected' });
    try { res.json(runtime.status({ orderId: req.params.orderId, owner: await authenticate(req) })); }
    catch { res.status(404).json({ error: 'Image job unavailable' }); }
  });
  return { router, runtime, storage, cleanup: () => storage.cleanup() };
}
