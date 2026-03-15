export type ThemeKey = 'premium' | 'minimal' | 'playful';
export type ImageRoleType = 'hero' | 'detail' | 'usage';
export type PageCountOption = 5 | 7 | 10;
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
};

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
  return list[index];
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

  return result.sections.map((section, index) => {
    const preferred = takeFromRole(buckets, counters, section.image_role);
    const fallback = preferred
      ?? takeFromRole(buckets, counters, 'hero')
      ?? takeFromRole(buckets, counters, 'detail')
      ?? takeFromRole(buckets, counters, 'usage')
      ?? images[0];

    return {
      ...section,
      id: `${section.type}-${index}`,
      image: fallback
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
        ${cards}
        ${bullets}
        <div class="section-image">
          <img src="${section.image.dataUrl}" alt="${escapeHtml(section.title)}" />
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
      .section-image { overflow: hidden; margin-top: 18px; border-radius: 26px; background: #e2e8f0; }
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
