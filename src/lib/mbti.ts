// Shared MBTI data for the MBTI test, love compatibility and game match tools. Descriptions are original copy.

export const MBTI_TYPES = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'] as const;
export type MbtiType = (typeof MBTI_TYPES)[number];

export const isMbti = (value: string): value is MbtiType => (MBTI_TYPES as readonly string[]).includes(value);

type TypeInfo = { nickname: string; emoji: string; color: string; summary: string; strengths: string[]; love: string };

export const MBTI_INFO: Record<MbtiType, TypeInfo> = {
  ISTJ: { nickname: '믿음직한 원칙주의자', emoji: '📘', color: '#2563EB', summary: '약속과 계획을 소중히 여기고, 맡은 일은 끝까지 해내는 성실한 타입이에요.', strengths: ['책임감', '꼼꼼함', '꾸준함'], love: '말보다 행동으로 오래 챙겨 주는 연애를 해요.' },
  ISFJ: { nickname: '다정한 수호자', emoji: '🧸', color: '#0EA5E9', summary: '주변 사람의 작은 변화도 알아채고 조용히 챙겨 주는 따뜻한 타입이에요.', strengths: ['배려', '성실함', '기억력'], love: '상대의 취향과 기념일을 잊지 않는 섬세한 연인이에요.' },
  INFJ: { nickname: '깊은 통찰의 조언자', emoji: '🔮', color: '#7C3AED', summary: '사람의 속마음을 잘 읽고, 의미 있는 관계와 가치를 추구하는 타입이에요.', strengths: ['통찰력', '공감', '신념'], love: '깊은 대화로 마음이 통하는 관계를 원해요.' },
  INTJ: { nickname: '큰 그림의 설계자', emoji: '♟️', color: '#4F46E5', summary: '목표를 세우면 가장 효율적인 길을 찾아 차근차근 실행하는 전략가예요.', strengths: ['분석력', '독립성', '계획력'], love: '서로의 성장을 응원하는 동반자 같은 연애를 해요.' },
  ISTP: { nickname: '침착한 해결사', emoji: '🔧', color: '#64748B', summary: '문제가 생기면 말없이 원인을 찾아 뚝딱 해결하는 실용파예요.', strengths: ['침착함', '손재주', '적응력'], love: '부담 없이 함께 무언가를 하는 시간을 좋아해요.' },
  ISFP: { nickname: '감성 가득 예술가', emoji: '🎨', color: '#EC4899', summary: '지금 이 순간의 아름다움을 즐기고, 자기만의 취향이 뚜렷한 타입이에요.', strengths: ['감수성', '유연함', '친절'], love: '작은 선물과 다정한 표현으로 마음을 전해요.' },
  INFP: { nickname: '따뜻한 이상주의자', emoji: '🌙', color: '#A855F7', summary: '마음속에 자기만의 세계와 가치가 있고, 진심을 중요하게 여기는 타입이에요.', strengths: ['진정성', '상상력', '공감'], love: '진심이 통하는 한 사람에게 깊이 빠지는 로맨티스트예요.' },
  INTP: { nickname: '호기심 많은 탐구자', emoji: '🧪', color: '#06B6D4', summary: '궁금한 건 끝까지 파고들고, 새로운 아이디어를 떠올리는 걸 즐겨요.', strengths: ['논리력', '창의성', '객관성'], love: '대화가 잘 통하는 친구 같은 연인을 원해요.' },
  ESTP: { nickname: '행동파 모험가', emoji: '🏄', color: '#F97316', summary: '생각보다 행동이 먼저! 현장에서 빛나는 에너지 넘치는 타입이에요.', strengths: ['순발력', '대담함', '사교성'], love: '같이 새로운 경험을 하며 설렘을 이어 가요.' },
  ESFP: { nickname: '분위기 메이커', emoji: '🎉', color: '#F43F5E', summary: '어디서든 사람들을 웃게 만들고, 즐거움을 나누는 걸 좋아해요.', strengths: ['유쾌함', '친화력', '긍정'], love: '표현이 풍부하고 함께 있으면 즐거운 연인이에요.' },
  ENFP: { nickname: '아이디어 뱅크', emoji: '🌈', color: '#EAB308', summary: '새로운 가능성에 설레고, 사람과 아이디어 모두에 열정적인 타입이에요.', strengths: ['열정', '창의성', '친화력'], love: '매일이 이벤트 같은 다정하고 활기찬 연애를 해요.' },
  ENTP: { nickname: '재치 있는 토론가', emoji: '💡', color: '#14B8A6', summary: '틀을 깨는 질문과 재치 있는 말로 새로운 길을 찾아내는 타입이에요.', strengths: ['재치', '도전정신', '말솜씨'], love: '티키타카가 잘 맞는 대화형 연애를 좋아해요.' },
  ESTJ: { nickname: '든든한 리더', emoji: '📋', color: '#1D4ED8', summary: '규칙과 효율을 중시하고, 일을 체계적으로 정리해 이끄는 타입이에요.', strengths: ['추진력', '책임감', '조직력'], love: '계획적으로 데이트를 챙기는 믿음직한 연인이에요.' },
  ESFJ: { nickname: '모두의 다정한 친구', emoji: '🤝', color: '#DB2777', summary: '사람들 사이의 분위기를 잘 챙기고, 함께하는 즐거움을 소중히 여겨요.', strengths: ['배려', '사교성', '성실함'], love: '애정 표현이 확실하고 상대를 세심하게 챙겨요.' },
  ENFJ: { nickname: '열정적인 응원단장', emoji: '🌟', color: '#F59E0B', summary: '사람의 잠재력을 믿고 함께 성장하도록 이끄는 따뜻한 리더예요.', strengths: ['리더십', '공감', '소통'], love: '상대를 진심으로 응원하고 함께 성장하는 연애를 해요.' },
  ENTJ: { nickname: '타고난 지휘관', emoji: '🚀', color: '#DC2626', summary: '목표가 정해지면 사람과 자원을 모아 빠르게 밀어붙이는 추진력의 아이콘이에요.', strengths: ['결단력', '전략', '추진력'], love: '함께 미래를 그리며 목표를 이루는 파트너를 원해요.' }
};

