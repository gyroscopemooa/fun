import { generateWithLocalSharp } from './localSharpProvider.js';
import { generateWithRemoveBg } from './removeBgProvider.js';
import { generateWithPhotoRoom } from './photoRoomProvider.js';

export function getImageProvider() {
  return process.env.IMAGE_PROVIDER ?? 'auto';
}

export function isExternalAiEnabled() {
  return process.env.EXTERNAL_AI_ENABLED === 'true';
}

export function getResolvedImageProvider() {
  if (!isExternalAiEnabled()) return 'local_sharp';

  const configured = getImageProvider();
  if (configured !== 'auto') return configured;
  if (process.env.REMOVE_BG_API_KEY) return 'remove_bg';
  if (process.env.PHOTOROOM_API_KEY && process.env.PHOTOROOM_REMOVE_BG_URL) return 'photoroom';
  return 'local_sharp';
}

async function runProvider({ provider, inputPath, storageDir, jobId }) {
  if (provider === 'local_sharp') return generateWithLocalSharp({ inputPath, storageDir, jobId });
  if (provider === 'remove_bg') return generateWithRemoveBg({ inputPath, storageDir, jobId });
  if (provider === 'photoroom') return generateWithPhotoRoom({ inputPath, storageDir, jobId });
  throw new Error(`unsupported IMAGE_PROVIDER: ${provider}`);
}

export async function generateCandidatesWithProvider({ inputPath, storageDir, jobId }) {
  const resolved = getResolvedImageProvider();
  try {
    return await runProvider({ provider: resolved, inputPath, storageDir, jobId });
  } catch (error) {
    if (resolved !== 'local_sharp') {
      // eslint-disable-next-line no-console
      console.warn(`[provider] ${resolved} failed, fallback to local_sharp: ${error.message}`);
      return runProvider({ provider: 'local_sharp', inputPath, storageDir, jobId });
    }
    throw error;
  }
}
