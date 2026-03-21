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
const ELEMENT_INTERPRETATION = {
  목: {
    strong: {
      traits: ['성장지향', '추진력', '고집'],
      strengths: ['도전정신', '확장력'],
      weaknesses: ['과도한 고집', '충돌'],
      careers: ['사업', '기획', '창업'],
      money: '크게 벌 수 있으나 안정성 부족'
    },
    weak: {
      traits: ['소극적', '결단력 부족'],
      support: '도전 환경이 필요합니다.'
    }
  },
  화: {
    strong: {
      traits: ['열정', '표현력', '리더십'],
      strengths: ['인기', '에너지'],
      weaknesses: ['과열', '감정기복'],
      careers: ['연예', '마케팅', '리더직'],
      money: '소비가 빠를 수 있어 관리가 필요합니다.'
    },
    weak: {
      traits: ['무기력', '표현 부족'],
      support: '활동성과 표현 리듬을 키울 필요가 있습니다.'
    }
  },
  토: {
    strong: {
      traits: ['안정', '보수적'],
      strengths: ['지속력', '신뢰'],
      weaknesses: ['변화 거부'],
      careers: ['관리', '공무', '부동산'],
      money: '안정적으로 축적하는 흐름입니다.'
    },
    weak: {
      traits: ['불안정', '기반 약함'],
      support: '루틴과 생활 기반을 먼저 세우는 편이 좋습니다.'
    }
  },
  금: {
    strong: {
      traits: ['결단력', '냉정'],
      strengths: ['판단력', '재물관리'],
      weaknesses: ['차가움'],
      careers: ['금융', '법', '관리'],
      money: '관리 능력이 우수한 편입니다.'
    },
    weak: {
      traits: ['우유부단'],
      support: '결정 훈련과 기준 정리가 필요합니다.'
    }
  },
  수: {
    strong: {
      traits: ['지혜', '유연성'],
      strengths: ['적응력', '두뇌'],
      weaknesses: ['우유부단'],
      careers: ['연구', '기획', 'IT'],
      money: '흐름형 자산 구조로 들고 나는 움직임이 있습니다.'
    },
    weak: {
      traits: ['감정 부족', '유연성 부족'],
      support: '소통과 유연성을 키우는 편이 좋습니다.'
    }
  }
};
const ELEMENT_COLOR_MAP = {
  목: ['초록', '청록'],
  화: ['빨강', '주황'],
  토: ['노랑', '베이지'],
  금: ['흰색', '회색'],
  수: ['파랑', '검정']
};
const ELEMENT_NUMBER_MAP = {
  목: ['3', '8'],
  화: ['2', '7'],
  토: ['5', '10'],
  금: ['4', '9'],
  수: ['1', '6']
};
const ELEMENT_DIRECTION_MAP = {
  목: '동쪽',
  화: '남쪽',
  토: '중심축이 잡힌 곳',
  금: '서쪽',
  수: '북쪽'
};
const ELEMENT_REGION_MAP = {
  목: '숲과 공원이 가까운 생활권',
  화: '활동성이 높은 도시 중심권',
  토: '생활 인프라가 안정적인 주거권',
  금: '정돈된 업무 중심 도시권',
  수: '바다나 강과 가까운 수변 생활권'
};

