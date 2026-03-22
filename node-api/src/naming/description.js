const slotLabelMap = {
  heaven: '천격',
  human: '인격',
  earth: '지격',
  outer: '외격',
  total: '총격'
};

const gradeToneMap = {
  대길: '핵심 격수가 단단하게 받쳐주는 안정형 흐름',
  길: '무난하면서도 상승 여지가 보이는 균형형 흐름',
  보통: '강점과 보완 포인트가 함께 보이는 혼합형 흐름',
  주의: '보완 설명이 함께 필요한 변동형 흐름'
};

const splitKeywords = (value) => String(value ?? '')
  .split(/[\\/,\s]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

const summarizeKeywords = (items) => unique(items).slice(0, 4).join(', ');

const countValues = (items) => items.reduce((acc, item) => {
  acc[item] = (acc[item] ?? 0) + 1;
  return acc;
}, {});

const getPrimaryElement = (elements) => {
  const counts = countValues(elements);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const getMissingElements = (elements) => {
  const full = ['목', '화', '토', '금', '수'];
  const current = new Set(elements);
  return full.filter((item) => !current.has(item));
};

export function buildNameExplanation({ surname, given, grids, scoreResult, metaMap }) {
  const name = `${surname}${given.join('')}`;
  const chars = [surname, ...given];
  const parts = chars.map((char) => ({
    hanja: char,
    meta: metaMap.get(char) ?? null
  }));

  const meanings = parts.map((part) => part.meta?.meaning).filter(Boolean);
  const elements = parts.map((part) => part.meta?.element).filter(Boolean);
  const yinYang = parts.map((part) => part.meta?.yinyang).filter(Boolean);
  const keywords = parts.flatMap((part) => splitKeywords(part.meta?.keywords));
  const strongSlots = scoreResult.details
    .filter((detail) => detail.grade === '대길' || detail.grade === '길')
    .slice(0, 3)
    .map((detail) => `${slotLabelMap[detail.slot]} ${detail.number}`);

  const primaryElement = getPrimaryElement(elements);
  const missingElements = getMissingElements(elements);
  const yinCount = yinYang.filter((value) => value === '음').length;
  const yangCount = yinYang.filter((value) => value === '양').length;

  const summary = [
    `${name}은 ${scoreResult.grade} 흐름으로 읽히는 이름입니다.`,
    strongSlots.length > 0 ? `특히 ${strongSlots.join(', ')}이 받쳐주며` : '오격 배치는 전반을 무난하게 받쳐주며',
    `${gradeToneMap[scoreResult.grade] ?? '현재 흐름'}이 드러납니다.`
  ].join(' ');

  const aiDosa = [
    `${name}은 첫인상에서 ${summarizeKeywords(keywords) || '정돈된 흐름'} 기운이 먼저 느껴집니다.`,
    strongSlots.length > 0 ? `${strongSlots.join(', ')}이 중심을 잡아주고` : '주요 격수의 균형이 이어지고',
    `${primaryElement ? `${primaryElement} 기운이 중심축을 만들며` : '기본 오행 흐름이 이어지며'} 이름의 방향성을 또렷하게 남깁니다.`,
    'AI 도사 평가는 재미 요소를 포함한 해석이므로 참고용으로 가볍게 보시면 좋습니다.'
  ].join(' ');

  return {
    summary,
    aiDosa,
    sections: {
      hanjaElement: parts
        .map((part) => {
          const meta = part.meta;
          return `${meta?.reading || part.hanja}(${part.hanja})는 ${meta?.meaning || '의미 정보 없음'} 뜻을 바탕으로 ${meta?.element || '-'} 오행, ${meta?.yinyang || '-'} 흐름을 가집니다.`;
        })
        .join(' '),
      strokeFlow: `천격 ${grids.heaven}, 인격 ${grids.human}, 지격 ${grids.earth}, 외격 ${grids.outer}, 총격 ${grids.total}로 계산됩니다. ${strongSlots.length > 0 ? `${strongSlots.join(', ')}이 길한 축으로 읽히며` : '핵심 격수의 연결을 먼저 살펴볼 수 있으며'} ${scoreResult.grade} 쪽 해석이 중심입니다.`,
      yinYangBalance: yinYang.length > 0
        ? `음 ${yinCount}, 양 ${yangCount} 분포로 보이며 ${Math.abs(yinCount - yangCount) <= 1 ? '음양 균형이 비교적 고른 편입니다.' : yinCount > yangCount ? '음의 기운이 조금 더 두드러져 차분함과 내면성이 강조됩니다.' : '양의 기운이 조금 더 강해 추진력과 외향성이 먼저 드러납니다.'}`
        : '음양 데이터가 연결되면 이름 내부 균형을 더 정교하게 해석할 수 있습니다.',
      soundFlow: `${name}은 ${given.length >= 2 ? '호흡이 자연스럽게 이어지는' : '짧고 선명하게 남는'} 발음 흐름을 가집니다. 독음은 ${parts.map((part) => part.meta?.reading).filter(Boolean).join('·') || '이름 발음'}으로 이어지며 듣는 사람에게 ${keywords.length > 0 ? summarizeKeywords(keywords) : '정리된'} 인상을 남기기 쉽습니다.`,
      meaningStory: meanings.length > 0
        ? `${meanings.join(', ')}의 뜻이 순서대로 이어지며 ${summarizeKeywords(keywords) || '이름의 핵심 방향성'}을 만드는 구조입니다. 그래서 이 이름은 단순히 보기 좋은 이름보다 메시지와 성향이 함께 읽히는 편입니다.`
        : '한자 의미 데이터가 확장되면 이름 전체를 하나의 이야기처럼 읽는 스토리 해석을 더 풍부하게 붙일 수 있습니다.',
      sajuBridge: `${missingElements.length > 0 ? `이름 내부 기준으로는 ${missingElements.join(', ')} 오행이 상대적으로 비어 보입니다.` : '이름 자체 오행은 다섯 축이 고르게 드러나는 편입니다.'} 생년월일과 성별을 함께 넣으면 부족 오행 보완형 사주 해석으로 자연스럽게 이어서 볼 수 있습니다.`
    },
    meta: {
      primaryElement,
      missingElements,
      keywords: unique(keywords),
      strongSlots
    }
  };
}
