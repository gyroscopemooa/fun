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
export const DETAIL_PAGE_MIN_COUNT = 1;
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
  if (pageCount <= 3) return 'compact and minimal';
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

export const formatApproxKrw = (usdAmount: number, rate = 1450) => {
  const krw = Math.round(usdAmount * rate);
  const rounded = Math.round(krw / 1000) * 1000;
  return `about ${rounded.toLocaleString('ko-KR')} KRW`;
};

export const starterPrompts = [
  '?…ë¡œ?œí•œ ?í’ˆ ?¬ì§„??ë¶„ì„?´ì„œ ?œêµ­ ?¼í•‘ëª°í˜• ?ì„¸?˜ì´ì§€ ì¹´í”¼ë¥??‘ì„±?´ì¤˜.',
  '860px ëª¨ë°”???ì„¸?˜ì´ì§€ ê¸°ì??¼ë¡œ ?¹ì…˜ ?ë¦„???ì—°?¤ëŸ½ê²??´ì–´ì§€?„ë¡ ?‘ì„±?´ì¤˜.',
  '?¤ë§ˆ?¸ìŠ¤? ì–´?€ ì¿ íŒ¡???´ìš¸ë¦¬ëŠ” ?ë§¤ ?¤ìœ¼ë¡?ì§§ê³  ?¤ë“???ˆê²Œ ?•ë¦¬?´ì¤˜.'
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
    description: 'ì§™ì? ?€ë¹„ì? ?°ëœ»???˜ì´?¼ì´?¸ë¡œ ë¸Œëœ?œí˜• ?ì„¸?˜ì´ì§€???´ìš¸ë¦½ë‹ˆ??',
    accent: 'from-amber-200 via-orange-200 to-rose-200',
    shell: 'from-stone-950 via-zinc-950 to-slate-950',
    heroSurface: 'from-[#fff7ec] to-[#fff1f2]'
  },
  {
    key: 'minimal',
    name: 'Minimal Editorial',
    description: '?•ë³´ ?„ë‹¬ ì¤‘ì‹¬???•ëˆ???ë””? ë¦¬??ë¬´ë“œ?…ë‹ˆ??',
    accent: 'from-cyan-200 via-sky-200 to-emerald-200',
    shell: 'from-slate-950 via-slate-900 to-slate-950',
    heroSurface: 'from-[#eff8ff] to-[#f0fdf4]'
  },
  {
    key: 'playful',
    name: 'Playful Social',
    description: 'ì§§ê³  ê°•í•œ ë¬¸ì¥ê³?? ëª…??ë¶„ìœ„ê¸°ì˜ ?Œì…œ??ë¬´ë“œ?…ë‹ˆ??',
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
  premium: 'Premium Commerce',
  minimal: 'Minimal Editorial',
  playful: 'Playful Catalog'
};

export const detailPageTestScenarios: DetailPageTestScenario[] = [
  {
    id: 'two-images-ten-pages',
    pageCount: 10,
    imageCount: 2,
    sellingPoints: 'ë³´ì˜¨ê°? ?¤ì‚¬???¸ì˜, ? ë¬¼??ë¬´ë“œ',
    audience: 'ê°ì„±?ì¸ ì£¼ë°© ?„ì´?œì„ ì°¾ëŠ” ê³ ê°',
    prompt: '?ì? ?´ë?ì§€ë¡œë„ ?„ì„±???’ê²Œ êµ¬ì„±?´ì¤˜.',
    description: '2 images + 10 pages'
  },
  {
    id: 'five-images-five-pages',
    pageCount: 5,
    imageCount: 5,
    sellingPoints: '?µì‹¬ ê¸°ëŠ¥, ê°€ê²?ë©”ë¦¬?? ê°„ê²°??ë©”ì‹œì§€',
    audience: 'ë¹ ë¥´ê²?ê²°ì •?˜ëŠ” ?¤ì†??ê³ ê°',
    prompt: 'ì§§ê³  ë°”ë¡œ ?´í•´?˜ëŠ” êµ¬ì„±?¼ë¡œ ?•ë¦¬?´ì¤˜.',
    description: '5 images + 5 pages'
  },
  {
    id: 'ten-images-ten-pages',
    pageCount: 10,
    imageCount: 10,
    sellingPoints: 'Detail highlights, premium mood, comparison selling points',
    audience: 'Customers who expect a more complete product detail page',
    prompt: 'Compose it like a premium commerce detail page.',
    description: '10 images + 10 pages'
  },
  {
    id: 'missing-selling-points',
    pageCount: 7,
    imageCount: 4,
    sellingPoints: '',
    audience: '?•ë³´ ?ìƒ‰??ê³ ê°',
    prompt: '?¬ì§„ ê¸°ë°˜?¼ë¡œ ?µì‹¬ ?¥ì ??? ì¶”?´ì¤˜.',
    description: 'missing selling points'
  },
  {
    id: 'missing-target-customer',
    pageCount: 7,
    imageCount: 4,
    sellingPoints: 'ê°€ë²¼ìš´ ?¬ìš©ê°? ê¹”ë”??ë§ˆê°',
    audience: '',
    prompt: '?€ì¤‘ì ??êµ¬ë§¤??ê´€?ìœ¼ë¡??•ë¦¬?´ì¤˜.',
    description: 'missing target customer'
  },
  {
    id: 'missing-prompt',
    pageCount: 7,
    imageCount: 4,
    sellingPoints: '?€???¥ì  ?„ì£¼ ?•ë¦¬',
    audience: '?¤ìš©??êµ¬ë§¤ ê³ ê°',
    prompt: '',
    description: 'missing prompt'
  }
];

