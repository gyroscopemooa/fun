import sharp from 'sharp';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function getFaceCropRegion(metadata, geometry) {
  const width = metadata.width ?? 600;
  const height = metadata.height ?? 800;
  const centerX = clamp(Math.round((geometry?.faceCenterRatioX ?? 0.5) * width), 0, width);
  const centerY = clamp(Math.round((geometry?.eyeLineRatio ?? 0.38) * height + height * 0.16), 0, height);
  const faceWidthRatio = geometry?.faceWidthRatio ?? 0.36;
  const cropWidth = clamp(Math.round(width * Math.max(0.34, faceWidthRatio * 1.45)), 120, width);
  const cropHeight = clamp(Math.round(cropWidth * 1.22), 140, height);
  const left = clamp(Math.round(centerX - cropWidth / 2), 0, Math.max(0, width - cropWidth));
  const top = clamp(Math.round(centerY - cropHeight / 2), 0, Math.max(0, height - cropHeight));
  return { left, top, width: cropWidth, height: cropHeight };
}

async function extractSignature(buffer, geometry) {
  const metadata = await sharp(buffer).metadata();
  const region = getFaceCropRegion(metadata, geometry);
  const raw = await sharp(buffer)
    .extract(region)
    .resize(48, 48, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  const bucketMeans = [];
  const bucketSize = 6;
  for (let by = 0; by < 48; by += bucketSize) {
    for (let bx = 0; bx < 48; bx += bucketSize) {
      let sum = 0;
      let count = 0;
      for (let y = by; y < by + bucketSize; y += 1) {
        for (let x = bx; x < bx + bucketSize; x += 1) {
          sum += raw[y * 48 + x];
          count += 1;
        }
      }
      bucketMeans.push(sum / Math.max(1, count));
    }
  }

  return bucketMeans;
}

export async function createFaceIdentityReference({ inputBuffer, geometry }) {
  return extractSignature(inputBuffer, geometry);
}

export async function calculateFaceIdentityScore({ referenceSignature, candidateBuffer, geometry }) {
  if (!Array.isArray(referenceSignature) || referenceSignature.length === 0) {
    return 0;
  }

  const candidateSignature = await extractSignature(candidateBuffer, geometry);
  const diffs = candidateSignature.map((value, index) => Math.abs(value - (referenceSignature[index] ?? value)));
  const averageDiff = diffs.reduce((sum, value) => sum + value, 0) / Math.max(1, diffs.length);
  const score = clamp(100 - averageDiff * 1.35, 0, 100);
  return Math.round(score * 10) / 10;
}
