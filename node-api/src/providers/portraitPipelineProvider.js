import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getToolPreset, VARIANT_PROFILES } from './pipelineConfig.js';
import { alignFaceStage, detectFaceStage } from './stages/faceStage.js';
import { facePoseCorrectionStage } from './stages/poseStage.js';
import { faceRelightStage } from './stages/relightStage.js';
import { createFaceIdentityReference, calculateFaceIdentityScore } from './stages/identityStage.js';
import { backgroundRemovalStage, backgroundReplaceStage, backgroundToneStage } from './stages/backgroundStage.js';
import { faceRetouchStage, hairCleanupStage } from './stages/retouchStage.js';
import { suitOverlayStage } from './stages/suitStage.js';
import { qualityValidationStage } from './stages/validationStage.js';

const VALIDATION_PROFILES = [
  { name: 'default', centerShift: 0, topShift: 0, zoomMultiplier: 1 },
  { name: 'tight_center', centerShift: 0, topShift: -0.03, zoomMultiplier: 1.14 },
  { name: 'tight_headroom', centerShift: 0, topShift: -0.01, zoomMultiplier: 1.2 },
  { name: 'wide_headroom', centerShift: 0, topShift: 0.02, zoomMultiplier: 0.96 },
  { name: 'left_nudge', centerShift: -0.025, topShift: -0.01, zoomMultiplier: 1.08 },
  { name: 'right_nudge', centerShift: 0.025, topShift: -0.01, zoomMultiplier: 1.08 }
];

const BACKGROUND_TONES = {
  id_photo: ['#FFFFFF', '#FAFCFF', '#F8FAFC'],
  passport_photo: ['#FFFFFF', '#FDFDFD', '#FAFAFA'],
  headshot: ['#F8FAFC', '#F5F9FF', '#EEF2FF']
};

const MICRO_OFFSETS = [
  { x: 0, y: 0 },
  { x: 6, y: -4 },
  { x: -5, y: 3 }
];

const MIN_IDENTITY_SCORE = 78;
const FINAL_QUALITY_RETRY_THRESHOLD = 84;
const IDENTITY_RETRY_PROFILE = {
  backgroundTone: '#FFFFFF',
  microOffset: { x: 0, y: 0 },
  retouchStrength: 0.97,
  suitShading: 1
};
const FINAL_QUALITY_RETRY_PROFILES = [
  { name: 'center_reframe', microOffset: { x: 0, y: -8 }, relightStrength: 1.04 },
  { name: 'headroom_relax', microOffset: { x: 0, y: 10 }, relightStrength: 1.02 },
  { name: 'left_balance', microOffset: { x: 8, y: -4 }, relightStrength: 1.03 },
  { name: 'right_balance', microOffset: { x: -8, y: -4 }, relightStrength: 1.03 }
];

function getVariantModifiers(toolType, index) {
  const tonePalette = BACKGROUND_TONES[toolType] ?? BACKGROUND_TONES.id_photo;
  const microOffset = MICRO_OFFSETS[index % MICRO_OFFSETS.length];
  return {
    backgroundTone: tonePalette[index % tonePalette.length],
    microOffset,
    retouchStrength: 1 + index * 0.03,
    suitShading: 1 + index * 0.05
  };
}

function getVariantScore({ identityScore, qualityScore, regenerated }) {
  const weighted = identityScore * 0.65 + qualityScore * 0.35;
  const adjusted = weighted - (regenerated ? 2 : 0);
  return Math.round(adjusted * 10) / 10;
}

function assignQualityReport(pipelineReport, quality) {
  pipelineReport.qualityScore = quality.qualityScore;
  pipelineReport.qualitySummary = quality.qualitySummary;
  pipelineReport.qualityFeedback = quality.qualityFeedback;
  pipelineReport.qualityIssueCodes = Array.isArray(quality.issues) ? quality.issues : [];
  pipelineReport.qualityMetrics = quality.metrics ?? null;
}

function buildIdentitySummary(pipelineReport) {
  const entries = Object.entries(pipelineReport.variantIdentityScores ?? {})
    .map(([variant, score]) => ({ variant, score: Number(score ?? 0) }))
    .sort((a, b) => b.score - a.score);
  const topVariant = entries[0] ?? null;
  const lowestVariant = entries[entries.length - 1] ?? null;
  return {
    threshold: pipelineReport.identityThreshold,
    recommendedVariant: pipelineReport.recommendedVariant ?? null,
    topVariant,
    lowestVariant,
    rejectedVariants: Array.isArray(pipelineReport.identityRejectedVariants) ? pipelineReport.identityRejectedVariants : [],
    regeneratedVariants: Array.isArray(pipelineReport.identityRegeneratedVariants) ? pipelineReport.identityRegeneratedVariants : [],
    fallbackKept: pipelineReport.identityFallbackKept ?? null,
    variantCount: entries.length,
    averageIdentityScore: pipelineReport.identityScore
  };
}

