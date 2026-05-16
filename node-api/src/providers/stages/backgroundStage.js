import sharp from 'sharp';

const DEFAULT_REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createPortraitMask(width, height, geometry) {
  const portraitMask = new Uint8Array(width * height);
  const faceCenterX = clamp(Math.round((geometry?.faceCenterRatioX ?? 0.5) * width), 0, width - 1);
  const faceWidth = Math.max(1, Math.round((geometry?.faceWidthRatio ?? 0.4) * width));
  const faceHeight = Math.max(1, Math.round(faceWidth * 1.36));
  const eyeLineY = clamp(Math.round((geometry?.eyeLineRatio ?? 0.38) * height), 0, height - 1);
  const headCenterY = clamp(Math.round(eyeLineY + (faceHeight * 0.16)), 0, height - 1);
  const upperTorsoCenterY = clamp(Math.round(headCenterY + (faceHeight * 1.02)), 0, height - 1);
  const lowerTorsoCenterY = clamp(Math.round(headCenterY + (faceHeight * 1.72)), 0, height - 1);
  const headRadiusX = Math.max(1, Math.round(faceWidth * 0.98));
  const headRadiusY = Math.max(1, Math.round(faceHeight * 1.08));
  const upperTorsoRadiusX = Math.max(1, Math.round(faceWidth * 1.28));
  const upperTorsoRadiusY = Math.max(1, Math.round(faceHeight * 1.08));
  const lowerTorsoRadiusX = Math.max(1, Math.round(faceWidth * 1.46));
  const lowerTorsoRadiusY = Math.max(1, Math.round(faceHeight * 1.28));

  for (let y = 0; y < height; y += 1) {
    const headNormY = (y - headCenterY) / headRadiusY;
    const upperTorsoNormY = (y - upperTorsoCenterY) / upperTorsoRadiusY;
    const lowerTorsoNormY = (y - lowerTorsoCenterY) / lowerTorsoRadiusY;
    for (let x = 0; x < width; x += 1) {
      const headNormX = (x - faceCenterX) / headRadiusX;
      const upperTorsoNormX = (x - faceCenterX) / upperTorsoRadiusX;
      const lowerTorsoNormX = (x - faceCenterX) / lowerTorsoRadiusX;
      const headInside = ((headNormX * headNormX) + (headNormY * headNormY)) <= 1;
      const upperTorsoInside = ((upperTorsoNormX * upperTorsoNormX) + (upperTorsoNormY * upperTorsoNormY)) <= 1;
      const lowerTorsoInside = ((lowerTorsoNormX * lowerTorsoNormX) + (lowerTorsoNormY * lowerTorsoNormY)) <= 1;
      if (headInside || upperTorsoInside || lowerTorsoInside) {
        portraitMask[(y * width) + x] = 255;
      }
    }
  }

  return portraitMask;
}

function createFocusMask(width, height, geometry) {
  const focusMask = new Uint8Array(width * height);
  const faceCenterX = clamp(Math.round((geometry?.faceCenterRatioX ?? 0.5) * width), 0, width - 1);
  const faceWidth = Math.max(1, Math.round((geometry?.faceWidthRatio ?? 0.4) * width));
  const faceHeight = Math.max(1, Math.round(faceWidth * 1.36));
  const eyeLineY = clamp(Math.round((geometry?.eyeLineRatio ?? 0.38) * height), 0, height - 1);
  const focusCenterY = clamp(Math.round(eyeLineY + (faceHeight * 0.95)), 0, height - 1);
  const radiusX = Math.max(1, Math.round(faceWidth * 1.18));
  const radiusY = Math.max(1, Math.round(faceHeight * 1.62));

  for (let y = 0; y < height; y += 1) {
    const normY = (y - focusCenterY) / radiusY;
    for (let x = 0; x < width; x += 1) {
      const normX = (x - faceCenterX) / radiusX;
      const distance = Math.sqrt((normX * normX) + (normY * normY));
      let alpha = 0;
      if (distance <= 0.82) {
        alpha = 255;
      } else if (distance < 1.12) {
        alpha = Math.round(255 * (1 - ((distance - 0.82) / 0.3)));
      }
      focusMask[(y * width) + x] = alpha;
    }
  }

  return focusMask;
}

async function removeWithLocalSharp(inputBuffer, geometry) {
  const { info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? 600;
  const height = info.height ?? 800;
  const portraitAlpha = await sharp(createPortraitMask(width, height, geometry), {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .blur(12)
    .normalize()
    .png()
    .toBuffer();

  const focusAlpha = await sharp(createFocusMask(width, height, geometry), {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .blur(8)
    .png()
    .toBuffer();

  const portraitAlphaRaw = await sharp(portraitAlpha).raw().toBuffer();
  const focusAlphaRaw = await sharp(focusAlpha).raw().toBuffer();
  const mergedAlpha = Buffer.alloc(width * height);
  for (let i = 0; i < mergedAlpha.length; i += 1) {
    mergedAlpha[i] = Math.min(255, Math.max(portraitAlphaRaw[i], focusAlphaRaw[i]));
  }

  const mergedAlphaPng = await sharp(mergedAlpha, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .png()
    .toBuffer();

  return sharp(inputBuffer)
    .removeAlpha()
    .joinChannel(mergedAlphaPng)
    .png()
    .toBuffer();
}

async function removeWithRemoveBg(inputBuffer) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) throw new Error('REMOVE_BG_API_KEY is not set');

  const form = new FormData();
  form.append('image_file', new Blob([inputBuffer]), 'source.png');
  form.append('size', 'auto');
  form.append('format', 'png');

  const response = await fetch(process.env.REMOVE_BG_URL || DEFAULT_REMOVE_BG_URL, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`remove.bg failed (${response.status}): ${details.slice(0, 180)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function removeWithPhotoRoom(inputBuffer) {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  const endpoint = process.env.PHOTOROOM_REMOVE_BG_URL;
  const field = process.env.PHOTOROOM_IMAGE_FIELD || 'image_file';
  if (!apiKey) throw new Error('PHOTOROOM_API_KEY is not set');
  if (!endpoint) throw new Error('PHOTOROOM_REMOVE_BG_URL is not set');

  const form = new FormData();
  form.append(field, new Blob([inputBuffer]), 'source.png');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`photoroom failed (${response.status}): ${details.slice(0, 180)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function backgroundRemovalStage({ inputBuffer, provider = 'local_sharp', geometry = null }) {
  if (provider === 'remove_bg') return removeWithRemoveBg(inputBuffer);
  if (provider === 'photoroom') return removeWithPhotoRoom(inputBuffer);
  return removeWithLocalSharp(inputBuffer, geometry);
}

export async function backgroundReplaceStage({ inputBuffer, background = '#FFFFFF' }) {
  return sharp(inputBuffer)
    .ensureAlpha()
    .flatten({ background })
    .jpeg({ quality: 94 })
    .toBuffer();
}

export async function backgroundToneStage({ inputBuffer, tone = null }) {
  if (!tone) return inputBuffer;
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? 600;
  const height = metadata.height ?? 800;
  const overlay = {
    input: {
      create: {
        width,
        height,
        channels: 4,
        background: tone
      }
    },
    blend: 'multiply',
    opacity: 0.08
  };
  return sharp(inputBuffer)
    .composite([overlay])
    .jpeg({ quality: 94 })
    .toBuffer();
}
