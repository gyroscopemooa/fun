import sharp from 'sharp';
import { renderSuitOverlay } from '../suitOverlayProvider.js';

export async function suitOverlayStage({ inputBuffer, outfitType = 'current', variant = 'clean', toolType = 'id_photo', faceHint = null, geometry = null, shading = 1 }) {
  if (outfitType !== 'suit') return { buffer: inputBuffer, template: 'current', selection: null };
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? 600;
  const height = metadata.height ?? 800;
  const { overlay, template, selection } = await renderSuitOverlay({ width, height, variant, toolType, faceHint, geometry, shading });
  const buffer = await sharp(inputBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toBuffer();
  return { buffer, template, selection };
}