const DEFAULT_COPY_BY_PAGE_COUNT: Record<PageCountOption, GeneratedCopy> = {
  5: {
    headline: 'Clear product value, quickly understood',
    subheadline: 'A shorter structure that highlights the essentials fast and keeps the purchase path simple.',
    key_selling_points: ['Fast value scan', 'Mobile-friendly readability', 'Simple conversion flow'],
    feature_descriptions: ['Quick feature summary', 'Only the key information', 'Compact purchase motivation'],
    usage_scenario_text: 'Show the most realistic and useful usage scene first so buyers understand the product immediately.',
    detail_description: 'Keep product details concise but specific enough to support the core value proposition.',
    benefits: ['Easy to compare at a glance', 'Shorter but still conversion-aware structure'],
    cta: 'Check the essentials and move straight to purchase.',
    seo_title: 'Mobile-friendly product detail page focused on key selling points'
  },
  7: {
    headline: 'Balanced ecommerce detail page structure',
    subheadline: 'A standard long-form layout that connects hero, usage, proof, and CTA in a more persuasive flow.',
    key_selling_points: ['Balanced section flow', 'Natural usage and proof flow', 'Better product understanding'],
    feature_descriptions: ['Features and benefits shown together', 'Clear buying reasons', 'Marketplace-friendly copy blocks'],
    usage_scenario_text: 'Blend practical use scenes with buyer imagination so the product feels easier to choose.',
    detail_description: 'Add enough detail and proof to support confident purchase decisions without overloading the page.',
    benefits: ['Clear structure between information and persuasion', 'Suitable for most marketplace product pages'],
    cta: 'Review the details, compare the value, and choose with confidence.',
    seo_title: 'Standard marketplace-ready product detail page'
  },
  10: {
    headline: 'Premium long-form product detail page',
    subheadline: 'A fuller structure that layers proof, comparison, benefits, and conversion cues for higher-ticket presentation.',
    key_selling_points: ['Premium information flow', 'Stronger proof and comparison sections', 'More complete buying journey'],
    feature_descriptions: ['Richer feature storytelling', 'Premium-style comparison and proof', 'Expanded commerce-ready copy'],
    usage_scenario_text: 'Use more varied scenarios and richer narrative flow so the page feels complete and premium.',
    detail_description: 'Separate benefit, comparison, ingredient, and proof sections to create a more complete long-scroll experience.',
    benefits: ['Built for stronger persuasion', 'Fits premium or more competitive categories'],
    cta: 'Explore the full value and complete the purchase with confidence.',
    seo_title: 'Premium long-form mobile product detail page'
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
    const toneNote = emphasis === 'full' ? '?€?œì»· ê°•ì¡°' : emphasis === 'detail' ? '?”í…Œ??ê°•ì¡°' : 'ë¶„ìœ„ê¸?ê°•ì¡°';

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
    title: text.split(':')[0]?.trim() || `?¬ì¸??${index + 1}`,
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
  `[?í’ˆëª? ${formValues.productName}`,
  `[ê°€ê²??µì…˜] ${formValues.price}`,
  `[?€ê¹?ê³ ê°] ${formValues.audience}`,
  `[?˜ì´ì§€ ?? ${result.page_count}`,
  '',
  `[SEO ?œëª©] ${result.generated_copy.seo_title}`,
  `[?¤ë“œ?¼ì¸] ${result.generated_copy.headline}`,
  `[?œë¸Œ?¤ë“œ?¼ì¸] ${result.generated_copy.subheadline}`,
  '',
  '[?µì‹¬ ?¥ì ]',
  ...result.generated_copy.key_selling_points.map((item, index) => `${index + 1}. ${item}`),
  '',
  '[ê¸°ëŠ¥ ?¤ëª…]',
  ...result.generated_copy.feature_descriptions.map((item) => `- ${item}`),
  '',
  `[?¬ìš© ?¥ë©´] ${result.generated_copy.usage_scenario_text}`,
  `[?ì„¸ ?¤ëª…] ${result.generated_copy.detail_description}`,
  '',
  '[Benefits]',
  ...result.generated_copy.benefits.map((item) => `- ${item}`),
  '',
  `[CTA] ${result.generated_copy.cta}`,
  '',
  '[Section overview]',
  ...result.sections.map((section, index) => `${index + 1}. ${sectionLabelMap[section.type]}\n?œëª©: ${section.title}\në³¸ë¬¸: ${section.text}`),
  '',
  '[?¹ì…˜ ?œì„œ]',
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
          <div><strong>?í’ˆëª?/strong>${escapeHtml(formValues.productName)}</div>
          <div><strong>ê°€ê²??µì…˜</strong>${escapeHtml(formValues.price)}</div>
          <div><strong>?€ê¹?/strong>${escapeHtml(formValues.audience)}</div>
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
