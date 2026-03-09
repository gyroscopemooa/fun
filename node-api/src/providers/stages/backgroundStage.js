import sharp from 'sharp';

const DEFAULT_REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';

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

export async function backgroundRemovalStage({ inputBuffer, provider = 'local_sharp' }) {
  if (provider === 'remove_bg') return removeWithRemoveBg(inputBuffer);
  if (provider === 'photoroom') return removeWithPhotoRoom(inputBuffer);
  return inputBuffer;
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
