const DEFAULT_BG = '#FFFFFF';

export const TOOL_PRESETS = {
  id_photo: {
    outputWidth: 600,
    outputHeight: 800,
    faceWidthRatio: 0.43,
    eyeLineRatio: 0.38,
    targetCenterX: 0.5,
    cropWidthFloorRatio: 0.34,
    cropHeightFloorRatio: 0.44,
    minFaceWidthRatio: 0.28,
    maxFaceWidthRatio: 0.56,
    background: DEFAULT_BG
  },
  passport_photo: {
    outputWidth: 600,
    outputHeight: 800,
    faceWidthRatio: 0.46,
    eyeLineRatio: 0.42,
    targetCenterX: 0.5,
    cropWidthFloorRatio: 0.32,
    cropHeightFloorRatio: 0.42,
    minFaceWidthRatio: 0.32,
    maxFaceWidthRatio: 0.58,
    background: DEFAULT_BG
  },
  headshot: {
    outputWidth: 800,
    outputHeight: 1000,
    faceWidthRatio: 0.34,
    eyeLineRatio: 0.36,
    targetCenterX: 0.5,
    cropWidthFloorRatio: 0.5,
    cropHeightFloorRatio: 0.62,
    minFaceWidthRatio: 0.26,
    maxFaceWidthRatio: 0.46,
    background: '#F8FAFC'
  }
};

export const VARIANT_PROFILES = [
  { name: 'clean', brightness: 1.02, saturation: 1.01, sharpen: 1.05, contrast: 1.02 },
  { name: 'bright', brightness: 1.07, saturation: 1.02, sharpen: 1.15, contrast: 1.03 },
  { name: 'polished', brightness: 1.04, saturation: 1.0, sharpen: 1.12, contrast: 1.05 }
];

export function getToolPreset(toolType) {
  return TOOL_PRESETS[toolType] ?? TOOL_PRESETS.id_photo;
}
