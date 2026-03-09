import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db } from './store.js';
import { generateCandidatesWithProvider, getImageProvider, getResolvedImageProvider } from './providers/providerRouter.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const rootDir = path.resolve(process.cwd(), 'node-api-storage');
const originalDir = path.join(rootDir, 'originals');
const generatedDir = path.join(rootDir, 'generated');

await fs.mkdir(originalDir, { recursive: true });
await fs.mkdir(generatedDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use('/files', express.static(rootDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'manytool-node-api' });
});

app.get('/config', (_req, res) => {
  res.json({
    imageProvider: getResolvedImageProvider(),
    configuredImageProvider: getImageProvider(),
    paymentMode: process.env.PAYMENT_MODE ?? 'mock'
  });
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'image file is required (field name: image)' });
    }
    if (!String(req.file.mimetype).startsWith('image/')) {
      return res.status(400).json({ error: 'only image uploads are allowed' });
    }
    const photoId = uuidv4();
    const ext = (req.file.mimetype ?? '').includes('png') ? 'png' : 'jpg';
    const fileName = `${photoId}.${ext}`;
    const filePath = path.join(originalDir, fileName);
    await fs.writeFile(filePath, req.file.buffer);

    db.photos.set(photoId, {
      id: photoId,
      sourceType: req.body.sourceType ?? 'upload',
      originalPath: filePath,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      photoId,
      originalUrl: `/files/originals/${fileName}`
    });
  } catch (error) {
    return res.status(500).json({ error: `upload failed: ${error.message}` });
  }
});

app.post('/generate', async (req, res) => {
  const { photoId, toolType = 'id_photo', outfitType = 'current' } = req.body ?? {};
  if (!photoId) {
    return res.status(400).json({ error: 'photoId is required' });
  }
  const photo = db.photos.get(photoId);
  if (!photo) {
    return res.status(404).json({ error: 'photo not found' });
  }

  const jobId = uuidv4();
  const job = {
    id: jobId,
    photoId,
    toolType,
    outfitType,
    status: 'processing',
    candidates: [],
    createdAt: new Date().toISOString()
  };
  db.jobs.set(jobId, job);

  try {
    const generated = await generateCandidatesWithProvider({
      inputPath: photo.originalPath,
      storageDir: generatedDir,
      jobId
    });

    const candidates = generated.map((item, index) => ({
      id: `${jobId}-${index + 1}`,
      variant: item.variant,
      imageUrl: `/files/generated/${path.basename(item.filePath)}`
    }));

    job.status = 'done';
    job.candidates = candidates;
    job.completedAt = new Date().toISOString();

    return res.status(201).json({
      jobId,
      status: job.status,
      candidates
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    return res.status(500).json({ error: `generate failed: ${error.message}`, jobId });
  }
});

app.get('/job/:id', (req, res) => {
  const job = db.jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  return res.json(job);
});

app.post('/checkout', (req, res) => {
  const {
    productType = 'add2',
    amount = 0,
    currency = 'KRW',
    jobId = null,
    provider = 'polar'
  } = req.body ?? {};

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'valid amount is required' });
  }

  const orderId = uuidv4();
  const paymentMode = process.env.PAYMENT_MODE ?? 'mock';
  const status = paymentMode === 'mock' ? 'paid' : 'pending';

  db.orders.set(orderId, {
    id: orderId,
    productType,
    amount: Number(amount),
    currency,
    jobId,
    provider,
    status,
    createdAt: new Date().toISOString()
  });

  return res.status(201).json({
    orderId,
    status,
    paymentMode,
    paid: status === 'paid'
  });
});

app.post('/payment/webhook', (req, res) => {
  // TODO: replace with Polar signature verification + real DB updates.
  const orderId = req.body?.orderId ?? uuidv4();
  const status = req.body?.status ?? 'paid';
  const jobId = req.body?.jobId ?? null;

  db.orders.set(orderId, {
    id: orderId,
    jobId,
    provider: 'polar',
    status,
    payload: req.body ?? {},
    createdAt: new Date().toISOString()
  });

  return res.json({ ok: true, orderId, status });
});

app.get('/download/:candidateId', (req, res) => {
  const candidateId = req.params.candidateId;
  for (const job of db.jobs.values()) {
    const candidate = job.candidates.find((item) => item.id === candidateId);
    if (candidate) {
      const filePath = path.join(rootDir, candidate.imageUrl.replace('/files/', ''));
      return res.download(filePath);
    }
  }
  return res.status(404).json({ error: 'candidate not found' });
});

app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'image too large (max 12MB)' });
  }
  return res.status(500).json({ error: 'internal server error' });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[manytool-node-api] listening on http://127.0.0.1:${port}`);
});
