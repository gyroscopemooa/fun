import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';

const detailPageSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page_count: { type: 'integer', enum: [5, 7, 10] },
    section_order: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['hero', 'feature', 'usage', 'detail', 'benefit', 'ingredient', 'proof', 'comparison', 'cta']
      },
      minItems: 5,
      maxItems: 10
    },
    image_role_mapping: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hero: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 9 },
          minItems: 1,
          maxItems: 10
        },
        detail: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 9 },
          minItems: 0,
          maxItems: 10
        },
        usage: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 9 },
          minItems: 0,
          maxItems: 10
        }
      },
      required: ['hero', 'detail', 'usage']
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: ['hero', 'feature', 'usage', 'detail', 'benefit', 'ingredient', 'proof', 'comparison', 'cta']
          },
          title: { type: 'string' },
          text: { type: 'string' },
          image_role: {
            type: 'string',
            enum: ['hero', 'detail', 'usage']
          }
        },
        required: ['type', 'title', 'text', 'image_role']
      },
      minItems: 5,
      maxItems: 10
    },
    generated_copy: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: { type: 'string' },
        subheadline: { type: 'string' },
        key_selling_points: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 6
        },
        feature_descriptions: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 6
        },
        usage_scenario_text: { type: 'string' },
        detail_description: { type: 'string' },
        benefits: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 6
        },
        cta: { type: 'string' },
        seo_title: { type: 'string' }
      },
      required: [
        'headline',
        'subheadline',
        'key_selling_points',
        'feature_descriptions',
        'usage_scenario_text',
        'detail_description',
        'benefits',
        'cta',
        'seo_title'
      ]
    }
  },
  required: ['page_count', 'section_order', 'image_role_mapping', 'sections', 'generated_copy']
};

const PAGE_TEMPLATES = {
  5: ['hero', 'feature', 'feature', 'usage', 'cta'],
  7: ['hero', 'feature', 'feature', 'usage', 'detail', 'proof', 'cta'],
  10: ['hero', 'feature', 'feature', 'usage', 'detail', 'benefit', 'ingredient', 'comparison', 'proof', 'cta']
};

const DEFAULT_COPY_BY_PAGE_COUNT = {
  5: {
    headline: '핵심만 빠르게 전달하는 실속형 상세페이지',
    subheadline: '짧은 체류 시간에도 상품 장점이 바로 이해되도록 간결하게 구성했습니다.',
    key_selling_points: ['핵심 장점이 한눈에 보이는 구성', '불필요한 반복을 줄인 요약형 카피', '모바일에서 빠르게 읽히는 흐름'],
    feature_descriptions: ['가장 중요한 포인트부터 직관적으로 전달', '짧지만 구매 판단에 필요한 정보 확보', '실속형 상품에 맞는 간결한 설득 구조'],
    usage_scenario_text: '대표 사용 장면만 골라 보여주며 짧고 명확하게 설득합니다.',
    detail_description: '필수 정보 위주로 정리된 짧은 상세 설명입니다.',
    benefits: ['빠른 이해', '짧은 구매 결정 동선'],
    cta: '필요한 정보만 확인하고 바로 구매해보세요',
    seo_title: '핵심 장점이 잘 보이는 간결형 상품 상세페이지'
  },
  7: {
    headline: '가장 표준적인 한국형 쇼핑몰 상세페이지 구성',
    subheadline: '헤드라인, 장점, 사용 장면, 디테일, proof가 균형 있게 이어지는 기본형 구성입니다.',
    key_selling_points: ['가장 일반적인 모바일 쇼핑몰 흐름', '장점과 사용 장면이 자연스럽게 연결', 'proof 섹션까지 포함한 안정적인 설득 구조'],
    feature_descriptions: ['기능과 장점을 균형 있게 보여주는 구성', '고객이 스크롤하며 자연스럽게 이해하는 흐름', '국내 마켓에 익숙한 전개 방식'],
    usage_scenario_text: '사용 장면과 고객 맥락을 연결해 구매 이미지를 그리기 쉽게 만듭니다.',
    detail_description: '정보량과 가독성의 균형이 가장 잘 맞는 표준형 상세 설명입니다.',
    benefits: ['대부분의 카테고리에 적용 가능', '정보와 전환 요소의 균형이 좋음'],
    cta: '장점부터 디테일까지 확인하고 바로 선택해보세요',
    seo_title: '모바일 쇼핑몰에 잘 맞는 표준형 상품 상세페이지'
  },
  10: {
    headline: '프리미엄 무드로 완성하는 풀사이즈 상세페이지',
    subheadline: '기본 정보부터 비교 포인트와 proof까지 촘촘하게 담아 더 완성도 높은 구매 경험을 만듭니다.',
    key_selling_points: ['섹션별 역할이 분명한 프리미엄 구성', '비교, 베네핏, ingredient까지 포함한 완성형 흐름', '반복보다 정보 확장에 초점을 둔 디테일 전개'],
    feature_descriptions: ['고급 상품처럼 보이게 만드는 정보 밀도', '읽을수록 신뢰가 쌓이는 프리미엄 커머스 흐름', '비교와 proof가 자연스럽게 이어지는 완성형 카피'],
    usage_scenario_text: '사용 장면과 라이프스타일 맥락을 더 풍부하게 제시해 몰입도를 높입니다.',
    detail_description: '디테일, benefit, ingredient, comparison, proof가 분리되어 완성도 높은 장문형 상세 설명을 구성합니다.',
    benefits: ['정독형 고객에게도 설득력 유지', '브랜드형 상품이나 고관여 상품에 적합'],
    cta: '오늘 주문하고 프리미엄 디테일의 차이를 직접 경험해보세요',
    seo_title: '프리미엄 무드의 풀사이즈 모바일 상품 상세페이지'
  }
};

