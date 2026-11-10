import express from 'express';

// Explicit staging assembly only. Never mounted by the production server.
export function createNicepayPrivatePhotoRouter({ enabled = false, storage, runtime, authenticate, origin, maxConcurrentUploads = 8, maxOwnerUploads = 2 } = {}) {
  if (enabled && (!storage || !runtime || typeof authenticate !== 'function' || new URL(origin).protocol !== 'https:')) {
    throw Error('Private photo staging dependencies incomplete');
  }
  if (![maxConcurrentUploads, maxOwnerUploads].every(n => Number.isSafeInteger(n) && n > 0)) throw Error('Invalid upload concurrency limit');
  const router = express.Router();
  const inFlight = new Map(); let total = 0;
  function admitUpload(_req, res, next) {
    const owner = res.locals.photoOwner;
    if (total >= maxConcurrentUploads || (inFlight.get(owner) ?? 0) >= maxOwnerUploads) return res.status(429).json({ error: 'Photo upload busy' });
    total++; inFlight.set(owner, (inFlight.get(owner) ?? 0) + 1);
    let released = false;
    const release = () => { if (released) return; released = true; total--; const count = inFlight.get(owner) - 1; if (count) inFlight.set(owner, count); else inFlight.delete(owner); };
    res.locals.releasePhotoUpload = release;
    res.once('finish', release); res.once('close', () => { if (!res.locals.photoUploadWorking) release(); }); next();
  }
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!enabled) return res.status(503).json({ error: 'NICE photo disabled' });
    if (req.headers.origin !== origin) return res.status(403).json({ error: 'Origin rejected' });
    try {
      const owner = await authenticate(req);
      if (typeof owner !== 'string' || !owner) throw Error();
      res.locals.photoOwner = owner;
      next();
    } catch { return res.status(401).json({ error: 'Authentication required' }); }
  });
  router.post('/upload', admitUpload, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '20mb' }), async (req, res) => {
    res.locals.photoUploadWorking = true;
    try {
      const result = await storage.put({ owner: res.locals.photoOwner, kind: 'source', buffer: req.body });
      res.status(201).json(result);
    } catch (error) { res.status(error?.status === 429 ? 429 : 400).json({ error: error?.status === 429 ? 'Photo storage quota reached' : 'Private photo upload rejected' }); }
    finally { res.locals.releasePhotoUpload(); }
  });
  router.post('/delete-source', express.json({ limit: '2kb' }), async (req, res) => {
    try { await storage.removeSource({ owner: res.locals.photoOwner, artifactId: req.body?.artifactId }); res.json({ removed: true }); }
    catch { res.status(409).json({ error: 'Photo cannot be removed' }); }
  });
  router.post('/download', express.json({ limit: '2kb' }), async (req, res) => {
    try {
      const buffer = await runtime.download({ owner: res.locals.photoOwner, orderId: req.body?.orderId, candidateId: req.body?.candidateId });
      res.set('Content-Disposition', 'attachment; filename="photo.png"').type('png').send(buffer);
    } catch { res.status(404).json({ error: 'Private photo unavailable' }); }
  });
  router.use((error, _req, res, _next) => res.status(error?.status === 413 ? 413 : 400).json({ error: 'Invalid photo request' }));
  return router;
}
