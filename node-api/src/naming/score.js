const gradeScoreMap = {
  대길: 20,
  길: 10,
  미정: 0,
  흉: -10
};

export function scoreFiveGrid(grids, luckMap) {
  let score = 0;

  const details = Object.entries(grids).map(([slot, value]) => {
    const luck = luckMap.get(value) ?? {
      number: String(value),
      grade: '미정',
      summary: '기준 데이터 보강 필요',
      keywords: 'seed'
    };

    score += gradeScoreMap[luck.grade] ?? 0;

    return {
      slot,
      number: value,
      grade: luck.grade,
      summary: luck.summary,
      keywords: luck.keywords
    };
  });

  const grade = score >= 60
    ? '대길'
    : score >= 20
      ? '길'
      : score >= 0
        ? '보통'
        : '주의';

  return {
    score,
    grade,
    details
  };
}
