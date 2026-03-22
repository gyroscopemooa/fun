import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Webhook } from 'standardwebhooks';
import { db } from './store.js';
import { generateCommerceDetailPage } from './commerce/detailPage.js';
import { generateAiImage, getModeOptions, getProviderOptions, sanitizeUserInput } from './commerce/aiImageGenerator.js';
import { analyzeMealCalories } from './commerce/calorieAnalyzer.js';
import { analyzePersonalColor } from './commerce/personalColorAnalyzer.js';
import { analyzeSaju } from './commerce/sajuAnalyzer.js';
import { analyzePetAudio, parsePetAudioPayload } from './commerce/petTranslator.js';
import { generateCandidatesWithProvider, getImageProvider, getResolvedImageProvider, isExternalAiEnabled, normalizeRequestedProvider, resolveImageProvider } from './providers/providerRouter.js';
import { getNamingDataset } from './naming/repository.js';
import { validateNamingInput, validateRecommendInput } from './naming/validate.js';
import { calculateFiveGrid } from './naming/fiveGrid.js';
import { scoreFiveGrid } from './naming/score.js';
import { recommendNames } from './naming/recommend.js';
import { buildFallback, getMissingStrokeSuggestion } from './naming/fallback.js';
import { buildNameExplanation } from './naming/description.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const paymentMode = process.env.PAYMENT_MODE ?? 'mock';
const polarServer = process.env.POLAR_SERVER === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
const polarCheckoutUrl = `${polarServer}/v1/checkouts`;
const resendApiUrl = 'https://api.resend.com/emails';
const ffmpegBinary = (process.env.FFMPEG_PATH ?? 'ffmpeg').trim() || 'ffmpeg';
const VIDEO_MAX_BYTES = Math.floor(1.5 * 1024 * 1024 * 1024);
const ffmpegReady = (() => {
  try {
    const result = spawnSync(ffmpegBinary, ['-version'], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
})();

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const rootDir = path.resolve(thisDir, '..', 'node-api-storage');
const originalDir = path.join(rootDir, 'originals');
const generatedDir = path.join(rootDir, 'generated');
const reportsDir = path.join(rootDir, 'reports');
const jobSnapshotDir = path.join(reportsDir, 'jobs');
const aiManseryeokJobDir = path.join(reportsDir, 'ai-manseryeok');
const videoDir = path.join(rootDir, 'video');
const videoIncomingDir = path.join(videoDir, 'incoming');
const videoOutputDir = path.join(videoDir, 'output');

await fs.mkdir(originalDir, { recursive: true });
await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(jobSnapshotDir, { recursive: true });
await fs.mkdir(aiManseryeokJobDir, { recursive: true });
await fs.mkdir(videoIncomingDir, { recursive: true });
await fs.mkdir(videoOutputDir, { recursive: true });

const AI_MANSERYEOK_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const largeVideoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, videoIncomingDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mkv';
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: VIDEO_MAX_BYTES }
});

const allowedOrigins = new Set([
  'https://manytool.net',
  'http://127.0.0.1:4321',
  'http://localhost:4321'
]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));
app.use('/files', express.static(rootDir));

const maybeAudioUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single('audio')(req, res, next);
  }
  return next();
};

const getFirstEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const getResendConfig = () => ({
  apiKey: getFirstEnv('RESEND_API_KEY'),
  fromEmail: getFirstEnv('RESEND_FROM_EMAIL')
});

const PET_DAILY_LIMIT = 5;
const PET_COOLDOWN_MS = 5000;

const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

const seedPetTranslatorTokens = () => {
  if (db.petTranslatorTokens.size > 0) return;

  const raw = getFirstEnv('PET_TRANSLATOR_TOKENS_JSON');
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed)
      ? parsed
      : Object.entries(parsed).map(([token, value]) => ({ token, ...(value ?? {}) }));

    for (const row of rows) {
      const token = typeof row?.token === 'string' ? row.token.trim() : '';
      if (!token) continue;
      db.petTranslatorTokens.set(token, {
        token,
        usage_count: Number(row?.usage_count ?? 0),
        last_used_date: typeof row?.last_used_date === 'string' ? row.last_used_date : null,
        expires_at: typeof row?.expires_at === 'string' ? row.expires_at : null,
        last_request_at: typeof row?.last_request_at === 'string' ? row.last_request_at : null
      });
    }
  } catch (error) {
    console.error('Failed to parse PET_TRANSLATOR_TOKENS_JSON', error);
  }
};

const getPetTranslatorTokenState = (token) => {
  seedPetTranslatorTokens();

  const normalized = typeof token === 'string' ? token.trim() : '';
  if (!normalized) {
    const error = new Error('token is required');
    error.statusCode = 400;
    throw error;
  }

  const record = db.petTranslatorTokens.get(normalized);
  if (!record) {
    const error = new Error('invalid token');
    error.statusCode = 401;
    throw error;
  }

  const now = new Date();
  if (record.expires_at && Number.isFinite(Date.parse(record.expires_at)) && Date.parse(record.expires_at) < now.getTime()) {
    const error = new Error('token expired');
    error.statusCode = 403;
    throw error;
  }

  const todayKey = getTodayDateKey();
  const baseRecord = record.last_used_date !== todayKey
    ? { ...record, usage_count: 0, last_used_date: todayKey }
    : { ...record };

  const lastRequestAt = baseRecord.last_request_at ? Date.parse(baseRecord.last_request_at) : NaN;
  if (Number.isFinite(lastRequestAt)) {
    const elapsed = now.getTime() - lastRequestAt;
    if (elapsed < PET_COOLDOWN_MS) {
      const retryAfterMs = PET_COOLDOWN_MS - elapsed;
      const error = new Error('cooldown active');
      error.statusCode = 429;
      error.retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      throw error;
    }
  }

  if (baseRecord.usage_count >= PET_DAILY_LIMIT) {
    const error = new Error('daily usage exceeded');
    error.statusCode = 429;
    throw error;
  }

  return baseRecord;
};

const commitPetTranslatorUsage = (record) => {
  const next = {
    ...record,
    usage_count: Number(record.usage_count ?? 0) + 1,
    last_used_date: getTodayDateKey(),
    last_request_at: new Date().toISOString()
  };

  db.petTranslatorTokens.set(next.token, next);
  return next;
};

const getPolarProductMap = () => ({
  base: getFirstEnv('POLAR_PRODUCT_BASE', 'POLAR_PRODUCT_ID'),
  calorie: getFirstEnv('POLAR_PRODUCT_CALORIE'),
  donation: getFirstEnv('POLAR_PRODUCT_DONATION'),
  ai_personal_color: getFirstEnv('POLAR_PRODUCT_AI_PERSONAL_COLOR'),
  ai_manseryeok: getFirstEnv('POLAR_PRODUCT_AI_MANSERYEOK'),
  ai_name_premium: getFirstEnv('POLAR_PRODUCT_AI_NAME_PREMIUM'),
  video_mkv_mp4: getFirstEnv('POLAR_PRODUCT_VIDEO_MKV_MP4'),
  add2: getFirstEnv('POLAR_PRODUCT_ADD2'),
  add3: getFirstEnv('POLAR_PRODUCT_ADD3'),
  add7: getFirstEnv('POLAR_PRODUCT_ADD7'),
  passport_addon: getFirstEnv('POLAR_PRODUCT_PASSPORT_ADDON'),
  headshot_addon: getFirstEnv('POLAR_PRODUCT_HEADSHOT_ADDON')
});

const getPolarDetailPageTierMap = () => ({
  5: getFirstEnv('POLAR_PRODUCT_DETAIL_PAGE_5'),
  7: getFirstEnv('POLAR_PRODUCT_DETAIL_PAGE_7'),
  10: getFirstEnv('POLAR_PRODUCT_DETAIL_PAGE_10'),
  15: getFirstEnv('POLAR_PRODUCT_DETAIL_PAGE_15'),
  20: getFirstEnv('POLAR_PRODUCT_DETAIL_PAGE_20')
});

const resolveCustomerEmail = (payload) => (
  payload?.customerEmail
  ?? payload?.customer_email
  ?? payload?.customer?.email
  ?? payload?.data?.customerEmail
  ?? payload?.data?.customer_email
  ?? payload?.data?.customer?.email
  ?? payload?.data?.checkout?.customerEmail
  ?? payload?.data?.checkout?.customer_email
  ?? payload?.data?.checkout?.customer?.email
  ?? payload?.data?.order?.customerEmail
  ?? payload?.data?.order?.customer_email
  ?? payload?.data?.order?.customer?.email
  ?? payload?.order?.customerEmail
  ?? payload?.order?.customer_email
  ?? payload?.order?.customer?.email
  ?? null
);

const getProviderDiagnostics = () => {
  const externalAiEnabled = isExternalAiEnabled();
  const removeBgMissing = ['REMOVE_BG_API_KEY'].filter((key) => !getFirstEnv(key));
  const photoroomMissing = ['PHOTOROOM_API_KEY', 'PHOTOROOM_REMOVE_BG_URL'].filter((key) => !getFirstEnv(key));

  return {
    auto: {
      requested: 'auto',
      resolved: resolveImageProvider('auto'),
      available: true,
      externalCapable: externalAiEnabled && (removeBgMissing.length === 0 || photoroomMissing.length === 0),
      missingEnv: []
    },
    local_sharp: {
      requested: 'local_sharp',
      resolved: 'local_sharp',
      available: true,
      externalCapable: false,
      missingEnv: []
    },
    remove_bg: {
      requested: 'remove_bg',
      resolved: resolveImageProvider('remove_bg'),
      available: externalAiEnabled && removeBgMissing.length === 0,
      externalCapable: externalAiEnabled,
      missingEnv: removeBgMissing
    },
    photoroom: {
      requested: 'photoroom',
      resolved: resolveImageProvider('photoroom'),
      available: externalAiEnabled && photoroomMissing.length === 0,
      externalCapable: externalAiEnabled,
      missingEnv: photoroomMissing
    }
  };
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'manytool-node-api' });
});

