export function buildNameExplanation({ surname, given, grids, scoreResult, metaMap }) {
  const givenKeywords = given
    .map((char) => metaMap.get(char)?.keywords)
    .filter(Boolean)
    .join(', ');

  const strongSlots = scoreResult.details
    .filter((detail) => detail.grade === '대길' || detail.grade === '길')
    .map((detail) => `${slotLabelMap[detail.slot]} ${detail.number}`)
    .slice(0, 3);

  return [
    `${surname}${given.join('')}은 현재 기준에서 ${scoreResult.grade} 흐름으로 분류됩니다.`,
    strongSlots.length > 0 ? `강하게 받는 격은 ${strongSlots.join(', ')}입니다.` : '길흉 기준표가 아직 일부 미정이라 보수적으로 해석했습니다.',
    givenKeywords ? `이름자 키워드는 ${givenKeywords} 축으로 읽을 수 있습니다.` : '이름자 키워드 데이터는 아직 일부만 연결된 상태입니다.'
  ].join(' ');
}

const slotLabelMap = {
  heaven: '천격',
  human: '인격',
  earth: '지격',
  outer: '외격',
  total: '총격'
};
