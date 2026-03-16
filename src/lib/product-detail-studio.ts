export type ThemeKey = 'premium' | 'minimal' | 'playful';
export type ImageRoleType = 'hero' | 'detail' | 'usage';
export type PageCountOption = number;
export type SectionType =
  | 'hero'
  | 'feature'
  | 'usage'
  | 'detail'
  | 'benefit'
  | 'ingredient'
  | 'proof'
  | 'comparison'
  | 'cta';

export type ProductDetailFormValues = {
  productName: string;
  price: string;
  audience: string;
  sellingPoints: string;
  prompt: string;
  pageCount: PageCountOption;
};

export type DetailPagePricing = {
  page_count: PageCountOption;
  unit_price: number;
  total_price: number;
  unit_amount_cents: number;
  total_amount_cents: number;
  currency: 'USD';
};

export type UploadedImage = {
  id: string;
  file: File;
  url: string;
  dataUrl: string;
};

export type ProductSection = {
  type: SectionType;
  title: string;
  text: string;
  image_role: ImageRoleType;
};

export type GeneratedCopy = {
  headline: string;
  subheadline: string;
  key_selling_points: string[];
  feature_descriptions: string[];
  usage_scenario_text: string;
  detail_description: string;
  benefits: string[];
  cta: string;
  seo_title: string;
};

export type ProductDetailResult = {
  page_count: PageCountOption;
  section_order: SectionType[];
  image_role_mapping: {
    hero: number[];
    detail: number[];
    usage: number[];
  };
  sections: ProductSection[];
  generated_copy: GeneratedCopy;
};

export type ClassifiedImage = {
  image: UploadedImage;
  role: ImageRoleType;
};

export type RenderSection = ProductSection & {
  id: string;
  image: UploadedImage;
  imageIndex: number;
  emphasis: 'full' | 'detail' | 'soft';
  cropClass: string;
  toneNote: string;
};

export type DetailPageTestScenario = {
  id: string;
  pageCount: PageCountOption;
  imageCount: number;
  sellingPoints: string;
  audience: string;
  prompt: string;
  description: string;
};

export const DETAIL_PAGE_UNIT_PRICE_CENTS = 699;
export const DETAIL_PAGE_MIN_COUNT = 5;
export const DETAIL_PAGE_MAX_COUNT = 20;

