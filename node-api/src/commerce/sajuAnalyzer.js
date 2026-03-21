import OpenAI from 'openai';
import { calculateFourPillars, lunarToSolar, solarToLunar } from '../vendor/manseryeok.mjs';

const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
const ELEMENT_ORDER = ['목', '화', '토', '금', '수'];
const ELEMENT_LABELS = {
  목: '목',
  화: '화',
  토: '토',
  금: '금',
  수: '수'
};
const STEM_ROLE_HINTS = {
  목: '확장과 성장',
  화: '표현과 추진',
  토: '정리와 완충',
  금: '판단과 기준',
  수: '정보와 흐름'
};

const scoredBlock = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number' },
    summary: { type: 'string' }
  },
  required: ['score', 'summary']
};

const sajuSchema = {
  name: 'manseryeok_saju_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string' },
      summary: { type: 'string' },
      personality: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      blind_spots: { type: 'array', items: { type: 'string' } },
      money: scoredBlock,
      relationship: scoredBlock,
      work: {
        type: 'object',
        additionalProperties: false,
        properties: {
          score: { type: 'number' },
          summary: { type: 'string' },
          suitable_roles: { type: 'array', items: { type: 'string' } }
        },
        required: ['score', 'summary', 'suitable_roles']
      },
      health: scoredBlock,
      yearly_flow: scoredBlock,
      fortunes: {
        type: 'object',
        additionalProperties: false,
        properties: {
          today: scoredBlock,
          this_week: scoredBlock,
          this_month: scoredBlock,
          first_half: scoredBlock,
          second_half: scoredBlock,
          this_year: scoredBlock
        },
        required: ['today', 'this_week', 'this_month', 'first_half', 'second_half', 'this_year']
      },
      life_stages: {
        type: 'object',
        additionalProperties: false,
        properties: {
          midlife: scoredBlock,
          later_years: scoredBlock
        },
        required: ['midlife', 'later_years']
      },
      keywords: { type: 'array', items: { type: 'string' } },
      advice: { type: 'array', items: { type: 'string' } },
      consistency_comment: { type: 'string' },
      reliability_comment: { type: 'string' },
      accuracy_comment: { type: 'string' }
    },
    required: [
      'headline',
      'summary',
      'personality',
      'strengths',
      'blind_spots',
      'money',
      'relationship',
      'work',
      'health',
      'yearly_flow',
      'fortunes',
      'life_stages',
      'keywords',
      'advice',
      'consistency_comment',
      'reliability_comment',
      'accuracy_comment'
    ]
  }
};

let client = null;

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  client ??= new OpenAI({ apiKey });
  return client;
};

const extractJson = (content) => {
  if (!content) throw new Error('OpenAI response content is empty');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('OpenAI response did not contain JSON');
  }
  return JSON.parse(content.slice(start, end + 1));
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const normalizeList = (items, limit = 6) => (
  Array.isArray(items)
    ? items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, limit)
    : []
);

const normalizeScoredBlock = (payload) => ({
  score: clamp(Number(payload?.score ?? 0)),
  summary: typeof payload?.summary === 'string' ? payload.summary.trim() : ''
});

