import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
const MAX_DETAIL_PAGE_IMAGES = 30;
const MIN_DETAIL_PAGE_COUNT = 5;
const MAX_DETAIL_PAGE_COUNT = 20;
const DETAIL_PAGE_BODY_SEQUENCE = [
  'feature',
  'feature',
  'usage',
  'detail',
  'benefit',
  'ingredient',
  'comparison',
  'proof',
  'feature',
  'usage',
  'detail',
  'benefit',
  'comparison',
  'proof',
  'feature',
  'usage',
  'detail',
  'benefit'
];

const clampPageCount = (value) => {
  const count = Math.round(Number(value) || MIN_DETAIL_PAGE_COUNT);
  return Math.min(MAX_DETAIL_PAGE_COUNT, Math.max(MIN_DETAIL_PAGE_COUNT, count));
};

const buildSectionOrder = (pageCount) => {
  const safeCount = clampPageCount(pageCount);
  const bodyCount = Math.max(0, safeCount - 2);
  return ['hero', ...DETAIL_PAGE_BODY_SEQUENCE.slice(0, bodyCount), 'cta'];
};

const getPageQualityNote = (pageCount) => {
  if (pageCount <= 6) return 'concise and essential';
  if (pageCount <= 10) return 'balanced and standard';
  return 'premium and complete';
};

const getDefaultCopyForPageCount = (pageCount) => {
  if (pageCount <= 6) return DEFAULT_COPY_BY_PAGE_COUNT[5];
  if (pageCount <= 10) return DEFAULT_COPY_BY_PAGE_COUNT[7];
  return DEFAULT_COPY_BY_PAGE_COUNT[10];
};

const detailPageSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page_count: { type: 'integer', minimum: MIN_DETAIL_PAGE_COUNT, maximum: MAX_DETAIL_PAGE_COUNT },
    section_order: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['hero', 'feature', 'usage', 'detail', 'benefit', 'ingredient', 'proof', 'comparison', 'cta']
      },
      minItems: MIN_DETAIL_PAGE_COUNT,
      maxItems: MAX_DETAIL_PAGE_COUNT
    },
    image_role_mapping: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hero: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: MAX_DETAIL_PAGE_IMAGES - 1 },
          minItems: 1,
          maxItems: MAX_DETAIL_PAGE_IMAGES
        },
        detail: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: MAX_DETAIL_PAGE_IMAGES - 1 },
          minItems: 0,
          maxItems: MAX_DETAIL_PAGE_IMAGES
        },
        usage: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: MAX_DETAIL_PAGE_IMAGES - 1 },
          minItems: 0,
          maxItems: MAX_DETAIL_PAGE_IMAGES
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
          eyebrow: { type: 'string' },
          title: { type: 'string' },
          text: { type: 'string' },
          bullets: {
            type: 'array',
            items: { type: 'string' },
            minItems: 0,
            maxItems: 4
          },
          image_role: {
            type: 'string',
            enum: ['hero', 'detail', 'usage']
          },
          image_index: { type: 'integer', minimum: -1, maximum: MAX_DETAIL_PAGE_IMAGES - 1 },
          layout: { type: 'string', enum: ['stacked', 'image-first', 'split', 'text-focus'] }
        },
        required: ['type', 'eyebrow', 'title', 'text', 'bullets', 'image_role', 'image_index', 'layout']
      },
      minItems: MIN_DETAIL_PAGE_COUNT,
      maxItems: MAX_DETAIL_PAGE_COUNT
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
        seo_title: { type: 'string' },
        badge: { type: 'string' },
        closing_line: { type: 'string' },
        spec_rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { label: { type: 'string' }, value: { type: 'string' } },
            required: ['label', 'value']
          },
          minItems: 0,
          maxItems: 8
        },
        comparison_rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { label: { type: 'string' }, ordinary: { type: 'string' }, ours: { type: 'string' } },
            required: ['label', 'ordinary', 'ours']
          },
          minItems: 0,
          maxItems: 5
        },
        faq: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { question: { type: 'string' }, answer: { type: 'string' } },
            required: ['question', 'answer']
          },
          minItems: 0,
          maxItems: 5
        },
        notices: {
          type: 'array',
          items: { type: 'string' },
          minItems: 0,
          maxItems: 5
        }
      },
      required: [
        'badge',
        'closing_line',
        'spec_rows',
        'comparison_rows',
        'faq',
        'notices',
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

const DEFAULT_COPY_BY_PAGE_COUNT = {
  5: {
    headline: '핵심만 빠르게 전하는\n실속형 상세페이지',
    subheadline: '짧은 체류 시간에도 상품의 장점이 바로 이해되도록 간결하게 구성했습니다.',
    key_selling_points: ['핵심 장점이 한눈에 보이는 구성', '군더더기 없는 요약형 카피', '모바일에서 빠르게 읽히는 흐름'],
    feature_descriptions: ['가장 중요한 포인트부터 직관적으로 전달', '구매 판단에 필요한 정보만 정리', '실속형 상품에 맞는 간결한 설득 구조'],
    usage_scenario_text: '대표 사용 장면만 골라 보여주며 짧고 명확하게 설득합니다.',
    detail_description: '필수 정보 위주로 정리한 짧은 상세 설명입니다.',
    benefits: ['빠른 이해', '짧은 구매 결정 동선'],
    cta: '필요한 정보만 확인하고 바로 만나보세요',
    seo_title: '핵심 장점이 잘 보이는 간결한 상품 상세페이지'
  },
  7: {
    headline: '매일 손이 가는 이유,\n지금 확인해보세요',
    subheadline: '장점, 사용 장면, 디테일이 균형 있게 이어지는 기본형 상세페이지 구성입니다.',
    key_selling_points: ['오픈마켓에 익숙한 흐름', '장점과 사용 장면을 자연스럽게 연결', '신뢰 포인트까지 담은 안정적인 구성'],
    feature_descriptions: ['기능과 장점을 균형 있게 보여주는 구성', '스크롤하며 자연스럽게 이해되는 흐름', '국내 쇼핑몰에 익숙한 전개 방식'],
    usage_scenario_text: '실제 사용 장면과 연결해 구매 후 모습을 그리기 쉽게 만듭니다.',
    detail_description: '정보량과 가독성의 균형을 맞춘 표준형 상세 설명입니다.',
    benefits: ['정보와 설득의 균형', '대부분의 상품에 어울리는 구성'],
    cta: '장점부터 디테일까지 확인하고 선택해보세요',
    seo_title: '모바일 쇼핑몰에 잘 맞는 표준형 상품 상세페이지'
  },
  10: {
    headline: '디테일까지 완성한\n프리미엄 상세페이지',
    subheadline: '기본 정보부터 비교 포인트와 신뢰 요소까지 촘촘하게 담아 완성도 높은 구매 경험을 만듭니다.',
    key_selling_points: ['섹션별 역할이 분명한 구성', '비교와 신뢰 요소까지 담은 흐름', '반복 없이 정보를 넓혀가는 전개'],
    feature_descriptions: ['프리미엄 정보 구조', '긴 스크롤에 맞춘 스토리텔링', '읽기 쉬운 비교·신뢰 섹션'],
    usage_scenario_text: '다양한 사용 장면과 라이프스타일을 풍부하게 보여주며 몰입도를 높입니다.',
    detail_description: '디테일, 장점, 비교, 신뢰 요소를 나눠 완성도 높은 상세 설명을 구성합니다.',
    benefits: ['꼼꼼한 고객에게도 설득력 유지', '브랜드형·고가 상품에 적합'],
    cta: '오늘 주문하고 디테일의 차이를 직접 경험해보세요',
    seo_title: '프리미엄 무드의 롱스크롤 상품 상세페이지'
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

const SECTION_FALLBACK_TITLES = {
  hero: '첫인상부터 다른 선택',
  feature: '이래서 선택합니다',
  usage: '일상 속 이런 순간에',
  detail: '가까이 볼수록 느껴지는 디테일',
  benefit: '써보면 알게 되는 장점',
  ingredient: '꼼꼼하게 확인하세요',
  proof: '믿고 고를 수 있는 이유',
  comparison: '비교해보면 차이가 보입니다',
  cta: '지금 만나보세요'
};

const normalizeBulletList = (value) => normalizeStringList(value).slice(0, 4);

const normalizeImageIndex = (value, imageCount) => {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < imageCount ? index : -1;
};

const normalizeRowList = (value, keys, max) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Object.fromEntries(keys.map((key) => [key, normalizeString(item?.[key])])))
    .filter((item) => keys.every((key) => item[key]))
    .slice(0, max);
};

const normalizeSections = (value, sectionOrder, generatedCopy, imageCount = 1) => {
  const fallbackSections = sectionOrder.map((type, index) => ({
    type,
    eyebrow: '',
    title: index === 0 ? generatedCopy.headline : SECTION_FALLBACK_TITLES[type] ?? SECTION_FALLBACK_TITLES.detail,
    bullets: [],
    image_index: -1,
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

  const normalized = value.map((item, index) => {
    const type = normalizeSectionType(item?.type ?? sectionOrder[index] ?? 'detail');
    return {
      type,
      eyebrow: normalizeString(item?.eyebrow),
      title: normalizeString(item?.title) || fallbackSections[index]?.title || SECTION_FALLBACK_TITLES[type],
      text: normalizeString(item?.text) || fallbackSections[index]?.text || generatedCopy.detail_description,
      bullets: normalizeBulletList(item?.bullets),
      image_role: normalizeImageRole(item?.image_role ?? fallbackSections[index]?.image_role),
      image_index: normalizeImageIndex(item?.image_index, imageCount),
      layout: ['stacked', 'image-first', 'split', 'text-focus'].includes(item?.layout) ? item.layout : 'stacked'
    };
  });

  return normalized.length ? normalized : fallbackSections;
};

const buildFallbackPayload = (pageCount) => {
  const safePageCount = clampPageCount(pageCount);
  const copy = getDefaultCopyForPageCount(safePageCount);
  const sectionOrder = buildSectionOrder(safePageCount);
  return {
    page_count: safePageCount,
    section_order: sectionOrder,
    image_role_mapping: {
      hero: [0],
      detail: [1],
      usage: [2]
    },
    sections: sectionOrder.map((type, index) => ({
      type,
      eyebrow: '',
      title: index === 0 ? copy.headline : SECTION_FALLBACK_TITLES[type],
      bullets: [],
      image_index: -1,
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

export const buildFallbackCommerceDetailPage = (pageCount = 7, imageCount = 1) => {
  const safePageCount = clampPageCount(pageCount);
  const safeImageCount = Math.max(1, Number(imageCount) || 1);
  return normalizeCommerceDetailPage(buildFallbackPayload(safePageCount), safeImageCount, safePageCount);
};

export const normalizeCommerceDetailPage = (payload, imageCount, requestedPageCount) => {
  const safeRequestedPageCount = clampPageCount(requestedPageCount);
  const fallbackPayload = buildFallbackPayload(safeRequestedPageCount);
  const pageCount = safeRequestedPageCount;
  const generatedCopy = {
    headline: normalizeString(payload?.generated_copy?.headline, fallbackPayload.generated_copy.headline),
    subheadline: normalizeString(payload?.generated_copy?.subheadline, fallbackPayload.generated_copy.subheadline),
    key_selling_points: normalizeStringList(payload?.generated_copy?.key_selling_points, fallbackPayload.generated_copy.key_selling_points),
    feature_descriptions: normalizeStringList(payload?.generated_copy?.feature_descriptions, fallbackPayload.generated_copy.feature_descriptions),
    usage_scenario_text: normalizeString(payload?.generated_copy?.usage_scenario_text, fallbackPayload.generated_copy.usage_scenario_text),
    detail_description: normalizeString(payload?.generated_copy?.detail_description, fallbackPayload.generated_copy.detail_description),
    benefits: normalizeStringList(payload?.generated_copy?.benefits, fallbackPayload.generated_copy.benefits),
    cta: normalizeString(payload?.generated_copy?.cta, fallbackPayload.generated_copy.cta),
    seo_title: normalizeString(payload?.generated_copy?.seo_title, fallbackPayload.generated_copy.seo_title),
    badge: normalizeString(payload?.generated_copy?.badge),
    closing_line: normalizeString(payload?.generated_copy?.closing_line),
    spec_rows: normalizeRowList(payload?.generated_copy?.spec_rows, ['label', 'value'], 8),
    comparison_rows: normalizeRowList(payload?.generated_copy?.comparison_rows, ['label', 'ordinary', 'ours'], 5),
    faq: normalizeRowList(payload?.generated_copy?.faq, ['question', 'answer'], 5),
    notices: normalizeStringList(payload?.generated_copy?.notices).slice(0, 5)
  };

  const requestedOrder = buildSectionOrder(pageCount);
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
    sections: normalizeSections(payload?.sections, sectionOrder, generatedCopy, imageCount).slice(0, pageCount),
    generated_copy: generatedCopy
  };

  const fallbackSections = normalizeSections(null, requestedOrder, generatedCopy, imageCount);
  while (normalized.sections.length < pageCount) normalized.sections.push(fallbackSections[normalized.sections.length]);
  normalized.sections[0].type = 'hero';
  normalized.sections[pageCount - 1].type = 'cta';
  for (let i = 1; i < pageCount - 1; i++) {
    if (['hero', 'cta'].includes(normalized.sections[i].type)) normalized.sections[i].type = 'detail';
  }
  normalized.section_order = normalized.sections.map(section => section.type);
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
  'You are a professional Korean e-commerce copywriter specialized in high-conversion product detail pages for Korean marketplaces such as Naver Smart Store, Coupang, and 11st.',
  'Generate only JSON for a Korean e-commerce detail page script.',
  'Assume an 860px-wide long-form product detail layout suitable for Smart Store, Coupang, 11st, and similar Korean marketplaces.',
  'Write in natural Korean shopping-mall marketing copy style.',
  'Use persuasive language but avoid exaggerated or false claims.',
  'Balance sales copy, visual explanation, and realistic product storytelling.',
  'If information is limited, infer only reasonable lifestyle benefits, not hard specifications.',
  `Target page count: ${pageCount}.`,
  `Page count guidance: ${getPageQualityNote(pageCount)}.`,
  `Return exactly ${clampPageCount(pageCount)} sections, including hero and cta.`,
  'Choose the middle section types and order for THIS product, photos and customer request. Only the first hero and final cta are fixed. Do not reuse a universal feature-feature-usage sequence.',
  'Set section_order to exactly match sections[].type. Prefer visible product details, styling or use cases; include ingredient, proof or comparison only when supplied facts support them.',
  'For each section choose layout: stacked (headline then image), image-first (large photo then copy), split (photo beside copy), or text-focus (copy and bullets without a photo).',
  'Choose the hero layout to match the requested direction: image-first for a visual lookbook, split for an editorial catalog, stacked for a concise product introduction. Hero must have an image, never text-focus.',
  'Vary layouts purposefully, not randomly. Read the actual image aspect ratios: keep full products visible, use portrait photos for split blocks, landscape photos for wide image-first blocks.',
  'When photos are scarce, use text-focus sections instead of repeating the same photo. When photos are plentiful, show meaningful different views. Respect explicit customer layout requests.',
  'Return page_count, section_order, image_role_mapping, sections, and generated_copy.',
  'Allowed sections.type values: hero, feature, usage, detail, benefit, ingredient, proof, comparison, cta.',
  'Allowed sections.image_role values: hero, detail, usage.',
  'Map hero sections to lead images, detail sections to close-up or product-detail images, and usage sections to lifestyle, in-context, or review-like images.',
  'If there are fewer images than pages, reuse images naturally and insert text-led sections where appropriate.',
  'If there are more images than pages, prioritize the most sales-relevant images and distribute them so the page does not feel repetitive.',
  'Image interpretation rules:',
  '- Front or full-product image: explain silhouette, overall design, first impression, and main selling point.',
  '- Side or angled image: explain shape, structure, proportions, or usability.',
  '- Close-up or zoomed detail image: explain finish, texture, stitching, edge quality, parts, or craftsmanship only if visible.',
  '- Lifestyle image: explain when, where, and for whom the product feels useful.',
  '- Review-like or real-use image: write in a natural review-style tone without inventing a real customer identity.',
  'Persuasive structure guidance:',
  '- Hero should open with an emotional hook + key benefit + short support text.',
  '- Early sections should help the customer imagine common problems, use situations, or purchase motivation.',
  '- Product introduction should clarify product identity, who it fits, and why it is appealing.',
  '- Key benefit sections should feel practical and purchase-oriented, not abstract.',
  '- Usage sections should show real-life fit, gifting angle, self-reward angle, convenience, or everyday appeal where appropriate.',
  '- Detail/proof/comparison sections should deepen trust, not repeat the same message.',
  '- Review-style copy should sound realistic and useful, but must not claim real sales counts or verified customer data.',
  '- CTA should feel specific to the product and purchase motivation, not generic.',
  'Section quality guidance by page count:',
  '- 5 pages: compact but still feel like a real detail page with a beginning, middle, and CTA.',
  '- 7 to 10 pages: persuasive standard structure with stronger flow and richer explanations.',
  '- 10 pages or more: premium and complete, with better continuity between images and sections.',
  `Product name: ${productName}`,
  `Price or options: ${price || 'not provided'}`,
  `Structured pricing: ${pricing ? JSON.stringify(pricing) : 'not provided'}`,
  `Target audience: ${audience || 'not provided'}`,
  `Key selling points: ${sellingPoints || 'not provided'}`,
  `Theme: ${theme}`,
  `Extra prompt: ${prompt || 'Create a clean, conversion-focused commerce detail page based on the uploaded product images.'}`,
  `Uploaded image count: ${imageCount}`,
  'Copy formatting rules (the result is rendered as a real Korean shopping-mall detail page image, so text length matters):',
  '- generated_copy.headline: 2 short lines separated by \n, each line at most 14 Korean characters. Emotional hook first, benefit second.',
  '- generated_copy.badge: one tiny label above the headline, at most 12 characters (e.g. "선물하기 좋은", "데일리 필수템"). Never claim rankings or sales numbers.',
  '- sections[].eyebrow: a short label at most 12 characters such as "POINT 01", "이런 분께 추천", "DETAIL", "HOW TO USE". Number feature sections as POINT 01, POINT 02 in order.',
  '- sections[].title: at most 2 short lines (use \n between lines), each line at most 16 Korean characters. Must be specific to this product, never generic like "Feature Section".',
  '- sections[].text: 1 to 3 short sentences, at most 110 Korean characters total. Conversational marketplace tone (해요체 or 합니다체, consistent across the page).',
  '- sections[].bullets: 0 to 4 short phrases, each at most 18 Korean characters. Use them for feature, benefit, detail, proof sections; leave empty for hero and cta.',
  '- sections[].image_index: the 0-based index of the uploaded image that best matches this section. Avoid using the same image in two consecutive sections. Use -1 only when no image fits.',
  '- generated_copy.spec_rows: product information table rows (상품명, 구성, 옵션, 가격, 추천 대상 etc.). Only use facts from the input or clearly visible in images; otherwise omit the row. Return an empty array if nothing is known.',
  '- generated_copy.comparison_rows: return [] unless comparative facts were supplied; otherwise up to 4 rows comparing "일반적인 제품" (ordinary) vs this product (ours), each value at most 16 characters. Base "ours" only on input selling points or visible qualities. Never name competitors.',
  '- generated_copy.faq: 3 to 4 practical buyer questions with short, honest answers. Do not invent shipping, warranty, or refund policies; point to the option/notice area instead when unknown.',
  '- generated_copy.notices: 2 to 4 neutral 구매 전 확인사항 such as screen color differences or measurement tolerances, without inventing specifics.',
  '- generated_copy.closing_line: one warm closing sentence for the bottom of the page, at most 40 characters.',
  'All customer-facing text must be in Korean except eyebrow labels, which may be short English.',
  'generated_copy.feature_descriptions should be short, punchy, and immediately usable in feature blocks. Use the format "짧은 제목: 한 줄 설명".',
  'generated_copy.seo_title should read naturally for Korean marketplace search and listing contexts.',
  'Avoid repetitive copy between sections, especially for benefit, ingredient, comparison, and proof sections.',
  'Safety rules:',
  '- Never invent product specifications that are not provided in the input.',
  '- Only describe materials, stitching, zipper quality, coating, durability, capacity, weight, or dimensions if they are clearly visible in images or explicitly stated in the input.',
  '- If the exact specification is unknown, use neutral wording such as "튼튼한 구조", "실용적인 수납 구조", "일상 사용에 어울리는 디자인", or similar safe Korean expressions.',
  '- Do not mention brand names, certifications, waterproofing, leather, metal type, exact dimensions, or technical claims unless confirmed.',
  '- Do not fabricate review counts, bestseller status, stock urgency, or ranking claims.',
  'Do not include markdown, HTML, or explanatory notes. Return JSON only.'
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
    ? images.filter((item) => typeof item === 'string' && item.startsWith('data:image/')).slice(0, MAX_DETAIL_PAGE_IMAGES)
    : [];

  if (!safeImages.length) {
    throw new Error('At least one image is required');
  }

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You generate structured Korean e-commerce JSON for high-conversion long-form marketplace product detail pages.'
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
  return normalizeCommerceDetailPage(parsed, safeImages.length, pageCount);
};


