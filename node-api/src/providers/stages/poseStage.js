import sharp from 'sharp';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const POSE_PROFILES = {
  standard: {
    yawMultiplier: 1.8,
    shearMultiplier: 0.28,
    verticalMultiplier: 0.6,
    translationMultiplier: 0.14,
    rotationMultiplier: 1
  },
  assertive: {
    yawMultiplier: 2.15,
    shearMultiplier: 0.34,
    verticalMultiplier: 0.72,
    translationMultiplier: 0.18,
    rotationMultiplier: 1.1
  },
  soft: {
    yawMultiplier: 1.45,
    shearMultiplier: 0.22,
    verticalMultiplier: 0.45,
    translationMultiplier: 0.1,
    rotationMultiplier: 0.92
  }
};

export async function facePoseCorrectionStage({ inputBuffer, geometry = null, toolType = 'id_photo', profile = 'standard' }) {
  if (!geometry) {
    return {
      buffer: inputBuffer,
      poseMetrics: {
        roll: 0,
        yawBias: 0,
        applied: false,
        profile
      }
    };
  }

  const poseProfile = POSE_PROFILES[profile] ?? POSE_PROFILES.standard;
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? (toolType === 'headshot' ? 800 : 600);
  const height = metadata.height ?? (toolType === 'headshot' ? 1000 : 800);
  const centerBias = (geometry.faceCenterRatioX ?? 0.5) - 0.5;
  const eyeBias = (geometry.eyeLineRatio ?? 0.38) - (toolType === 'headshot' ? 0.36 : toolType === 'passport_photo' ? 0.42 : 0.38);
  const roll = clamp(Number(geometry.rotation ?? 0) * poseProfile.rotationMultiplier, -10, 10);
  const yawBias = clamp(centerBias * poseProfile.yawMultiplier, -0.15, 0.15);
  const verticalBias = clamp(eyeBias * poseProfile.verticalMultiplier, -0.06, 0.06);
  const shearX = clamp(-yawBias * poseProfile.shearMultiplier, -0.045, 0.045);
  const translation = [
    clamp(yawBias * width * poseProfile.translationMultiplier, -width * 0.05, width * 0.05),
    clamp(-verticalBias * height * 0.1, -height * 0.03, height * 0.03)
  ];
  const shouldApply = Math.abs(shearX) > 0.006 || Math.abs(translation[0]) > 2 || Math.abs(translation[1]) > 2 || Math.abs(roll) > 0.8;

  if (!shouldApply) {
    return {
      buffer: inputBuffer,
      poseMetrics: {
        roll,
        yawBias,
        applied: false,
        profile
      }
    };
  }

  const corrected = await sharp(inputBuffer)
    .rotate(-roll, { background: '#ffffff' })
    .affine(
      [
        [1, shearX],
        [0, 1]
      ],
      {
        background: '#ffffff',
        interpolate: sharp.interpolators.bilinear,
        idx: translation[0],
        idy: translation[1]
      }
    )
    .resize(width, height, { fit: 'fill' })
    .jpeg({ quality: 94 })
    .toBuffer();

  return {
    buffer: corrected,
    poseMetrics: {
      roll,
      yawBias,
      applied: true,
      profile
    }
  };
}
