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
          title: { type: 'string' },
          text: { type: 'string' },
          image_role: {
            type: 'string',
            enum: ['hero', 'detail', 'usage']
          }
        },
        required: ['type', 'title', 'text', 'image_role']
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

const DEFAULT_COPY_BY_PAGE_COUNT = {
  5: {
    headline: '?듭떖留?鍮좊Ⅴ寃??꾨떖?섎뒗 ?ㅼ냽???곸꽭?섏씠吏',
    subheadline: '吏㏃? 泥대쪟 ?쒓컙?먮룄 ?곹뭹 ?μ젏??諛붾줈 ?댄빐?섎룄濡?媛꾧껐?섍쾶 援ъ꽦?덉뒿?덈떎.',
    key_selling_points: ['?듭떖 ?μ젏???쒕늿??蹂댁씠??援ъ꽦', '遺덊븘?뷀븳 諛섎났??以꾩씤 ?붿빟??移댄뵾', '紐⑤컮?쇱뿉??鍮좊Ⅴ寃??쏀엳???먮쫫'],
    feature_descriptions: ['媛??以묒슂???ъ씤?몃???吏곴??곸쑝濡??꾨떖', '吏㏃?留?援щℓ ?먮떒???꾩슂???뺣낫 ?뺣낫', '?ㅼ냽???곹뭹??留욌뒗 媛꾧껐???ㅻ뱷 援ъ“'],
    usage_scenario_text: '????ъ슜 ?λ㈃留?怨⑤씪 蹂댁뿬二쇰ŉ 吏㏐퀬 紐낇솗?섍쾶 ?ㅻ뱷?⑸땲??',
    detail_description: '?꾩닔 ?뺣낫 ?꾩＜濡??뺣━??吏㏃? ?곸꽭 ?ㅻ챸?낅땲??',
    benefits: ['鍮좊Ⅸ ?댄빐', '吏㏃? 援щℓ 寃곗젙 ?숈꽑'],
    cta: '?꾩슂???뺣낫留??뺤씤?섍퀬 諛붾줈 援щℓ?대낫?몄슂',
    seo_title: '?듭떖 ?μ젏????蹂댁씠??媛꾧껐???곹뭹 ?곸꽭?섏씠吏'
  },
  7: {
    headline: '媛???쒖??곸씤 ?쒓뎅???쇳븨紐??곸꽭?섏씠吏 援ъ꽦',
    subheadline: '?ㅻ뱶?쇱씤, ?μ젏, ?ъ슜 ?λ㈃, ?뷀뀒?? proof媛 洹좏삎 ?덇쾶 ?댁뼱吏??湲곕낯??援ъ꽦?낅땲??',
    key_selling_points: ['媛???쇰컲?곸씤 紐⑤컮???쇳븨紐??먮쫫', '?μ젏怨??ъ슜 ?λ㈃???먯뿰?ㅻ읇寃??곌껐', 'proof ?뱀뀡源뚯? ?ы븿???덉젙?곸씤 ?ㅻ뱷 援ъ“'],
    feature_descriptions: ['湲곕뒫怨??μ젏??洹좏삎 ?덇쾶 蹂댁뿬二쇰뒗 援ъ꽦', '怨좉컼???ㅽ겕濡ㅽ븯硫??먯뿰?ㅻ읇寃??댄빐?섎뒗 ?먮쫫', '援?궡 留덉폆???듭닕???꾧컻 諛⑹떇'],
    usage_scenario_text: '?ъ슜 ?λ㈃怨?怨좉컼 留λ씫???곌껐??援щℓ ?대?吏瑜?洹몃━湲??쎄쾶 留뚮벊?덈떎.',
    detail_description: '?뺣낫?됯낵 媛?낆꽦??洹좏삎??媛????留욌뒗 ?쒖????곸꽭 ?ㅻ챸?낅땲??',
    benefits: ['??????? ??????????? ????', '????? ??? ?????????????'],
    cta: '?μ젏遺???뷀뀒?쇨퉴吏 ?뺤씤?섍퀬 諛붾줈 ?좏깮?대낫?몄슂',
    seo_title: '紐⑤컮???쇳븨紐곗뿉 ??留욌뒗 ?쒖????곹뭹 ?곸꽭?섏씠吏'
  },
  10: {
    headline: '?꾨━誘몄뾼 臾대뱶濡??꾩꽦?섎뒗 ??ъ씠利??곸꽭?섏씠吏',
    subheadline: '湲곕낯 ?뺣낫遺??鍮꾧탳 ?ъ씤?몄? proof源뚯? 珥섏킌?섍쾶 ?댁븘 ???꾩꽦???믪? 援щℓ 寃쏀뿕??留뚮벊?덈떎.',
    key_selling_points: ['?뱀뀡蹂???븷??遺꾨챸???꾨━誘몄뾼 援ъ꽦', '鍮꾧탳, 踰좊꽕?? ingredient源뚯? ?ы븿???꾩꽦???먮쫫', '諛섎났蹂대떎 ?뺣낫 ?뺤옣??珥덉젏?????뷀뀒???꾧컻'],
    feature_descriptions: ['Premium information architecture', 'Long-scroll commerce storytelling', 'Comparison and proof sections that stay easy to read'],
    usage_scenario_text: '?ъ슜 ?λ㈃怨??쇱씠?꾩뒪???留λ씫?????띾??섍쾶 ?쒖떆??紐곗엯?꾨? ?믪엯?덈떎.',
    detail_description: '?뷀뀒?? benefit, ingredient, comparison, proof媛 遺꾨━?섏뼱 ?꾩꽦???믪? ?λЦ???곸꽭 ?ㅻ챸??援ъ꽦?⑸땲??',
    benefits: ['?뺣룆??怨좉컼?먭쾶???ㅻ뱷???좎?', '釉뚮옖?쒗삎 ?곹뭹?대굹 怨좉????곹뭹???곹빀'],
    cta: '?ㅻ뒛 二쇰Ц?섍퀬 ?꾨━誘몄뾼 ?뷀뀒?쇱쓽 李⑥씠瑜?吏곸젒 寃쏀뿕?대낫?몄슂',
    seo_title: '?꾨━誘몄뾼 臾대뱶????ъ씠利?紐⑤컮???곹뭹 ?곸꽭?섏씠吏'
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

export const buildFallbackCommerceDetailPage = (pageCount = 7, imageCount = 1) => {
  const safePageCount = clampPageCount(pageCount);
  const safeImageCount = Math.max(1, Number(imageCount) || 1);
  return normalizePayload(buildFallbackPayload(safePageCount), safeImageCount, safePageCount);
};

const normalizePayload = (payload, imageCount, requestedPageCount) => {
  const safeRequestedPageCount = clampPageCount(requestedPageCount);
  const fallbackPayload = buildFallbackPayload(safeRequestedPageCount);
  const pageCount = clampPageCount(payload?.page_count ?? requestedPageCount);
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
  'Generate only JSON for a Korean ecommerce detail page.',
  'Assume an 860px-wide long-form product detail layout suitable for Smart Store, Coupang, and similar marketplaces.',
  `Target page count: ${pageCount}.`,
  `Page count guidance: ${getPageQualityNote(pageCount)}.`,
  `Required section order: ${JSON.stringify(buildSectionOrder(pageCount))}.`,
  'Return page_count, section_order, image_role_mapping, sections, and generated_copy.',
  'Allowed sections.type values: hero, feature, usage, detail, benefit, ingredient, proof, comparison, cta.',
  'Allowed sections.image_role values: hero, detail, usage.',
  'Map hero sections to lead images, detail sections to product detail images, and usage sections to lifestyle or context images.',
  'If there are fewer images than pages, reuse images naturally and insert text-led sections where appropriate.',
  `Product name: ${productName}`,
  `Price or options: ${price || 'not provided'}`,
  `Structured pricing: ${pricing ? JSON.stringify(pricing) : 'not provided'}`,
  `Target audience: ${audience || 'not provided'}`,
  `Key selling points: ${sellingPoints || 'not provided'}`,
  `Theme: ${theme}`,
  `Extra prompt: ${prompt || 'Create a clean, conversion-focused commerce detail page based on the uploaded product images.'}`,
  `Uploaded image count: ${imageCount}`,
  'generated_copy.feature_descriptions should be short, punchy, and immediately usable in a feature section.',
  'generated_copy.seo_title should read naturally for Korean marketplace listings and product search contexts.',
  'generated_copy.cta should feel specific to the product and purchase motivation, not generic.',
  'Make the composition feel more basic at 5 pages, more persuasive at 7 pages, and more premium and complete at 10 pages or more.',
  'Avoid repetitive copy between sections, especially for benefit, ingredient, comparison, and proof sections.',
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


