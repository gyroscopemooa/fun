import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db } from './store.js';
import { generateCandidatesWithProvider, getImageProvider, getResolvedImageProvider } from './providers/providerRouter.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const paymentMode = process.env.PAYMENT_MODE ?? 'mock';
const polarServer = process.env.POLAR_SERVER === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
const polarCheckoutUrl = `${polarServer}/v1/checkouts`;

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const rootDir = path.resolve(thisDir, '..', 'node-api-storage');
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
  const removeBgReady = Boolean(process.env.REMOVE_BG_API_KEY);
  const photoroomReady = Boolean(process.env.PHOTOROOM_API_KEY && process.env.PHOTOROOM_REMOVE_BG_URL);
  const polarReady = Boolean(
    process.env.POLAR_ACCESS_TOKEN
    && process.env.POLAR_PRODUCT_BASE
    && process.env.POLAR_PRODUCT_ADD2
    && process.env.POLAR_PRODUCT_ADD3
    && process.env.POLAR_PRODUCT_ADD7
  );

  res.json({
    imageProvider: getResolvedImageProvider(),
    configuredImageProvider: getImageProvider(),
    paymentMode,
    readiness: {
      removeBgReady,
      photoroomReady,
      polarReady
    }
  });
});

const getPolarProductIdByType = (productType) => {
  const map = {
    base: process.env.POLAR_PRODUCT_BASE,
    add2: process.env.POLAR_PRODUCT_ADD2,
    add3: process.env.POLAR_PRODUCT_ADD3,
    add7: process.env.POLAR_PRODUCT_ADD7,
    passport_addon: process.env.POLAR_PRODUCT_PASSPORT_ADDON,
    headshot_addon: process.env.POLAR_PRODUCT_HEADSHOT_ADDON
  };
  return map[productType] ?? null;
};

const createPolarCheckout = async ({ order, productId, clientSessionId = null }) => {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN is missing');
  }
  if (!productId) {
    throw new Error(`Polar product id is missing for productType=${order.productType}`);
  }
  const successUrl = process.env.POLAR_SUCCESS_URL ?? process.env.PUBLIC_WEB_BASE_URL ?? null;
  const returnUrl = process.env.POLAR_RETURN_URL ?? process.env.PUBLIC_WEB_BASE_URL ?? null;

  const payload = {
    products: [productId],
    metadata: {
      order_id: order.id,
      product_type: order.productType
    }
  };
  if (order.jobId) payload.metadata.job_id = order.jobId;
  if (successUrl) payload.success_url = successUrl;
  if (returnUrl) payload.return_url = returnUrl;
  if (clientSessionId) payload.external_customer_id = clientSessionId;

  const response = await fetch(polarCheckoutUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`polar checkout create failed: ${response.status} ${reason}`);
  }
  const checkout = await response.json();
  const checkoutId = checkout?.id ?? null;
  const checkoutSessionUrl = checkout?.url ?? null;
  if (!checkoutSessionUrl) {
    throw new Error('polar checkout url is missing');
  }
  return { checkoutId, checkoutUrl: checkoutSessionUrl };
};

const resolveOrderIdFromWebhook = (payload) => (
  payload?.orderId
  ?? payload?.metadata?.order_id
  ?? payload?.metadata?.orderId
  ?? payload?.data?.metadata?.order_id
  ?? payload?.data?.metadata?.orderId
  ?? payload?.data?.checkout?.metadata?.order_id
  ?? payload?.data?.checkout?.metadata?.orderId
  ?? null
);

const resolvePaymentStatusFromWebhook = (payload) => {
  const eventType = String(payload?.type ?? '').toLowerCase();
  const rawStatus = String(payload?.status ?? payload?.data?.status ?? '').toLowerCase();
  if (eventType.includes('order.paid') || eventType.includes('checkout.succeeded')) return 'paid';
  if (eventType.includes('order.refunded')) return 'refunded';
  if (eventType.includes('checkout.expired')) return 'expired';
  if (eventType.includes('checkout.failed')) return 'failed';
  if (rawStatus === 'succeeded' || rawStatus === 'paid' || rawStatus === 'confirmed') return 'paid';
  if (rawStatus === 'refunded') return 'refunded';
  if (rawStatus === 'failed') return 'failed';
  if (rawStatus === 'expired') return 'expired';
  return 'pending';
};

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

app.post('/checkout', async (req, res) => {
  const {
    productType = 'add2',
    amount = 0,
    currency = 'KRW',
    jobId = null,
    provider = 'polar',
    clientSessionId = null
  } = req.body ?? {};

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'valid amount is required' });
  }

  const orderId = uuidv4();
  const order = {
    id: orderId,
    productType,
    amount: Number(amount),
    currency,
    jobId,
    provider,
    status: paymentMode === 'mock' ? 'paid' : 'pending',
    paymentMode,
    polarCheckoutId: null,
    checkoutUrl: null,
    createdAt: new Date().toISOString()
  };
  db.orders.set(orderId, order);

  try {
    if (paymentMode === 'polar') {
      const productId = getPolarProductIdByType(productType);
      const polarCheckout = await createPolarCheckout({ order, productId, clientSessionId });
      order.polarCheckoutId = polarCheckout.checkoutId;
      order.checkoutUrl = polarCheckout.checkoutUrl;
      order.status = 'pending';
      db.orders.set(orderId, order);
    }

    return res.status(201).json({
      orderId: order.id,
      status: order.status,
      paymentMode,
      paid: order.status === 'paid',
      checkoutUrl: order.checkoutUrl
    });
  } catch (error) {
    order.status = 'failed';
    order.error = error.message;
    db.orders.set(orderId, order);
    return res.status(500).json({ error: error.message, orderId: order.id, status: order.status });
  }
});

app.post('/payment/webhook', (req, res) => {
  const insecureToken = process.env.POLAR_WEBHOOK_INSECURE_TOKEN;
  if (insecureToken) {
    const received = req.get('x-manytool-webhook-token');
    if (!received || received !== insecureToken) {
      return res.status(401).json({ error: 'invalid webhook token' });
    }
  }

  const payload = req.body ?? {};
  const orderId = resolveOrderIdFromWebhook(payload);
  if (!orderId) {
    return res.status(400).json({ error: 'order_id is missing in webhook payload metadata' });
  }

  const current = db.orders.get(orderId);
  if (!current) {
    return res.status(404).json({ error: 'order not found' });
  }

  const status = resolvePaymentStatusFromWebhook(payload);
  const next = {
    ...current,
    status,
    paidAt: status === 'paid' ? new Date().toISOString() : current.paidAt ?? null,
    payload
  };
  db.orders.set(orderId, next);
  return res.json({ ok: true, orderId, status });
});

app.get('/order/:id', (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'order not found' });
  return res.json(order);
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
