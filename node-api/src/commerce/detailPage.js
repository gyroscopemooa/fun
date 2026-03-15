import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';

const detailPageSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    sub_headline: { type: 'string' },
    selling_points: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 6
    },
    feature_icons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          icon: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['icon', 'label', 'description']
      },
      minItems: 3,
      maxItems: 4
    },
    description: { type: 'string' },
    recommended_users: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 5
    },
    product_info: {
      type: 'object',
      additionalProperties: false,
      properties: {
        price_note: { type: 'string' },
        materials: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5
        },
        colors: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5
        },
        visual_style: { type: 'string' },
        usage_situations: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5
        },
        key_visual_details: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 6
        },
        size_tip: { type: 'string' },
        package_includes: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5
        }
      },
      required: [
        'price_note',
        'materials',
        'colors',
        'visual_style',
        'usage_situations',
        'key_visual_details',
        'size_tip',
        'package_includes'
      ]
    },
    cta: { type: 'string' },
    layout_plan: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hero_image_index: { type: 'integer', minimum: 0, maximum: 7 },
        detail_image_index: { type: 'integer', minimum: 0, maximum: 7 },
        usage_image_index: { type: 'integer', minimum: 0, maximum: 7 },
        section_count: { type: 'integer', minimum: 6, maximum: 8 }
      },
      required: ['hero_image_index', 'detail_image_index', 'usage_image_index', 'section_count']
    },
    image_analysis: {
      type: 'object',
      additionalProperties: false,
      properties: {
        product_color: { type: 'string' },
        materials: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5
        },
        visual_style: { type: 'string' },
        usage_situations: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5
        },
        key_visual_details: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 6
        }
      },
      required: [
        'product_color',
        'materials',
        'visual_style',
        'usage_situations',
        'key_visual_details'
      ]
    },
    image_roles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer', minimum: 0, maximum: 7 },
          role: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['index', 'role', 'reason']
      },
      minItems: 1,
      maxItems: 8
    },
    seo: {
      type: 'object',
      additionalProperties: false,
      properties: {
        naver_title: { type: 'string' },
        product_keywords: {
          type: 'array',
          items: { type: 'string' },
          minItems: 4,
          maxItems: 10
        },
        product_tags: {
          type: 'array',
          items: { type: 'string' },
          minItems: 4,
          maxItems: 10
        },
        short_marketing_copy: { type: 'string' }
      },
      required: ['naver_title', 'product_keywords', 'product_tags', 'short_marketing_copy']
    }
  },
  required: [
    'headline',
    'sub_headline',
    'selling_points',
    'feature_icons',
    'description',
    'recommended_users',
    'product_info',
    'cta',
    'layout_plan',
    'image_analysis',
    'image_roles',
    'seo'
  ]
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

const normalizeFeatureIcons = (value) => {
  if (!Array.isArray(value)) {
    return [
      { icon: 'sparkles', label: '핵심 포인트', description: '첫 화면에서 장점을 바로 전달합니다.' },
      { icon: 'badge-check', label: '신뢰감', description: '상품 특징을 이해하기 쉽게 정리합니다.' },
      { icon: 'shopping-bag', label: '구매 유도', description: '모바일 쇼핑 동선에 맞춘 CTA를 배치합니다.' }
    ];
  }

  const normalized = value
    .map((item) => ({
      icon: normalizeString(item?.icon, 'sparkles'),
      label: normalizeString(item?.label),
      description: normalizeString(item?.description)
    }))
    .filter((item) => item.label && item.description)
    .slice(0, 4);

  return normalized.length ? normalized : normalizeFeatureIcons(null);
};

const normalizeImageRoles = (value, imageCount) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      index: Number(item?.index ?? -1),
      role: normalizeString(item?.role, 'detail'),
      reason: normalizeString(item?.reason, '상품 흐름상 적합한 이미지로 분류')
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < imageCount);
};