let client = null;

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  client ??= new OpenAI({ apiKey });
  return client;
};

const normalizeString = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);

const normalizeStringList = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => normalizeString(item)).filter(Boolean);
};

const normalizeRoleArray = (value, imageCount, fallback = []) => {
  const list = Array.isArray(value) ? value : fallback;
  const unique = [];
  const seen = new Set();
  list.forEach((item) => {
    const index = Number(item);
    if (!Number.isInteger(index) || index < 0 || index >= imageCount || seen.has(index)) return;
    seen.add(index);
    unique.push(index);
  });
  return unique;
};

const normalizeSectionType = (value) => {
  const allowed = new Set(['hero', 'feature', 'usage', 'detail', 'benefit', 'ingredient', 'proof', 'comparison', 'cta']);
  return allowed.has(value) ? value : 'detail';
};

const normalizeImageRole = (value) => (value === 'hero' || value === 'usage' ? value : 'detail');

const ensureRoleFallbacks = (mapping, imageCount) => {
  const hero = mapping.hero.length ? mapping.hero : [0];
  const detailFallback = imageCount > 1 ? [1] : [hero[0]];
  const usageFallback = imageCount > 2 ? [2] : [detailFallback[0]];

  return {
    hero,
    detail: mapping.detail.length ? mapping.detail : detailFallback,
    usage: mapping.usage.length ? mapping.usage : usageFallback
  };
};

const normalizeSections = (value, sectionOrder, generatedCopy) => {
  const fallbackSections = sectionOrder.map((type, index) => ({
    type,
    title: index === 0 ? generatedCopy.headline : `${type.toUpperCase()} Section`,
    text:
      type === 'hero'
        ? generatedCopy.subheadline
        : type === 'usage'
          ? generatedCopy.usage_scenario_text
          : type === 'detail'
            ? generatedCopy.detail_description
            : type === 'cta'
              ? generatedCopy.cta
              : generatedCopy.key_selling_points.join('\n'),
    image_role: type === 'hero' ? 'hero' : type === 'usage' ? 'usage' : 'detail'
  }));

  if (!Array.isArray(value)) return fallbackSections;

  const normalized = value.map((item, index) => ({
    type: normalizeSectionType(item?.type ?? sectionOrder[index] ?? 'detail'),
    title: normalizeString(item?.title, fallbackSections[index]?.title || 'Section'),
    text: normalizeString(item?.text, fallbackSections[index]?.text || generatedCopy.detail_description),
    image_role: normalizeImageRole(item?.image_role ?? fallbackSections[index]?.image_role)
  }));

  return normalized.length ? normalized : fallbackSections;
};

