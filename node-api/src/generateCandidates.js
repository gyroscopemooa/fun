import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

const OUTPUT_W = 600;
const OUTPUT_H = 800;

export async function generateCandidates({
  inputPath,
  storageDir,
  jobId
}) {
  await fs.mkdir(storageDir, { recursive: true });

  const baseName = `${jobId}-${uuidv4().slice(0, 8)}`;
  const baseOut = path.join(storageDir, `${baseName}-base.jpg`);
  const brightOut = path.join(storageDir, `${baseName}-bright.jpg`);
  const cropAltOut = path.join(storageDir, `${baseName}-cropalt.jpg`);

  // Base: white background + 3:4 style output.
  await sharp(inputPath)
    .resize(OUTPUT_W, OUTPUT_H, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92 })
    .toFile(baseOut);

  // Bright: small exposure/brightness lift.
  await sharp(inputPath)
    .resize(OUTPUT_W, OUTPUT_H, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .modulate({ brightness: 1.08, saturation: 1.02 })
    .jpeg({ quality: 92 })
    .toFile(brightOut);

  // Crop alt: slight framing difference.
  const resizedW = OUTPUT_W + 28;
  const resizedH = OUTPUT_H + 28;
  await sharp(inputPath)
    .resize(resizedW, resizedH, { fit: 'cover', position: 'centre' })
    .extract({ left: 14, top: 8, width: OUTPUT_W, height: OUTPUT_H })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92 })
    .toFile(cropAltOut);

  return [
    { variant: 'base', filePath: baseOut },
    { variant: 'bright', filePath: brightOut },
    { variant: 'crop_alt', filePath: cropAltOut }
  ];
}
