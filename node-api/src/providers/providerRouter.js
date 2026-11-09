import { generateWithLocalSharp } from './localSharpProvider.js';
import { generateWithRemoveBg } from './removeBgProvider.js';
import { generateWithPhotoRoom } from './photoRoomProvider.js';
import { generateWithOpenAiImage } from './openAiPortraitProvider.js';

const hasOpenAiKey = () => Boolean(process.env.OPENAI_API_KEY?.trim());

// Dedicated launch flag: other experimental photo tools retain their existing switch.
export const isIdPhotoEnabled = () => process.env.ID_PHOTO_ENABLED !== 'false' && hasOpenAiKey();

export function getImageProvider() {
  return process.env.IMAGE_PROVIDER ?? 'auto';
}

export function isExternalAiEnabled() {
  return process.env.EXTERNAL_AI_ENABLED === 'true';
}

export function normalizeRequestedProvider(provider) {
  if (typeof provider !== 'string') return null;
  const normalized = provider.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'auto';
  if (normalized === 'local_sharp' || normalized === 'remove_bg' || normalized === 'photoroom' || normalized === 'openai_image') return normalized;
  return null;
}

export function getResolvedImageProvider() {
  if (!isExternalAiEnabled()) return 'local_sharp';

  const configured = getImageProvider();
  if (configured !== 'auto') return configured;
  if (hasOpenAiKey()) return 'openai_image';
  if (process.env.REMOVE_BG_API_KEY) return 'remove_bg';
  if (process.env.PHOTOROOM_API_KEY && process.env.PHOTOROOM_REMOVE_BG_URL) return 'photoroom';
  return 'local_sharp';
}

export function resolveImageProvider(requestedProvider = null) {
  const normalized = normalizeRequestedProvider(requestedProvider);
  if (!normalized || normalized === 'auto') return getResolvedImageProvider();
  if (normalized === 'local_sharp') return 'local_sharp';
  if (!isExternalAiEnabled()) return 'local_sharp';
  if (normalized === 'openai_image') return hasOpenAiKey() ? 'openai_image' : 'local_sharp';
  if (normalized === 'remove_bg') return process.env.REMOVE_BG_API_KEY ? 'remove_bg' : 'local_sharp';
  if (normalized === 'photoroom') {
    return process.env.PHOTOROOM_API_KEY && process.env.PHOTOROOM_REMOVE_BG_URL ? 'photoroom' : 'local_sharp';
  }
  return getResolvedImageProvider();
}

async function runProvider({ provider, inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey }) {
  if (provider === 'local_sharp') return generateWithLocalSharp({ inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey });
  if (provider === 'remove_bg') return generateWithRemoveBg({ inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey });
  if (provider === 'photoroom') return generateWithPhotoRoom({ inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey });
  if (provider === 'openai_image') return generateWithOpenAiImage({ inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions });
  throw new Error(`unsupported IMAGE_PROVIDER: ${provider}`);
}

export async function generateCandidatesWithProvider({ inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey, requestedProvider = null }) {
  const normalizedRequestedProvider = normalizeRequestedProvider(requestedProvider) ?? getImageProvider();
  const resolved = toolType === 'id_photo' && isIdPhotoEnabled()
    ? 'openai_image' : resolveImageProvider(normalizedRequestedProvider);
  // ID photos require generative editing; filters cannot correct pose or clothing.
  if (toolType === 'id_photo' && (!isIdPhotoEnabled() || resolved !== 'openai_image')) {
    throw Object.assign(new Error('증명사진 AI 서버가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.'), { statusCode: 503 });
  }
  try {
    const result = await runProvider({ provider: resolved, inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey });
    return {
      ...result,
      pipelineReport: {
        ...(result?.pipelineReport ?? {}),
        requestedProvider: normalizedRequestedProvider,
        resolvedProvider: resolved,
        fallbackToLocalSharp: false
      }
    };
  } catch (error) {
    if (resolved === 'openai_image' || toolType === 'id_photo') throw error;
    if (resolved !== 'local_sharp') {
      // eslint-disable-next-line no-console
      console.warn(`[provider] ${resolved} failed, fallback to local_sharp: ${error.message}`);
      const fallback = await runProvider({ provider: 'local_sharp', inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, faceHint, cacheKey });
      return {
        ...fallback,
        pipelineReport: {
          ...(fallback?.pipelineReport ?? {}),
          requestedProvider: normalizedRequestedProvider,
          resolvedProvider: resolved,
          fallbackToLocalSharp: true,
          fallbackReason: error.message
        }
      };
    }
    throw error;
  }
}