app.get('/config', (_req, res) => {
  const openAiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
  const xaiReady = Boolean(process.env.XAI_API_KEY?.trim());
  const removeBgReady = Boolean(process.env.REMOVE_BG_API_KEY);
  const photoroomReady = Boolean(process.env.PHOTOROOM_API_KEY && process.env.PHOTOROOM_REMOVE_BG_URL);
  const polarProducts = getPolarProductMap();
  const detailPageTierMap = getPolarDetailPageTierMap();
  const detailPageTiersReady = Object.values(detailPageTierMap).every(Boolean);
  const polarBaseReady = Boolean(process.env.POLAR_ACCESS_TOKEN && polarProducts.base);
  const polarAddonReady = Boolean(
    process.env.POLAR_ACCESS_TOKEN
    && polarProducts.add2
    && polarProducts.add3
    && polarProducts.add7
  );
  const providerDiagnostics = getProviderDiagnostics();
  const resend = getResendConfig();

  res.json({
    imageProvider: getResolvedImageProvider(),
    configuredImageProvider: getImageProvider(),
    externalAiEnabled: isExternalAiEnabled(),
    paymentMode,
    supportedImageProviders: ['auto', 'local_sharp', 'remove_bg', 'photoroom'],
    paymentProducts: {
      ...Object.fromEntries(
        Object.entries(polarProducts).map(([key, value]) => [key, Boolean(value)])
      ),
      detail_page: detailPageTiersReady,
      detail_page_tiers: Object.fromEntries(
        Object.entries(detailPageTierMap).map(([key, value]) => [key, Boolean(value)])
      )
    },
    readiness: {
      openAiReady,
      xaiReady,
      aiImageGeneratorReady: openAiReady || xaiReady,
      aiPersonalColorReady: openAiReady,
      aiManseryeokReady: openAiReady,
      petTranslatorReady: openAiReady,
      resendReady: Boolean(resend.apiKey && resend.fromEmail),
      removeBgReady,
      photoroomReady,
      polarReady: Boolean(process.env.POLAR_ACCESS_TOKEN) && (polarBaseReady || detailPageTiersReady),
      polarAddonReady,
      ffmpegReady,
      videoConverterReady: ffmpegReady
    },
    providerAvailability: {
      auto: true,
      local_sharp: true,
      remove_bg: removeBgReady && isExternalAiEnabled(),
      photoroom: photoroomReady && isExternalAiEnabled()
    },
    aiImageModes: getModeOptions(),
    aiImageProviders: getProviderOptions(),
    providerResolutionMap: providerDiagnostics,
    providerDiagnostics
  });
});

const handlePetTranslator = async (req, res) => {
  try {
    const tokenState = getPetTranslatorTokenState(req.body?.token);
    const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : 'analyze';
    const animal = typeof req.body?.animal === 'string' ? req.body.animal.trim() : 'dog';
    const textInput = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const audioInput = parsePetAudioPayload({
      file: req.file,
      audio: req.body?.audio,
      audioMimeType: req.body?.audioMimeType
    });

    const result = await analyzePetAudio({
      audioInput,
      mode,
      animal,
      textInput
    });

    const usage = commitPetTranslatorUsage(tokenState);

    if (mode === 'command') {
      return res.json({
        ok: true,
        mode,
        animal,
        audio: result.audio,
        mimeType: result.mimeType,
        meta: {
          text: result.text,
          emotion: result.emotion,
          description: result.description,
          transcript: result.transcript,
          durationSeconds: result.durationSeconds
        },
        usage: {
          usageCount: usage.usage_count,
          dailyLimit: PET_DAILY_LIMIT,
          lastUsedDate: usage.last_used_date
        }
      });
    }

    return res.json({
      ok: true,
      mode,
      animal,
      text: result.text,
      emotion: result.emotion,
      description: result.description,
      transcript: result.transcript,
      durationSeconds: result.durationSeconds,
      usage: {
        usageCount: usage.usage_count,
        dailyLimit: PET_DAILY_LIMIT,
        lastUsedDate: usage.last_used_date
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pet translator failed';
    const statusCode = Number.isFinite(error?.statusCode) ? error.statusCode : 500;
    const retryAfterSeconds = Number.isFinite(error?.retryAfterSeconds) ? error.retryAfterSeconds : null;

    return res.status(statusCode).json({
      ok: false,
      error: message,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {})
    });
  }
};

app.post('/pet', maybeAudioUpload, handlePetTranslator);
app.post('/api/pet', maybeAudioUpload, handlePetTranslator);

const ensureVideoOrder = async (orderId) => {
  if (!orderId) throw new Error('orderId is required');
  const current = db.orders.get(orderId);
  const order = await refreshOrderFromPolarIfNeeded(current);
  if (!order) throw new Error('order not found');
  if (order.productType !== 'video_mkv_mp4') throw new Error('invalid order product type');
  if (order.status !== 'paid') throw new Error('payment required');
  if (order.videoJobId) {
    const existingJob = db.videoJobs.get(order.videoJobId);
    if (existingJob && existingJob.status !== 'failed') {
      throw new Error('this order has already been used');
    }
  }
  return order;
};

const ensureAiPersonalColorOrder = async (orderId) => {
  if (!orderId) throw new Error('orderId is required');
  const current = db.orders.get(orderId);
  const order = await refreshOrderFromPolarIfNeeded(current);
  if (!order) throw new Error('order not found');
  if (order.productType !== 'ai_personal_color') throw new Error('invalid order product type');
  if (order.status !== 'paid') throw new Error('payment required');
  if (order.aiPersonalColorJobId) {
    const existingJob = db.aiPersonalColorJobs.get(order.aiPersonalColorJobId);
    if (existingJob && existingJob.status !== 'failed') {
      throw new Error('this order has already been used');
    }
  }
  return order;
};

const ensureAiManseryeokOrder = async (orderId) => {
  if (!orderId) throw new Error('orderId is required');
  const current = db.orders.get(orderId);
  const order = await refreshOrderFromPolarIfNeeded(current);
  if (!order) throw new Error('order not found');
  if (order.productType !== 'ai_manseryeok') throw new Error('invalid order product type');
  if (order.status !== 'paid') throw new Error('payment required');
  if (order.aiManseryeokJobId) {
    const existingJob = db.aiManseryeokJobs.get(order.aiManseryeokJobId);
    if (existingJob && existingJob.status !== 'failed') {
      throw new Error('this order has already been used');
    }
  }
  return order;
};

const normalizeNamePremiumLockInput = (input = {}) => {
  const displayName = typeof input?.displayName === 'string' ? input.displayName.trim() : '';
  const hanjaName = typeof input?.hanjaName === 'string' ? input.hanjaName.trim().replace(/\s+/g, '') : '';
  const birthDate = typeof input?.birthDate === 'string' ? input.birthDate.trim() : '';
  const gender = input?.gender === 'male' ? 'male' : 'female';
  const calendarType = input?.calendarType === 'lunar' ? 'lunar' : 'solar';
  const surname = typeof input?.surname === 'string' && input.surname.trim()
    ? input.surname.trim()
    : hanjaName.slice(0, 1);
  const givenSource = Array.isArray(input?.given) ? input.given : hanjaName.slice(1).split('');
  const given = givenSource
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return {
    displayName,
    hanjaName,
    birthDate,
    gender,
    calendarType,
    surname,
    given
  };
};

const serializeNamePremiumLockInput = (input = {}) => JSON.stringify(normalizeNamePremiumLockInput(input));

const ensureNamePremiumOrder = async (orderId, requestedInput = null) => {
  if (!orderId) throw new Error('orderId is required');
  const current = db.orders.get(orderId);
  let order = await refreshOrderFromPolarIfNeeded(current);
  if (!order) throw new Error('order not found');
  if (order.productType !== 'ai_name_premium') throw new Error('invalid order product type');
  if (order.status !== 'paid') throw new Error('payment required');
  if (requestedInput) {
    const normalizedInput = normalizeNamePremiumLockInput(requestedInput);
    if (order.namePremiumLock) {
      if (serializeNamePremiumLockInput(order.namePremiumLock) !== serializeNamePremiumLockInput(normalizedInput)) {
        throw new Error('name premium input changed');
      }
    } else {
      order = {
        ...order,
        namePremiumLock: normalizedInput,
        namePremiumLockedAt: new Date().toISOString()
      };
      db.orders.set(order.id, order);
    }
  }
  return order;
};

const toVideoJobPayload = (job) => ({
  id: job.id,
  orderId: job.orderId,
  status: job.status,
  createdAt: job.createdAt,
  startedAt: job.startedAt ?? null,
  completedAt: job.completedAt ?? null,
  inputName: job.inputName,
  inputSize: job.inputSize,
  outputUrl: job.outputUrl ?? null,
  outputName: job.outputName ?? null,
  error: job.error ?? null
});

const waitForFfmpeg = (args) => new Promise((resolve, reject) => {
  const child = spawn(ffmpegBinary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
  });
});

const runMkvToMp4Job = async (jobId) => {
  const job = db.videoJobs.get(jobId);
  if (!job) return;
  job.status = 'processing';
  job.startedAt = new Date().toISOString();
  db.videoJobs.set(jobId, job);

  const copyArgs = ['-y', '-i', job.inputPath, '-c', 'copy', '-movflags', '+faststart', job.outputPath];
  const reencodeArgs = ['-y', '-i', job.inputPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', job.outputPath];

  try {
    await waitForFfmpeg(copyArgs);
  } catch {
    try {
      await fs.rm(job.outputPath, { force: true });
    } catch {
      // ignore stale output cleanup failure
    }
    await waitForFfmpeg(reencodeArgs);
  }

  const next = {
    ...job,
    status: 'done',
    completedAt: new Date().toISOString(),
    outputUrl: `/files/video/output/${path.basename(job.outputPath)}`
  };
  db.videoJobs.set(jobId, next);
};

app.post('/video/mkv-mp4/convert', largeVideoUpload.single('video'), async (req, res) => {
  if (!ffmpegReady) {
    if (req.file?.path) {
      await fs.rm(req.file.path, { force: true }).catch(() => {});
    }
    return res.status(503).json({ error: 'ffmpeg is not configured on the server' });
  }

  try {
    const order = await ensureVideoOrder(req.body?.orderId ?? req.query?.orderId ?? null);
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'video file is required' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const allowedVideoExtensions = new Set(['.mkv', '.mov', '.avi', '.m4v']);
    const allowedVideoMimeHints = ['matroska', 'quicktime', 'x-msvideo', 'video/avi', 'video/x-m4v'];
    const isAllowedVideo = allowedVideoExtensions.has(ext) || allowedVideoMimeHints.some((hint) => mime.includes(hint));
    if (!isAllowedVideo) {
      await fs.rm(file.path, { force: true }).catch(() => {});
      return res.status(400).json({ error: 'only mkv, mov, avi, and m4v uploads are allowed' });
    }

    const jobId = uuidv4();
    const outputName = `${path.parse(file.filename).name}.mp4`;
    const outputPath = path.join(videoOutputDir, outputName);
    const job = {
      id: jobId,
      orderId: order.id,
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      inputPath: file.path,
      inputName: file.originalname,
      inputSize: file.size,
      outputPath,
      outputName,
      outputUrl: null,
      error: null
    };

    db.videoJobs.set(jobId, job);
    db.orders.set(order.id, { ...order, videoJobId: jobId });

    void runMkvToMp4Job(jobId).catch(async (error) => {
      const current = db.videoJobs.get(jobId);
      if (!current) return;
      db.videoJobs.set(jobId, {
        ...current,
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'conversion failed'
      });
      await fs.rm(outputPath, { force: true }).catch(() => {});
    });

    return res.status(202).json({ ok: true, jobId, job: toVideoJobPayload(job) });
  } catch (error) {
    if (req.file?.path) {
      await fs.rm(req.file.path, { force: true }).catch(() => {});
    }
    return res.status(400).json({ error: error instanceof Error ? error.message : 'failed to start conversion' });
  }
});

app.get('/video/mkv-mp4/job/:id', (req, res) => {
  const job = db.videoJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'job not found' });
  }
  return res.json({ ok: true, job: toVideoJobPayload(job) });
});

