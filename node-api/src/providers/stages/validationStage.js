import { getToolPreset } from '../pipelineConfig.js';

function buildQualityFeedback({ issues, metrics, toolType, qualityScore }) {
  const feedback = [];

  if (!issues.includes('center_alignment_out_of_bounds')) {
    feedback.push('얼굴 중앙 정렬이 안정적입니다.');
  } else if ((metrics.centerX ?? 0.5) < 0.5) {
    feedback.push('얼굴이 왼쪽으로 치우쳐 있어 중앙에 더 맞추는 편이 좋습니다.');
  } else {
    feedback.push('얼굴이 오른쪽으로 치우쳐 있어 중앙에 더 맞추는 편이 좋습니다.');
  }

  if (!issues.includes('face_ratio_out_of_bounds')) {
    feedback.push('얼굴 비율이 규격 범위 안에 있습니다.');
  } else if ((metrics.faceWidthRatio ?? 0) < getToolPreset(toolType).minFaceWidthRatio) {
    feedback.push('얼굴이 작게 보여 더 가까운 사진이 유리합니다.');
  } else {
    feedback.push('얼굴이 너무 크게 보여 여백이 부족합니다.');
  }

  if (!issues.includes('top_head_margin_out_of_bounds')) {
    feedback.push('머리 상단 여백이 자연스럽습니다.');
  } else if ((metrics.topHeadMarginRatio ?? 0) < 0.1) {
    feedback.push('머리 위 여백이 부족해 답답해 보일 수 있습니다.');
  } else {
    feedback.push('머리 위 여백이 많아 얼굴 존재감이 약해질 수 있습니다.');
  }

  if (!issues.includes('eye_line_out_of_bounds')) {
    feedback.push('눈 위치가 증명사진 기준에 가깝습니다.');
  } else {
    feedback.push('눈 위치가 규격 기준에서 벗어나 있어 크롭 재조정이 필요할 수 있습니다.');
  }

  if (issues.includes('resolution_below_minimum')) {
    feedback.push('원본 해상도가 낮아 세부 디테일이 흐릴 수 있습니다.');
  }

  let summary = '증명사진 규격이 전반적으로 안정적입니다.';
  if (qualityScore < 60) {
    summary = '규격 적합도가 낮아 재촬영 또는 다른 후보 선택이 좋습니다.';
  } else if (qualityScore < 85) {
    summary = '사용 가능하지만 여백과 정렬을 조금 더 다듬을 여지가 있습니다.';
  }

  return {
    summary,
    feedback
  };
}

export function qualityValidationStage({ geometry, toolType = 'id_photo' }) {
  const preset = getToolPreset(toolType);
  const faceWidthRatio = geometry?.faceWidthRatio ?? 0;
  const eyeLineRatio = geometry?.eyeLineRatio ?? 0;
  const centerX = geometry?.faceCenterRatioX ?? 0.5;
  const outputWidth = geometry?.outputWidth ?? preset.outputWidth;
  const outputHeight = geometry?.outputHeight ?? preset.outputHeight;
  const topHeadMarginRatio = Math.max(0, eyeLineRatio - 0.16);
  const centerBounds = toolType === 'passport_photo' ? [0.44, 0.56] : toolType === 'headshot' ? [0.36, 0.64] : [0.4, 0.6];
  const eyeBounds = toolType === 'passport_photo' ? [0.34, 0.46] : toolType === 'headshot' ? [0.28, 0.44] : [0.3, 0.46];
  const topMarginBounds = toolType === 'passport_photo' ? [0.12, 0.24] : toolType === 'headshot' ? [0.08, 0.22] : [0.1, 0.2];
  const issues = [];
  let qualityScore = 100;

  if (outputWidth < preset.outputWidth || outputHeight < preset.outputHeight) {
    issues.push('resolution_below_minimum');
    qualityScore -= 30;
  }
  if (faceWidthRatio < preset.minFaceWidthRatio || faceWidthRatio > preset.maxFaceWidthRatio) {
    issues.push('face_ratio_out_of_bounds');
    qualityScore -= 25;
  }
  if (eyeLineRatio < eyeBounds[0] || eyeLineRatio > eyeBounds[1]) {
    issues.push('eye_line_out_of_bounds');
    qualityScore -= 20;
  }
  if (centerX < centerBounds[0] || centerX > centerBounds[1]) {
    issues.push('center_alignment_out_of_bounds');
    qualityScore -= 15;
  }
  if (topHeadMarginRatio < topMarginBounds[0] || topHeadMarginRatio > topMarginBounds[1]) {
    issues.push('top_head_margin_out_of_bounds');
    qualityScore -= 10;
  }

  const safeQualityScore = Math.max(0, qualityScore);
  const qualityNarrative = buildQualityFeedback({
    issues,
    metrics: {
      faceWidthRatio,
      eyeLineRatio,
      centerX,
      topHeadMarginRatio,
      outputWidth,
      outputHeight
    },
    toolType,
    qualityScore: safeQualityScore
  });

  return {
    valid: issues.length === 0,
    issues,
    qualityScore: safeQualityScore,
    qualitySummary: qualityNarrative.summary,
    qualityFeedback: qualityNarrative.feedback,
    metrics: {
      faceWidthRatio,
      eyeLineRatio,
      centerX,
      topHeadMarginRatio,
      outputWidth,
      outputHeight
    }
  };
}
