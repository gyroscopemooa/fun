import express from 'express';

// Explicit staging assembly only. Never mounted by the production server.
export function createNicepayPrivatePhotoRouter({ enabled = false, storage, runtime, authenticate, origin } = {}) {
  if (enabled && (!storage || !runtime || typeof authenticate !== 'function' || new URL(origin).protocol !== 'https:')) {
    throw Error('Private photo staging dependencies incomplete');
  }
  const router = express.Router();
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
  router.post('/upload', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '20mb' }), async (req, res) => {
    try {
      const result = await storage.put({ owner: res.locals.photoOwner, kind: 'source', buffer: req.body });
      res.status(201).json(result);
    } catch { res.status(400).json({ error: 'Private photo upload rejected' }); }
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
