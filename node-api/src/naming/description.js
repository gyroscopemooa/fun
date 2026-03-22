const slotLabelMap = {
  heaven: '천격',
  human: '인격',
  earth: '지격',
  outer: '외격',
  total: '총격'
};

export function buildNameExplanation({ surname, given, scoreResult, metaMap }) {
  const name = `${surname}${given.join('')}`;
  const keywordText = given
    .map((char) => metaMap.get(char)?.keywords)
    .filter(Boolean)
    .join(', ');

  const strongSlots = scoreResult.details
    .filter((detail) => detail.grade === '대길' || detail.grade === '길')
    .map((detail) => `${slotLabelMap[detail.slot]} ${detail.number}`)
    .slice(0, 3);

  const lines = [
    `${name}은 현재 기준에서 ${scoreResult.grade} 흐름으로 읽히는 이름입니다.`,
    strongSlots.length > 0
      ? `강하게 받쳐주는 격은 ${strongSlots.join(', ')}입니다.`
      : '강한 길수 구간은 적지만 전체 균형을 보면서 해석할 수 있습니다.',
    keywordText
      ? `이름 의미는 ${keywordText} 방향으로 모이며 인상과 메시지를 함께 만듭니다.`
      : '이름 키워드 데이터는 아직 일부만 연결된 상태입니다.'
  ];

  return lines.join(' ');
}
