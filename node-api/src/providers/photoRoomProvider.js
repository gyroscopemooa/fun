import { generatePortraitPipeline } from './portraitPipelineProvider.js';

export async function generateWithPhotoRoom({ inputPath, storageDir, jobId, toolType, outfitType, faceHint, cacheKey }) {
  return generatePortraitPipeline({
    inputPath,
    storageDir,
    jobId,
    toolType,
    outfitType,
    faceHint,
    backgroundProvider: 'photoroom',
    cacheKey
  });
}
