import { calculateFiveGrid } from './fiveGrid.js';
import { scoreFiveGrid } from './score.js';

const splitKeywords = (value) => String(value ?? '')
  .split(/[\\/,\s]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

const summarizeKeywords = (value) => unique(splitKeywords(value)).slice(0, 4).join(', ');

const buildRecommendationCopy = ({ item }) => {
  const parts = item.parts ?? [];
  const meanings = parts.map((part) => part.meta?.meaning).filter(Boolean);
  const readings = parts.map((part) => part.meta?.reading).filter(Boolean);
  const keywords = parts.flatMap((part) => splitKeywords(part.meta?.keywords));
  const keywordSummary = summarizeKeywords(keywords.join(', '));

  const reason = item.grade === '대길'
    ? `${readings.join('·') || item.given.join('')}은 인격 ${item.grids?.human ?? '-'}과 총격 ${item.grids?.total ?? '-'}의 흐름이 강하게 받쳐주는 대길형 후보입니다. ${keywordSummary ? `${keywordSummary} 기운이 또렷해` : '이름의 결이 선명해'} 프리미엄 개명 추천 상단에 올렸습니다.`
    : item.grade === '길'
      ? `${readings.join('·') || item.given.join('')}은 인격 ${item.grids?.human ?? '-'}과 지격 ${item.grids?.earth ?? '-'}이 무난하게 이어지는 길형 후보입니다. ${keywordSummary ? `${keywordSummary} 방향성이 자연스럽게 이어져` : '전반적 리듬이 안정적으로 이어져'} 부담 없이 검토하기 좋은 이름입니다.`
      : `${readings.join('·') || item.given.join('')}은 보완형으로 비교해볼 가치가 있는 후보입니다. 격수 흐름은 더 차분하지만 ${keywordSummary ? `${keywordSummary} 이미지가 살아 있어` : '이름 인상이 분명해'} 대안군으로 함께 제시합니다.`;

  const story = meanings.length > 0
    ? `${meanings.join(', ')}의 뜻이 순서대로 이어지며 ${keywordSummary || '이름의 중심 메시지'}를 만드는 구조입니다. 이름 전체를 읽었을 때 한자 뜻이 따로 놀지 않고 한 방향으로 모입니다.`
    : '한자 뜻풀이 데이터가 확장되면 이 후보의 스토리 해석도 더 풍부하게 연결됩니다.';

  return {
    reason,
    story
  };
};

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
    .map((item) => {
      const parts = item.given.map((char) => ({
        hanja: char,
        meta: metaMap.get(char) ?? null
      }));

      const copy = buildRecommendationCopy({
        item: {
          ...item,
          parts
        }
      });

      return {
        ...item,
        parts,
        recommendationReason: copy.reason,
        story: copy.story
      };
    });
}
