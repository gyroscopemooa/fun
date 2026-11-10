import express from 'express';
import { createPrivatePhotoStorage, createPhotoPurchaseSnapshots, createNicepayPhotoRuntime } from './nicepay-photo-runtime.js';
import { createNicepayPrivatePhotoRouter } from './nicepay-photo-router.js';
import { createNicepayStagingRouter } from './nicepay-callback.js';

/** Explicit assembly only: no listener, environment activation, live client construction or timers.
 * Caller supplies a reviewed catalog and checkout-rights policy. It is never inferred from prices.
 */
export async function createNicepayPhotoStaging({ enabled = false, store, creditStore, root, publicRoots, quotaPolicy,
  config, policy, catalog, authenticate, origin, client, resolveCheckoutRights, provider, allowPaidGeneration = false } = {}) {
  const router = express.Router();
  if (!enabled) {
    router.use((_req, res) => res.status(503).set('Cache-Control', 'no-store').json({ error: 'NICE photo staging disabled' }));
    return { router };
  }
  if (!catalog || !Object.keys(catalog).length || Object.keys(catalog).some(key => !['base', 'add2', 'add3', 'add7'].includes(key))
    || Object.values(catalog).some(product => product.category !== 'direct') || typeof resolveCheckoutRights !== 'function') {
    throw Error('Explicit photo-only catalog and checkout rights policy required');
  }
  // Validate DB, origin, authentication and payment configuration before creating any files.
  createNicepayStagingRouter({ enabled, store, creditStore, config, policy, catalog, authenticate, origin, client });
  if (!provider && !allowPaidGeneration) throw Error('Photo generator is disabled');
  const storage = await createPrivatePhotoStorage({ creditStore, root, publicRoots, quotaPolicy });
  const snapshots = createPhotoPurchaseSnapshots({ creditStore, storage });
  const runtime = createNicepayPhotoRuntime({ enabled, creditStore, storage, snapshots, resolveCheckoutRights, provider, allowPaidGeneration });
  const adapters = Object.fromEntries(Object.keys(catalog).map(product => [product, runtime.adapters[product]]));
  router.use('/files', createNicepayPrivatePhotoRouter({ enabled, storage, runtime, authenticate, origin }));
  router.use('/payment', createNicepayStagingRouter({ enabled, store, creditStore, config, policy, catalog, authenticate, origin, client, toolAdapters: adapters }));
  router.get('/jobs/:orderId', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin !== origin) return res.status(403).json({ error: 'Origin rejected' });
    try {
      const owner = await authenticate(req), order = store.owned(req.params.orderId, owner);
      if (!Object.hasOwn(adapters, order.productId)) throw Error();
      const job = creditStore.db.prepare('SELECT state,result FROM nice_photo_jobs WHERE order_id=? AND owner=?').get(order.id, owner);
      res.json({ orderId: order.id, paymentState: order.state, status: job?.state ?? 'not_started',
        ...(job?.state === 'done' ? { result: JSON.parse(job.result) } : {}) });
    } catch { res.status(404).json({ error: 'Photo job unavailable' }); }
  });
  return { router, storage, snapshots, runtime, cleanup: () => storage.cleanup() };
}
