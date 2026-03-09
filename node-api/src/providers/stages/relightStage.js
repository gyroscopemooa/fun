import sharp from 'sharp';

export async function faceRelightStage({ inputBuffer, toolType = 'id_photo', strength = 1, geometry = null }) {
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? (toolType === 'headshot' ? 800 : 600);
  const height = metadata.height ?? (toolType === 'headshot' ? 1000 : 800);
  const topBoost = toolType === 'passport_photo' ? 0.1 : toolType === 'headshot' ? 0.08 : 0.09;
  const leftWarm = toolType === 'headshot' ? 0.07 : 0.05;
  const faceCenterX = Math.round((geometry?.faceCenterRatioX ?? 0.5) * width);
  const eyeLineY = Math.round((geometry?.eyeLineRatio ?? (toolType === 'headshot' ? 0.36 : toolType === 'passport_photo' ? 0.42 : 0.38)) * height);
  const faceRadiusX = Math.max(110, Math.round(width * ((geometry?.faceWidthRatio ?? 0.36) * 0.85)));
  const faceRadiusY = Math.max(150, Math.round(faceRadiusX * (toolType === 'headshot' ? 1.28 : 1.42)));
  const relightStrength = 0.16 * strength;

  const lightSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="softTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,${0.18 * strength})"/>
          <stop offset="55%" stop-color="rgba(255,255,255,${topBoost * strength})"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
        <linearGradient id="warmSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,244,214,${leftWarm * strength})"/>
          <stop offset="45%" stop-color="rgba(255,244,214,0)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
        <radialGradient id="faceGlow" cx="${faceCenterX / width}" cy="${eyeLineY / height}" r="0.36">
          <stop offset="0%" stop-color="rgba(255,255,255,${relightStrength})"/>
          <stop offset="42%" stop-color="rgba(255,248,236,${relightStrength * 0.82})"/>
          <stop offset="70%" stop-color="rgba(255,248,236,${relightStrength * 0.26})"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#softTop)"/>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#warmSide)"/>
      <ellipse cx="${faceCenterX}" cy="${eyeLineY + Math.round(faceRadiusY * 0.38)}" rx="${faceRadiusX}" ry="${faceRadiusY}" fill="url(#faceGlow)"/>
    </svg>
  `;

  return sharp(inputBuffer)
    .normalise()
    .gamma(1.045)
    .modulate({
      brightness: 1.015 + strength * 0.01,
      saturation: 1.002 + strength * 0.008
    })
    .composite([
      {
        input: Buffer.from(lightSvg),
        top: 0,
        left: 0,
        blend: 'screen'
      }
    ])
    .jpeg({ quality: 94 })
    .toBuffer();
}
