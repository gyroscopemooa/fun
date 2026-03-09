import sharp from 'sharp';
import { getToolPreset } from '../pipelineConfig.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPoint = (point, width, height) => {
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return null;
  return {
    x: point.x <= 1 ? point.x * width : point.x,
    y: point.y <= 1 ? point.y * height : point.y
  };
};

function resolveFaceHint(metadata, faceHint) {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const fallback = {
    bbox: {
      x: width * 0.28,
      y: height * 0.14,
      width: width * 0.44,
      height: height * 0.44
    },
    leftEye: null,
    rightEye: null
  };

  if (!faceHint?.bbox || width <= 0 || height <= 0) return fallback;

  const x = faceHint.bbox.x <= 1 ? faceHint.bbox.x * width : faceHint.bbox.x;
  const y = faceHint.bbox.y <= 1 ? faceHint.bbox.y * height : faceHint.bbox.y;
  const boxWidth = faceHint.bbox.width <= 1 ? faceHint.bbox.width * width : faceHint.bbox.width;
  const boxHeight = faceHint.bbox.height <= 1 ? faceHint.bbox.height * height : faceHint.bbox.height;

  return {
    bbox: {
      x: clamp(x, 0, width),
      y: clamp(y, 0, height),
      width: clamp(boxWidth, Math.max(1, width * 0.12), width),
      height: clamp(boxHeight, Math.max(1, height * 0.12), height)
    },
    leftEye: getPoint(faceHint.leftEye ?? faceHint.keypoints?.leftEye ?? null, width, height),
    rightEye: getPoint(faceHint.rightEye ?? faceHint.keypoints?.rightEye ?? null, width, height)
  };
}

export async function detectFaceStage({ inputBuffer, toolType = 'id_photo', faceHint = null }) {
  const preset = getToolPreset(toolType);
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? preset.outputWidth;
  const height = metadata.height ?? preset.outputHeight;
  const hint = resolveFaceHint(metadata, faceHint);
  return {
    preset,
    metadata,
    width,
    height,
    hint
  };
}

export async function alignFaceStage({ inputBuffer, toolType = 'id_photo', faceHint = null, detection = null, cropAdjustment = null }) {
  const resolved = detection ?? await detectFaceStage({ inputBuffer, toolType, faceHint });
  const preset = resolved.preset ?? getToolPreset(toolType);
  const width = resolved.width ?? resolved.metadata?.width ?? preset.outputWidth;
  const height = resolved.height ?? resolved.metadata?.height ?? preset.outputHeight;
  const hint = resolved.hint ?? resolveFaceHint(resolved.metadata ?? {}, faceHint);
  const faceCenterX = hint.bbox.x + hint.bbox.width / 2;
  const eyeLineY = hint.leftEye && hint.rightEye
    ? (hint.leftEye.y + hint.rightEye.y) / 2
    : hint.bbox.y + hint.bbox.height * 0.38;
  const zoomMultiplier = cropAdjustment?.zoomMultiplier ?? 1;
  const targetFaceWidth = preset.outputWidth * preset.faceWidthRatio * zoomMultiplier;
  const scale = targetFaceWidth / Math.max(1, hint.bbox.width);
  const cropWidth = clamp(Math.round(preset.outputWidth / scale), Math.round(width * (preset.cropWidthFloorRatio ?? 0.4)), width);
  const cropHeight = clamp(Math.round(preset.outputHeight / scale), Math.round(height * (preset.cropHeightFloorRatio ?? 0.5)), height);
  const cropLeft = clamp(
    Math.round(faceCenterX - cropWidth * ((preset.targetCenterX ?? 0.5) + (cropAdjustment?.centerShift ?? 0))),
    0,
    Math.max(0, width - cropWidth)
  );
  const cropTop = clamp(
    Math.round(eyeLineY - cropHeight * ((preset.eyeLineRatio ?? 0.38) + (cropAdjustment?.topShift ?? 0))),
    0,
    Math.max(0, height - cropHeight)
  );
  const faceCenterWithinCropX = faceCenterX - cropLeft;
  const eyeLineWithinCropY = eyeLineY - cropTop;
  const rotation = hint.leftEye && hint.rightEye
    ? Math.atan2(hint.rightEye.y - hint.leftEye.y, hint.rightEye.x - hint.leftEye.x) * (180 / Math.PI)
    : 0;

  let pipeline = sharp(inputBuffer).extract({
    left: cropLeft,
    top: cropTop,
    width: cropWidth,
    height: cropHeight
  });

  if (Math.abs(rotation) > 1 && Math.abs(rotation) < 15) {
    pipeline = pipeline.rotate(-rotation, { background: '#ffffff' });
  }

  const buffer = await pipeline
    .resize(preset.outputWidth, preset.outputHeight, {
      fit: 'cover',
      position: 'centre'
    })
    .toBuffer();

  return {
    buffer,
    geometry: {
      outputWidth: preset.outputWidth,
      outputHeight: preset.outputHeight,
      faceWidthRatio: hint.bbox.width / Math.max(1, cropWidth),
      eyeLineRatio: eyeLineWithinCropY / Math.max(1, cropHeight),
      faceCenterRatioX: faceCenterWithinCropX / Math.max(1, cropWidth),
      rotation,
      crop: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight },
      sourceBox: hint.bbox
    }
  };
}
