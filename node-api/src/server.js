import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Webhook } from 'standardwebhooks';
import { db } from './store.js';
import { generateCandidatesWithProvider, getImageProvider, getResolvedImageProvider, isExternalAiEnabled } from './providers/providerRouter.js';

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
const reportsDir = path.join(rootDir, 'reports');
const jobSnapshotDir = path.join(reportsDir, 'jobs');

await fs.mkdir(originalDir, { recursive: true });
await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(jobSnapshotDir, { recursive: true });

app.use(cors());
app.use(express.json({
  limit: '4mb',
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));
app.use('/files', express.static(rootDir));

const getFirstEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const getPolarProductMap = () => ({
  base: getFirstEnv('POLAR_PRODUCT_BASE', 'POLAR_PRODUCT_ID'),
  add2: getFirstEnv('POLAR_PRODUCT_ADD2'),
  add3: getFirstEnv('POLAR_PRODUCT_ADD3'),
  add7: getFirstEnv('POLAR_PRODUCT_ADD7'),
  passport_addon: getFirstEnv('POLAR_PRODUCT_PASSPORT_ADDON'),
  headshot_addon: getFirstEnv('POLAR_PRODUCT_HEADSHOT_ADDON')
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'manytool-node-api' });
});

app.get('/config', (_req, res) => {
  const removeBgReady = Boolean(process.env.REMOVE_BG_API_KEY);
  const photoroomReady = Boolean(process.env.PHOTOROOM_API_KEY && process.env.PHOTOROOM_REMOVE_BG_URL);
  const polarProducts = getPolarProductMap();
  const polarBaseReady = Boolean(process.env.POLAR_ACCESS_TOKEN && polarProducts.base);
  const polarAddonReady = Boolean(
    process.env.POLAR_ACCESS_TOKEN
    && polarProducts.add2
    && polarProducts.add3
    && polarProducts.add7
  );

  res.json({
    imageProvider: getResolvedImageProvider(),
    configuredImageProvider: getImageProvider(),
    externalAiEnabled: isExternalAiEnabled(),
    paymentMode,
    paymentProducts: Object.fromEntries(
      Object.entries(polarProducts).map(([key, value]) => [key, Boolean(value)])
    ),
    readiness: {
      removeBgReady,
      photoroomReady,
      polarReady: polarBaseReady,
      polarAddonReady
    }
  });
});

const getPolarProductIdByType = (productType) => {
  const map = getPolarProductMap();
  return map[productType] ?? null;
};

const getJobPayload = (job) => {
  const photo = job?.photoId ? db.photos.get(job.photoId) : null;
  const originalUrl = job?.originalUrl ?? (photo?.originalPath
    ? `/files/originals/${path.basename(photo.originalPath)}`
    : null);
  const recommendedCandidate = Array.isArray(job?.candidates)
    ? (job.candidates.find((item) => item.recommended) ?? job.candidates[0] ?? null)
    : null;

  return {
    ...job,
    pipelineReport: job?.pipelineReport ?? null,
    originalUrl,
    recommendedCandidateId: recommendedCandidate?.id ?? null
  };
};

const getJobSnapshotPath = (jobId) => path.join(jobSnapshotDir, `${jobId}.json`);

const persistJobSnapshot = async (job) => {
  if (!job?.id) return;
  const payload = getJobPayload(job);
  await fs.writeFile(getJobSnapshotPath(job.id), JSON.stringify(payload, null, 2), 'utf-8');
};