const uniqueIndices = (...indices) => {
  const seen = new Set();
  return indices.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const normalizePayload = (payload, imageCount) => {
  const imageAnalysis = payload?.image_analysis ?? {};
  const productInfo = payload?.product_info ?? {};
  const heroImageIndex = Number(payload?.layout_plan?.hero_image_index ?? 0);
  const detailImageIndex = Number(payload?.layout_plan?.detail_image_index ?? Math.min(1, imageCount - 1));
  const usageImageIndex = Number(payload?.layout_plan?.usage_image_index ?? Math.min(2, imageCount - 1));
  const sectionCount = Number(payload?.layout_plan?.section_count ?? (imageCount > 5 ? 8 : 6));
  const safeHero = Number.isInteger(heroImageIndex) && heroImageIndex >= 0 && heroImageIndex < imageCount ? heroImageIndex : 0;
  const safeDetail = Number.isInteger(detailImageIndex) && detailImageIndex >= 0 && detailImageIndex < imageCount ? detailImageIndex : Math.min(1, imageCount - 1);
  const safeUsage = Number.isInteger(usageImageIndex) && usageImageIndex >= 0 && usageImageIndex < imageCount ? usageImageIndex : Math.min(2, imageCount - 1);
  const roles = normalizeImageRoles(payload?.image_roles, imageCount);
  const fallbackRoles = uniqueIndices(safeHero, safeDetail, safeUsage).map((index) => ({
    index,
    role: index === safeHero ? 'hero' : index === safeUsage ? 'usage' : 'detail',
    reason: index === safeHero
      ? '대표 상품 이미지로 적합'
      : index === safeUsage
        ? '사용 장면이나 라이프스타일 연출에 적합'
        : '디테일 설명 섹션에 적합'
  }));

  return {
    headline: normalizeString(payload?.headline, '상품의 첫 인상을 선명하게 보여주는 상세페이지'),
    sub_headline: normalizeString(payload?.sub_headline, '실제 상품 사진과 입력한 조건을 바탕으로 모바일 쇼핑에 맞춘 상세페이지 흐름을 구성했습니다.'),
    selling_points: normalizeStringList(payload?.selling_points, [
      '첫 화면에서 핵심 장점이 바로 보이도록 정리',
      '한국형 모바일 쇼핑몰 톤으로 카피 구성',
      '구매 결정을 돕는 CTA 흐름까지 포함'
    ]).slice(0, 6),
    feature_icons: normalizeFeatureIcons(payload?.feature_icons),
    description: normalizeString(payload?.description, '상품 특징과 실제 사용 장면을 자연스럽게 연결한 상세 설명입니다.'),
    recommended_users: normalizeStringList(payload?.recommended_users, [
      '실용적인 상품 정보를 빠르게 파악하고 싶은 고객',
      '사진 중심으로 상품 분위기를 보고 구매를 결정하는 고객'
    ]).slice(0, 5),
    product_info: {
      price_note: normalizeString(productInfo.price_note, '가격 및 옵션 정보는 판매 정책에 맞게 최종 조정해 주세요.'),
      materials: normalizeStringList(productInfo.materials, normalizeStringList(imageAnalysis.materials, ['대표 소재 정보'])),
      colors: normalizeStringList(productInfo.colors, [normalizeString(imageAnalysis.product_color, '대표 컬러')]),
      visual_style: normalizeString(productInfo.visual_style, normalizeString(imageAnalysis.visual_style, '모바일 커머스에 맞는 깔끔한 비주얼')),
      usage_situations: normalizeStringList(productInfo.usage_situations, normalizeStringList(imageAnalysis.usage_situations, ['일상 사용', '선물 제안'])),
      key_visual_details: normalizeStringList(productInfo.key_visual_details, normalizeStringList(imageAnalysis.key_visual_details, ['형태', '질감', '디테일'])),
      size_tip: normalizeString(productInfo.size_tip, '옵션과 사이즈 정보는 판매 페이지 기준으로 보완해 주세요.'),
      package_includes: normalizeStringList(productInfo.package_includes, ['상품 본품'])
    },
    cta: normalizeString(payload?.cta, '지금 바로 상품의 매력을 상세페이지로 완성해 보세요.'),
    layout_plan: {
      hero_image_index: safeHero,
      detail_image_index: safeDetail,
      usage_image_index: safeUsage,
      section_count: Math.max(6, Math.min(imageCount > 5 ? 8 : 6, sectionCount || 6))
    },
    image_analysis: {
      product_color: normalizeString(imageAnalysis.product_color, '대표 컬러'),
      materials: normalizeStringList(imageAnalysis.materials, ['대표 소재']),
      visual_style: normalizeString(imageAnalysis.visual_style, '실사용 중심의 커머스 스타일'),
      usage_situations: normalizeStringList(imageAnalysis.usage_situations, ['일상 사용', '선물 제안']),
      key_visual_details: normalizeStringList(imageAnalysis.key_visual_details, ['형태', '질감', '마감'])
    },
    image_roles: roles.length ? roles : fallbackRoles,
    seo: {
      naver_title: normalizeString(payload?.seo?.naver_title, normalizeString(payload?.headline, '상품 상세페이지 초안')),
      product_keywords: normalizeStringList(payload?.seo?.product_keywords, ['상품상세', '상세페이지', '스마트스토어', '쇼핑몰']),
      product_tags: normalizeStringList(payload?.seo?.product_tags, ['상세페이지', '스마트스토어', '쿠팡', '상품소개']),
      short_marketing_copy: normalizeString(payload?.seo?.short_marketing_copy, '실제 상품 사진을 기반으로 설득력 있게 정리한 판매 문구입니다.')
    }
  };
};

const extractJson = (value) => {
  if (typeof value !== 'string') {
    throw new Error('OpenAI response content is empty');
  }
  const trimmed = value.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? trimmed.slice(firstBrace, lastBrace + 1)
    : trimmed;
  return JSON.parse(candidate);
};

const buildPrompt = ({
  productName,
  price,
  audience,
  highlight,
  prompt,
  theme,
  imageCount
}) => [
  '다음 입력값과 업로드된 상품 이미지를 함께 분석해서 한국형 모바일 쇼핑 상세페이지용 JSON만 생성하세요.',
  '레이아웃은 860px 폭의 세로형 쇼핑몰 상세페이지를 전제로 합니다.',
  '반드시 다음 섹션 흐름을 반영하세요: Hero, Key selling points, Feature icons, Usage scenario, Detail description, CTA.',
  '이미지는 hero image, detail image, usage image로 분류하고 image_roles 배열과 layout_plan 인덱스에 반영하세요.',
  '문체는 스마트스토어, 쿠팡, 카페24에서 바로 쓸 수 있는 자연스러운 한국어 판매 톤으로 작성하세요.',
  'HTML이나 마크다운은 출력하지 말고 JSON만 반환하세요.',
  `상품명: ${productName}`,
  `가격/옵션: ${price || '미입력'}`,
  `타깃 고객: ${audience || '미입력'}`,
  `핵심 포인트: ${highlight || '미입력'}`,
  `추가 프롬프트: ${prompt || '실제 상품 사진을 바탕으로 구매 전환형 상세페이지 카피를 생성'}`,
  `테마: ${theme}`,
  `업로드 이미지 수: ${imageCount}`,
  'feature_icons는 아이콘 이름, 짧은 라벨, 한 줄 설명으로 구성하세요.',
  'image_roles.role은 hero, detail, usage 중 하나를 우선 사용하세요.',
  'section_count는 기본 6으로 두고 이미지가 매우 다양하면 7 또는 8까지 확장해도 됩니다.',
  'seo 필드도 반드시 포함하세요.'
].join('\n');

export const generateCommerceDetailPage = async ({
  productName,
  price,
  audience,
  highlight,
  prompt,
  theme,
  images
}) => {
  const safeImages = Array.isArray(images)
    ? images.filter((item) => typeof item === 'string' && item.startsWith('data:image/')).slice(0, 8)
    : [];

  if (!safeImages.length) {
    throw new Error('At least one image is required');
  }

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content: 'You generate structured Korean e-commerce JSON for mobile shopping detail pages.'
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
              highlight,
              prompt,
              theme,
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
  return normalizePayload(parsed, safeImages.length);
};