const DETAIL_PAGE_BODY_SEQUENCE: SectionType[] = [
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

export const normalizeDetailPageCount = (value: number): PageCountOption => {
  const count = Math.round(Number(value) || DETAIL_PAGE_MIN_COUNT);
  return Math.min(DETAIL_PAGE_MAX_COUNT, Math.max(DETAIL_PAGE_MIN_COUNT, count));
};

export const buildDetailPageSectionOrder = (pageCount: number): SectionType[] => {
  const safeCount = normalizeDetailPageCount(pageCount);
  const bodyCount = Math.max(0, safeCount - 2);
  return ['hero', ...DETAIL_PAGE_BODY_SEQUENCE.slice(0, bodyCount), 'cta'];
};

const getDetailPageQualityNote = (pageCount: number) => {
  if (pageCount <= 6) return 'concise and essential';
  if (pageCount <= 10) return 'balanced and standard';
  return 'premium and complete';
};

export const buildDetailPagePricing = (pageCount: PageCountOption): DetailPagePricing => ({
  page_count: normalizeDetailPageCount(pageCount),
  unit_price: DETAIL_PAGE_UNIT_PRICE_CENTS / 100,
  total_price: Number(((normalizeDetailPageCount(pageCount) * DETAIL_PAGE_UNIT_PRICE_CENTS) / 100).toFixed(2)),
  unit_amount_cents: DETAIL_PAGE_UNIT_PRICE_CENTS,
  total_amount_cents: normalizeDetailPageCount(pageCount) * DETAIL_PAGE_UNIT_PRICE_CENTS,
  currency: 'USD'
});

export const formatDetailPagePrice = (amount: number, currency: 'USD' = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(amount);

export const starterPrompts = [
  '업로드한 상품 사진을 분석해서 한국 쇼핑몰형 상세페이지 카피를 작성해줘.',
  '860px 모바일 상세페이지 기준으로 섹션 흐름이 자연스럽게 이어지도록 작성해줘.',
  '스마트스토어와 쿠팡에 어울리는 판매 톤으로 짧고 설득력 있게 정리해줘.'
];

export const themes: Array<{
  key: ThemeKey;
  name: string;
  description: string;
  accent: string;
  shell: string;
  heroSurface: string;
}> = [
  {
    key: 'premium',
    name: 'Premium Commerce',
    description: '짙은 대비와 따뜻한 하이라이트로 브랜드형 상세페이지에 어울립니다.',
    accent: 'from-amber-200 via-orange-200 to-rose-200',
    shell: 'from-stone-950 via-zinc-950 to-slate-950',
    heroSurface: 'from-[#fff7ec] to-[#fff1f2]'
  },
  {
    key: 'minimal',
    name: 'Minimal Editorial',
    description: '정보 전달 중심의 정돈된 에디토리얼 무드입니다.',
    accent: 'from-cyan-200 via-sky-200 to-emerald-200',
    shell: 'from-slate-950 via-slate-900 to-slate-950',
    heroSurface: 'from-[#eff8ff] to-[#f0fdf4]'
  },
  {
    key: 'playful',
    name: 'Playful Social',
    description: '짧고 강한 문장과 선명한 분위기의 소셜형 무드입니다.',
    accent: 'from-fuchsia-200 via-pink-200 to-orange-200',
    shell: 'from-rose-950 via-zinc-950 to-orange-950',
    heroSurface: 'from-[#fff1f3] to-[#fff7ed]'
  }
];

export const iconGlyphMap: Record<string, string> = {
  hero: '*',
  feature: '+',
  usage: '@',
  detail: '#',
  benefit: '=',
  ingredient: '%',
  proof: 'O',
  comparison: '<>',
  cta: '>'
};

export const sectionLabelMap: Record<SectionType, string> = {
  hero: 'Hero',
  feature: 'Feature',
  usage: 'Usage',
  detail: 'Detail',
  benefit: 'Benefit',
  ingredient: 'Ingredient',
  proof: 'Proof',
  comparison: 'Comparison',
  cta: 'CTA'
};

export const themeLabelMap: Record<ThemeKey, string> = {
  premium: '프리미엄 커머스',
  minimal: '미니멀 에디토리얼',
  playful: '플레이풀 소셜'
};

export const detailPageTestScenarios: DetailPageTestScenario[] = [
  {
    id: 'two-images-ten-pages',
    pageCount: 10,
    imageCount: 2,
    sellingPoints: '보온감, 실사용 편의, 선물용 무드',
    audience: '감성적인 주방 아이템을 찾는 고객',
    prompt: '적은 이미지로도 완성도 높게 구성해줘.',
    description: '2 images + 10 pages'
  },
  {
    id: 'five-images-five-pages',
    pageCount: 5,
    imageCount: 5,
    sellingPoints: '핵심 기능, 가격 메리트, 간결한 메시지',
    audience: '빠르게 결정하는 실속형 고객',
    prompt: '짧고 바로 이해되는 구성으로 정리해줘.',
    description: '5 images + 5 pages'
  },
  {
    id: 'ten-images-ten-pages',
    pageCount: 10,
    imageCount: 10,
    sellingPoints: '디테일 강조, 프리미엄 무드, 비교 포인트',
    audience: '완성도 높은 상세페이지를 기대하는 고객',
    prompt: '프리미엄 쇼핑몰 상세페이지처럼 구성해줘.',
    description: '10 images + 10 pages'
  },
  {
    id: 'missing-selling-points',
    pageCount: 7,
    imageCount: 4,
    sellingPoints: '',
    audience: '정보 탐색형 고객',
    prompt: '사진 기반으로 핵심 장점을 유추해줘.',
    description: 'missing selling points'
  },
  {
    id: 'missing-target-customer',
    pageCount: 7,
    imageCount: 4,
    sellingPoints: '가벼운 사용감, 깔끔한 마감',
    audience: '',
    prompt: '대중적인 구매자 관점으로 정리해줘.',
    description: 'missing target customer'
  },
  {
    id: 'missing-prompt',
    pageCount: 7,
    imageCount: 4,
    sellingPoints: '대표 장점 위주 정리',
    audience: '실용적 구매 고객',
    prompt: '',
    description: 'missing prompt'
  }
];

const DEFAULT_COPY_BY_PAGE_COUNT: Record<PageCountOption, GeneratedCopy> = {
  5: {
    headline: '한눈에 장점이 보이는 실속형 상세페이지',
    subheadline: '핵심 정보만 빠르게 전달해 바로 구매 판단이 가능하도록 구성했습니다.',
    key_selling_points: ['첫 화면에서 장점이 바로 보이는 구조', '불필요한 반복 없이 핵심만 정리', '모바일에서 빠르게 읽히는 카피'],
    feature_descriptions: ['핵심 기능을 짧게 요약', '필요한 정보만 빠르게 전달', '간결한 구매 포인트 강조'],
    usage_scenario_text: '일상 사용과 선물용 제안처럼 바로 이해되는 사용 장면 위주로 구성합니다.',
    detail_description: '간단하지만 빠짐없이 상품 특징을 설명하는 실속형 상세 설명입니다.',
    benefits: ['빠르게 비교 가능한 정보 구조', '짧은 체류 시간에도 이해되는 흐름'],
    cta: '지금 필요한 포인트만 확인하고 바로 구매해보세요',
    seo_title: '핵심 장점이 잘 보이는 모바일 상품 상세페이지'
  },
  7: {
    headline: '가장 표준적인 한국형 쇼핑몰 상세페이지 구성',
    subheadline: '헤드라인부터 사용 장면, 신뢰 포인트, CTA까지 균형 있게 이어지는 기본형 구성입니다.',
    key_selling_points: ['모바일 쇼핑 흐름에 맞는 균형형 구조', '장점과 사용 장면을 자연스럽게 연결', '신뢰 포인트까지 포함한 표준형 카피'],
    feature_descriptions: ['기능과 장점을 함께 보여주는 구성', '상품 이해와 구매 판단을 동시에 지원', '국내 마켓에 익숙한 상세페이지 흐름'],
    usage_scenario_text: '대표 사용 장면과 고객 맥락을 자연스럽게 연결해 설득력을 높입니다.',
    detail_description: '디테일 설명과 proof 섹션이 함께 들어가 표준적인 커머스 완성도를 유지합니다.',
    benefits: ['정보 밀도와 가독성의 균형', '대부분의 스마트스토어 상품에 바로 적용 가능'],
    cta: '고객이 망설이기 전에 핵심 정보를 확인하고 바로 선택해보세요',
    seo_title: '모바일 쇼핑몰에 맞는 표준형 상품 상세페이지'
  },
  10: {
    headline: '프리미엄 커머스 무드로 완성하는 풀사이즈 상세페이지',
    subheadline: '기본 정보부터 비교 포인트, 베네핏, proof까지 촘촘하게 담아 완성도 높은 구매 경험을 만듭니다.',
    key_selling_points: ['브랜드형 흐름을 살린 프리미엄 구성', '반복 없이 섹션별 역할이 분명한 전개', '상세한 비교와 설득 포인트까지 포함'],
    feature_descriptions: ['디자인과 기능을 함께 설득하는 구조', '프리미엄 상품처럼 보이게 만드는 정보 밀도', '상세한 비교 포인트를 담는 완성형 카피'],
    usage_scenario_text: '실사용 장면을 더 풍부하게 제시해 라이프스타일 제안형 상세페이지를 만듭니다.',
    detail_description: '세부 특징, 비교 포인트, 베네핏, proof가 분리돼 더 완성도 높은 커머스 페이지를 구성합니다.',
    benefits: ['상세히 읽는 고객에게도 설득력 유지', '고가 상품이나 경쟁 강한 카테고리에 유리'],
    cta: '지금 주문하고 프리미엄 디테일의 차이를 직접 경험해보세요',
    seo_title: '프리미엄 무드의 풀사이즈 모바일 상품 상세페이지'
  }
};

const getDefaultCopyForPageCount = (pageCount: number): GeneratedCopy => {
  if (pageCount <= 6) return DEFAULT_COPY_BY_PAGE_COUNT[5];
  if (pageCount <= 10) return DEFAULT_COPY_BY_PAGE_COUNT[7];
  return DEFAULT_COPY_BY_PAGE_COUNT[10];
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const splitLines = (value: string) => value
  .split(/\n+/)
  .map((item) => item.trim())
  .filter(Boolean);

const takeFromRole = (
  buckets: Record<ImageRoleType, UploadedImage[]>,
  counters: Record<ImageRoleType, number>,
  role: ImageRoleType
) => {
  const list = buckets[role];
  if (!list.length) return null;
  const index = counters[role] % list.length;
  counters[role] += 1;
  return { image: list[index], index };
};

export const classifyImages = (result: ProductDetailResult, images: UploadedImage[]): ClassifiedImage[] => {
  const mapping = result.image_role_mapping;
  const roleByIndex = new Map<number, ImageRoleType>();

  mapping.hero.forEach((index) => roleByIndex.set(index, 'hero'));
  mapping.detail.forEach((index) => {
    if (!roleByIndex.has(index)) roleByIndex.set(index, 'detail');
  });
  mapping.usage.forEach((index) => {
    if (!roleByIndex.has(index)) roleByIndex.set(index, 'usage');
  });

  return images.map((image, index) => ({
    image,
    role: roleByIndex.get(index) ?? (index === 0 ? 'hero' : index % 2 === 0 ? 'detail' : 'usage')
  }));
};

export const buildRenderSections = (
  result: ProductDetailResult,
  images: UploadedImage[]
): RenderSection[] => {
  const classified = classifyImages(result, images);
  const buckets: Record<ImageRoleType, UploadedImage[]> = {
    hero: classified.filter((item) => item.role === 'hero').map((item) => item.image),
    detail: classified.filter((item) => item.role === 'detail').map((item) => item.image),
    usage: classified.filter((item) => item.role === 'usage').map((item) => item.image)
  };
  const fallbackHero = images[0];
  if (!buckets.hero.length && fallbackHero) buckets.hero.push(fallbackHero);
  if (!buckets.detail.length && images[1]) buckets.detail.push(images[1]);
  if (!buckets.detail.length && fallbackHero) buckets.detail.push(fallbackHero);
  if (!buckets.usage.length && images[2]) buckets.usage.push(images[2]);
  if (!buckets.usage.length && buckets.detail[0]) buckets.usage.push(buckets.detail[0]);

  const counters: Record<ImageRoleType, number> = { hero: 0, detail: 0, usage: 0 };
  let lastImageId = '';

  return result.sections.map((section, index) => {
    let selected = takeFromRole(buckets, counters, section.image_role)
      ?? takeFromRole(buckets, counters, 'hero')
      ?? takeFromRole(buckets, counters, 'detail')
      ?? takeFromRole(buckets, counters, 'usage')
      ?? { image: images[0], index: 0 };

    if (selected.image?.id === lastImageId) {
      const alternateRole = section.image_role === 'hero' ? 'detail' : section.image_role === 'detail' ? 'usage' : 'detail';
      const alternate = takeFromRole(buckets, counters, alternateRole);
      if (alternate?.image && alternate.image.id !== lastImageId) {
        selected = alternate;
      }
    }
    lastImageId = selected.image?.id ?? '';

    const variationIndex = index % 3;
    const emphasis = variationIndex === 0 ? 'full' : variationIndex === 1 ? 'detail' : 'soft';
    const cropClass = emphasis === 'full' ? 'object-cover object-center' : emphasis === 'detail' ? 'object-cover object-[50%_35%]' : 'object-cover object-[50%_60%]';
    const toneNote = emphasis === 'full' ? '대표컷 강조' : emphasis === 'detail' ? '디테일 강조' : '분위기 강조';

    return {
      ...section,
      id: `${section.type}-${index}`,
      image: selected.image,
      imageIndex: selected.index,
      emphasis,
      cropClass,
      toneNote
    };
  });
};

export const buildFeatureCards = (result: ProductDetailResult) => {
  const items = result.generated_copy.feature_descriptions.length
    ? result.generated_copy.feature_descriptions
    : result.generated_copy.key_selling_points;

  return items.slice(0, 4).map((text, index) => ({
    glyph: ['+', 'O', '#', '@'][index] ?? '+',
    title: text.split(':')[0]?.trim() || `포인트 ${index + 1}`,
    body: text.includes(':') ? text.split(':').slice(1).join(':').trim() : text
  }));
};

export const buildFallbackResult = (pageCount: PageCountOption): ProductDetailResult => {
  const safePageCount = normalizeDetailPageCount(pageCount);
  const copy = getDefaultCopyForPageCount(safePageCount);
  const sectionOrder = buildDetailPageSectionOrder(safePageCount);

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
      title: index === 0 ? copy.headline : `${sectionLabelMap[type]} Section`,
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

const normalizeText = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
};

const normalizeList = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return normalized.length ? normalized : fallback;
};

const normalizeSectionType = (value: unknown): SectionType | null => {
  if (typeof value !== 'string') return null;
  return value in sectionLabelMap ? (value as SectionType) : null;
};

const normalizeImageRole = (value: unknown): ImageRoleType | null => {
  if (value === 'hero' || value === 'detail' || value === 'usage') return value;
  return null;
};

export const ensureResultIntegrity = (
  result: ProductDetailResult | null | undefined,
  pageCount: PageCountOption
) => {
  if (!result) return buildFallbackResult(pageCount);
  const fallback = buildFallbackResult(pageCount);
  const normalizedSectionOrder = Array.isArray(result.section_order)
    ? result.section_order
      .map((item) => normalizeSectionType(item))
      .filter((item): item is SectionType => Boolean(item))
    : [];
  const normalizedSections = Array.isArray(result.sections)
    ? result.sections.map((section, index) => {
      const fallbackSection = fallback.sections[index] ?? fallback.sections[fallback.sections.length - 1];
      return {
        type: normalizeSectionType(section?.type) ?? fallbackSection.type,
        title: normalizeText(section?.title, fallbackSection.title),
        text: normalizeText(section?.text, fallbackSection.text),
        image_role: normalizeImageRole(section?.image_role) ?? fallbackSection.image_role
      };
    }).filter((section) => Boolean(section.title) && Boolean(section.text))
    : [];

  return {
    page_count: result.page_count || fallback.page_count,
    section_order: normalizedSectionOrder.length ? normalizedSectionOrder : fallback.section_order,
    image_role_mapping: {
      hero: result.image_role_mapping?.hero?.length ? result.image_role_mapping.hero : fallback.image_role_mapping.hero,
      detail: result.image_role_mapping?.detail?.length ? result.image_role_mapping.detail : fallback.image_role_mapping.detail,
      usage: result.image_role_mapping?.usage?.length ? result.image_role_mapping.usage : fallback.image_role_mapping.usage
    },
    sections: normalizedSections.length ? normalizedSections : fallback.sections,
    generated_copy: {
      headline: normalizeText(result.generated_copy?.headline, fallback.generated_copy.headline),
      subheadline: normalizeText(result.generated_copy?.subheadline, fallback.generated_copy.subheadline),
      key_selling_points: normalizeList(result.generated_copy?.key_selling_points, fallback.generated_copy.key_selling_points),
      feature_descriptions: normalizeList(result.generated_copy?.feature_descriptions, fallback.generated_copy.feature_descriptions),
      usage_scenario_text: normalizeText(result.generated_copy?.usage_scenario_text, fallback.generated_copy.usage_scenario_text),
      detail_description: normalizeText(result.generated_copy?.detail_description, fallback.generated_copy.detail_description),
      benefits: normalizeList(result.generated_copy?.benefits, fallback.generated_copy.benefits),
      cta: normalizeText(result.generated_copy?.cta, fallback.generated_copy.cta),
      seo_title: normalizeText(result.generated_copy?.seo_title, fallback.generated_copy.seo_title)
    }
  };
};

export const buildPlainCopyText = ({
  formValues,
  result
}: {
  formValues: ProductDetailFormValues;
  result: ProductDetailResult;
}) => [
  `[상품명] ${formValues.productName}`,
  `[가격/옵션] ${formValues.price}`,
  `[타깃 고객] ${formValues.audience}`,
  `[페이지 수] ${result.page_count}`,
  '',
  `[SEO 제목] ${result.generated_copy.seo_title}`,
  `[헤드라인] ${result.generated_copy.headline}`,
  `[서브헤드라인] ${result.generated_copy.subheadline}`,
  '',
  '[핵심 장점]',
  ...result.generated_copy.key_selling_points.map((item, index) => `${index + 1}. ${item}`),
  '',
  '[기능 설명]',
  ...result.generated_copy.feature_descriptions.map((item) => `- ${item}`),
  '',
  `[사용 장면] ${result.generated_copy.usage_scenario_text}`,
  `[상세 설명] ${result.generated_copy.detail_description}`,
  '',
  '[베네핏]',
  ...result.generated_copy.benefits.map((item) => `- ${item}`),
  '',
  `[CTA] ${result.generated_copy.cta}`,
  '',
  '[섹션별 원고]',
  ...result.sections.map((section, index) => `${index + 1}. ${sectionLabelMap[section.type]}\n제목: ${section.title}\n본문: ${section.text}`),
  '',
  '[섹션 순서]',
  ...result.section_order.map((item, index) => `${index + 1}. ${sectionLabelMap[item]}`)
].join('\n');

export const buildDetailPageHtml = ({
  formValues,
  result,
  images,
  theme
}: {
  formValues: ProductDetailFormValues;
  result: ProductDetailResult;
  images: UploadedImage[];
  theme: ThemeKey;
}) => {
  const sections = buildRenderSections(result, images);
  const featureCards = buildFeatureCards(result);
  const themeName = themeLabelMap[theme];
  const tags = result.generated_copy.key_selling_points.map((item) => `<span>${escapeHtml(item)}</span>`).join('');

  const sectionHtml = sections.map((section) => {
    const cards = section.type === 'feature'
      ? `<div class="feature-grid">${featureCards.map((item) => `
          <article class="feature-card">
            <div class="glyph">${escapeHtml(item.glyph)}</div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join('')}</div>`
      : '';
    const bullets = splitLines(section.text).length > 1
      ? `<div class="text-list">${splitLines(section.text).map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</div>`
      : '';

    return `
      <section class="section-block section-${section.type}">
        <p class="eyebrow">${escapeHtml(sectionLabelMap[section.type])}</p>
        <h2>${escapeHtml(section.title)}</h2>
        <p class="lead">${escapeHtml(section.text)}</p>
        <p class="note">${escapeHtml(section.toneNote)}</p>
        ${cards}
        ${bullets}
        <div class="section-image">
          <img class="${section.cropClass}" src="${section.image.dataUrl}" alt="${escapeHtml(section.title)}" />
        </div>
      </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(result.generated_copy.seo_title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Pretendard, Apple SD Gothic Neo, sans-serif; }
      .page { width: 860px; max-width: 100%; margin: 0 auto; background: #ffffff; }
      .hero { padding: 40px 28px 28px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; }
      .eyebrow { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.7; }
      .hero h1 { margin: 0; font-size: 42px; line-height: 1.12; }
      .hero p { margin: 14px 0 0; line-height: 1.8; }
      .hero-meta { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 22px; }
      .hero-meta div { padding: 16px; border-radius: 18px; background: rgba(255,255,255,0.08); }
      .hero-meta strong { display: block; margin-bottom: 8px; font-size: 12px; opacity: 0.75; }
      .hero-image { overflow: hidden; margin-top: 24px; border-radius: 28px; }
      .hero-image img, .section-image img { display: block; width: 100%; height: auto; }
      .content { padding: 24px 24px 42px; }
      .section-block { padding: 22px 0 30px; border-bottom: 1px solid #e2e8f0; }
      .section-block:last-child { border-bottom: 0; }
      .section-block h2 { margin: 0; font-size: 30px; line-height: 1.2; }
      .lead { margin: 14px 0 0; line-height: 1.8; color: #475569; }
      .note { margin: 10px 0 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; }
      .section-image { overflow: hidden; margin-top: 18px; border-radius: 26px; background: #e2e8f0; }
      .section-image img { aspect-ratio: 4 / 5; }
      .feature-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 18px; }
      .feature-card { padding: 18px; border-radius: 20px; background: #f8fafc; }
      .glyph { font-size: 20px; margin-bottom: 10px; }
      .feature-card h3 { margin: 0; font-size: 18px; }
      .feature-card p { margin: 8px 0 0; line-height: 1.7; color: #475569; }
      .text-list { display: grid; gap: 10px; margin-top: 16px; }
      .text-list p { margin: 0; padding: 14px 16px; border-radius: 18px; background: #f8fafc; line-height: 1.7; }
      .seo-box { margin-top: 28px; padding: 24px; border-radius: 28px; background: #0f172a; color: #ffffff; }
      .seo-box h2 { margin: 0; font-size: 30px; line-height: 1.2; }
      .seo-box p { margin: 14px 0 0; line-height: 1.8; }
      .tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      .tags span { padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,0.1); font-size: 13px; }
      @media (max-width: 860px) {
        .hero { padding: 28px 18px 22px; }
        .hero h1 { font-size: 30px; }
        .hero-meta, .feature-grid { grid-template-columns: 1fr; }
        .content { padding: 18px 16px 34px; }
        .section-block h2, .seo-box h2 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="page" data-theme="${escapeHtml(theme)}" data-theme-label="${escapeHtml(themeName)}">
      <header class="hero">
        <p class="eyebrow">${escapeHtml(themeName)}</p>
        <h1>${escapeHtml(result.generated_copy.headline)}</h1>
        <p>${escapeHtml(result.generated_copy.subheadline)}</p>
        ${sections[0] ? `<div class="hero-image"><img src="${sections[0].image.dataUrl}" alt="${escapeHtml(sections[0].title)}" /></div>` : ''}
        <div class="hero-meta">
          <div><strong>상품명</strong>${escapeHtml(formValues.productName)}</div>
          <div><strong>가격/옵션</strong>${escapeHtml(formValues.price)}</div>
          <div><strong>타깃</strong>${escapeHtml(formValues.audience)}</div>
        </div>
      </header>
      <main class="content">
${sectionHtml}
        <section class="seo-box">
          <p class="eyebrow">SEO / CTA</p>
          <h2>${escapeHtml(result.generated_copy.seo_title)}</h2>
          <p>${escapeHtml(result.generated_copy.cta)}</p>
          <div class="tags">${tags}</div>
        </section>
      </main>
    </div>
  </body>
</html>`;
};