const loadPersistedJob = async (jobId) => {
  try {
    const raw = await fs.readFile(getJobSnapshotPath(jobId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toJobSummary = (job) => {
  const photo = job?.photoId ? db.photos.get(job.photoId) : null;
  const originalUrl = job?.originalUrl ?? (photo?.originalPath
    ? `/files/originals/${path.basename(photo.originalPath)}`
    : null);
  const recommendedCandidate = Array.isArray(job?.candidates)
    ? (job.candidates.find((item) => item.recommended) ?? job.candidates[0] ?? null)
    : null;
  const report = job?.pipelineReport ?? {};
  const qualityScore = Number(report?.qualityScore ?? recommendedCandidate?.qualityScore ?? 0);
  const identityScore = Number(report?.identityScore ?? recommendedCandidate?.identityScore ?? 0);
  const flags = [];
  if (job?.status === 'failed') flags.push('failed');
  if (report?.finalQualityRetryTriggered) flags.push('quality_retry');
  if (report?.fallbackToLocalSharp) flags.push('provider_fallback');
  if (Array.isArray(report?.identityRejectedVariants) && report.identityRejectedVariants.length) flags.push('identity_reject');
  if (qualityScore > 0 && qualityScore < 84) flags.push('low_quality');
  if (identityScore > 0 && identityScore < Number(report?.identityThreshold ?? 78)) flags.push('low_identity');

  return {
    id: job?.id ?? null,
    status: job?.status ?? 'unknown',
    createdAt: job?.createdAt ?? null,
    completedAt: job?.completedAt ?? null,
    toolType: report?.toolType ?? job?.toolType ?? null,
    outfitType: report?.outfitType ?? job?.outfitType ?? null,
    requestedProvider: report?.requestedProvider ?? null,
    resolvedProvider: report?.resolvedProvider ?? null,
    cropProfile: report?.cropProfile ?? null,
    poseProfile: report?.poseProfile ?? null,
    suitTemplate: report?.suitTemplate ?? null,
    suitSelectionSummary: report?.suitSelectionSummary ?? null,
    qualityScore,
    qualitySummary: report?.qualitySummary ?? null,
    identityScore,
    identityThreshold: report?.identityThreshold ?? 78,
    score: typeof recommendedCandidate?.score === 'number' ? recommendedCandidate.score : null,
    recommendedCandidateId: recommendedCandidate?.id ?? null,
    recommendedVariant: report?.recommendedVariant ?? recommendedCandidate?.variant ?? null,
    recommendedImageUrl: recommendedCandidate?.imageUrl ?? null,
    originalUrl,
    candidateCount: Array.isArray(job?.candidates) ? job.candidates.length : 0,
    generatedVariants: Array.isArray(report?.generatedVariants) ? report.generatedVariants : [],
    cache: report?.cache ?? {},
    timings: report?.timings ?? {},
    flags,
    pipelineReport: report
  };
};

const loadPersistedRecentJobs = async () => {
  try {
    const files = await fs.readdir(jobSnapshotDir);
    const items = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          try {
            const raw = await fs.readFile(path.join(jobSnapshotDir, file), 'utf-8');
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })
    );
    return items.filter(Boolean);
  } catch {
    return [];
  }
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

const verifyPolarWebhook = (req) => {
  const secret = getFirstEnv('POLAR_WEBHOOK_SECRET');
  if (!secret) return;

  const encodedSecret = Buffer.from(secret, 'utf-8').toString('base64');
  const webhook = new Webhook(encodedSecret);
  webhook.verify(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})), {
    'webhook-id': req.get('webhook-id') ?? '',
    'webhook-signature': req.get('webhook-signature') ?? '',
    'webhook-timestamp': req.get('webhook-timestamp') ?? ''
  });
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

const resolvePolarOrderIdFromWebhook = (payload) => {
  const eventType = String(payload?.type ?? '').toLowerCase();
  if (eventType.includes('order.')) {
    return payload?.data?.id ?? payload?.id ?? null;
  }
  return payload?.data?.order_id ?? payload?.order_id ?? null;
};

const createPolarRefund = async ({ order, reason = 'service_disruption' }) => {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) throw new Error('POLAR_ACCESS_TOKEN is missing');
  if (!order?.polarOrderId) throw new Error('polar order id is missing');
  if (!Number.isFinite(Number(order.amount)) || Number(order.amount) <= 0) {
    throw new Error('refund amount is invalid');
  }

  const response = await fetch(`${polarServer}/v1/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: order.polarOrderId,
      reason,
      amount: Number(order.amount),
      comment: `Auto refund for manytool order ${order.id}`,
      metadata: {
        local_order_id: order.id,
        product_type: order.productType
      }
    })
  });

  if (!response.ok) {
    const reasonText = await response.text();
    throw new Error(`polar refund create failed: ${response.status} ${reasonText}`);
  }

  return response.json();
};

const fetchPolarCheckout = async (checkoutId) => {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) throw new Error('POLAR_ACCESS_TOKEN is missing');
  if (!checkoutId) throw new Error('polar checkout id is missing');

  const response = await fetch(`${polarServer}/v1/checkouts/${checkoutId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const reasonText = await response.text();
    throw new Error(`polar checkout get failed: ${response.status} ${reasonText}`);
  }

  return response.json();
};

const resolveOrderStatusFromPolarCheckout = (checkout) => {
  const checkoutStatus = String(checkout?.status ?? '').toLowerCase();
  const paymentStatus = String(checkout?.payment_status ?? checkout?.paymentStatus ?? '').toLowerCase();
  const orderStatus = String(checkout?.order?.status ?? '').toLowerCase();

  if (checkoutStatus === 'succeeded' || paymentStatus === 'paid' || orderStatus === 'paid') {
    return 'paid';
  }
  if (checkoutStatus === 'expired') return 'expired';
  if (checkoutStatus === 'failed') return 'failed';
  return 'pending';
};

const refreshOrderFromPolarIfNeeded = async (order) => {
  if (!order || order.paymentMode !== 'polar' || order.status !== 'pending' || !order.polarCheckoutId) {
    return order;
  }

  try {
    const checkout = await fetchPolarCheckout(order.polarCheckoutId);
    const nextStatus = resolveOrderStatusFromPolarCheckout(checkout);
    if (nextStatus === order.status) return order;

    const refreshed = {
      ...order,
      status: nextStatus,
      polarOrderId: order.polarOrderId ?? checkout?.order?.id ?? null,
      paidAt: nextStatus === 'paid' ? order.paidAt ?? new Date().toISOString() : order.paidAt ?? null,
      polarCheckoutPayload: checkout
    };
    db.orders.set(order.id, refreshed);
    return refreshed;
  } catch {
    return order;
  }
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
    let faceHint = null;
    if (typeof req.body.faceHint === 'string' && req.body.faceHint.trim()) {
      try {
        faceHint = JSON.parse(req.body.faceHint);
      } catch {}
    }

    db.photos.set(photoId, {
      id: photoId,
      sourceType: req.body.sourceType ?? 'upload',
      originalPath: filePath,
      faceHint,
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
  const { photoId, toolType = 'id_photo', outfitType = 'current', faceHint = null } = req.body ?? {};
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
    const generation = await generateCandidatesWithProvider({
      inputPath: photo.originalPath,
      storageDir: generatedDir,
      jobId,
      toolType,
      outfitType,
      faceHint: faceHint ?? photo.faceHint ?? null,
      cacheKey: photoId
    });
    const generated = generation?.generated ?? [];

    const candidates = generated.map((item, index) => ({
      id: `${jobId}-${index + 1}`,
      variant: item.variant,
      imageUrl: `/files/generated/${path.basename(item.filePath)}`,
      identityScore: item.identityScore ?? null,
      regenerated: Boolean(item.regenerated),
      score: item.score ?? null,
      recommended: index === 0
    }));

    job.status = 'done';
    job.candidates = candidates;
    job.pipelineReport = generation?.pipelineReport ?? null;
    job.completedAt = new Date().toISOString();
    job.originalUrl = `/files/originals/${path.basename(photo.originalPath)}`;
    await persistJobSnapshot(job);

    return res.status(201).json({
      jobId,
      status: job.status,
      candidates,
      pipelineReport: job.pipelineReport
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.originalUrl = `/files/originals/${path.basename(photo.originalPath)}`;
    await persistJobSnapshot(job);
    return res.status(500).json({ error: `generate failed: ${error.message}`, jobId });
  }
});

app.get('/job/:id', async (req, res) => {
  const job = db.jobs.get(req.params.id) ?? await loadPersistedJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  return res.json(getJobPayload(job));
});

app.get('/jobs/recent', async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20) || 20));
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
  const flaggedOnly = String(req.query.flagged ?? '').toLowerCase() === 'true';
  const toolFilter = typeof req.query.toolType === 'string' ? req.query.toolType.trim().toLowerCase() : '';

  const memoryJobs = Array.from(db.jobs.values());
  const persistedJobs = await loadPersistedRecentJobs();
  const deduped = new Map();
  [...persistedJobs, ...memoryJobs].forEach((item) => {
    if (item?.id) deduped.set(item.id, item);
  });

  let items = Array.from(deduped.values())
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map(toJobSummary);

  if (statusFilter) {
    items = items.filter((item) => String(item.status).toLowerCase() === statusFilter);
  }
  if (toolFilter) {
    items = items.filter((item) => String(item.toolType ?? '').toLowerCase() === toolFilter);
  }
  if (flaggedOnly) {
    items = items.filter((item) => Array.isArray(item.flags) && item.flags.length > 0);
  }

  const sliced = items.slice(0, limit);
  const stats = {
    total: items.length,
    failed: items.filter((item) => item.status === 'failed').length,
    lowQuality: items.filter((item) => item.flags.includes('low_quality')).length,
    lowIdentity: items.filter((item) => item.flags.includes('low_identity')).length,
    providerFallback: items.filter((item) => item.flags.includes('provider_fallback')).length
  };

  return res.json({
    items: sliced,
    stats,
    filters: {
      limit,
      status: statusFilter || null,
      flagged: flaggedOnly,
      toolType: toolFilter || null
    }
  });
});