const buildFallbackPayload = (pageCount) => {
  const copy = DEFAULT_COPY_BY_PAGE_COUNT[pageCount];
  const sectionOrder = PAGE_TEMPLATES[pageCount];
  return {
    page_count: pageCount,
    section_order: sectionOrder,
    image_role_mapping: {
      hero: [0],
      detail: [1],
      usage: [2]
    },
    sections: sectionOrder.map((type, index) => ({
      type,
      title: index === 0 ? copy.headline : `${type.toUpperCase()} Section`,
      text:
        type === 'hero'
          ? copy.subheadline
          : type === 'usage'
            ? copy.usage_scenario_text
            : type === 'detail'
              ? copy.detail_description
              : type === 'benefit'
                ? copy.benefits.join('\n')
                : type === 'cta'
                  ? copy.cta
                  : copy.key_selling_points.join('\n'),
      image_role: type === 'hero' ? 'hero' : type === 'usage' ? 'usage' : 'detail'
    })),
    generated_copy: copy
  };
};

const normalizePayload = (payload, imageCount, requestedPageCount) => {
  const safeRequestedPageCount = [5, 7, 10].includes(Number(requestedPageCount)) ? Number(requestedPageCount) : 7;
  const fallbackPayload = buildFallbackPayload(safeRequestedPageCount);
  const pageCount = [5, 7, 10].includes(Number(payload?.page_count)) ? Number(payload.page_count) : requestedPageCount;
  const generatedCopy = {
    headline: normalizeString(payload?.generated_copy?.headline, fallbackPayload.generated_copy.headline),
    subheadline: normalizeString(payload?.generated_copy?.subheadline, fallbackPayload.generated_copy.subheadline),
    key_selling_points: normalizeStringList(payload?.generated_copy?.key_selling_points, fallbackPayload.generated_copy.key_selling_points),
    feature_descriptions: normalizeStringList(payload?.generated_copy?.feature_descriptions, fallbackPayload.generated_copy.feature_descriptions),
    usage_scenario_text: normalizeString(payload?.generated_copy?.usage_scenario_text, fallbackPayload.generated_copy.usage_scenario_text),
    detail_description: normalizeString(payload?.generated_copy?.detail_description, fallbackPayload.generated_copy.detail_description),
    benefits: normalizeStringList(payload?.generated_copy?.benefits, fallbackPayload.generated_copy.benefits),
    cta: normalizeString(payload?.generated_copy?.cta, fallbackPayload.generated_copy.cta),
    seo_title: normalizeString(payload?.generated_copy?.seo_title, fallbackPayload.generated_copy.seo_title)
  };

  const requestedOrder = PAGE_TEMPLATES[pageCount];
  const sectionOrder = Array.isArray(payload?.section_order) && payload.section_order.length
    ? payload.section_order.map((item) => normalizeSectionType(item)).slice(0, requestedOrder.length)
    : requestedOrder;

  const imageRoleMapping = ensureRoleFallbacks({
    hero: normalizeRoleArray(payload?.image_role_mapping?.hero, imageCount, [0]),
    detail: normalizeRoleArray(payload?.image_role_mapping?.detail, imageCount, imageCount > 1 ? [1] : [0]),
    usage: normalizeRoleArray(payload?.image_role_mapping?.usage, imageCount, imageCount > 2 ? [2] : [Math.min(1, imageCount - 1)])
  }, imageCount);

  const normalized = {
    page_count: pageCount,
    section_order: sectionOrder,
    image_role_mapping: imageRoleMapping,
    sections: normalizeSections(payload?.sections, sectionOrder, generatedCopy),
    generated_copy: generatedCopy
  };

  if (!normalized.sections.length) {
    return fallbackPayload;
  }
  return normalized;
};