const getPolarProductIdByType = (productType) => {
  const map = getPolarProductMap();
  return map[productType] ?? null;
};

const getDetailPageTierProductId = (pageCount) => {
  const tierMap = getPolarDetailPageTierMap();
  const safeCount = Math.max(5, Math.min(20, Math.round(Number(pageCount) || 7)));
  return tierMap[safeCount] ?? null;
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
  const candidateBreakdown = Array.isArray(job?.candidates)
    ? job.candidates.map((candidate) => ({
      id: candidate.id,
      variant: candidate.variant,
      recommended: Boolean(candidate.recommended),
      regenerated: Boolean(candidate.regenerated),
      score: typeof candidate.score === 'number' ? candidate.score : null,
      identityScore: typeof candidate.identityScore === 'number' ? candidate.identityScore : null,
      qualityScore,
      imageUrl: candidate.imageUrl ?? null,
      rejected: Array.isArray(report?.identityRejectedVariants)
        ? report.identityRejectedVariants.includes(candidate.variant)
        : false
    }))
    : [];
  const rejectedVariantBreakdown = Array.isArray(report?.identityRejectedVariants)
    ? report.identityRejectedVariants.map((variant) => {
      const rejectedIdentityScore = Number(report?.variantIdentityScores?.[variant] ?? 0);
      const regenerated = Array.isArray(report?.identityRegeneratedVariants)
        ? report.identityRegeneratedVariants.includes(variant)
        : false;
      return {
        variant,
        rejected: true,
        regenerated,
        identityScore: rejectedIdentityScore || null,
        qualityScore,
        score: rejectedIdentityScore
          ? Math.round(((rejectedIdentityScore * 0.65) + (qualityScore * 0.35) - (regenerated ? 1.5 : 0)) * 10) / 10
          : null
      };
    })
    : [];

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
    qualityScoreBeforeRetry: typeof report?.qualityScoreBeforeRetry === 'number' ? report.qualityScoreBeforeRetry : null,
    finalQualityRetryTriggered: Boolean(report?.finalQualityRetryTriggered),
    finalQualityRetryProfile: report?.finalQualityRetryProfile ?? null,
    qualitySummary: report?.qualitySummary ?? null,
    qualityIssueCodes: Array.isArray(report?.qualityIssueCodes) ? report.qualityIssueCodes : [],
    qualityMetrics: report?.qualityMetrics ?? null,
    identityScore,
    identityThreshold: report?.identityThreshold ?? 78,
    identitySummary: report?.identitySummary ?? null,
    score: typeof recommendedCandidate?.score === 'number' ? recommendedCandidate.score : null,
    recommendedCandidateId: recommendedCandidate?.id ?? null,
    recommendedVariant: report?.recommendedVariant ?? recommendedCandidate?.variant ?? null,
    recommendedImageUrl: recommendedCandidate?.imageUrl ?? null,
    candidateBreakdown,
    rejectedVariantBreakdown,
    rejectedVariants: Array.isArray(report?.identityRejectedVariants) ? report.identityRejectedVariants : [],
    originalUrl,
    candidateCount: Array.isArray(job?.candidates) ? job.candidates.length : 0,
    generatedVariants: Array.isArray(report?.generatedVariants) ? report.generatedVariants : [],
    variantDecisionTrace: Array.isArray(report?.variantDecisionTrace) ? report.variantDecisionTrace : [],
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

const loadAllJobSummaries = async () => {
  const memoryJobs = Array.from(db.jobs.values());
  const persistedJobs = await loadPersistedRecentJobs();
  const deduped = new Map();
  [...persistedJobs, ...memoryJobs].forEach((item) => {
    if (item?.id) deduped.set(item.id, item);
  });

  return Array.from(deduped.values())
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map(toJobSummary);
};

const applySinceHoursFilter = (items, sinceHours) => {
  if (!Number.isFinite(sinceHours) || sinceHours <= 0) return items;
  const cutoff = Date.now() - (sinceHours * 60 * 60 * 1000);
  return items.filter((item) => new Date(item.createdAt ?? 0).getTime() >= cutoff);
};

const applyJobSummaryFilters = (items, {
  statusFilter = '',
  flaggedOnly = false,
  fallbackOnly = false,
  toolFilter = '',
  providerFilter = '',
  sinceHours = 0
} = {}) => {
  let filtered = applySinceHoursFilter(items, sinceHours);

  if (statusFilter) {
    filtered = filtered.filter((item) => String(item.status).toLowerCase() === statusFilter);
  }
  if (toolFilter) {
    filtered = filtered.filter((item) => String(item.toolType ?? '').toLowerCase() === toolFilter);
  }
  if (providerFilter) {
    filtered = filtered.filter((item) => String(item.provider ?? item.resolvedProvider ?? '').toLowerCase() === providerFilter);
  }
  if (flaggedOnly) {
    filtered = filtered.filter((item) => Array.isArray(item.flags) && item.flags.length > 0);
  }
  if (fallbackOnly) {
    filtered = filtered.filter((item) => Array.isArray(item.flags) && item.flags.includes('provider_fallback'));
  }

  return filtered;
};

const getAiImageJobPayload = (job) => {
  if (!job) return null;
  return {
    id: job.id,
    provider: job.provider ?? 'openai',
    mode: job.mode,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    imageUrl: job.imageUrl ?? null,
    prompt: job.prompt ?? null,
    revisedPrompt: job.revisedPrompt ?? null,
    error: job.error ?? null
  };
};

const summarizeIssueCounts = (items, extractor) => {
  const counts = new Map();
  items.forEach((item) => {
    extractor(item).forEach((value) => {
      if (!value) return;
      const existing = counts.get(value);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(value, {
          count: 1,
          representativeJobId: item.id ?? null
        });
      }
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([label, meta]) => ({
      label,
      count: meta.count,
      representativeJobId: meta.representativeJobId
    }));
};

const buildOrderReturnUrl = (baseUrl, orderId) => {
  if (!baseUrl || !orderId) return baseUrl ?? null;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('orderId', orderId);
    return url.toString();
  } catch {
    return baseUrl;
  }
};

const buildDetailPageResultUrl = (orderId) => {
  const base = getFirstEnv('PUBLIC_WEB_BASE_URL', 'WEB_BASE_URL') ?? 'https://manytool.net';
  try {
    const url = new URL('/tools/product-detail-studio/result/', base);
    url.searchParams.set('orderId', orderId);
    return url.toString();
  } catch {
    return `https://manytool.net/tools/product-detail-studio/result/?orderId=${encodeURIComponent(orderId)}`;
  }
};

const sendDetailPageResultEmail = async (order) => {
  const resend = getResendConfig();
  if (!resend.apiKey || !resend.fromEmail) throw new Error('Resend is not configured');
  if (!order?.customerEmail) throw new Error('customer email is missing');
  if (!order?.detailPageRequest?.productName) throw new Error('detail page request is missing');

  const resultUrl = buildDetailPageResultUrl(order.id);
  const pageCount = Number(order?.detailPageRequest?.pageCount ?? 0) || 0;
  const productName = String(order.detailPageRequest.productName).trim();

  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resend.fromEmail,
      to: [order.customerEmail],
      subject: `[ManyTool] ${productName} 상세페이지가 준비되었습니다`,
      html: `
        <div style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#0f172a;">
          <h1 style="font-size:22px;margin:0 0 16px;">상세페이지 생성이 완료되었습니다.</h1>
          <p style="margin:0 0 10px;"><strong>상품명:</strong> ${productName}</p>
          <p style="margin:0 0 14px;"><strong>구성 장수:</strong> ${pageCount}장</p>
          <p style="margin:0 0 20px;">아래 링크에서 결과를 확인하고 PNG, JPG, PDF, HTML로 저장할 수 있습니다.</p>
          <p style="margin:0 0 22px;">
            <a href="${resultUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">결과 페이지 열기</a>
          </p>
          <p style="margin:0 0 6px;color:#475569;">링크가 열리지 않으면 아래 주소를 복사해 접속해 주세요.</p>
          <p style="margin:0;color:#334155;word-break:break-all;">${resultUrl}</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`resend email send failed: ${response.status} ${reason}`);
  }

  return response.json();
};

const sendDetailPageResultEmailIfNeeded = async (order) => {
  if (!order || order.productType !== 'detail_page') return order;
  if (!order.customerEmail || order.emailStatus === 'sent') return order;

  const emailPayload = await sendDetailPageResultEmail(order);
  const nextOrder = {
    ...order,
    emailStatus: 'sent',
    emailSentAt: new Date().toISOString(),
    emailError: null,
    emailPayload
  };
  db.orders.set(order.id, nextOrder);
  return nextOrder;
};

const buildAiImageResultPageUrl = (jobId) => {
  const base = getFirstEnv('PUBLIC_WEB_BASE_URL', 'WEB_BASE_URL') ?? 'https://manytool.net';
  try {
    const url = new URL('/ai-image-generator/', base);
    url.searchParams.set('jobId', jobId);
    return url.toString();
  } catch {
    return `https://manytool.net/ai-image-generator/?jobId=${encodeURIComponent(jobId)}`;
  }
};

const buildAbsoluteFileUrl = (relativePath) => {
  const base = getFirstEnv('PUBLIC_API_BASE_URL', 'API_BASE_URL') ?? 'https://api.manytool.net';
  try {
    return new URL(relativePath, base).toString();
  } catch {
    return `${base.replace(/\/+$/, '')}${relativePath}`;
  }
};

const sendAiImageResultEmail = async ({ order, job }) => {
  const resend = getResendConfig();
  if (!resend.apiKey || !resend.fromEmail) throw new Error('Resend is not configured');
  if (!order?.customerEmail) throw new Error('customer email is missing');
  if (!job?.imageUrl) throw new Error('ai image result is missing');

  const resultPageUrl = buildAiImageResultPageUrl(job.id);
  const imageUrl = buildAbsoluteFileUrl(job.imageUrl);
  const modeLabel = String(job.mode ?? 'ai image').trim();

  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resend.fromEmail,
      to: [order.customerEmail],
      subject: `[ManyTool] Your AI image is ready`,
      html: `
        <div style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#0f172a;">
          <h1 style="font-size:22px;margin:0 0 16px;">Your AI image is ready</h1>
          <p style="margin:0 0 10px;"><strong>Mode:</strong> ${modeLabel}</p>
          <p style="margin:0 0 20px;">Use the links below to open the result page or download the generated image directly.</p>
          <p style="margin:0 0 12px;">
            <a href="${resultPageUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">Open result page</a>
          </p>
          <p style="margin:0 0 22px;">
            <a href="${imageUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">Download image</a>
          </p>
          <p style="margin:0 0 6px;color:#475569;">Result page URL</p>
          <p style="margin:0 0 14px;color:#334155;word-break:break-all;">${resultPageUrl}</p>
          <p style="margin:0 0 6px;color:#475569;">Direct image URL</p>
          <p style="margin:0;color:#334155;word-break:break-all;">${imageUrl}</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`resend email send failed: ${response.status} ${reason}`);
  }

  return response.json();
};

const sendAiImageResultEmailIfNeeded = async ({ order, job }) => {
  if (!order || !job?.imageUrl) return order;
  if (!order.customerEmail || order.aiImageEmailStatus === 'sent') return order;

  const emailPayload = await sendAiImageResultEmail({ order, job });
  const nextOrder = {
    ...order,
    aiImageEmailStatus: 'sent',
    aiImageEmailSentAt: new Date().toISOString(),
    aiImageEmailError: null,
    aiImageEmailPayload: emailPayload
  };
  db.orders.set(order.id, nextOrder);
  return nextOrder;
};

const buildAiPersonalColorResultPageUrl = (jobId) => {
  const base = getFirstEnv('PUBLIC_WEB_BASE_URL', 'WEB_BASE_URL') ?? 'https://manytool.net';
  try {
    const url = new URL('/ai-personal-color/', base);
    url.searchParams.set('jobId', jobId);
    return url.toString();
  } catch {
    return `https://manytool.net/ai-personal-color/?jobId=${encodeURIComponent(jobId)}`;
  }
};

