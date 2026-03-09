import { generateControlledVariants } from './variantSharp.js';

export async function generateWithLocalSharp({ inputPath, storageDir, jobId }) {
  return generateControlledVariants({ inputPath, storageDir, jobId });
}
