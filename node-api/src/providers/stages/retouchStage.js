import sharp from 'sharp';

export async function faceRetouchStage({ inputBuffer, profile, strength = 1 }) {
  const brightness = (profile?.brightness ?? 1.03) * (0.985 + strength * 0.015);
  const saturation = (profile?.saturation ?? 1.01) * (0.99 + strength * 0.01);
  const sharpen = (profile?.sharpen ?? 1.08) * (0.96 + strength * 0.04);
  const contrast = (profile?.contrast ?? 1.03) * (0.99 + strength * 0.01);

  return sharp(inputBuffer)
    .normalise()
    .modulate({ brightness, saturation })
    .linear(contrast, -(contrast * 8) + 8)
    .sharpen(sharpen, 1, 2)
    .jpeg({ quality: 94 })
    .toBuffer();
}

export async function hairCleanupStage({ inputBuffer, strength = 1 }) {
  return sharp(inputBuffer)
    .median(strength > 1.02 ? 2 : 1)
    .sharpen(1.05 + strength * 0.08, 0.8, 2)
    .jpeg({ quality: 94 })
    .toBuffer();
}