const buildAiManseryeokResultPageUrl = (jobId) => {
  const base = getFirstEnv('PUBLIC_WEB_BASE_URL', 'WEB_BASE_URL') ?? 'https://manytool.net';
  try {
    const url = new URL('/ai-manseryeok/', base);
    url.searchParams.set('jobId', jobId);
    return url.toString();
  } catch {
    return `https://manytool.net/ai-manseryeok/?jobId=${encodeURIComponent(jobId)}`;
  }
};

const buildNamePremiumResultUrl = (orderId) => {
  const base = getFirstEnv('PUBLIC_WEB_BASE_URL', 'WEB_BASE_URL') ?? 'https://manytool.net';
  try {
    const url = new URL('/name-premium/', base);
    url.searchParams.set('orderId', orderId);
    return url.toString();
  } catch {
    return `https://manytool.net/name-premium/?orderId=${encodeURIComponent(orderId)}`;
  }
};

const getAiManseryeokJobPath = (jobId) => path.join(aiManseryeokJobDir, `${jobId}.json`);

const isAiManseryeokJobExpired = (job) => {
  const createdAt = new Date(job?.createdAt ?? 0).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return true;
  return Date.now() - createdAt > AI_MANSERYEOK_RETENTION_MS;
};

const persistAiManseryeokJob = async (job) => {
  if (!job?.id) return;
  await fs.writeFile(getAiManseryeokJobPath(job.id), JSON.stringify(job, null, 2), 'utf-8');
};