async function applyMicroCropOffset(inputBuffer, offset, background) {
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? 600;
  const height = metadata.height ?? 800;
  const pad = 12;
  const extended = await sharp(inputBuffer)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background
    })
    .toBuffer();

  return sharp(extended)
    .extract({
      left: pad + Math.max(0, -offset.x),
      top: pad + Math.max(0, -offset.y),
      width,
      height
    })
    .resize(width, height, { fit: 'fill' })
    .jpeg({ quality: 94 })
    .toBuffer();
}

function adjustGeometryForRetry(geometry, offset) {
  if (!geometry) return null;
  const outputWidth = geometry.outputWidth ?? 600;
  const outputHeight = geometry.outputHeight ?? 800;
  return {
    ...geometry,
    faceCenterRatioX: Math.max(0, Math.min(1, (geometry.faceCenterRatioX ?? 0.5) - (offset.x / Math.max(1, outputWidth)))),
    eyeLineRatio: Math.max(0, Math.min(1, (geometry.eyeLineRatio ?? 0.38) - (offset.y / Math.max(1, outputHeight))))
  };
}

export async function generatePortraitPipeline({
  inputPath,
  storageDir,
  jobId,
  toolType = 'id_photo',
  outfitType = 'current',
  faceHint = null,
  backgroundProvider = 'local_sharp',
  cacheKey = null
}) {
  await fs.mkdir(storageDir, { recursive: true });
  const inputBuffer = await fs.readFile(inputPath);
  const preset = getToolPreset(toolType);
  const cacheBaseName = cacheKey ? `${cacheKey}-${backgroundProvider}-${toolType}` : `${jobId}-${backgroundProvider}-${toolType}`;
  const alignedPath = path.join(storageDir, `${cacheBaseName}-aligned.jpg`);
  const cutoutPath = path.join(storageDir, `${cacheBaseName}-cutout.png`);
  const flattenedPath = path.join(storageDir, `${cacheBaseName}-flattened.jpg`);
  const geometryPath = path.join(storageDir, `${cacheBaseName}-geometry.json`);
  const pipelineReport = {
    toolType,
    outfitType,
    backgroundProvider,
    cacheKey,
    cropProfile: 'default',
    suitTemplate: outfitType === 'suit' ? 'pending' : 'current',
    suitSelectionReason: outfitType === 'suit' ? 'pending' : 'current outfit selected',
    suitSelectionSummary: outfitType === 'suit' ? 'pending' : 'current outfit kept',
    suitSelectionInputs: null,
    qualityScore: 0,
    qualityScoreBeforeRetry: null,
    qualitySummary: '',
    qualityFeedback: [],
    qualityIssueCodes: [],
    qualityMetrics: null,
    identityScore: 0,
    identityThreshold: MIN_IDENTITY_SCORE,
    variantIdentityScores: {},
    variantScores: {},
    identityRegeneratedVariants: [],
    identityRejectedVariants: [],
    identitySummary: null,
    variantDecisionTrace: [],
    cache: {
      aligned: false,
      cutout: false,
      flattened: false
    },
    externalBackgroundCall: false,
    generatedVariants: [],
    poseProfile: 'standard',
    poseAttempts: [],
    finalQualityRetryTriggered: false,
    finalQualityRetryProfile: null,
    finalQualityRetryAttempts: [],
    timings: {
      detect: 0,
      align: 0,
      pose: 0,
      cutout: 0,
      flatten: 0,
      relight: 0,
      finalRetry: 0,
      variants: 0
    }
  };

  let alignedBuffer = null;
  let geometry = null;
  try {
    alignedBuffer = await fs.readFile(alignedPath);
    geometry = JSON.parse(await fs.readFile(geometryPath, 'utf8'));
    pipelineReport.cache.aligned = true;
  } catch {
    const detectStartedAt = Date.now();
    const detection = await detectFaceStage({ inputBuffer, toolType, faceHint });
    pipelineReport.timings.detect = Date.now() - detectStartedAt;
    let aligned = null;
    let quality = null;
    const alignStartedAt = Date.now();
    for (const profile of VALIDATION_PROFILES) {
      aligned = await alignFaceStage({
        inputBuffer,
        toolType,
        faceHint,
        detection,
        cropAdjustment: profile
      });
      quality = qualityValidationStage({
        geometry: aligned.geometry,
        toolType
      });
      pipelineReport.cropProfile = profile.name;
      assignQualityReport(pipelineReport, quality);
      if (quality.valid) break;
    }
    pipelineReport.timings.align = Date.now() - alignStartedAt;
    alignedBuffer = aligned?.buffer ?? inputBuffer;
    geometry = aligned?.geometry ?? null;
    await fs.writeFile(alignedPath, alignedBuffer);
    await fs.writeFile(geometryPath, JSON.stringify(geometry));
  }

  const poseStartedAt = Date.now();
  const standardPose = await facePoseCorrectionStage({
    inputBuffer: alignedBuffer,
    geometry,
    toolType,
    profile: 'standard'
  });
  let posed = standardPose;
  pipelineReport.poseAttempts.push(standardPose.poseMetrics);
  const poseSeverity = Math.abs(standardPose.poseMetrics.roll ?? 0) + Math.abs((standardPose.poseMetrics.yawBias ?? 0) * 100);
  if (poseSeverity > 10) {
    const assertivePose = await facePoseCorrectionStage({
      inputBuffer: alignedBuffer,
      geometry,
      toolType,
      profile: 'assertive'
    });
    pipelineReport.poseAttempts.push(assertivePose.poseMetrics);
    posed = assertivePose;
  }
  pipelineReport.timings.pose = Date.now() - poseStartedAt;
  alignedBuffer = posed.buffer;
  pipelineReport.poseMetrics = posed.poseMetrics;
  pipelineReport.poseProfile = posed.poseMetrics?.profile ?? 'standard';
  const referenceSignature = await createFaceIdentityReference({
    inputBuffer: alignedBuffer,
    geometry
  });

  let cutout = null;
  try {
    cutout = await fs.readFile(cutoutPath);
    pipelineReport.cache.cutout = true;
  } catch {
    const cutoutStartedAt = Date.now();
    cutout = await backgroundRemovalStage({
      inputBuffer: alignedBuffer,
      provider: backgroundProvider
    });
    pipelineReport.timings.cutout = Date.now() - cutoutStartedAt;
    pipelineReport.externalBackgroundCall = backgroundProvider !== 'local_sharp';
    await fs.writeFile(cutoutPath, cutout);
  }

  let flattened = null;
  try {
    flattened = await fs.readFile(flattenedPath);
    pipelineReport.cache.flattened = true;
  } catch {
    const flattenStartedAt = Date.now();
    flattened = await backgroundReplaceStage({
      inputBuffer: cutout,
      background: preset.background
    });
    pipelineReport.timings.flatten = Date.now() - flattenStartedAt;
    await fs.writeFile(flattenedPath, flattened);
  }

  let quality = qualityValidationStage({
    geometry,
    toolType
  });
  assignQualityReport(pipelineReport, quality);
  const relightStartedAt = Date.now();
  flattened = await faceRelightStage({
    inputBuffer: flattened,
    toolType,
    strength: 1,
    geometry
  });
  pipelineReport.timings.relight = Date.now() - relightStartedAt;
  pipelineReport.relightMetrics = {
    applied: true,
    strength: 1
  };

  if (quality.qualityScore < FINAL_QUALITY_RETRY_THRESHOLD) {
    pipelineReport.qualityScoreBeforeRetry = quality.qualityScore;
    pipelineReport.finalQualityRetryTriggered = true;
    const finalRetryStartedAt = Date.now();
    let bestRetry = null;
    for (const retryProfile of FINAL_QUALITY_RETRY_PROFILES) {
      const retryGeometry = adjustGeometryForRetry(geometry, retryProfile.microOffset);
      let retryBuffer = await applyMicroCropOffset(flattened, retryProfile.microOffset, preset.background);
      retryBuffer = await faceRelightStage({
        inputBuffer: retryBuffer,
        toolType,
        strength: retryProfile.relightStrength,
        geometry: retryGeometry
      });
      const retryQuality = qualityValidationStage({
        geometry: retryGeometry,
        toolType
      });
      pipelineReport.finalQualityRetryAttempts.push({
        profile: retryProfile.name,
        qualityScore: retryQuality.qualityScore,
        issues: retryQuality.issues
      });
      if (!bestRetry || retryQuality.qualityScore > bestRetry.quality.qualityScore) {
        bestRetry = {
          profile: retryProfile,
          buffer: retryBuffer,
          geometry: retryGeometry,
          quality: retryQuality
        };
      }
    }
    pipelineReport.timings.finalRetry = Date.now() - finalRetryStartedAt;
    if (bestRetry && bestRetry.quality.qualityScore > quality.qualityScore) {
      flattened = bestRetry.buffer;
      geometry = bestRetry.geometry;
      quality = bestRetry.quality;
      pipelineReport.finalQualityRetryProfile = bestRetry.profile.name;
      pipelineReport.relightMetrics = {
        ...(pipelineReport.relightMetrics ?? {}),
        finalRetryRelightStrength: bestRetry.profile.relightStrength
      };
    }
  }

  assignQualityReport(pipelineReport, quality);

  const generated = [];
  const variantsStartedAt = Date.now();
  for (const [index, profile] of VARIANT_PROFILES.entries()) {
    const buildVariant = async (modifiers) => {
      let current = flattened;
      current = await backgroundToneStage({ inputBuffer: current, tone: modifiers.backgroundTone });
      current = await applyMicroCropOffset(current, modifiers.microOffset, preset.background);
      current = await faceRetouchStage({ inputBuffer: current, profile, strength: modifiers.retouchStrength });
      current = await hairCleanupStage({ inputBuffer: current, strength: modifiers.retouchStrength });
      const suited = await suitOverlayStage({
        inputBuffer: current,
        outfitType,
        variant: profile.name,
        toolType,
        faceHint,
        geometry,
        shading: modifiers.suitShading
      });
      const identityScore = await calculateFaceIdentityScore({
        referenceSignature,
        candidateBuffer: suited.buffer,
        geometry
      });
      return {
        buffer: suited.buffer,
        template: suited.template,
        suitSelection: suited.selection ?? null,
        identityScore
      };
    };

    const modifiers = getVariantModifiers(toolType, index);
    let variantResult = await buildVariant(modifiers);
    let regenerated = false;

    if (variantResult.identityScore < MIN_IDENTITY_SCORE) {
      const retryResult = await buildVariant(IDENTITY_RETRY_PROFILE);
      if (retryResult.identityScore > variantResult.identityScore) {
        variantResult = retryResult;
        regenerated = true;
        pipelineReport.identityRegeneratedVariants.push(profile.name);
      }
    }

    pipelineReport.suitTemplate = variantResult.template;
    pipelineReport.suitSelectionReason = variantResult.suitSelection?.reason ?? pipelineReport.suitSelectionReason;
    pipelineReport.suitSelectionSummary = variantResult.suitSelection?.summary ?? pipelineReport.suitSelectionSummary;
    pipelineReport.suitSelectionInputs = variantResult.suitSelection?.inputs ?? pipelineReport.suitSelectionInputs;
    pipelineReport.variantIdentityScores[profile.name] = variantResult.identityScore;
    pipelineReport.variantDecisionTrace.push({
      variant: profile.name,
      identityScore: variantResult.identityScore,
      regenerated,
      accepted: variantResult.identityScore >= MIN_IDENTITY_SCORE
    });

    if (variantResult.identityScore < MIN_IDENTITY_SCORE) {
      pipelineReport.identityRejectedVariants.push(profile.name);
    }

    const filePath = path.join(storageDir, `${jobId}-${uuidv4().slice(0, 8)}-${profile.name}.jpg`);
    await sharp(variantResult.buffer)
      .jpeg({ quality: 94 })
      .toFile(filePath);

    generated.push({
      variant: profile.name,
      filePath,
      identityScore: variantResult.identityScore,
      regenerated,
      score: getVariantScore({
        identityScore: variantResult.identityScore,
        qualityScore: pipelineReport.qualityScore,
        regenerated
      })
    });
    pipelineReport.generatedVariants.push(profile.name);
    pipelineReport.variantScores[profile.name] = generated[generated.length - 1].score;
  }
  pipelineReport.timings.variants = Date.now() - variantsStartedAt;
  generated.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  pipelineReport.generatedVariants = generated.map((item) => item.variant);
  pipelineReport.recommendedVariant = generated[0]?.variant ?? null;
  const identityScores = Object.values(pipelineReport.variantIdentityScores);
  pipelineReport.identityScore = identityScores.length
    ? Math.round((identityScores.reduce((sum, value) => sum + value, 0) / identityScores.length) * 10) / 10
    : 0;
  pipelineReport.identitySummary = buildIdentitySummary(pipelineReport);

  return {
    generated,
    pipelineReport
  };
}