app.get('/jobs/alerts', async (_req, res) => {
  const memoryJobs = Array.from(db.jobs.values());
  const persistedJobs = await loadPersistedRecentJobs();
  const deduped = new Map();
  [...persistedJobs, ...memoryJobs].forEach((item) => {
    if (item?.id) deduped.set(item.id, item);
  });

  const summaries = Array.from(deduped.values())
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map(toJobSummary);

  const flagged = summaries.filter((item) => Array.isArray(item.flags) && item.flags.length > 0);
  const toolBreakdown = {};
  const providerBreakdown = {};

  flagged.forEach((item) => {
    const tool = item.toolType ?? 'unknown';
    const provider = item.resolvedProvider ?? 'unknown';
    toolBreakdown[tool] ??= { total: 0, failed: 0, lowQuality: 0, lowIdentity: 0 };
    providerBreakdown[provider] ??= { total: 0, fallback: 0, lowQuality: 0 };
    toolBreakdown[tool].total += 1;
    providerBreakdown[provider].total += 1;
    if (item.flags.includes('failed')) toolBreakdown[tool].failed += 1;
    if (item.flags.includes('low_quality')) {
      toolBreakdown[tool].lowQuality += 1;
      providerBreakdown[provider].lowQuality += 1;
    }
    if (item.flags.includes('low_identity')) toolBreakdown[tool].lowIdentity += 1;
    if (item.flags.includes('provider_fallback')) providerBreakdown[provider].fallback += 1;
  });

  return res.json({
    totalJobs: summaries.length,
    totalFlagged: flagged.length,
    latestFlagged: flagged.slice(0, 12),
    toolBreakdown,
    providerBreakdown
  });
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
  try {
    verifyPolarWebhook(req);
  } catch {
    const insecureToken = process.env.POLAR_WEBHOOK_INSECURE_TOKEN;
    if (insecureToken) {
      const received = req.get('x-manytool-webhook-token');
      if (!received || received !== insecureToken) {
        return res.status(401).json({ error: 'invalid webhook token' });
      }
    } else {
      return res.status(401).json({ error: 'invalid webhook signature' });
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
    polarOrderId: current.polarOrderId ?? resolvePolarOrderIdFromWebhook(payload),
    paidAt: status === 'paid' ? new Date().toISOString() : current.paidAt ?? null,
    refundedAt: status === 'refunded' ? new Date().toISOString() : current.refundedAt ?? null,
    payload
  };
  db.orders.set(orderId, next);
  return res.json({ ok: true, orderId, status });
});

app.post('/refund', async (req, res) => {
  const { orderId, reason = 'service_disruption' } = req.body ?? {};
  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }

  const order = db.orders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'order not found' });
  }
  if (order.status === 'refunded' || order.refundStatus === 'succeeded') {
    return res.json({
      ok: true,
      orderId,
      status: order.status,
      refundStatus: order.refundStatus ?? 'succeeded',
      refundId: order.refundId ?? null
    });
  }
  if (order.status !== 'paid') {
    return res.status(409).json({ error: 'only paid orders can be refunded', status: order.status });
  }

  try {
    const refund = await createPolarRefund({ order, reason });
    const refundStatus = String(refund?.status ?? 'pending').toLowerCase();
    const next = {
      ...order,
      status: refundStatus === 'succeeded' ? 'refunded' : order.status,
      refundedAt: refundStatus === 'succeeded' ? new Date().toISOString() : order.refundedAt ?? null,
      refundId: refund?.id ?? null,
      refundStatus,
      refundPayload: refund
    };
    db.orders.set(orderId, next);
    return res.json({
      ok: true,
      orderId,
      status: next.status,
      refundStatus,
      refundId: next.refundId
    });
  } catch (error) {
    const next = {
      ...order,
      refundStatus: 'failed',
      refundError: error.message
    };
    db.orders.set(orderId, next);
    return res.status(500).json({ error: error.message, orderId, refundStatus: 'failed' });
  }
});

app.get('/order/:id', async (req, res) => {
  const current = db.orders.get(req.params.id);
  const order = await refreshOrderFromPolarIfNeeded(current);
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