const parseBirthDate = (birthDate) => {
  const match = String(birthDate ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('birthDate must be in YYYY-MM-DD format');
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

const parseBirthTime = (birthTime, timeUnknown) => {
  if (timeUnknown) return { hour: 12, minute: 0, known: false };
  const match = String(birthTime ?? '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new Error('birthTime must be in HH:MM format');
  return { hour: Number(match[1]), minute: Number(match[2]), known: true };
};

const formatDate = ({ year, month, day }) => `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;

const countElements = (detail) => {
  const counts = Object.fromEntries(ELEMENT_ORDER.map((element) => [element, 0]));
  [detail.yearElement, detail.monthElement, detail.dayElement, detail.hourElement].forEach((item) => {
    counts[item.stem] = (counts[item.stem] ?? 0) + 1;
    counts[item.branch] = (counts[item.branch] ?? 0) + 1;
  });
  return counts;
};

const summarizeElementStructure = (counts) => {
  const entries = ELEMENT_ORDER.map((element) => ({ key: element, label: ELEMENT_LABELS[element], count: counts[element] ?? 0 }));
  const total = entries.reduce((sum, item) => sum + item.count, 0) || 1;
  const withRatio = entries.map((item) => ({ ...item, ratio: Math.round((item.count / total) * 100) }));
  const sorted = [...withRatio].sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 0;
  const minCount = sorted[sorted.length - 1]?.count ?? 0;
  const lacking = withRatio.filter((item) => item.count === minCount).map((item) => item.label);
  const dominant = sorted.filter((item) => item.count === maxCount).map((item) => item.label);
  const average = total / withRatio.length;
  const variance = withRatio.reduce((sum, item) => sum + ((item.count - average) ** 2), 0) / withRatio.length;
  const spread = maxCount - minCount;
  const balanceScore = clamp(100 - (spread * 12) - (variance * 8));
  return { items: withRatio, dominant, lacking, maxCount, minCount, spread, balanceScore };
};

const deriveMetaScores = ({ structure, timeKnown, calendarType, isLeapMonth }) => {
  const dominantGap = structure.maxCount - structure.minCount;
  const lackingPenalty = Math.max(0, structure.lacking.length - 1) * 4;
  const consistencyScore = clamp(72 + (structure.balanceScore * 0.18) + (dominantGap * 2) - lackingPenalty - (timeKnown ? 0 : 16));
  const reliabilityScore = clamp(68 + (structure.balanceScore * 0.24) + (timeKnown ? 14 : -10) + (calendarType === 'lunar' ? 2 : 0) - (isLeapMonth ? 4 : 0));
  const accuracyScore = clamp(70 + (timeKnown ? 16 : -8) + (calendarType === 'lunar' ? 3 : 0) - (isLeapMonth ? 3 : 0));
  return { consistencyScore, reliabilityScore, accuracyScore };
};

const normalizeAnalysis = (payload) => ({
  headline: typeof payload?.headline === 'string' ? payload.headline.trim() : '',
  summary: typeof payload?.summary === 'string' ? payload.summary.trim() : '',
  personality: typeof payload?.personality === 'string' ? payload.personality.trim() : '',
  strengths: normalizeList(payload?.strengths),
  blindSpots: normalizeList(payload?.blind_spots),
  money: normalizeScoredBlock(payload?.money),
  relationship: normalizeScoredBlock(payload?.relationship),
  work: {
    score: clamp(Number(payload?.work?.score ?? 0)),
    summary: typeof payload?.work?.summary === 'string' ? payload.work.summary.trim() : '',
    suitableRoles: normalizeList(payload?.work?.suitable_roles)
  },
  health: normalizeScoredBlock(payload?.health),
  yearlyFlow: normalizeScoredBlock(payload?.yearly_flow),
  fortunes: {
    today: normalizeScoredBlock(payload?.fortunes?.today),
    thisWeek: normalizeScoredBlock(payload?.fortunes?.this_week),
    thisMonth: normalizeScoredBlock(payload?.fortunes?.this_month),
    firstHalf: normalizeScoredBlock(payload?.fortunes?.first_half),
    secondHalf: normalizeScoredBlock(payload?.fortunes?.second_half),
    thisYear: normalizeScoredBlock(payload?.fortunes?.this_year)
  },
  lifeStages: {
    midlife: normalizeScoredBlock(payload?.life_stages?.midlife),
    laterYears: normalizeScoredBlock(payload?.life_stages?.later_years)
  },
  keywords: normalizeList(payload?.keywords, 10),
  advice: normalizeList(payload?.advice, 8),
  consistencyComment: typeof payload?.consistency_comment === 'string' ? payload.consistency_comment.trim() : '',
  reliabilityComment: typeof payload?.reliability_comment === 'string' ? payload.reliability_comment.trim() : '',
  accuracyComment: typeof payload?.accuracy_comment === 'string' ? payload.accuracy_comment.trim() : ''
});

export const analyzeSaju = async ({ name = '', birthDate, birthTime, calendarType = 'solar', isLeapMonth = false, timeUnknown = false }) => {
  const date = parseBirthDate(birthDate);
  const time = parseBirthTime(birthTime, timeUnknown);
  const isLunar = calendarType === 'lunar';
  const solarDate = isLunar ? lunarToSolar(date.year, date.month, date.day, Boolean(isLeapMonth)) : date;
  const lunarDate = isLunar ? { ...date, isLeapMonth: Boolean(isLeapMonth) } : solarToLunar(date.year, date.month, date.day);

  const detail = calculateFourPillars({
    year: date.year,
    month: date.month,
    day: date.day,
    hour: time.hour,
    minute: time.minute,
    isLunar,
    isLeapMonth: isLunar ? Boolean(isLeapMonth) : false
  });

  const structure = summarizeElementStructure(countElements(detail));
  const metaScores = deriveMetaScores({ structure, timeKnown: time.known, calendarType, isLeapMonth: Boolean(isLeapMonth) });
  const pillarText = detail.toObject();
  const hanjaText = detail.toHanjaObject();
  const dayMaster = `${pillarText.day.slice(0, 1)}${detail.dayElement.stem}`;
  const dominantSummary = structure.dominant.join(', ');
  const lackingSummary = structure.lacking.join(', ');
  const ruleHints = [
    `일간의 중심 오행은 ${detail.dayElement.stem}이며 핵심 역할 키워드는 ${STEM_ROLE_HINTS[detail.dayElement.stem] ?? '균형'}입니다.`,
    `오행 분포는 ${structure.items.map((item) => `${item.label} ${item.count}`).join(', ')}입니다.`,
    `강한 축은 ${dominantSummary || '없음'}, 약한 축은 ${lackingSummary || '없음'}입니다.`,
    time.known
      ? `출생 시간 ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')} 기준으로 시주까지 반영했습니다.`
      : '출생 시간이 없어 시주는 정오 기준 가정치로 계산했고 신뢰도를 낮춰 해석해야 합니다.'
  ];

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: [
          '당신은 한국 만세력과 사주팔자 해석을 구조적으로 정리하는 분석가입니다.',
          '입력으로 주어진 사주 계산 결과를 바꾸지 말고 그 위에 해석만 덧붙이십시오.',
          '모든 출력은 자연스러운 한국어로 작성하십시오.',
          '운세를 사실처럼 단정하지 말고 경향, 흐름, 가능성이라는 표현을 사용하십시오.',
          '결과는 프리미엄 리포트처럼 자세하지만 반복은 줄이고 실제 행동 조언을 포함하십시오.',
          '오늘, 이번주, 이번달, 올해, 상반기, 하반기 운세는 재구매를 유도하는 짧은 문장이 아니라 각 기간의 초점과 리스크를 구체적으로 설명하십시오.',
          '중년과 말년 해석은 자산, 관계, 생활리듬, 커리어 전환 가능성을 포함해 납득감 있게 서술하십시오.',
          '일관성, 신뢰도, 정확도 코멘트는 과학적 검증이 아니라 입력 완전성과 구조 해석 안정성 기준으로 설명하십시오.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          profile: {
            name: String(name || '').trim() || null,
            solarDate: formatDate(solarDate),
            lunarDate: `${formatDate(lunarDate)}${lunarDate.isLeapMonth ? ' (윤달)' : ' (평달)'}`,
            calendarType,
            birthTime: time.known ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '모름',
            timeKnown: time.known,
            pillars: pillarText,
            pillarsHanja: hanjaText,
            dayMaster,
            dayElement: detail.dayElement,
            yearElement: detail.yearElement,
            monthElement: detail.monthElement,
            hourElement: detail.hourElement,
            fiveElements: structure.items,
            balanceScore: structure.balanceScore,
            consistencyScore: metaScores.consistencyScore,
            reliabilityScore: metaScores.reliabilityScore,
            accuracyScore: metaScores.accuracyScore,
            dominantElements: structure.dominant,
            lackingElements: structure.lacking,
            hints: ruleHints
          },
          responseGuide: {
            headline: '핵심 분위기를 한 줄로 요약',
            summary: '전체 사주 구조 요약',
            personality: '성향, 판단 방식, 감정 처리 방식',
            strengths: '강점 3~5개',
            blind_spots: '주의할 점 3~5개',
            money: '재물운 점수와 설명',
            relationship: '관계운 점수와 설명',
            work: '직업/적성 점수와 설명 및 어울리는 역할',
            health: '생활 리듬/컨디션 관리 관점의 점수와 설명',
            yearly_flow: '올해 전체 흐름 요약',
            fortunes: '오늘/이번주/이번달/상반기/하반기/올해 각각 점수와 구체적 설명',
            life_stages: '중년/말년 흐름과 포인트',
            keywords: '짧은 핵심 키워드',
            advice: '실행 가능한 조언',
            consistency_comment: '같은 입력에서 같은 결과가 유지되는 구조 해석 관점 설명',
            reliability_comment: '시간 유무, 입력 완전성, 오행 분포 명확성 기준 설명',
            accuracy_comment: '통계가 아닌 규칙 기반 해석이라는 점을 숨기지 않되 납득 가능한 표현'
          }
        })
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: sajuSchema
    }
  });

  const parsed = extractJson(completion.choices?.[0]?.message?.content);
  const report = normalizeAnalysis(parsed);

  return {
    profile: {
      name: String(name || '').trim() || null,
      calendarType,
      solarDate,
      lunarDate,
      birthTime: time.known ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '모름',
      timeKnown: time.known,
      pillars: { korean: pillarText, hanja: hanjaText },
      dayMaster,
      elementSummary: {
        items: structure.items,
        dominant: structure.dominant,
        lacking: structure.lacking,
        balanceScore: structure.balanceScore
      },
      metaScores,
      ruleHints
    },
    report
  };
};