const extractJson = (value) => {
  if (typeof value !== 'string') {
    throw new Error('OpenAI response content is empty');
  }
  const trimmed = value.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
  return JSON.parse(candidate);
};

const buildPrompt = ({
  productName,
  price,
  audience,
  sellingPoints,
  prompt,
  theme,
  pageCount,
  imageCount,
  pricing = null
}) => [
  '한국 모바일 쇼핑몰용 상세페이지 JSON만 생성하세요.',
  '페이지 폭은 860px이고 스마트스토어, 쿠팡, 카페24에 붙여넣는 것을 전제로 합니다.',
  `목표 페이지 수는 ${pageCount}장입니다.`,
  `페이지 수별 기대 품질은 ${pageCount === 5 ? 'concise and essential' : pageCount === 7 ? 'balanced and standard' : 'premium and complete'} 입니다.`,
  `페이지 수별 섹션 규칙은 다음과 같습니다: ${JSON.stringify(PAGE_TEMPLATES[pageCount])}`,
  '반드시 page_count, section_order, image_role_mapping, sections, generated_copy를 포함하세요.',
  'sections.type은 hero, feature, usage, detail, benefit, ingredient, proof, comparison, cta 중 하나만 사용하세요.',
  'sections.image_role은 hero, detail, usage만 사용하세요.',
  'Hero 섹션에는 대표컷이 오고, detail 섹션은 디테일컷, usage 섹션은 사용컷이 오도록 image_role_mapping을 배치하세요.',
  '이미지가 부족하면 재사용을 전제로 가장 합리적인 매핑을 만드세요.',
  `상품명: ${productName}`,
  `가격/옵션: ${price || '미입력'}`,
  `구조화 가격 정보: ${pricing ? JSON.stringify(pricing) : '없음'}`,
  `타깃 고객: ${audience || '미입력'}`,
  `키 셀링 포인트: ${sellingPoints || '미입력'}`,
  `테마: ${theme}`,
  `추가 프롬프트: ${prompt || '상품 사진을 바탕으로 구매 전환형 상세페이지를 생성'}`,
  `업로드 이미지 수: ${imageCount}`,
  'generated_copy.feature_descriptions는 아이콘형 feature 섹션에 바로 쓸 수 있게 짧고 강한 문장으로 작성하세요.',
  'generated_copy.seo_title은 스마트스토어, 쿠팡 상품명처럼 카테고리 키워드와 핵심 속성이 자연스럽게 섞이게 작성하세요.',
  'generated_copy.cta는 generic 하지 않게 배송, 한정성, 체감 이점 등 전환 요소를 담아 작성하세요.',
  '5장 구성은 군더더기 없이 핵심만, 7장은 가장 표준적인 균형형, 10장은 premium and complete 느낌으로 차별화하세요.',
  '섹션 간 문구를 반복하지 말고, 특히 10장 구성에서는 benefit, ingredient, comparison, proof가 서로 다른 역할을 가지게 하세요.',
  '마크다운, HTML, 설명문 없이 JSON만 출력하세요.'
].join('\n');

export const generateCommerceDetailPage = async ({
  productName,
  price,
  audience,
  sellingPoints,
  prompt,
  theme,
  pageCount,
  pricing = null,
  images
}) => {
  const safeImages = Array.isArray(images)
    ? images.filter((item) => typeof item === 'string' && item.startsWith('data:image/')).slice(0, 10)
    : [];

  if (!safeImages.length) {
    throw new Error('At least one image is required');
  }

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: 'You generate structured Korean e-commerce JSON for mobile product detail pages.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildPrompt({
              productName,
              price,
              audience,
              sellingPoints,
              prompt,
              theme,
              pageCount,
              imageCount: safeImages.length,
              pricing
            })
          },
          ...safeImages.map((image) => ({
            type: 'image_url',
            image_url: { url: image }
          }))
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'commerce_detail_page',
        strict: true,
        schema: detailPageSchema
      }
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return normalizePayload(parsed, safeImages.length, pageCount);
};
