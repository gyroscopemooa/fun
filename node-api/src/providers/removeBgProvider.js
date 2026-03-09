import { generatePortraitPipeline } from './portraitPipelineProvider.js';

export async function generateWithRemoveBg({ inputPath, storageDir, jobId, toolType, outfitType, faceHint, cacheKey }) {
  return generatePortraitPipeline({
    inputPath,
    storageDir,
    jobId,
    toolType,
    outfitType,
    faceHint,
    backgroundProvider: 'remove_bg',
    cacheKey
  });
}
