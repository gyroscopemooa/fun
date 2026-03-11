import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const suitAssetDir = path.join(__dirname, 'assets', 'suits');
const suitTemplateCache = new Map();

function estimateGender(faceHint) {
  const raw = String(
    faceHint?.genderEstimate
    ?? faceHint?.gender
    ?? faceHint?.sex
    ?? ''
  ).toLowerCase();
  if (raw.includes('female') || raw.includes('woman')) return 'female';
  if (raw.includes('male') || raw.includes('man')) return 'male';
  return 'neutral';
}

function getFaceMetrics(faceHint) {
  const bbox = faceHint?.bbox ?? {};
  const width = Number(bbox.width ?? 0);
  const height = Number(bbox.height ?? 0);
  const centerX = Number(bbox.x ?? 0) + width / 2;
  const centerY = Number(bbox.y ?? 0) + height / 2;
  const eyeTilt = faceHint?.leftEye && faceHint?.rightEye
    ? Math.abs(Number(faceHint.leftEye.y ?? 0) - Number(faceHint.rightEye.y ?? 0))
    : 0;
  return {
    faceWidthRatio: width,
    faceHeightRatio: height,
    faceCenterX: centerX,
    faceCenterY: centerY,
    faceAspectRatio: width > 0 ? height / width : 0,
    eyeTilt
  };
}

function buildFaceHintFromGeometry(geometry) {
  if (!geometry) return null;
  const faceWidthRatio = Number(geometry.faceWidthRatio ?? 0);
  const faceCenterRatioX = Number(geometry.faceCenterRatioX ?? 0.5);
  const eyeLineRatio = Number(geometry.eyeLineRatio ?? 0.38);
  const sourceBox = geometry.sourceBox ?? null;
  const sourceAspect = sourceBox?.width > 0 ? Number(sourceBox.height ?? 0) / Number(sourceBox.width) : 1.24;
  const faceHeightRatio = clamp(faceWidthRatio * clamp(sourceAspect, 1.05, 1.45), 0.32, 0.62);
  const bboxX = clamp(faceCenterRatioX - faceWidthRatio / 2, 0.08, 0.92 - faceWidthRatio);
  const bboxY = clamp(eyeLineRatio - faceHeightRatio * 0.38, 0.06, 0.72 - faceHeightRatio);
  return {
    bbox: {
      x: bboxX,
      y: bboxY,
      width: clamp(faceWidthRatio, 0.2, 0.58),
      height: faceHeightRatio
    },
    leftEye: null,
    rightEye: null
  };
}

function buildSuitSelectionSummary({ gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered }) {
  const parts = [
    `gender=${gender}`,
    `faceWidth=${metrics.faceWidthRatio.toFixed(2)}`,
    `faceCenter=${metrics.faceCenterX.toFixed(2)}/${metrics.faceCenterY.toFixed(2)}`,
  ];
  if (looksClose) parts.push('close-frame');
  if (portraitStyleHeadshot) parts.push('portrait-headshot');
  if (stronglyCentered) parts.push('well-centered');
  if (metrics.eyeTilt > 0.03) parts.push(`eye-tilt=${metrics.eyeTilt.toFixed(3)}`);
  return parts.join(' · ');
}

function resolveSuitTemplate({ toolType, faceHint }) {
  const gender = estimateGender(faceHint);
  const metrics = getFaceMetrics(faceHint);
  const looksClose = metrics.faceWidthRatio >= 0.38 || metrics.faceHeightRatio >= 0.56;
  const portraitStyleHeadshot = toolType === 'headshot' && metrics.faceCenterY < 0.48;
  const stronglyCentered = Math.abs(metrics.faceCenterX - 0.5) < 0.08;
  const summary = buildSuitSelectionSummary({ gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered });

  if (toolType === 'passport_photo') {
    return {
      template: gender === 'female' ? 'female_blazer' : 'business_suit',
      reason: gender === 'female'
        ? 'passport_photo + female estimate prefers a formal blazer silhouette'
        : 'passport_photo defaults to the most conservative business suit',
      summary,
      inputs: { gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered }
    };
  }
  if (gender === 'female' && (looksClose || stronglyCentered)) {
    return {
      template: 'female_blazer',
      reason: 'female estimate with close or centered framing prefers female_blazer',
      summary,
      inputs: { gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered }
    };
  }
  if (toolType === 'headshot') {
    return {
      template: portraitStyleHeadshot ? 'business_suit' : 'casual_jacket',
      reason: portraitStyleHeadshot
        ? 'headshot with high face position switches to business_suit for a tighter portrait crop'
        : 'headshot defaults to casual_jacket for a softer shoulder framing',
      summary,
      inputs: { gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered }
    };
  }
  if (metrics.faceAspectRatio > 1.28 || metrics.eyeTilt > 0.035) {
    return {
      template: 'business_suit',
      reason: 'elongated face ratio or eye tilt uses business_suit to stabilize the neckline visually',
      summary,
      inputs: { gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered }
    };
  }
  return {
    template: 'business_suit',
    reason: 'default formal fallback',
    summary,
    inputs: { gender, metrics, looksClose, portraitStyleHeadshot, stronglyCentered }
  };
}