const scoredBlock = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number' },
    summary: { type: 'string' },
    basis: { type: 'string' }
  },
  required: ['score', 'summary', 'basis']
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
      easy_reading: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dosa_line: { type: 'string' },
          elemental_story: { type: 'string' },
          timing_note: { type: 'string' }
        },
        required: ['dosa_line', 'elemental_story', 'timing_note']
      },
      personality: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      blind_spots: { type: 'array', items: { type: 'string' } },
      base_categories: {
        type: 'object',
        additionalProperties: false,
        properties: {
          love: scoredBlock,
          marriage: scoredBlock,
          money: scoredBlock,
          business: scoredBlock,
          career: {
            type: 'object',
            additionalProperties: false,
            properties: {
              score: { type: 'number' },
              summary: { type: 'string' },
              basis: { type: 'string' },
              suitable_roles: { type: 'array', items: { type: 'string' } }
            },
            required: ['score', 'summary', 'basis', 'suitable_roles']
          },
          study: scoredBlock,
          health: scoredBlock,
          social: scoredBlock,
          benefactor: scoredBlock
        },
        required: ['love', 'marriage', 'money', 'business', 'career', 'study', 'health', 'social', 'benefactor']
      },
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
      dosa_advisory: {
        type: 'object',
        additionalProperties: false,
        properties: {
          top_actions: { type: 'array', items: { type: 'string' } },
          avoid_choices: { type: 'array', items: { type: 'string' } },
          yearly_strategy: { type: 'string' },
          life_direction: { type: 'string' },
          risky_period: { type: 'string' },
          conflict_period: { type: 'string' },
          money_loss_risk: { type: 'string' },
          health_caution_period: { type: 'string' },
          love_start_timing: { type: 'string' },
          marriage_timing: { type: 'string' },
          job_change_timing: { type: 'string' },
          investment_timing: { type: 'string' },
          business_timing: { type: 'string' },
          moving_timing: { type: 'string' },
          recommended_exercise: { type: 'string' },
          career_top3: { type: 'array', items: { type: 'string' } },
          money_style: { type: 'string' },
          good_partner_type: { type: 'string' },
          avoid_partner_type: { type: 'string' },
          good_direction: { type: 'string' },
          good_region_style: { type: 'string' },
          good_colors: { type: 'array', items: { type: 'string' } },
          good_numbers: { type: 'array', items: { type: 'string' } },
          good_name_style: { type: 'string' },
          lucky_actions: { type: 'array', items: { type: 'string' } },
          avoid_habits: { type: 'array', items: { type: 'string' } },
          timing_howto: { type: 'string' }
        },
        required: ['top_actions', 'avoid_choices', 'yearly_strategy', 'life_direction', 'risky_period', 'conflict_period', 'money_loss_risk', 'health_caution_period', 'love_start_timing', 'marriage_timing', 'job_change_timing', 'investment_timing', 'business_timing', 'moving_timing', 'recommended_exercise', 'career_top3', 'money_style', 'good_partner_type', 'avoid_partner_type', 'good_direction', 'good_region_style', 'good_colors', 'good_numbers', 'good_name_style', 'lucky_actions', 'avoid_habits', 'timing_howto']
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
      'easy_reading',
      'personality',
      'strengths',
      'blind_spots',
      'base_categories',
      'yearly_flow',
      'fortunes',
      'life_stages',
      'dosa_advisory',
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
  summary: typeof payload?.summary === 'string' ? payload.summary.trim() : '',
  basis: typeof payload?.basis === 'string' ? payload.basis.trim() : ''
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

const getAge = ({ year, month, day }) => {
  const now = new Date();
  let age = now.getFullYear() - year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return Math.max(0, age);
};

const getLifeStageLabels = (age) => {
  if (age >= 70) {
    return {
      primary: { eyebrow: '후반 인생 흐름', title: '후반 인생의 리듬', description: '현재 나이대 기준으로 생활 리듬, 건강 관리, 관계 정리, 자산 배분의 안정성을 중심으로 읽습니다.' },
      secondary: { eyebrow: '말년의 안목', title: '긴 안목의 마무리', description: '장기적으로 무엇을 줄이고 무엇을 남길지, 귀인과 가족 관계를 어떻게 정리할지에 초점을 둡니다.' }
    };
  }
  if (age >= 50) {
    return {
      primary: { eyebrow: '중년의 상승', title: '중년의 비상', description: '커리어, 자산, 관계 네트워크가 실제로 압축되는 구간을 중심으로 해석합니다.' },
      secondary: { eyebrow: '후반 인생 준비', title: '말년의 시계', description: '이후 흐름은 건강, 생활 리듬, 관계 정리, 자산 배분의 균형을 중심으로 읽습니다.' }
    };
  }
  return {
    primary: { eyebrow: '성장기의 확장', title: '앞으로 커지는 운의 축', description: '앞으로 어떤 영역을 키워야 성장 폭이 커지는지, 연애·직업·학업의 확장 포인트를 중심으로 봅니다.' },
    secondary: { eyebrow: '후반 인생 예고', title: '나중에 강해지는 축', description: '중장기적으로 어떤 자산과 인간관계가 남는지, 후반 인생의 강점을 미리 보여주는 구간입니다.' }
  };
};

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

const unique = (items) => [...new Set((items || []).filter(Boolean))];

const buildAnchorScores = (structure) => {
  const countOf = (element) => structure.items.find((item) => item.key === element)?.count ?? 0;
  const wood = countOf('목');
  const fire = countOf('화');
  const earth = countOf('토');
  const metal = countOf('금');
  const water = countOf('수');
  const balance = structure.balanceScore;

  return {
    love: clamp(48 + (fire * 7) + (wood * 4) + (water * 2) - (metal * 2) + (balance * 0.08)),
    marriage: clamp(50 + (earth * 6) + (water * 4) + (metal * 2) - (fire * 1) + (balance * 0.08)),
    money: clamp(46 + (metal * 7) + (earth * 5) + (water * 3) - (fire * 2) + (balance * 0.1)),
    business: clamp(45 + (wood * 7) + (fire * 5) + (water * 2) - (earth * 1) + (balance * 0.07)),
    career: clamp(48 + (metal * 6) + (earth * 5) + (water * 2) + (balance * 0.09)),
    study: clamp(47 + (water * 7) + (wood * 4) + (metal * 2) + (balance * 0.08)),
    health: clamp(42 + (balance * 0.42) + (earth * 2) + (water * 1)),
    social: clamp(48 + (fire * 6) + (wood * 4) + (water * 1) - (metal * 2) + (balance * 0.06)),
    benefactor: clamp(47 + (metal * 5) + (water * 4) + (earth * 2) + (balance * 0.07)),
    yearly: clamp(45 + (balance * 0.28) + (water * 2) + (earth * 1))
  };
};

const deriveAnchors = ({ detail, structure, age }) => {
  const sortedDesc = [...structure.items].sort((a, b) => b.count - a.count || ELEMENT_ORDER.indexOf(a.key) - ELEMENT_ORDER.indexOf(b.key));
  const sortedAsc = [...structure.items].sort((a, b) => a.count - b.count || ELEMENT_ORDER.indexOf(a.key) - ELEMENT_ORDER.indexOf(b.key));
  const dominantKey = sortedDesc[0]?.key ?? '토';
  const supportKey = sortedAsc[0]?.key ?? dominantKey;
  const secondarySupportKey = sortedAsc[1]?.key ?? supportKey;
  const excessKey = sortedDesc[0]?.key ?? dominantKey;
  const scores = buildAnchorScores(structure);
  const dominantDb = ELEMENT_INTERPRETATION[dominantKey]?.strong;
  const supportDb = ELEMENT_INTERPRETATION[supportKey]?.weak;
  const secondarySupportDb = ELEMENT_INTERPRETATION[secondarySupportKey]?.weak;
  const colors = unique([
    ...(ELEMENT_COLOR_MAP[supportKey] ?? []),
    ...(ELEMENT_COLOR_MAP[secondarySupportKey] ?? []),
    ...(ELEMENT_COLOR_MAP[dominantKey] ?? [])
  ]).slice(0, 3);
  const numbers = unique([
    ...(ELEMENT_NUMBER_MAP[supportKey] ?? []),
    ...(ELEMENT_NUMBER_MAP[secondarySupportKey] ?? []),
    ...(ELEMENT_NUMBER_MAP[dominantKey] ?? [])
  ]).slice(0, 3);
  const careerTop3 = unique([
    ...(dominantDb?.careers ?? []),
    ...(ELEMENT_INTERPRETATION[supportKey]?.strong?.careers ?? [])
  ]).slice(0, 3);
  const stageFocus = age >= 60 ? '안정적 자산 관리와 생활 리듬 유지' : age >= 35 ? '관계와 자산의 압축 성장' : '성장 동력과 진로 확장';

  return {
    coreLabel: `${structure.dominant.join('·')} 중심 ${detail.dayElement.stem} 일간`,
    headline: `${structure.dominant.join('·')} 기운이 앞서는 ${detail.dayElement.stem} 일간 구조`,
    summaryAnchor: `${dominantKey} 기운이 앞에 서고 ${supportKey} 기운을 보완할수록 흐름이 안정되는 구조입니다.`,
    dominantTraits: dominantDb?.traits ?? [],
    dominantStrengths: dominantDb?.strengths ?? [],
    supportNeed: supportDb?.support ?? '',
    supportNeedSecondary: secondarySupportDb?.support ?? '',
    moneyTone: dominantDb?.money ?? '',
    scores,
    yongshin: supportKey,
    huisin: secondarySupportKey,
    gishin: excessKey,
    colors,
    numbers,
    direction: ELEMENT_DIRECTION_MAP[supportKey] ?? '균형이 잘 잡히는 방향',
    regionStyle: ELEMENT_REGION_MAP[supportKey] ?? '안정적인 생활권',
    careerTop3,
    goodNameStyle: `${ELEMENT_LABELS[supportKey]} 기운을 보완하는 안정형 이름 구조`,
    lifeDirection: `${stageFocus}에 맞춰 ${supportKey} 기운을 보완하는 선택이 유리합니다.`,
    moneyStyle: scores.money >= 70 ? '안정적 축적형과 관리형 수익 구조가 잘 맞습니다.' : '한 번에 크게 벌기보다 흐름을 관리하며 쌓는 방식이 유리합니다.',
    riskyTone: `${supportKey} 기운이 약해지는 구간에는 속도를 낮추고 기준을 다시 세우는 편이 좋습니다.`
  };
};

const applyAnchorsToReport = (report, anchors) => ({
  ...report,
  headline: anchors.headline,
  baseCategories: {
    ...report.baseCategories,
    love: { ...report.baseCategories.love, score: anchors.scores.love, basis: `평소 사주 기본 성향 기준. ${anchors.coreLabel} 구조를 반영했습니다.` },
    marriage: { ...report.baseCategories.marriage, score: anchors.scores.marriage, basis: `평소 사주 기본 성향 기준. ${anchors.yongshin} 기운 보완 흐름을 함께 봅니다.` },
    money: { ...report.baseCategories.money, score: anchors.scores.money, basis: `평소 사주 기본 성향 기준. ${anchors.moneyTone || '축적과 관리 흐름'}를 반영했습니다.` },
    business: { ...report.baseCategories.business, score: anchors.scores.business, basis: `평소 사주 기본 성향 기준. ${anchors.gishin} 과열을 줄이고 ${anchors.yongshin} 보완 시 더 안정적입니다.` },
    career: { ...report.baseCategories.career, score: anchors.scores.career, basis: `평소 사주 기본 성향 기준. ${anchors.coreLabel}와 직업 적성 앵커를 반영했습니다.`, suitableRoles: anchors.careerTop3.length ? anchors.careerTop3 : report.baseCategories.career.suitableRoles },
    study: { ...report.baseCategories.study, score: anchors.scores.study, basis: `평소 사주 기본 성향 기준. ${anchors.yongshin} 보완형 학습 흐름을 반영했습니다.` },
    health: { ...report.baseCategories.health, score: anchors.scores.health, basis: `평소 사주 기본 성향 기준. 오행 균형도 ${anchors.scores.health}점대 관리 흐름입니다.` },
    social: { ...report.baseCategories.social, score: anchors.scores.social, basis: `평소 사주 기본 성향 기준. 대인 에너지와 표현 축의 강약을 반영했습니다.` },
    benefactor: { ...report.baseCategories.benefactor, score: anchors.scores.benefactor, basis: `평소 사주 기본 성향 기준. 도움을 받는 방식과 인맥 구조를 반영했습니다.` }
  },
  yearlyFlow: {
    ...report.yearlyFlow,
    score: anchors.scores.yearly,
    basis: `올해 전체 흐름 기준. 기본 사주 축과 현재 리듬을 함께 반영했습니다.`
  },
  dosaAdvisory: {
    ...report.dosaAdvisory,
    careerTop3: anchors.careerTop3.length ? anchors.careerTop3 : report.dosaAdvisory.careerTop3,
    moneyStyle: anchors.moneyStyle,
    goodDirection: anchors.direction,
    goodRegionStyle: anchors.regionStyle,
    goodColors: anchors.colors.length ? anchors.colors : report.dosaAdvisory.goodColors,
    goodNumbers: anchors.numbers.length ? anchors.numbers : report.dosaAdvisory.goodNumbers,
    goodNameStyle: anchors.goodNameStyle,
    lifeDirection: anchors.lifeDirection,
    riskyPeriod: report.dosaAdvisory.riskyPeriod || anchors.riskyTone
  }
});

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
  easyReading: {
    dosaLine: typeof payload?.easy_reading?.dosa_line === 'string' ? payload.easy_reading.dosa_line.trim() : '',
    elementalStory: typeof payload?.easy_reading?.elemental_story === 'string' ? payload.easy_reading.elemental_story.trim() : '',
    timingNote: typeof payload?.easy_reading?.timing_note === 'string' ? payload.easy_reading.timing_note.trim() : ''
  },
  personality: typeof payload?.personality === 'string' ? payload.personality.trim() : '',
  strengths: normalizeList(payload?.strengths),
  blindSpots: normalizeList(payload?.blind_spots),
  baseCategories: {
    love: normalizeScoredBlock(payload?.base_categories?.love),
    marriage: normalizeScoredBlock(payload?.base_categories?.marriage),
    money: normalizeScoredBlock(payload?.base_categories?.money),
    business: normalizeScoredBlock(payload?.base_categories?.business),
    career: {
      score: clamp(Number(payload?.base_categories?.career?.score ?? 0)),
      summary: typeof payload?.base_categories?.career?.summary === 'string' ? payload.base_categories.career.summary.trim() : '',
      basis: typeof payload?.base_categories?.career?.basis === 'string' ? payload.base_categories.career.basis.trim() : '',
      suitableRoles: normalizeList(payload?.base_categories?.career?.suitable_roles)
    },
    study: normalizeScoredBlock(payload?.base_categories?.study),
    health: normalizeScoredBlock(payload?.base_categories?.health),
    social: normalizeScoredBlock(payload?.base_categories?.social),
    benefactor: normalizeScoredBlock(payload?.base_categories?.benefactor)
  },
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
  dosaAdvisory: {
    topActions: normalizeList(payload?.dosa_advisory?.top_actions, 3),
    avoidChoices: normalizeList(payload?.dosa_advisory?.avoid_choices, 3),
    yearlyStrategy: typeof payload?.dosa_advisory?.yearly_strategy === 'string' ? payload.dosa_advisory.yearly_strategy.trim() : '',
    lifeDirection: typeof payload?.dosa_advisory?.life_direction === 'string' ? payload.dosa_advisory.life_direction.trim() : '',
    riskyPeriod: typeof payload?.dosa_advisory?.risky_period === 'string' ? payload.dosa_advisory.risky_period.trim() : '',
    conflictPeriod: typeof payload?.dosa_advisory?.conflict_period === 'string' ? payload.dosa_advisory.conflict_period.trim() : '',
    moneyLossRisk: typeof payload?.dosa_advisory?.money_loss_risk === 'string' ? payload.dosa_advisory.money_loss_risk.trim() : '',
    healthCautionPeriod: typeof payload?.dosa_advisory?.health_caution_period === 'string' ? payload.dosa_advisory.health_caution_period.trim() : '',
    loveStartTiming: typeof payload?.dosa_advisory?.love_start_timing === 'string' ? payload.dosa_advisory.love_start_timing.trim() : '',
    marriageTiming: typeof payload?.dosa_advisory?.marriage_timing === 'string' ? payload.dosa_advisory.marriage_timing.trim() : '',
    jobChangeTiming: typeof payload?.dosa_advisory?.job_change_timing === 'string' ? payload.dosa_advisory.job_change_timing.trim() : '',
    investmentTiming: typeof payload?.dosa_advisory?.investment_timing === 'string' ? payload.dosa_advisory.investment_timing.trim() : '',
    businessTiming: typeof payload?.dosa_advisory?.business_timing === 'string' ? payload.dosa_advisory.business_timing.trim() : '',
    movingTiming: typeof payload?.dosa_advisory?.moving_timing === 'string' ? payload.dosa_advisory.moving_timing.trim() : '',
    recommendedExercise: typeof payload?.dosa_advisory?.recommended_exercise === 'string' ? payload.dosa_advisory.recommended_exercise.trim() : '',
    careerTop3: normalizeList(payload?.dosa_advisory?.career_top3, 3),
    moneyStyle: typeof payload?.dosa_advisory?.money_style === 'string' ? payload.dosa_advisory.money_style.trim() : '',
    goodPartnerType: typeof payload?.dosa_advisory?.good_partner_type === 'string' ? payload.dosa_advisory.good_partner_type.trim() : '',
    avoidPartnerType: typeof payload?.dosa_advisory?.avoid_partner_type === 'string' ? payload.dosa_advisory.avoid_partner_type.trim() : '',
    goodDirection: typeof payload?.dosa_advisory?.good_direction === 'string' ? payload.dosa_advisory.good_direction.trim() : '',
    goodRegionStyle: typeof payload?.dosa_advisory?.good_region_style === 'string' ? payload.dosa_advisory.good_region_style.trim() : '',
    goodColors: normalizeList(payload?.dosa_advisory?.good_colors, 6),
    goodNumbers: normalizeList(payload?.dosa_advisory?.good_numbers, 6),
    goodNameStyle: typeof payload?.dosa_advisory?.good_name_style === 'string' ? payload.dosa_advisory.good_name_style.trim() : '',
    luckyActions: normalizeList(payload?.dosa_advisory?.lucky_actions, 6),
    avoidHabits: normalizeList(payload?.dosa_advisory?.avoid_habits, 6),
    timingHowto: typeof payload?.dosa_advisory?.timing_howto === 'string' ? payload.dosa_advisory.timing_howto.trim() : ''
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
  const age = getAge(solarDate);
  const lifeStageLabels = getLifeStageLabels(age);

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
  const anchors = deriveAnchors({ detail, structure, age });
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
    messages: [
      {
        role: 'system',
        content: [
          '당신은 한국 만세력과 사주팔자 해석을 구조적으로 정리하는 분석가입니다.',
          '입력으로 주어진 사주 계산 결과를 바꾸지 말고 그 위에 해석만 덧붙이십시오.',
          '모든 출력은 자연스러운 한국어로 작성하십시오.',
          '운세를 사실처럼 단정하지 말고 경향, 흐름, 가능성이라는 표현을 사용하십시오.',
          '결과는 프리미엄 리포트처럼 자세하지만 반복은 줄이고 실제 행동 조언을 포함하십시오.',
          '쉬운 해석 파트도 반드시 포함하십시오. AI 도사가 말하듯 은유적이지만 이해하기 쉬운 한마디가 있어야 합니다.',
          '오늘, 이번주, 이번달, 올해, 상반기, 하반기 운세는 재구매를 유도하는 짧은 문장이 아니라 각 기간의 초점과 리스크를 구체적으로 설명하십시오.',
          '기본 운세 카테고리는 평소 사주 기본 성향 기준으로 설명하고, 기간 운세는 오늘/이번주/이번달/올해 기준으로 분리하십시오.',
          '각 점수 블록에는 basis를 넣고 이 점수가 평생 기본 성향인지, 특정 기간 흐름인지 분명하게 설명하십시오.',
          '연애운, 결혼운, 재물운, 사업운, 직업운, 학업운, 건강운, 대인관계운, 귀인운을 모두 포함하십시오.',
          'AI 도사식 참고 인사이트도 반드시 포함하십시오. 여기에는 지금 해야 할 행동 TOP3, 피해야 할 선택 TOP3, 올해 핵심 전략, 인생 방향 추천, 올해 조율 구간, 인간관계 조율 시기, 지출 관리 포인트, 컨디션 관리 시기, 연애 시작 타이밍, 결혼 적기, 이직 타이밍, 투자 타이밍, 사업 시작 타이밍, 이동/이사 타이밍, 추천 운동, 맞는 직업 유형 TOP3, 돈 버는 방식, 잘 맞는 인간 유형, 피해야 할 인간 유형, 좋은 방향, 좋은 지역 성향, 좋은 색상, 좋은 숫자, 좋은 이름 구조, 운을 올리는 행동, 피해야 할 습관, 운이 트이는 시기 활용법이 들어가야 합니다.',
          '이 참고 인사이트는 사주 구조 기준의 참고용 표현으로 쓰고, 지나친 단정 대신 부드러운 권고 톤을 유지하십시오.',
          '좋은 방향, 좋은 지역 성향, 좋은 색상, 좋은 숫자, 좋은 이름 구조는 같은 입력이면 최대한 같은 값이 유지되도록 매우 보수적으로 선택하십시오.',
          '이 다섯 항목은 매번 새롭게 변주하지 말고, 오행 강약과 균형 구조를 바탕으로 반복 실행해도 유사한 결과가 나오도록 안정성을 우선하십시오.',
          '좋은 색상은 3개 내외, 좋은 숫자는 3개 내외로 간결하게 제시하고, 근거 없이 자주 바꾸지 마십시오.',
          '위험, 충돌, 손실, 건강 주의 같은 항목은 불안 조장형 표현을 피하고 조율, 관리, 점검, 속도 조절 같은 표현으로 완화하십시오.',
          '투자 타이밍, 사업 시작 타이밍, 금전 관련 표현은 확정적 권유를 절대 하지 말고 참고용 판단 포인트와 보수적 운영 원칙 위주로 쓰십시오.',
          '생애 흐름은 현재 나이를 반영해 표현을 조절하고 자산, 관계, 생활리듬, 커리어 전환 가능성을 포함해 납득감 있게 서술하십시오.',
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
            age,
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
            hints: ruleHints,
            anchors
          },
          responseGuide: {
            headline: `핵심 분위기를 한 줄로 요약하되 반드시 "${anchors.headline}"와 같은 결론 축을 유지`,
            summary: '전체 사주 구조 요약',
            easy_reading: 'AI 도사 한마디, 오행 비유, 언제 의미가 커지는지 쉬운 설명',
            personality: '성향, 판단 방식, 감정 처리 방식',
            strengths: `강점 3~5개. 가능하면 ${anchors.dominantStrengths.join(', ')} 축을 반영`,
            blind_spots: `주의할 점 3~5개. ${anchors.supportNeed || '부족한 기운 보완'} 관점을 포함`,
            base_categories: '연애운/결혼운/재물운/사업운/직업운/학업운/건강운/대인관계운/귀인운을 평소 사주 기본 성향 기준 점수와 설명으로 작성. score는 profile.anchors.scores와 크게 다르게 쓰지 말고, career에는 suitable_roles 포함',
            yearly_flow: '올해 전체 흐름 요약',
            fortunes: '오늘/이번주/이번달/상반기/하반기/올해 각각 점수와 구체적 설명',
            life_stages: `현재 나이 ${age}세 기준 생애 흐름. 1번은 ${lifeStageLabels.primary.title}, 2번은 ${lifeStageLabels.secondary.title}`,
            dosa_advisory: 'AI 도사식 참고 인사이트 묶음. 타이밍/방향/색/숫자/이동/운동/파트너/행동 조언을 긍정적이지만 과장 없이 작성. 투자와 사업은 참고용 보수 문장으로만 작성. profile.anchors.goodDirection/goodRegionStyle/goodColors/goodNumbers/goodNameStyle 결론을 뒤집지 말 것',
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
  const report = applyAnchorsToReport(normalizeAnalysis(parsed), anchors);

  return {
    profile: {
      name: String(name || '').trim() || null,
      calendarType,
      solarDate,
      lunarDate,
      birthTime: time.known ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '모름',
      timeKnown: time.known,
      pillars: { korean: pillarText, hanja: hanjaText },
      age,
      lifeStageLabels,
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