// Popular "best match" pairings, used as the top tier of the compatibility score.
const BEST_MATCH: Record<MbtiType, MbtiType[]> = {
  INFP: ['ENFJ', 'ENTJ'], ENFP: ['INFJ', 'INTJ'], INFJ: ['ENFP', 'ENTP'], INTJ: ['ENFP', 'ENTP'],
  ISFP: ['ENFJ', 'ESFJ', 'ESTJ'], ISTP: ['ESFJ', 'ESTJ'], ISFJ: ['ESFP', 'ESTP'], ISTJ: ['ESFP', 'ESTP'],
  ESFP: ['ISFJ', 'ISTJ'], ESTP: ['ISFJ', 'ISTJ'], ESFJ: ['ISFP', 'ISTP'], ESTJ: ['ISFP', 'ISTP', 'INTP'],
  ENFJ: ['INFP', 'ISFP'], ENTJ: ['INFP', 'INTP'], ENTP: ['INFJ', 'INTJ'], INTP: ['ENTJ', 'ESTJ']
};

export const bestMatchesOf = (type: MbtiType) => BEST_MATCH[type];

/** 0-100 pair score: best matches score highest, otherwise shared intuition/judging and complementary energy help. */
export const mbtiPairScore = (a: MbtiType, b: MbtiType) => {
  if (BEST_MATCH[a].includes(b) || BEST_MATCH[b].includes(a)) return 96;
  let score = 58;
  if (a[1] === b[1]) score += 14; // S/N: same way of seeing the world
  if (a[0] !== b[0]) score += 8; // E/I: one leads, one listens
  if (a[2] !== b[2]) score += 6; // T/F: balance of head and heart
  else score += 3;
  if (a[3] === b[3]) score += 5; // J/P: same pace for plans
  if (a === b) score -= 4;
  return Math.min(92, score);
};
