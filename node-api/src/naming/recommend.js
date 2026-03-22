import { calculateFiveGrid } from './fiveGrid.js';
import { scoreFiveGrid } from './score.js';

export function recommendNames({ surname, surnameStroke, givenLength, topK, pool, luckMap, metaMap }) {
  const results = [];

  for (const first of pool) {
    if (givenLength === 1) {
      const grids = calculateFiveGrid({ surnameStroke, givenStrokes: [first.strokes] });
      const scoreResult = scoreFiveGrid(grids, luckMap);
      results.push({
        surname,
        given: [first.hanja],
        name: `${surname}${first.hanja}`,
        score: scoreResult.score,
        grade: scoreResult.grade,
        grids,
        keywords: first.meta?.keywords ?? ''
      });
      continue;
    }

    for (const second of pool) {
      const grids = calculateFiveGrid({ surnameStroke, givenStrokes: [first.strokes, second.strokes] });
      const scoreResult = scoreFiveGrid(grids, luckMap);
      const priorityBonus = Math.round(((first.priority ?? 0) + (second.priority ?? 0)) / 20);
      const finalScore = scoreResult.score + priorityBonus;

      results.push({
        surname,
        given: [first.hanja, second.hanja],
        name: `${surname}${first.hanja}${second.hanja}`,
        score: finalScore,
        grade: scoreResult.grade,
        grids,
        keywords: [first.meta?.keywords, second.meta?.keywords].filter(Boolean).join(', ')
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'))
    .slice(0, topK)
    .map((item) => ({
      ...item,
      parts: item.given.map((char) => ({
        hanja: char,
        meta: metaMap.get(char) ?? null
      }))
    }));
}
