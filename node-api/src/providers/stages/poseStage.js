import sharp from 'sharp';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const POSE_PROFILES = {
  standard: {
    yawMultiplier: 1.35,
    shearMultiplier: 0.18,
    verticalMultiplier: 0.42,
    translationMultiplier: 0.1,
    rotationMultiplier: 0.72
  },
  assertive: {
    yawMultiplier: 1.7,
    shearMultiplier: 0.24,
    verticalMultiplier: 0.54,
    translationMultiplier: 0.14,
    rotationMultiplier: 0.88
  },
  soft: {
    yawMultiplier: 1,
    shearMultiplier: 0.12,
    verticalMultiplier: 0.28,
    translationMultiplier: 0.06,
    rotationMultiplier: 0.5
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
  const rollLimit = toolType === 'headshot' ? 6 : 7.5;
  const horizontalLimit = toolType === 'headshot' ? 0.08 : 0.11;
  const verticalLimit = toolType === 'headshot' ? 0.04 : 0.055;
  const shearLimit = toolType === 'headshot' ? 0.022 : 0.03;
  const roll = clamp(Number(geometry.rotation ?? 0) * poseProfile.rotationMultiplier, -rollLimit, rollLimit);
  const yawBias = clamp(centerBias * poseProfile.yawMultiplier, -horizontalLimit, horizontalLimit);
  const verticalBias = clamp(eyeBias * poseProfile.verticalMultiplier, -verticalLimit, verticalLimit);
  const shearX = clamp(-yawBias * poseProfile.shearMultiplier, -shearLimit, shearLimit);
  const translation = [
    clamp(yawBias * width * poseProfile.translationMultiplier, -width * 0.04, width * 0.04),
    clamp(-verticalBias * height * 0.16, -height * 0.04, height * 0.04)
  ];
  const shouldApply = Math.abs(shearX) > 0.008 || Math.abs(translation[0]) > 2 || Math.abs(translation[1]) > 2 || Math.abs(roll) > 1;

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
