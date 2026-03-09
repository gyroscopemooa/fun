import { generateWithLocalSharp } from './localSharpProvider.js';

export function getImageProvider() {
  return process.env.IMAGE_PROVIDER ?? 'local_sharp';
}

export async function generateCandidatesWithProvider({ inputPath, storageDir, jobId }) {
  const provider = getImageProvider();

  if (provider === 'local_sharp') {
    return generateWithLocalSharp({ inputPath, storageDir, jobId });
  }

  throw new Error(`unsupported IMAGE_PROVIDER: ${provider}`);
}

