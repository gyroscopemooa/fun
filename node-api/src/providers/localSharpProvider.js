import { generatePortraitPipeline } from './portraitPipelineProvider.js';

export async function generateWithLocalSharp({ inputPath, storageDir, jobId, toolType, outfitType, faceHint, cacheKey }) {
  return generatePortraitPipeline({
    inputPath,
    storageDir,
    jobId,
    toolType,
    outfitType,
    faceHint,
    backgroundProvider: 'local_sharp',
    cacheKey
  });
}
