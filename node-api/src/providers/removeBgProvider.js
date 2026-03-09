import fs from 'node:fs/promises';
import path from 'node:path';
import { generateControlledVariants } from './variantSharp.js';

const REMOVE_BG_URL = process.env.REMOVE_BG_URL ?? 'https://api.remove.bg/v1.0/removebg';

export async function generateWithRemoveBg({ inputPath, storageDir, jobId }) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    throw new Error('REMOVE_BG_API_KEY is not set');
  }

  const inputBuffer = await fs.readFile(inputPath);
  const form = new FormData();
  form.append('image_file', new Blob([inputBuffer]), path.basename(inputPath));
  form.append('size', 'auto');
  form.append('bg_color', 'FFFFFF');
  form.append('format', 'jpg');

  const response = await fetch(REMOVE_BG_URL, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey
    },
    body: form
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`remove.bg failed (${response.status}): ${details.slice(0, 180)}`);
  }

  const outputBuffer = Buffer.from(await response.arrayBuffer());
  const processedPath = path.join(storageDir, `${jobId}-removebg.jpg`);
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(processedPath, outputBuffer);

  return generateControlledVariants({ inputPath: processedPath, storageDir, jobId });
}

