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

const normalizePayload = (payload, imageCount, requestedPageCount) => {
  const pageCount = [5, 7, 10].includes(Number(payload?.page_count)) ? Number(payload.page_count) : requestedPageCount;
  const generatedCopy = {
    headline: normalizeString(payload?.generated_copy?.headline, '상품의 첫인상을 선명하게 보여주는 상세페이지'),
    subheadline: normalizeString(payload?.generated_copy?.subheadline, '실제 상품 사진과 상품 정보를 바탕으로 모바일 커머스에 맞는 상세페이지 흐름을 구성했습니다.'),
    key_selling_points: normalizeStringList(payload?.generated_copy?.key_selling_points, [
      '첫 화면에서 핵심 장점이 바로 보이도록 정리',
      '모바일 쇼핑몰 흐름에 맞춘 설득형 카피 구성',
      '상세 설명과 CTA까지 자연스럽게 연결'
    ]),
    feature_descriptions: normalizeStringList(payload?.generated_copy?.feature_descriptions, [
      '핵심 기능을 짧고 강한 문장으로 요약',
      '상품의 분위기와 사용 맥락을 빠르게 이해',
      '구매 결정을 돕는 정보 구조 제공'
    ]),
    usage_scenario_text: normalizeString(payload?.generated_copy?.usage_scenario_text, '일상 사용, 선물, 취향 소비 등 다양한 맥락에서 자연스럽게 제안할 수 있습니다.'),
    detail_description: normalizeString(payload?.generated_copy?.detail_description, '상품의 재질감, 디테일, 완성도를 모바일 상세페이지 흐름에 맞게 설명합니다.'),
    benefits: normalizeStringList(payload?.generated_copy?.benefits, ['실사용 만족도를 높이는 구성', '가볍게 비교해도 장점이 드러나는 카피']),
    cta: normalizeString(payload?.generated_copy?.cta, '지금 바로 구매해보세요'),
    seo_title: normalizeString(payload?.generated_copy?.seo_title, '상품 상세페이지 초안')
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

  return {
    page_count: pageCount,
    section_order: sectionOrder,
    image_role_mapping: imageRoleMapping,
    sections: normalizeSections(payload?.sections, sectionOrder, generatedCopy),
    generated_copy: generatedCopy
  };
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
  imageCount
}) => [
  '한국 모바일 쇼핑몰용 상세페이지 JSON만 생성하세요.',
  '페이지 폭은 860px이고 스마트스토어, 쿠팡, 카페24에 붙여넣는 것을 전제로 합니다.',
  `목표 페이지 수는 ${pageCount}장입니다.`,
  `페이지 수별 섹션 규칙은 다음과 같습니다: ${JSON.stringify(PAGE_TEMPLATES[pageCount])}`,
  '반드시 page_count, section_order, image_role_mapping, sections, generated_copy를 포함하세요.',
  'sections.type은 hero, feature, usage, detail, benefit, ingredient, proof, comparison, cta 중 하나만 사용하세요.',
  'sections.image_role은 hero, detail, usage만 사용하세요.',
  'Hero 섹션에는 대표컷이 오고, detail 섹션은 디테일컷, usage 섹션은 사용컷이 오도록 image_role_mapping을 배치하세요.',
  '이미지가 부족하면 재사용을 전제로 가장 합리적인 매핑을 만드세요.',
  `상품명: ${productName}`,
  `가격/옵션: ${price || '미입력'}`,
  `타깃 고객: ${audience || '미입력'}`,
  `키 셀링 포인트: ${sellingPoints || '미입력'}`,
  `테마: ${theme}`,
  `추가 프롬프트: ${prompt || '상품 사진을 바탕으로 구매 전환형 상세페이지를 생성'}`,
  `업로드 이미지 수: ${imageCount}`,
  'generated_copy.feature_descriptions는 아이콘형 feature 섹션에 바로 쓸 수 있게 짧고 강한 문장으로 작성하세요.',
  'generated_copy.seo_title은 한국 검색형 상품명 스타일로 작성하세요.',
  'generated_copy.cta는 짧고 직접적인 구매 유도 문장으로 작성하세요.',
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
              imageCount: safeImages.length
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
