import fs from 'node:fs/promises';
import path from 'node:path';
import { generateControlledVariants } from './variantSharp.js';

const PHOTOROOM_URL = process.env.PHOTOROOM_REMOVE_BG_URL ?? '';
const PHOTOROOM_FIELD = process.env.PHOTOROOM_IMAGE_FIELD ?? 'image_file';

export async function generateWithPhotoRoom({ inputPath, storageDir, jobId }) {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) {
    throw new Error('PHOTOROOM_API_KEY is not set');
  }
  if (!PHOTOROOM_URL) {
    throw new Error('PHOTOROOM_REMOVE_BG_URL is not set');
  }

  const inputBuffer = await fs.readFile(inputPath);
  const form = new FormData();
  form.append(PHOTOROOM_FIELD, new Blob([inputBuffer]), path.basename(inputPath));

  const response = await fetch(PHOTOROOM_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey
    },
    body: form
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`photoroom failed (${response.status}): ${details.slice(0, 180)}`);
  }

  const outputBuffer = Buffer.from(await response.arrayBuffer());
  const processedPath = path.join(storageDir, `${jobId}-photoroom.jpg`);
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(processedPath, outputBuffer);

  return generateControlledVariants({ inputPath: processedPath, storageDir, jobId });
}