async function getSuitTemplateAsset(template) {
  if (suitTemplateCache.has(template)) return suitTemplateCache.get(template);
  const filePath = path.join(suitAssetDir, `${template}.svg`);
  const content = await fs.readFile(filePath, 'utf8');
  suitTemplateCache.set(template, content);
  return content;
}

function replaceTemplateTokens(template, tokens) {
  return Object.entries(tokens).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

function buildBusinessSuitTokens({ width, height, variant, shading = 1, toolType, faceHint = null }) {
  const metrics = getFaceMetrics(faceHint);
  const faceWidthPx = metrics.faceWidthRatio > 0 ? metrics.faceWidthRatio * width : width * 0.28;
  const faceBottomY = metrics.faceHeightRatio > 0 ? (Number(faceHint?.bbox?.y ?? 0) + Number(faceHint?.bbox?.height ?? 0)) * height : height * 0.42;
  const shoulderWidth = clamp(faceWidthPx * (toolType === 'headshot' ? 1.58 : 1.68), width * 0.52, width * 0.68);
  const shoulderLeft = (width - shoulderWidth) / 2;
  const shoulderRight = shoulderLeft + shoulderWidth;
  const jacketTop = clamp(faceBottomY + height * (toolType === 'headshot' ? 0.055 : 0.07), height * 0.57, height * 0.65);
  const shirtTop = jacketTop - height * 0.012;
  const centerX = width / 2;
  const collarSpread = shoulderWidth * 0.082;
  const lapelInset = shoulderWidth * 0.14;
  const hemY = height;
  const tieWidth = width * 0.016;
  return {
    WIDTH: width,
    HEIGHT: height,
    JACKET_COLOR_TOP: variant === 'polished' ? '#172338' : '#1E2B43',
    JACKET_COLOR_BOTTOM: '#111A2B',
    LAPEL_COLOR_TOP: '#24344C',
    LAPEL_COLOR_BOTTOM: '#172233',
    SHIRT_COLOR_TOP: '#FFFFFF',
    SHIRT_COLOR_BOTTOM: '#F1F5F9',
    ACCENT_COLOR_TOP: variant === 'bright' ? '#315A8A' : '#213E63',
    ACCENT_COLOR_BOTTOM: '#132744',
    SHADOW_TOP: `rgba(15,23,42,${0.1 + (shading - 1) * 0.04})`,
    SHADOW_BOTTOM: 'rgba(15,23,42,0)',
    SHOULDER_LEFT: shoulderLeft,
    SHOULDER_RIGHT: shoulderRight,
    HEM_Y: hemY,
    JACKET_TOP_Y: jacketTop,
    SHIRT_TOP_Y: shirtTop,
    LEFT_CURVE_A_X: shoulderLeft + shoulderWidth * 0.02,
    LEFT_CURVE_A_Y: height * 0.82,
    LEFT_CURVE_B_X: shoulderLeft + shoulderWidth * 0.04,
    LEFT_CURVE_B_Y: height * 0.74,
    LEFT_CURVE_C_X: shoulderLeft + shoulderWidth * 0.11,
    LEFT_LAPEL_X: centerX - lapelInset,
    LEFT_CENTER_HEM_X: centerX - shoulderWidth * 0.012,
    RIGHT_CURVE_A_X: shoulderRight - shoulderWidth * 0.02,
    RIGHT_CURVE_A_Y: height * 0.82,
    RIGHT_CURVE_B_X: shoulderRight - shoulderWidth * 0.04,
    RIGHT_CURVE_B_Y: height * 0.74,
    RIGHT_CURVE_C_X: shoulderRight - shoulderWidth * 0.11,
    RIGHT_LAPEL_X: centerX + lapelInset,
    RIGHT_CENTER_HEM_X: centerX + shoulderWidth * 0.012,
    CENTER_X: centerX,
    LEFT_COLLAR_X: centerX - collarSpread * 0.24,
    LEFT_COLLAR_Y: jacketTop + height * 0.03,
    RIGHT_COLLAR_X: centerX + collarSpread * 0.24,
    RIGHT_COLLAR_Y: jacketTop + height * 0.03,
    LAPEL_CENTER_Y: jacketTop + height * 0.065,
    LEFT_CENTER_LINE_X: centerX - shoulderWidth * 0.01,
    RIGHT_CENTER_LINE_X: centerX + shoulderWidth * 0.01,
    CENTER_LINE_END_Y: height * 0.86,
    LEFT_OUTER_LINE_X: centerX - shoulderWidth * 0.05,
    LEFT_OUTER_LINE_Y: height * 0.72,
    RIGHT_OUTER_LINE_X: centerX + shoulderWidth * 0.05,
    RIGHT_OUTER_LINE_Y: height * 0.72,
    SHIRT_LEFT_X: centerX - collarSpread,
    SHIRT_RIGHT_X: centerX + collarSpread,
    SHIRT_CURVE_Y: jacketTop + height * 0.02,
    SHIRT_HEM_RIGHT_X: centerX + shoulderWidth * 0.03,
    SHIRT_HEM_LEFT_X: centerX - shoulderWidth * 0.03,
    SHIRT_HEM_Y: height * 0.8,
    TIE_LEFT_X: centerX - tieWidth,
    TIE_RIGHT_X: centerX + tieWidth,
    TIE_TOP_Y: jacketTop + height * 0.018,
    TIE_HEM_RIGHT_X: centerX + tieWidth * 0.45,
    TIE_HEM_LEFT_X: centerX - tieWidth * 0.45,
    TIE_HEM_Y: height * 0.72,
    TIE_KNOT_LEFT_X: centerX - tieWidth * 1.1,
    TIE_KNOT_RIGHT_X: centerX + tieWidth * 1.1,
    TIE_KNOT_Y: jacketTop + height * 0.008,
    TIE_POINT_Y: jacketTop + height * 0.03,
    ACCENT_OPACITY: 0.9,
    CENTER_LINE_WIDTH: Math.max(1, width * 0.0018),
    SHADOW_Y: jacketTop + height * 0.012,
    SHADOW_RX: shoulderWidth * 0.18,
    SHADOW_RY: height * 0.015,
    GLOW_START_X: shoulderLeft + shoulderWidth * 0.12,
    GLOW_END_X: shoulderRight - shoulderWidth * 0.12,
    GLOW_Y: jacketTop + height * 0.014,
    GLOW_CONTROL_Y: jacketTop + height * 0.014,
    GLOW_WIDTH: height * 0.012
  };
}

function buildCasualJacketTokens({ width, height, shading = 1 }) {
  const shoulderWidth = clamp(width * 0.84, width * 0.72, width * 0.92);
  const shoulderLeft = (width - shoulderWidth) / 2;
  const shoulderRight = shoulderLeft + shoulderWidth;
  const jacketTop = clamp(height * 0.6, height * 0.54, height * 0.7);
  const centerX = width / 2;
  const collarSpread = shoulderWidth * 0.17;
  return {
    WIDTH: width,
    HEIGHT: height,
    JACKET_COLOR_TOP: '#46556A',
    JACKET_COLOR_BOTTOM: '#1F2937',
    LAPEL_COLOR_TOP: '#5B6B82',
    LAPEL_COLOR_BOTTOM: '#243042',
    SHIRT_COLOR_TOP: '#F8FAFC',
    SHIRT_COLOR_BOTTOM: '#E2E8F0',
    ACCENT_COLOR_TOP: '#CBD5E1',
    ACCENT_COLOR_BOTTOM: '#94A3B8',
    SHADOW_TOP: `rgba(15,23,42,${0.2 + (shading - 1) * 0.06})`,
    SHADOW_BOTTOM: 'rgba(15,23,42,0)',
    SHOULDER_LEFT: shoulderLeft,
    SHOULDER_RIGHT: shoulderRight,
    HEM_Y: height,
    JACKET_TOP_Y: jacketTop,
    LEFT_CURVE_A_X: shoulderLeft + width * 0.05,
    LEFT_CURVE_A_Y: height * 0.76,
    LEFT_CURVE_B_X: shoulderLeft + width * 0.1,
    LEFT_CURVE_B_Y: height * 0.66,
    LEFT_CURVE_C_X: shoulderLeft + width * 0.14,
    RIGHT_CURVE_A_X: shoulderRight - width * 0.05,
    RIGHT_CURVE_A_Y: height * 0.76,
    RIGHT_CURVE_B_X: shoulderRight - width * 0.1,
    RIGHT_CURVE_B_Y: height * 0.66,
    RIGHT_CURVE_C_X: shoulderRight - width * 0.14,
    CENTER_X: centerX,
    CENTER_LEFT_COLLAR_X: centerX - collarSpread,
    CENTER_RIGHT_COLLAR_X: centerX + collarSpread,
    LEFT_CENTER_HEM_X: centerX - shoulderWidth * 0.04,
    RIGHT_CENTER_HEM_X: centerX + shoulderWidth * 0.04,
    SHIRT_CURVE_Y: jacketTop + height * 0.065,
    SHIRT_HEM_RIGHT_X: centerX + shoulderWidth * 0.06,
    SHIRT_HEM_LEFT_X: centerX - shoulderWidth * 0.06,
    SHIRT_HEM_Y: height * 0.9,
    LEFT_COLLAR_OUTER_X: centerX - collarSpread * 0.86,
    LEFT_COLLAR_OUTER_Y: jacketTop + height * 0.01,
    LEFT_COLLAR_INNER_X: centerX - collarSpread * 0.1,
    LEFT_COLLAR_INNER_Y: jacketTop + height * 0.11,
    LEFT_LAPEL_HEM_X: centerX - shoulderWidth * 0.1,
    LEFT_LAPEL_HEM_Y: height * 0.82,
    RIGHT_COLLAR_OUTER_X: centerX + collarSpread * 0.86,
    RIGHT_COLLAR_OUTER_Y: jacketTop + height * 0.01,
    RIGHT_COLLAR_INNER_X: centerX + collarSpread * 0.1,
    RIGHT_COLLAR_INNER_Y: jacketTop + height * 0.11,
    RIGHT_LAPEL_HEM_X: centerX + shoulderWidth * 0.1,
    RIGHT_LAPEL_HEM_Y: height * 0.82,
    ACCENT_X: centerX - width * 0.055,
    ACCENT_Y: jacketTop + height * 0.15,
    ACCENT_WIDTH: width * 0.11,
    ACCENT_HEIGHT: height * 0.012,
    ACCENT_RX: height * 0.006,
    SHADOW_Y: jacketTop + height * 0.03,
    SHADOW_RX: shoulderWidth * 0.3,
    SHADOW_RY: height * 0.035,
    GLOW_START_X: shoulderLeft + shoulderWidth * 0.08,
    GLOW_END_X: shoulderRight - shoulderWidth * 0.08,
    GLOW_Y: jacketTop + height * 0.04,
    GLOW_CONTROL_Y: jacketTop - height * 0.01,
    GLOW_WIDTH: height * 0.055
  };
}

function buildFemaleBlazerTokens({ width, height, shading = 1 }) {
  const shoulderWidth = clamp(width * 0.82, width * 0.7, width * 0.9);
  const shoulderLeft = (width - shoulderWidth) / 2;
  const shoulderRight = shoulderLeft + shoulderWidth;
  const jacketTop = clamp(height * 0.58, height * 0.52, height * 0.68);
  const centerX = width / 2;
  const lapelSpread = shoulderWidth * 0.16;
  return {
    WIDTH: width,
    HEIGHT: height,
    JACKET_COLOR_TOP: '#8362E8',
    JACKET_COLOR_BOTTOM: '#5B2FCB',
    LAPEL_COLOR_TOP: '#9B87F5',
    LAPEL_COLOR_BOTTOM: '#6D3FE0',
    SHIRT_COLOR_TOP: '#FFF7ED',
    SHIRT_COLOR_BOTTOM: '#FDE7D3',
    ACCENT_COLOR_TOP: '#F59E0B',
    ACCENT_COLOR_BOTTOM: '#B45309',
    SHADOW_TOP: `rgba(15,23,42,${0.22 + (shading - 1) * 0.06})`,
    SHADOW_BOTTOM: 'rgba(15,23,42,0)',
    SHOULDER_LEFT: shoulderLeft,
    SHOULDER_RIGHT: shoulderRight,
    HEM_Y: height,
    JACKET_TOP_Y: jacketTop,
    LEFT_CURVE_A_X: shoulderLeft + width * 0.05,
    LEFT_CURVE_A_Y: height * 0.75,
    LEFT_CURVE_B_X: shoulderLeft + width * 0.09,
    LEFT_CURVE_B_Y: height * 0.65,
    LEFT_CURVE_C_X: shoulderLeft + width * 0.13,
    RIGHT_CURVE_A_X: shoulderRight - width * 0.05,
    RIGHT_CURVE_A_Y: height * 0.75,
    RIGHT_CURVE_B_X: shoulderRight - width * 0.09,
    RIGHT_CURVE_B_Y: height * 0.65,
    RIGHT_CURVE_C_X: shoulderRight - width * 0.13,
    CENTER_X: centerX,
    CENTER_LEFT_LAPEL_X: centerX - lapelSpread,
    CENTER_RIGHT_LAPEL_X: centerX + lapelSpread,
    CENTER_LAPEL_Y: jacketTop + height * 0.02,
    LEFT_CENTER_HEM_X: centerX - shoulderWidth * 0.02,
    RIGHT_CENTER_HEM_X: centerX + shoulderWidth * 0.02,
    SHIRT_CURVE_Y: jacketTop + height * 0.14,
    SHIRT_HEM_RIGHT_X: centerX + shoulderWidth * 0.07,
    SHIRT_HEM_LEFT_X: centerX - shoulderWidth * 0.07,
    SHIRT_HEM_Y: height * 0.92,
    LEFT_LAPEL_OUTER_X: centerX - lapelSpread * 0.95,
    LEFT_LAPEL_INNER_X: centerX - lapelSpread * 0.12,
    LEFT_LAPEL_INNER_Y: jacketTop + height * 0.13,
    LEFT_LAPEL_HEM_X: centerX - shoulderWidth * 0.12,
    LEFT_LAPEL_HEM_Y: height * 0.78,
    RIGHT_LAPEL_OUTER_X: centerX + lapelSpread * 0.95,
    RIGHT_LAPEL_INNER_X: centerX + lapelSpread * 0.12,
    RIGHT_LAPEL_INNER_Y: jacketTop + height * 0.13,
    RIGHT_LAPEL_HEM_X: centerX + shoulderWidth * 0.12,
    RIGHT_LAPEL_HEM_Y: height * 0.78,
    BUTTON_TOP_Y: height * 0.82,
    BUTTON_BOTTOM_Y: height * 0.89,
    BUTTON_RADIUS: width * 0.012,
    SHADOW_Y: jacketTop + height * 0.04,
    SHADOW_RX: shoulderWidth * 0.28,
    SHADOW_RY: height * 0.038,
    GLOW_START_X: shoulderLeft + shoulderWidth * 0.09,
    GLOW_END_X: shoulderRight - shoulderWidth * 0.09,
    GLOW_Y: jacketTop + height * 0.05,
    GLOW_CONTROL_Y: jacketTop - height * 0.015,
    GLOW_WIDTH: height * 0.055
  };
}

export async function renderSuitOverlay({ width, height, variant = 'clean', toolType = 'id_photo', faceHint = null, geometry = null, shading = 1 }) {
  const resolvedFaceHint = faceHint?.bbox ? faceHint : buildFaceHintFromGeometry(geometry);
  const selection = resolveSuitTemplate({ toolType, faceHint: resolvedFaceHint });
  const template = selection.template;
  const svgTemplate = await getSuitTemplateAsset(template);
  const tokens = template === 'female_blazer'
    ? buildFemaleBlazerTokens({ width, height, shading })
    : template === 'casual_jacket'
      ? buildCasualJacketTokens({ width, height, shading })
      : buildBusinessSuitTokens({ width, height, variant, shading, toolType, faceHint: resolvedFaceHint });
  const overlaySvg = replaceTemplateTokens(svgTemplate, tokens);

  return {
    template,
    selection,
    overlay: Buffer.from(overlaySvg)
  };
}