const loadPersistedAiManseryeokJob = async (jobId) => {
  try {
    const raw = await fs.readFile(getAiManseryeokJobPath(jobId), 'utf-8');
    const parsed = JSON.parse(raw);
    if (isAiManseryeokJobExpired(parsed)) {
      await fs.rm(getAiManseryeokJobPath(jobId), { force: true });
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const sendAiPersonalColorResultEmail = async ({ order, job }) => {
  const resend = getResendConfig();
  if (!resend.apiKey || !resend.fromEmail) throw new Error('Resend is not configured');
  if (!order?.customerEmail) throw new Error('customer email is missing');
  if (!job?.analysis?.summary) throw new Error('personal color analysis result is missing');

  const resultPageUrl = buildAiPersonalColorResultPageUrl(job.id);
  const season = String(job.analysis.season ?? '').trim() || '퍼스널컬러 결과';
  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resend.fromEmail,
      to: [order.customerEmail],
      subject: '[ManyTool] AI 퍼스널컬러 분석 결과가 준비되었습니다',
      html: `
        <div style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#0f172a;">
          <h1 style="font-size:22px;margin:0 0 16px;">AI 퍼스널컬러 분석 결과가 준비되었습니다</h1>
          <p style="margin:0 0 8px;"><strong>메인 톤:</strong> ${season}</p>
          <p style="margin:0 0 14px;"><strong>요약:</strong> ${job.analysis.summary}</p>
          <p style="margin:0 0 20px;">아래 버튼으로 결과 페이지에서 추천 컬러, 메이크업, 헤어 컬러 가이드를 다시 확인할 수 있습니다.</p>
          <p style="margin:0 0 22px;">
            <a href="${resultPageUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">결과 페이지 열기</a>
          </p>
          <p style="margin:0 0 6px;color:#475569;">결과 페이지 URL</p>
          <p style="margin:0;color:#334155;word-break:break-all;">${resultPageUrl}</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`resend email send failed: ${response.status} ${reason}`);
  }

  return response.json();
};

const sendAiPersonalColorResultEmailIfNeeded = async ({ order, job }) => {
  if (!order || !job?.analysis?.summary) return order;
  if (!order.customerEmail || order.aiPersonalColorEmailStatus === 'sent') return order;

  const emailPayload = await sendAiPersonalColorResultEmail({ order, job });
  const nextOrder = {
    ...order,
    aiPersonalColorEmailStatus: 'sent',
    aiPersonalColorEmailSentAt: new Date().toISOString(),
    aiPersonalColorEmailError: null,
    aiPersonalColorEmailPayload: emailPayload
  };
  db.orders.set(order.id, nextOrder);
  return nextOrder;
};

const sendAiManseryeokResultEmail = async ({ order, job }) => {
  const resend = getResendConfig();
  if (!resend.apiKey || !resend.fromEmail) throw new Error('Resend is not configured');
  if (!order?.customerEmail) throw new Error('customer email is missing');
  if (!job?.analysis?.report?.summary) throw new Error('manseryeok analysis result is missing');

  const resultPageUrl = buildAiManseryeokResultPageUrl(job.id);
  const headline = String(job.analysis.report.headline ?? '').trim() || 'AI 만세력 사주팔자 정밀분석 결과';

  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resend.fromEmail,
      to: [order.customerEmail],
      subject: '[ManyTool] AI 만세력 사주팔자 정밀분석 결과가 준비되었습니다',
      html: `
        <div style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#0f172a;">
          <h1 style="font-size:22px;margin:0 0 16px;">AI 만세력 사주팔자 정밀분석 결과가 준비되었습니다</h1>
          <p style="margin:0 0 8px;"><strong>핵심 요약</strong> ${headline}</p>
          <p style="margin:0 0 14px;"><strong>해석 요약:</strong> ${job.analysis.report.summary}</p>
          <p style="margin:0 0 20px;">아래 버튼으로 이동하면 만세력 구성, 오행 분포, 해석 일관성, 재물운/관계운/직업 흐름까지 다시 확인할 수 있습니다.</p>
          <p style="margin:0 0 22px;">
            <a href="${resultPageUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">결과 페이지 열기</a>
          </p>
          <p style="margin:0 0 6px;color:#475569;">결과 페이지 URL</p>
          <p style="margin:0;color:#334155;word-break:break-all;">${resultPageUrl}</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`resend email send failed: ${response.status} ${reason}`);
  }

  return response.json();
};

const sendAiManseryeokResultEmailIfNeeded = async ({ order, job }) => {
  if (!order || !job?.analysis?.report?.summary) return order;
  if (!order.customerEmail || order.aiManseryeokEmailStatus === 'sent') return order;

  const emailPayload = await sendAiManseryeokResultEmail({ order, job });
  const nextOrder = {
    ...order,
    aiManseryeokEmailStatus: 'sent',
    aiManseryeokEmailSentAt: new Date().toISOString(),
    aiManseryeokEmailError: null,
    aiManseryeokEmailPayload: emailPayload
  };
  db.orders.set(order.id, nextOrder);
  return nextOrder;
};

const sendNamePremiumResultEmail = async ({ order, currentName, recommendations }) => {
  const resend = getResendConfig();
  if (!resend.apiKey || !resend.fromEmail) throw new Error('Resend is not configured');
  if (!order?.customerEmail) throw new Error('customer email is missing');
  if (!Array.isArray(recommendations) || recommendations.length === 0) throw new Error('name premium recommendations are missing');

  const resultUrl = buildNamePremiumResultUrl(order.id);
  const currentSummary = currentName
    ? `<p style="margin:0 0 14px;"><strong>현재 이름 풀이</strong><br />${currentName}</p>`
    : '';
  const recommendationHtml = recommendations
    .slice(0, 6)
    .map((item, index) => {
      const reading = (item.parts ?? []).map((part) => part.meta?.reading).filter(Boolean).join('') || (item.given ?? []).join('');
      const meaning = (item.parts ?? []).map((part) => part.meta?.meaning).filter(Boolean).join(', ');
      return `
        <li style="margin:0 0 12px;">
          <strong>추천 ${index + 1}. ${reading} (${(item.given ?? []).join('')})</strong><br />
          점수 ${item.score} / ${item.grade}<br />
          ${meaning || '이름 의미 데이터 연결 중'}
        </li>
      `;
    })
    .join('');

  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resend.fromEmail,
      to: [order.customerEmail],
      subject: '[ManyTool] 프리미엄 이름분석 결과가 준비되었습니다',
      html: `
        <div style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#0f172a;">
          <h1 style="font-size:22px;margin:0 0 16px;">프리미엄 이름분석 결과가 준비되었습니다</h1>
          ${currentSummary}
          <p style="margin:0 0 8px;"><strong>개명추천 요약</strong></p>
          <ol style="padding-left:18px;margin:0 0 20px;">${recommendationHtml}</ol>
          <p style="margin:0 0 20px;">아래 버튼으로 돌아오면 이름풀이, 수리오행, AI 도사 평가, 추천 이유 전체를 다시 확인할 수 있습니다.</p>
          <p style="margin:0 0 22px;">
            <a href="${resultUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">프리미엄 결과 다시 보기</a>
          </p>
          <p style="margin:0;color:#334155;word-break:break-all;">${resultUrl}</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`resend email send failed: ${response.status} ${reason}`);
  }

  return response.json();
};

const sendNamePremiumResultEmailIfNeeded = async ({ order, currentName, recommendations }) => {
  if (!order || !Array.isArray(recommendations) || recommendations.length === 0) return order;
  if (!order.customerEmail || order.aiNamePremiumEmailStatus === 'sent') return order;

  const emailPayload = await sendNamePremiumResultEmail({ order, currentName, recommendations });
  const nextOrder = {
    ...order,
    aiNamePremiumEmailStatus: 'sent',
    aiNamePremiumEmailSentAt: new Date().toISOString(),
    aiNamePremiumEmailError: null,
    aiNamePremiumEmailPayload: emailPayload
  };
  db.orders.set(order.id, nextOrder);
  return nextOrder;
};

const createPolarCheckout = async ({ order, productId, clientSessionId = null }) => {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN is missing');
  }
  if (!productId) {
    throw new Error(`Polar product id is missing for productType=${order.productType}`);
  }
  const successUrl = buildOrderReturnUrl(
    order.successUrl ?? process.env.POLAR_SUCCESS_URL ?? process.env.PUBLIC_WEB_BASE_URL ?? null,
    order.id
  );
  const returnUrl = buildOrderReturnUrl(
    order.returnUrl ?? process.env.POLAR_RETURN_URL ?? process.env.PUBLIC_WEB_BASE_URL ?? null,
    order.id
  );

  const payload = {
    products: [productId],
    metadata: {
      order_id: order.id,
      product_type: order.productType
    }
  };
  if (order.productType === 'detail_page' && Number.isFinite(Number(order.amount)) && Number(order.amount) > 0) {
    payload.amount = Math.round(Number(order.amount));
    payload.metadata.page_count = String(order?.detailPageRequest?.pageCount ?? '');
  }
  if (order.productType === 'donation' && Number.isFinite(Number(order.amount)) && Number(order.amount) > 0) {
    payload.amount = Math.round(Number(order.amount));
  }
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

const autoRefundOrder = async (order, reason = 'service_disruption') => {
  if (!order || order.paymentMode !== 'polar') {
    return {
      order,
      attempted: false,
      refunded: false,
      refundStatus: order?.refundStatus ?? null
    };
  }
  if (order.status !== 'paid') {
    return {
      order,
      attempted: false,
      refunded: false,
      refundStatus: order.refundStatus ?? null
    };
  }
  if (order.status === 'refunded' || order.refundStatus === 'succeeded') {
    return {
      order,
      attempted: false,
      refunded: true,
      refundStatus: order.refundStatus ?? 'succeeded'
    };
  }

  const refund = await createPolarRefund({ order, reason });
  const refundStatus = String(refund?.status ?? 'pending').toLowerCase();
  const nextOrder = {
    ...order,
    status: refundStatus === 'succeeded' ? 'refunded' : order.status,
    refundedAt: refundStatus === 'succeeded' ? new Date().toISOString() : order.refundedAt ?? null,
    refundId: refund?.id ?? null,
    refundStatus,
    refundPayload: refund,
    refundError: null
  };
  db.orders.set(order.id, nextOrder);
  return {
    order: nextOrder,
    attempted: true,
    refunded: refundStatus === 'succeeded',
    refundStatus
  };
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
      customerEmail: order.customerEmail ?? resolveCustomerEmail(checkout),
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
  const { photoId, toolType = 'id_photo', outfitType = 'current', faceHint = null, provider = null } = req.body ?? {};
  if (!photoId) {
    return res.status(400).json({ error: 'photoId is required' });
  }
  const requestedProvider = normalizeRequestedProvider(provider);
  if (provider != null && !requestedProvider) {
    return res.status(400).json({ error: 'invalid provider' });
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
      cacheKey: photoId,
      requestedProvider
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
      pipelineReport: job.pipelineReport,
      requestedProvider: requestedProvider ?? getImageProvider(),
      resolvedProvider: resolveImageProvider(requestedProvider)
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.originalUrl = `/files/originals/${path.basename(photo.originalPath)}`;
    await persistJobSnapshot(job);
    return res.status(500).json({ error: `generate failed: ${error.message}`, jobId });
  }
});

app.post('/ai-image-generator/generate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'image file is required (field name: image)' });
    }
    if (!String(req.file.mimetype).startsWith('image/')) {
      return res.status(400).json({ error: 'only image uploads are allowed' });
    }
    const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim().toLowerCase() : '';
    if (!['figure', 'body', 'travel', 'europe', 'proofshot', 'kakao', 'instagram', 'hanbok', 'kimono', 'outfit', 'streamer', 'pethuman', 'hairstyle', 'interior', 'animation', 'free'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be figure, body, travel, europe, proofshot, kakao, instagram, hanbok, kimono, outfit, streamer, pethuman, hairstyle, interior, animation, or free' });
    }
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().toLowerCase() : 'openai';
    if (!['openai', 'xai'].includes(provider)) {
      return res.status(400).json({ error: 'provider must be openai or xai' });
    }
    if (provider === 'openai' && !process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
    }
    if (provider === 'xai' && !process.env.XAI_API_KEY?.trim()) {
      return res.status(503).json({ error: 'XAI_API_KEY is not configured' });
    }
    const userInput = sanitizeUserInput(req.body?.userInput ?? '');
    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    let order = null;

    if (orderId) {
      order = await refreshOrderFromPolarIfNeeded(db.orders.get(orderId));
      if (!order) {
        return res.status(404).json({ error: 'order not found' });
      }
      if (order.status !== 'paid') {
        return res.status(402).json({ error: 'payment required', status: order.status });
      }
    }

    const generationId = uuidv4();
    const job = {
      id: generationId,
      orderId: order?.id ?? null,
      provider,
      mode,
      userInput,
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      imageUrl: null,
      prompt: null,
      revisedPrompt: null,
      error: null
    };
    db.aiImageJobs.set(generationId, job);

    void (async () => {
      job.status = 'processing';
      job.startedAt = new Date().toISOString();
      try {
        const generated = await generateAiImage({
          id: generationId,
          provider,
          mode,
          userInput,
          imageBuffer: req.file.buffer,
          mimeType: req.file.mimetype,
          originalFilename: req.file.originalname,
          outputDir: generatedDir
        });
        job.status = 'done';
        job.completedAt = new Date().toISOString();
        job.provider = generated.provider;
        job.userInput = generated.userInput;
        job.prompt = generated.prompt;
        job.revisedPrompt = generated.revisedPrompt;
        job.imageUrl = `/files/generated/${generated.fileName}`;
        if (order?.id) {
          const nextOrder = {
            ...order,
            aiImageJobId: generationId,
            aiImageEmailStatus: order.aiImageEmailStatus === 'sent' ? 'sent' : 'pending',
            aiImageEmailError: null
          };
          db.orders.set(order.id, nextOrder);
          await sendAiImageResultEmailIfNeeded({ order: nextOrder, job });
        }
      } catch (error) {
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        job.error = error instanceof Error ? error.message : 'ai image generation failed';
        if (order?.id) {
          const currentOrder = db.orders.get(order.id) ?? order;
          db.orders.set(order.id, {
            ...currentOrder,
            aiImageJobId: generationId,
            aiImageEmailStatus: 'failed',
            aiImageEmailError: job.error
          });
        }
      }
    })();

    return res.status(202).json({
      ok: true,
      jobId: generationId,
      provider,
      mode,
      status: 'queued'
    });
  } catch (error) {
    return res.status(500).json({ error: `ai image generate failed: ${error.message}` });
  }
});

app.post('/ai-calorie-calculator/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'image file is required (field name: image)' });
    }
    if (!String(req.file.mimetype).startsWith('image/')) {
      return res.status(400).json({ error: 'only image uploads are allowed' });
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const analysis = await analyzeMealCalories({ imageDataUrl });

    return res.json({
      ok: true,
      analysis
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'analysis failed' });
  }
});

app.post('/ai-personal-color/analyze', upload.single('image'), async (req, res) => {
  let job = null;
  let orderIdForError = null;
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'image file is required (field name: image)' });
    }
    if (!String(req.file.mimetype).startsWith('image/')) {
      return res.status(400).json({ error: 'only image uploads are allowed' });
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const order = await ensureAiPersonalColorOrder(orderId);
    orderIdForError = order.id;
    const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const jobId = uuidv4();
    job = {
      id: jobId,
      orderId: order.id,
      status: 'processing',
      notes,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      analysis: null,
      error: null
    };
    db.aiPersonalColorJobs.set(jobId, job);

    const analysis = await analyzePersonalColor({ imageDataUrl, notes });
    job.status = 'done';
    job.completedAt = new Date().toISOString();
    job.analysis = analysis;

    const nextOrder = {
      ...order,
      aiPersonalColorJobId: jobId,
      aiPersonalColorEmailStatus: order.aiPersonalColorEmailStatus === 'sent' ? 'sent' : 'pending',
      aiPersonalColorEmailError: null
    };
    db.orders.set(order.id, nextOrder);
    try {
      await sendAiPersonalColorResultEmailIfNeeded({ order: nextOrder, job });
    } catch (emailError) {
      db.orders.set(order.id, {
        ...nextOrder,
        aiPersonalColorEmailStatus: 'failed',
        aiPersonalColorEmailError: emailError instanceof Error ? emailError.message : 'email send failed'
      });
    }

    return res.json({
      ok: true,
      job: {
        id: job.id,
        orderId: job.orderId,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        analysis: job.analysis
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'analysis failed';
    if (job) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = message;
    }
    if (orderIdForError) {
      const currentOrder = db.orders.get(orderIdForError);
      if (currentOrder) {
        db.orders.set(orderIdForError, {
          ...currentOrder,
          aiPersonalColorJobId: job?.id ?? currentOrder.aiPersonalColorJobId ?? null,
          aiPersonalColorEmailStatus: currentOrder.aiPersonalColorEmailStatus ?? 'failed',
          aiPersonalColorEmailError: message
        });
      }
    }
    if (message === 'order not found') return res.status(404).json({ error: message });
    if (message === 'invalid order product type') return res.status(400).json({ error: message });
    if (message === 'payment required') return res.status(402).json({ error: message });
    if (message === 'this order has already been used') return res.status(409).json({ error: message });
    return res.status(500).json({ error: message });
  }
});

app.post('/ai-manseryeok/analyze', async (req, res) => {
  let job = null;
  let orderIdForError = null;
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const birthDate = typeof req.body?.birthDate === 'string' ? req.body.birthDate.trim() : '';
    const birthTime = typeof req.body?.birthTime === 'string' ? req.body.birthTime.trim() : '';
    const calendarType = req.body?.calendarType === 'lunar' ? 'lunar' : 'solar';
    const isLeapMonth = Boolean(req.body?.isLeapMonth);
    const timeUnknown = Boolean(req.body?.timeUnknown);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!birthDate) {
      return res.status(400).json({ error: 'birthDate is required' });
    }
    if (!timeUnknown && !birthTime) {
      return res.status(400).json({ error: 'birthTime is required when timeUnknown is false' });
    }

    const order = await ensureAiManseryeokOrder(orderId);
    orderIdForError = order.id;

    const jobId = uuidv4();
    job = {
      id: jobId,
      orderId: order.id,
      status: 'processing',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      analysis: null,
      error: null
    };
    db.aiManseryeokJobs.set(jobId, job);

    const analysis = await analyzeSaju({
      name,
      birthDate,
      birthTime,
      calendarType,
      isLeapMonth,
      timeUnknown
    });

    job.status = 'done';
    job.completedAt = new Date().toISOString();
    job.analysis = analysis;
    await persistAiManseryeokJob(job);

    const nextOrder = {
      ...order,
      aiManseryeokJobId: jobId,
      aiManseryeokEmailStatus: order.aiManseryeokEmailStatus === 'sent' ? 'sent' : 'pending',
      aiManseryeokEmailError: null
    };
    db.orders.set(order.id, nextOrder);

    try {
      await sendAiManseryeokResultEmailIfNeeded({ order: nextOrder, job });
    } catch (emailError) {
      db.orders.set(order.id, {
        ...nextOrder,
        aiManseryeokEmailStatus: 'failed',
        aiManseryeokEmailError: emailError instanceof Error ? emailError.message : 'email send failed'
      });
    }

    return res.json({
      ok: true,
      job: {
        id: job.id,
        orderId: job.orderId,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        analysis: job.analysis
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'analysis failed';
    if (job) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = message;
      await persistAiManseryeokJob(job);
    }
    if (orderIdForError) {
      const currentOrder = db.orders.get(orderIdForError);
      if (currentOrder) {
        db.orders.set(orderIdForError, {
          ...currentOrder,
          aiManseryeokJobId: job?.id ?? currentOrder.aiManseryeokJobId ?? null,
          aiManseryeokEmailStatus: currentOrder.aiManseryeokEmailStatus ?? 'failed',
          aiManseryeokEmailError: message
        });
      }
    }
    if (message === 'order not found') return res.status(404).json({ error: message });
    if (message === 'invalid order product type') return res.status(400).json({ error: message });
    if (message === 'payment required') return res.status(402).json({ error: message });
    if (message === 'this order has already been used') return res.status(409).json({ error: message });
    return res.status(500).json({ error: message });
  }
});

app.post('/name-premium/analyze', async (req, res) => {
  try {
    const order = await ensureNamePremiumOrder(req.body?.orderId ?? null, req.body?.input ?? null);
    const validation = validateNamingInput({
      surname: req.body?.surname,
      given: req.body?.given
    });

    if (!validation.valid) {
      return res.status(400).json(buildFallback({ error: validation.error }));
    }

    const { surname, given } = validation.value;
    const dataset = await getNamingDataset();
    const chars = [surname, ...given];
    const missingStrokeChars = chars.filter((char) => !dataset.strokeMap.has(char));

    if (missingStrokeChars.length > 0) {
      return res.status(404).json(buildFallback({
        error: '획수 데이터 없음',
        suggestion: getMissingStrokeSuggestion(chars, dataset.strokeMap, dataset.metaMap)
      }));
    }

    const surnameStroke = dataset.strokeMap.get(surname);
    const givenStrokes = given.map((char) => dataset.strokeMap.get(char));
    const grids = calculateFiveGrid({ surnameStroke, givenStrokes });
    const scoreResult = scoreFiveGrid(grids, dataset.luckMap);
    const report = buildNameExplanation({
      surname,
      given,
      grids,
      scoreResult,
      metaMap: dataset.metaMap
    });

    return res.json({
      ok: true,
      orderLock: order.namePremiumLock ?? null,
      input: {
        surname,
        given
      },
      grids,
      score: scoreResult.score,
      grade: scoreResult.grade,
      details: scoreResult.details,
      explanation: report.summary,
      report,
      parts: chars.map((char) => ({
        hanja: char,
        strokes: dataset.strokeMap.get(char) ?? null,
        meta: dataset.metaMap.get(char) ?? dataset.surnameMap.get(char) ?? null
      }))
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'order not found') {
      return res.status(404).json(buildFallback({ error: error.message }));
    }
    if (error instanceof Error && error.message === 'invalid order product type') {
      return res.status(400).json(buildFallback({ error: error.message }));
    }
    if (error instanceof Error && error.message === 'payment required') {
      return res.status(402).json(buildFallback({ error: error.message }));
    }
    if (error instanceof Error && error.message === 'name premium input changed') {
      return res.status(409).json(buildFallback({ error: 'paid input changed. checkout is required again.' }));
    }
    return res.status(500).json(buildFallback({
      error: error instanceof Error ? error.message : 'name premium analyze failed'
    }));
  }
});

app.post('/name-premium/recommend', async (req, res) => {
  try {
    const order = await ensureNamePremiumOrder(req.body?.orderId ?? null, req.body?.input ?? null);
    const validation = validateRecommendInput({
      surname: req.body?.surname,
      topK: req.body?.topK,
      givenLength: req.body?.givenLength
    });

    if (!validation.valid) {
      return res.status(400).json(buildFallback({ error: validation.error }));
    }

    const { surname, topK, givenLength } = validation.value;
    const dataset = await getNamingDataset();
    const surnameStroke = dataset.strokeMap.get(surname);

    if (!surnameStroke) {
      return res.status(404).json(buildFallback({
        error: '성씨 획수 데이터 없음',
        suggestion: getMissingStrokeSuggestion([surname], dataset.strokeMap, dataset.metaMap)
      }));
    }

    const recommendations = recommendNames({
      surname,
      surnameStroke,
      givenLength,
      topK,
      pool: dataset.pool,
      luckMap: dataset.luckMap,
      metaMap: dataset.metaMap
    });

    if (recommendations.length === 0) {
      return res.status(404).json(buildFallback({
        error: '추천 후보 없음',
        suggestion: 'name_pool.csv 또는 strokes.csv 데이터를 확장해 주세요.'
      }));
    }

    let mailedOrder = order;
    try {
      mailedOrder = await sendNamePremiumResultEmailIfNeeded({
        order,
        currentName: typeof req.body?.currentName === 'string' ? req.body.currentName.trim() : null,
        recommendations
      });
    } catch (emailError) {
      mailedOrder = {
        ...order,
        aiNamePremiumEmailStatus: 'failed',
        aiNamePremiumEmailError: emailError instanceof Error ? emailError.message : 'email send failed'
      };
      db.orders.set(order.id, mailedOrder);
    }

    return res.json({
      ok: true,
      orderLock: mailedOrder.namePremiumLock ?? null,
      input: {
        surname,
        topK,
        givenLength
      },
      recommendations,
      emailStatus: mailedOrder.aiNamePremiumEmailStatus ?? null,
      emailError: mailedOrder.aiNamePremiumEmailError ?? null,
      notices: [
        '현재는 단성 기준 추천만 지원합니다.',
        'luck81.csv의 31~81 구간은 seed 상태라 점수가 보수적으로 계산될 수 있습니다.'
      ]
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'order not found') {
      return res.status(404).json(buildFallback({ error: error.message }));
    }
    if (error instanceof Error && error.message === 'invalid order product type') {
      return res.status(400).json(buildFallback({ error: error.message }));
    }
    if (error instanceof Error && error.message === 'payment required') {
      return res.status(402).json(buildFallback({ error: error.message }));
    }
    if (error instanceof Error && error.message === 'name premium input changed') {
      return res.status(409).json(buildFallback({ error: 'paid input changed. checkout is required again.' }));
    }
    return res.status(500).json(buildFallback({
      error: error instanceof Error ? error.message : 'name premium recommend failed'
    }));
  }
});

app.get('/ai-image-generator/job/:id', (req, res) => {
  const job = db.aiImageJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'ai image job not found' });
  }
  return res.json({
    ok: true,
    job: getAiImageJobPayload(job)
  });
});

app.get('/ai-personal-color/job/:id', (req, res) => {
  const job = db.aiPersonalColorJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'personal color job not found' });
  }
  return res.json({
    ok: true,
    job: {
      id: job.id,
      orderId: job.orderId,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      completedAt: job.completedAt ?? null,
      analysis: job.analysis ?? null,
      error: job.error ?? null
    }
  });
});

app.get('/ai-manseryeok/job/:id', async (req, res) => {
  let job = db.aiManseryeokJobs.get(req.params.id);
  if (!job) {
    job = await loadPersistedAiManseryeokJob(req.params.id);
    if (job) db.aiManseryeokJobs.set(job.id, job);
  }
  if (!job) {
    return res.status(404).json({ error: 'manseryeok job not found or expired' });
  }
  if (isAiManseryeokJobExpired(job)) {
    db.aiManseryeokJobs.delete(job.id);
    await fs.rm(getAiManseryeokJobPath(job.id), { force: true }).catch(() => {});
    return res.status(410).json({ error: 'manseryeok job expired' });
  }
  return res.json({
    ok: true,
    job: {
      id: job.id,
      orderId: job.orderId,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      completedAt: job.completedAt ?? null,
      analysis: job.analysis ?? null,
      error: job.error ?? null
    }
  });
});

app.post('/commerce/detail-page/generate', async (req, res) => {
  console.log('detail-page request', {
    productName: req.body?.productName ?? '',
    pageCount: req.body?.pageCount ?? '',
    imageCount: Array.isArray(req.body?.images) ? req.body.images.length : 0,
    origin: req.headers.origin ?? '',
    userAgent: req.headers['user-agent'] ?? ''
  });

  const {
    productName = '',
    price = '',
    audience = '',
    sellingPoints = '',
    prompt = '',
    theme = 'premium',
    pageCount = 7,
    pricing = null,
    images = []
  } = req.body ?? {};

  if (!String(productName).trim()) {
    return res.status(400).json({ error: 'productName is required' });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'at least one product image is required' });
  }

  try {
    const result = await generateCommerceDetailPage({
      productName: String(productName).trim(),
      price: String(price ?? '').trim(),
      audience: String(audience ?? '').trim(),
      sellingPoints: String(sellingPoints ?? '').trim(),
      prompt: String(prompt ?? '').trim(),
      theme: String(theme ?? 'premium').trim(),
      pageCount: Math.max(5, Math.min(20, Math.round(Number(pageCount) || 7))),
      pricing: pricing && typeof pricing === 'object' ? pricing : null,
      images
    });

    return res.status(201).json({
      ok: true,
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
      result
    });
  } catch (error) {
    const message = error?.message ?? 'detail page generation failed';
    const status = message.includes('OPENAI_API_KEY is missing') ? 503 : 500;
    console.error('[commerce/detail-page/generate] generation failed:', error);
    return res.status(status).json({
      ok: false,
      error: {
        code: status === 503 ? 'OPENAI_NOT_CONFIGURED' : 'DETAIL_PAGE_GENERATION_FAILED',
        message
      }
    });
  }
});

app.post('/order/:id/detail-page', async (req, res) => {
  const order = await refreshOrderFromPolarIfNeeded(db.orders.get(req.params.id));
  if (!order) return res.status(404).json({ error: 'order not found' });
  if (order.productType !== 'detail_page') {
    return res.status(400).json({ error: 'order is not for detail_page' });
  }
  if (order.status !== 'paid') {
    return res.status(402).json({ error: 'payment required', status: order.status });
  }
  if (order.detailPageResult) {
    const mailedOrder = await sendDetailPageResultEmailIfNeeded(order);
    return res.json({
      ok: true,
      orderId: mailedOrder.id,
      status: mailedOrder.status,
      result: mailedOrder.detailPageResult,
      request: mailedOrder.detailPageRequest ?? null,
      emailStatus: mailedOrder.emailStatus ?? null
    });
  }

  const request = order.detailPageRequest;
  if (!request?.productName || !Array.isArray(request.images) || request.images.length === 0) {
    return res.status(400).json({ error: 'detail page request payload is missing' });
  }

  try {
    const result = await generateCommerceDetailPage({
      productName: String(request.productName).trim(),
      price: String(request.price ?? '').trim(),
      audience: String(request.audience ?? '').trim(),
      sellingPoints: String(request.sellingPoints ?? '').trim(),
      prompt: String(request.prompt ?? '').trim(),
      theme: String(request.theme ?? 'premium').trim(),
      pageCount: Math.max(5, Math.min(20, Math.round(Number(request.pageCount) || 7))),
      pricing: request.pricing && typeof request.pricing === 'object' ? request.pricing : null,
      images: request.images
    });

    const nextOrder = {
      ...order,
      detailPageGenerationStatus: 'succeeded',
      detailPageGenerationError: null,
      detailPageResult: result,
      detailPageGeneratedAt: new Date().toISOString()
    };
    db.orders.set(order.id, nextOrder);
    const mailedOrder = await sendDetailPageResultEmailIfNeeded(nextOrder);

    return res.json({
      ok: true,
      orderId: mailedOrder.id,
      status: mailedOrder.status,
      result,
      request: mailedOrder.detailPageRequest ?? null,
      emailStatus: mailedOrder.emailStatus ?? null
    });
  } catch (error) {
    const message = error?.message ?? 'detail page generation failed';
    let failedOrder = {
      ...order,
      detailPageGenerationStatus: 'failed',
      detailPageGenerationError: message
    };
    db.orders.set(order.id, failedOrder);

    try {
      const refund = await autoRefundOrder(failedOrder, 'service_disruption');
      failedOrder = {
        ...refund.order,
        detailPageGenerationStatus: 'failed',
        detailPageGenerationError: message
      };
      db.orders.set(order.id, failedOrder);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'DETAIL_PAGE_GENERATION_FAILED',
          message
        },
        orderId: order.id,
        refundStatus: failedOrder.refundStatus ?? null,
        refunded: failedOrder.status === 'refunded'
      });
    } catch (refundError) {
      const refundMessage = refundError?.message ?? 'refund failed';
      failedOrder = {
        ...failedOrder,
        refundStatus: 'failed',
        refundError: refundMessage
      };
      db.orders.set(order.id, failedOrder);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'DETAIL_PAGE_GENERATION_FAILED',
          message
        },
        orderId: order.id,
        refundStatus: 'failed',
        refundError: refundMessage
      });
    }
  }
});

app.get('/job/:id', async (req, res) => {
  const job = db.jobs.get(req.params.id) ?? await loadPersistedJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  return res.json(getJobPayload(job));
});

app.get('/jobs/summary', async (req, res) => {
  const limit = Math.max(1, Math.min(24, Number(req.query.limit ?? 6) || 6));
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
  const flaggedOnly = String(req.query.flagged ?? '').toLowerCase() === 'true';
  const fallbackOnly = String(req.query.fallbackOnly ?? '').toLowerCase() === 'true';
  const toolFilter = typeof req.query.toolType === 'string' ? req.query.toolType.trim().toLowerCase() : '';
  const providerFilter = typeof req.query.provider === 'string' ? req.query.provider.trim().toLowerCase() : '';
  const sinceHours = Number(req.query.sinceHours ?? 0) || 0;

  const allItems = await loadAllJobSummaries();
  const filtered = applyJobSummaryFilters(allItems, {
    statusFilter,
    flaggedOnly,
    fallbackOnly,
    toolFilter,
    providerFilter,
    sinceHours
  });
  const flagged = filtered.filter((item) => Array.isArray(item.flags) && item.flags.length > 0);

  const byTool = new Map();
  const byProvider = new Map();
  filtered.forEach((item) => {
    const toolKey = item.toolType ?? 'unknown';
    const providerKey = item.resolvedProvider ?? item.requestedProvider ?? 'unknown';
    if (!byTool.has(toolKey)) {
      byTool.set(toolKey, { key: toolKey, total: 0, failed: 0, flagged: 0, fallback: 0, avgQualityScore: 0, avgIdentityScore: 0 });
    }
    if (!byProvider.has(providerKey)) {
      byProvider.set(providerKey, { key: providerKey, total: 0, failed: 0, flagged: 0, fallback: 0, avgQualityScore: 0, avgIdentityScore: 0 });
    }

    const toolEntry = byTool.get(toolKey);
    const providerEntry = byProvider.get(providerKey);
    const isFlagged = Array.isArray(item.flags) && item.flags.length > 0;
    const isFailed = item.status === 'failed';
    const isFallback = item.flags.includes('provider_fallback');
    toolEntry.total += 1;
    providerEntry.total += 1;
    if (isFlagged) {
      toolEntry.flagged += 1;
      providerEntry.flagged += 1;
    }
    if (isFailed) {
      toolEntry.failed += 1;
      providerEntry.failed += 1;
    }
    if (isFallback) {
      toolEntry.fallback += 1;
      providerEntry.fallback += 1;
    }
    toolEntry.avgQualityScore += Number(item.qualityScore ?? 0);
    toolEntry.avgIdentityScore += Number(item.identityScore ?? 0);
    providerEntry.avgQualityScore += Number(item.qualityScore ?? 0);
    providerEntry.avgIdentityScore += Number(item.identityScore ?? 0);
  });

  const finalizeAggregateRows = (rows) => [...rows.values()]
    .map((entry) => ({
      ...entry,
      avgQualityScore: entry.total ? Math.round((entry.avgQualityScore / entry.total) * 10) / 10 : 0,
      avgIdentityScore: entry.total ? Math.round((entry.avgIdentityScore / entry.total) * 10) / 10 : 0
    }))
    .sort((a, b) => b.flagged - a.flagged || b.failed - a.failed || b.total - a.total)
    .slice(0, limit);

  const qualityReasons = summarizeIssueCounts(flagged, (item) => item.qualityIssueCodes ?? []).slice(0, 6);
  const identityReasons = summarizeIssueCounts(flagged, (item) => [
    ...(item.identitySummary?.rejectedVariants ?? []).map((variant) => `rejected ${variant}`),
    ...(item.identitySummary?.regeneratedVariants ?? []).map((variant) => `regenerated ${variant}`)
  ]).slice(0, 6);

  return res.json({
    totals: {
      jobs: filtered.length,
      flagged: flagged.length,
      failed: filtered.filter((item) => item.status === 'failed').length,
      fallback: filtered.filter((item) => item.flags.includes('provider_fallback')).length,
      avgQualityScore: filtered.length
        ? Math.round((filtered.reduce((sum, item) => sum + Number(item.qualityScore ?? 0), 0) / filtered.length) * 10) / 10
        : 0,
      avgIdentityScore: filtered.length
        ? Math.round((filtered.reduce((sum, item) => sum + Number(item.identityScore ?? 0), 0) / filtered.length) * 10) / 10
        : 0
    },
    topTools: finalizeAggregateRows(byTool),
    topProviders: finalizeAggregateRows(byProvider),
    topQualityReasons: qualityReasons,
    topIdentityReasons: identityReasons,
    latestFlagged: flagged.slice(0, limit),
    filters: {
      limit,
      status: statusFilter || null,
      flagged: flaggedOnly,
      fallbackOnly,
      toolType: toolFilter || null,
      provider: providerFilter || null,
      sinceHours: sinceHours > 0 ? sinceHours : null
    }
  });
});

app.get('/jobs/recent', async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20) || 20));
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
  const flaggedOnly = String(req.query.flagged ?? '').toLowerCase() === 'true';
  const fallbackOnly = String(req.query.fallbackOnly ?? '').toLowerCase() === 'true';
  const toolFilter = typeof req.query.toolType === 'string' ? req.query.toolType.trim().toLowerCase() : '';
  const providerFilter = typeof req.query.provider === 'string' ? req.query.provider.trim().toLowerCase() : '';
  const sinceHours = Number(req.query.sinceHours ?? 0) || 0;

  let items = await loadAllJobSummaries();
  items = applyJobSummaryFilters(items, {
    statusFilter,
    flaggedOnly,
    fallbackOnly,
    toolFilter,
    providerFilter,
    sinceHours
  });

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
      fallbackOnly,
      toolType: toolFilter || null,
      provider: providerFilter || null,
      sinceHours: sinceHours > 0 ? sinceHours : null
    }
  });
});

app.get('/jobs/alerts', async (req, res) => {
  const sinceHours = Number(req.query.sinceHours ?? 0) || 0;
  const fallbackOnly = String(req.query.fallbackOnly ?? '').toLowerCase() === 'true';
  const providerFilter = typeof req.query.provider === 'string' ? req.query.provider.trim().toLowerCase() : '';
  const memoryJobs = Array.from(db.jobs.values());
  const persistedJobs = await loadPersistedRecentJobs();
  const deduped = new Map();
  [...persistedJobs, ...memoryJobs].forEach((item) => {
    if (item?.id) deduped.set(item.id, item);
  });

  const summaries = Array.from(deduped.values())
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map(toJobSummary);

  const filteredSummaries = applySinceHoursFilter(summaries, sinceHours);

  const flagged = filteredSummaries.filter((item) => {
    if (!Array.isArray(item.flags) || !item.flags.length) return false;
    if (providerFilter && String(item.resolvedProvider ?? item.provider ?? '').toLowerCase() !== providerFilter) return false;
    if (fallbackOnly) return item.flags.includes('provider_fallback');
    return true;
  });
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
    totalJobs: filteredSummaries.length,
    totalFlagged: flagged.length,
    latestFlagged: flagged.slice(0, 12),
    toolBreakdown,
    providerBreakdown,
    sinceHours: sinceHours > 0 ? sinceHours : null,
    fallbackOnly,
    provider: providerFilter || null
  });
});

app.post('/checkout', async (req, res) => {
  const {
    productType = 'add2',
    amount = 0,
    currency = 'KRW',
    customerEmail = null,
    jobId = null,
    provider = 'polar',
    clientSessionId = null,
    successUrl = null,
    returnUrl = null,
    detailPageRequest = null
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
    videoJobId: null,
    aiImageJobId: null,
    aiPersonalColorJobId: null,
    aiManseryeokJobId: null,
    provider,
    status: paymentMode === 'mock' ? 'paid' : 'pending',
    paymentMode,
    polarCheckoutId: null,
    checkoutUrl: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
    refundedAt: null,
    successUrl: typeof successUrl === 'string' ? successUrl.trim() || null : null,
    returnUrl: typeof returnUrl === 'string' ? returnUrl.trim() || null : null,
    detailPageRequest: productType === 'detail_page' && detailPageRequest && typeof detailPageRequest === 'object'
      ? detailPageRequest
      : null,
    detailPageResult: null,
    detailPageGeneratedAt: null,
    detailPageGenerationStatus: 'pending',
    detailPageGenerationError: null,
    customerEmail: typeof customerEmail === 'string' ? customerEmail.trim() || null : null,
    emailStatus: null,
    emailSentAt: null,
    emailError: null,
    emailPayload: null,
    aiImageEmailStatus: null,
    aiImageEmailSentAt: null,
    aiImageEmailError: null,
    aiImageEmailPayload: null,
    aiPersonalColorEmailStatus: null,
    aiPersonalColorEmailSentAt: null,
    aiPersonalColorEmailError: null,
    aiPersonalColorEmailPayload: null,
    aiManseryeokEmailStatus: null,
    aiManseryeokEmailSentAt: null,
    aiManseryeokEmailError: null,
    aiManseryeokEmailPayload: null,
    aiNamePremiumEmailStatus: null,
    aiNamePremiumEmailSentAt: null,
    aiNamePremiumEmailError: null,
    aiNamePremiumEmailPayload: null,
    namePremiumLock: null,
    namePremiumLockedAt: null,
    refundId: null,
    refundStatus: null,
    refundPayload: null,
    refundError: null
  };
  db.orders.set(orderId, order);

  try {
    if (paymentMode === 'polar') {
      const productId = productType === 'detail_page'
        ? getDetailPageTierProductId(order.detailPageRequest?.pageCount)
        : getPolarProductIdByType(productType);
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
      amount: order.amount,
      currency: order.currency,
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
    customerEmail: current.customerEmail ?? resolveCustomerEmail(payload),
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
    return res.status(413).json({ error: `file too large (max ${Math.round(VIDEO_MAX_BYTES / (1024 * 1024))}MB for video uploads)` });
  }
  return res.status(500).json({ error: 'internal server error' });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[manytool-node-api] listening on http://127.0.0.1:${port}`);
});
