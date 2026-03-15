export type ThemeKey = 'premium' | 'minimal' | 'playful';
export type ImageRoleType = 'hero' | 'detail' | 'usage';

export type ProductDetailFormValues = {
  productName: string;
  price: string;
  audience: string;
  highlight: string;
  prompt: string;
};

export type UploadedImage = {
  id: string;
  file: File;
  url: string;
  dataUrl: string;
};

export type FeatureIcon = {
  icon: string;
  label: string;
  description: string;
};

export type ProductDetailResult = {
  headline: string;
  sub_headline: string;
  selling_points: string[];
  feature_icons: FeatureIcon[];
  description: string;
  recommended_users: string[];
  product_info: {
    price_note: string;
    materials: string[];
    colors: string[];
    visual_style: string;
    usage_situations: string[];
    key_visual_details: string[];
    size_tip: string;
    package_includes: string[];
  };
  cta: string;
  layout_plan: {
    hero_image_index: number;
    detail_image_index: number;
    usage_image_index: number;
    section_count: number;
  };
  image_analysis: {
    product_color: string;
    materials: string[];
    visual_style: string;
    usage_situations: string[];
    key_visual_details: string[];
  };
  image_roles: Array<{
    index: number;
    role: string;
    reason: string;
  }>;
  seo: {
    naver_title: string;
    product_keywords: string[];
    product_tags: string[];
    short_marketing_copy: string;
  };
};

export type ClassifiedImage = {
  image: UploadedImage;
  role: ImageRoleType;
  reason: string;
};

export type SectionPlan = {
  id: string;
  label: string;
  title: string;
  body: string;
  image?: UploadedImage;
  role?: ImageRoleType;
  bullets?: string[];
  icons?: FeatureIcon[];
};

export const starterPrompts = [
  '사진을 보고 네이버 스마트스토어형 상품 상세페이지 문구를 작성해줘.',
  '모바일 860px 상세페이지 기준으로 헤드라인, 장점, 사용 장면, CTA를 설득력 있게 구성해줘.',
  '과장되지 않지만 판매 전환에 유리한 한국형 쇼핑몰 톤으로 정리해줘.'
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
  sparkles: '*',
  'badge-check': 'O',
  'shopping-bag': '#',
  heart: '+',
  star: '★',
  package: '[]',
  clock: '@',
  shield: '=',
  gift: '<>'
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

const toRole = (value: string): ImageRoleType => {
  if (value === 'hero' || value === 'usage' || value === 'detail') return value;
  return 'detail';
};

export const classifyImages = (result: ProductDetailResult, images: UploadedImage[]): ClassifiedImage[] => {
  if (!images.length) return [];

  const roleMap = new Map<number, ClassifiedImage>();
  result.image_roles.forEach((item) => {
    if (!images[item.index]) return;
    roleMap.set(item.index, {
      image: images[item.index],
      role: toRole(item.role),
      reason: item.reason || 'AI가 섹션용 이미지로 분류했습니다.'
    });
  });

  const heroIndex = Math.min(Math.max(result.layout_plan.hero_image_index, 0), images.length - 1);
  const detailIndex = Math.min(Math.max(result.layout_plan.detail_image_index, 0), images.length - 1);
  const usageIndex = Math.min(Math.max(result.layout_plan.usage_image_index, 0), images.length - 1);

  const ensure = (index: number, role: ImageRoleType, reason: string) => {
    if (!roleMap.has(index)) {
      roleMap.set(index, { image: images[index], role, reason });
    }
  };

  ensure(heroIndex, 'hero', '대표 이미지로 사용하기 적합한 컷');
  ensure(detailIndex, 'detail', '디테일 설명 섹션에 적합한 컷');
  ensure(usageIndex, 'usage', '사용 장면 섹션에 적합한 컷');

  return images.map((image, index) => roleMap.get(index) ?? {
    image,
    role: 'detail',
    reason: '보조 디테일 이미지로 배치'
  });
};

export const buildSectionPlans = (
  result: ProductDetailResult,
  images: UploadedImage[]
): SectionPlan[] => {
  const classified = classifyImages(result, images);
  const heroImage = classified.find((item) => item.role === 'hero')?.image ?? images[0];
  const detailImage = classified.find((item) => item.role === 'detail')?.image ?? images[Math.min(1, images.length - 1)] ?? heroImage;
  const usageImage = classified.find((item) => item.role === 'usage')?.image ?? images[Math.min(2, images.length - 1)] ?? detailImage;

  return [
    {
      id: 'hero',
      label: 'Hero',
      title: result.headline,
      body: result.sub_headline,
      image: heroImage,
      role: 'hero'
    },
    {
      id: 'selling-points',
      label: 'Key Selling Points',
      title: '구매 포인트를 빠르게 이해시키는 핵심 장점',
      body: result.selling_points.join(' · '),
      bullets: result.selling_points,
      image: heroImage,
      role: 'hero'
    },
    {
      id: 'feature-icons',
      label: 'Feature Icons',
      title: '상품 특징을 한눈에 보여주는 기능 요약',
      body: result.feature_icons.map((item) => `${item.label}: ${item.description}`).join(' · '),
      icons: result.feature_icons
    },
    {
      id: 'usage',
      label: 'Usage Scenario',
      title: '이런 고객과 상황에 특히 잘 맞습니다',
      body: result.recommended_users.join(' · '),
      bullets: result.product_info.usage_situations,
      image: usageImage,
      role: 'usage'
    },
    {
      id: 'detail',
      label: 'Detail Description',
      title: '디테일 설명과 비주얼 포인트',
      body: result.description,
      bullets: result.product_info.key_visual_details,
      image: detailImage,
      role: 'detail'
    },
    {
      id: 'cta',
      label: 'CTA',
      title: result.cta,
      body: result.seo.short_marketing_copy,
      bullets: [result.product_info.price_note, result.product_info.size_tip]
    }
  ];
};

export const buildPlainCopyText = ({
  formValues,
  result
}: {
  formValues: ProductDetailFormValues;
  result: ProductDetailResult;
}) => [
  `[상품명] ${formValues.productName}`,
  `[가격/옵션] ${formValues.price || result.product_info.price_note}`,
  `[타깃 고객] ${formValues.audience}`,
  '',
  `[헤드라인] ${result.headline}`,
  `[서브 헤드라인] ${result.sub_headline}`,
  '',
  '[핵심 장점]',
  ...result.selling_points.map((item, index) => `${index + 1}. ${item}`),
  '',
  '[기능 요약]',
  ...result.feature_icons.map((item) => `- ${item.label}: ${item.description}`),
  '',
  `[상세 설명] ${result.description}`,
  '',
  '[추천 사용자]',
  ...result.recommended_users.map((item) => `- ${item}`),
  '',
  '[사용 장면]',
  ...result.product_info.usage_situations.map((item) => `- ${item}`),
  '',
  '[제품 정보]',
  `- 컬러: ${result.product_info.colors.join(', ')}`,
  `- 소재: ${result.product_info.materials.join(', ')}`,
  `- 스타일: ${result.product_info.visual_style}`,
  `- 구성품: ${result.product_info.package_includes.join(', ')}`,
  '',
  `[CTA] ${result.cta}`,
  '',
  '[SEO]',
  `- 네이버 타이틀: ${result.seo.naver_title}`,
  `- 키워드: ${result.seo.product_keywords.join(', ')}`,
  `- 태그: ${result.seo.product_tags.join(', ')}`
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
  const sections = buildSectionPlans(result, images);
  const themeName = themeLabelMap[theme];
  const tags = result.seo.product_tags.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  const featureIcons = result.feature_icons.map((item) => `
        <div class="feature-card">
          <div class="feature-glyph">${escapeHtml(iconGlyphMap[item.icon] ?? '✦')}</div>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.description)}</p>
        </div>`).join('');
  const roleBadges = classifyImages(result, images).map((item, index) => `
        <div class="role-card">
          <img src="${item.image.dataUrl}" alt="${escapeHtml(`${formValues.productName} 이미지 ${index + 1}`)}" />
          <strong>${escapeHtml(item.role.toUpperCase())}</strong>
          <p>${escapeHtml(item.reason)}</p>
        </div>`).join('');
  const sectionMarkup = sections.map((section) => `
      <section class="section-block section-${section.id}">
        <div class="section-head">
          <p class="eyebrow">${escapeHtml(section.label)}</p>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </div>
        ${section.icons ? `<div class="feature-grid">${featureIcons}</div>` : ''}
        ${section.bullets?.length ? `<ul class="bullet-list">${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        ${section.image ? `<div class="section-image"><img src="${section.image.dataUrl}" alt="${escapeHtml(section.title)}" /></div>` : ''}
      </section>`).join('\n');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(result.seo.naver_title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef2f7; color: #0f172a; font-family: Pretendard, Apple SD Gothic Neo, sans-serif; }
      .page { width: 860px; max-width: 100%; margin: 0 auto; background: #ffffff; }
      .hero { padding: 36px 28px 30px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; }
      .eyebrow { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.7; }
      .hero h1 { margin: 0; font-size: 42px; line-height: 1.14; }
      .hero p { margin: 14px 0 0; line-height: 1.8; }
      .hero-image img { display: block; width: 100%; height: auto; }
      .hero-image { overflow: hidden; border-radius: 28px; margin-top: 24px; }
      .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
      .meta div { border-radius: 18px; padding: 16px; background: rgba(255,255,255,0.08); }
      .meta strong { display: block; margin-bottom: 8px; font-size: 12px; opacity: 0.72; }
      .content { padding: 24px 24px 40px; }
      .section-block { padding: 22px 0 28px; border-bottom: 1px solid #e5e7eb; }
      .section-block:last-child { border-bottom: 0; }
      .section-head h2 { margin: 0; font-size: 31px; line-height: 1.2; }
      .section-head p { margin: 14px 0 0; line-height: 1.8; color: #475569; }
      .bullet-list { list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 10px; }
      .bullet-list li { padding: 16px 18px; background: #f8fafc; border-radius: 18px; line-height: 1.7; }
      .feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
      .feature-card { border-radius: 20px; padding: 18px; background: #f8fafc; }
      .feature-glyph { font-size: 22px; margin-bottom: 12px; }
      .feature-card strong { display: block; font-size: 18px; }
      .feature-card p { margin: 8px 0 0; line-height: 1.7; color: #475569; }
      .section-image { margin-top: 18px; overflow: hidden; border-radius: 28px; background: #e5e7eb; }
      .section-image img { display: block; width: 100%; height: auto; }
      .roles { padding-top: 8px; }
      .roles h2, .seo-box h2 { margin: 0; font-size: 28px; }
      .role-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .role-card { border-radius: 18px; overflow: hidden; background: #f8fafc; }
      .role-card img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
      .role-card strong, .role-card p { display: block; padding: 0 14px; }
      .role-card strong { padding-top: 12px; font-size: 13px; letter-spacing: 0.12em; }
      .role-card p { padding-bottom: 14px; margin: 6px 0 0; line-height: 1.6; color: #475569; font-size: 14px; }
      .seo-box { margin-top: 28px; padding: 24px; border-radius: 28px; background: #0f172a; color: #ffffff; }
      .seo-box p { margin: 14px 0 0; line-height: 1.8; }
      .tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      .tags span { padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,0.09); font-size: 13px; }
      @media (max-width: 860px) {
        .hero { padding: 28px 18px 24px; }
        .hero h1 { font-size: 30px; }
        .content { padding: 20px 16px 34px; }
        .meta, .feature-grid, .role-grid { grid-template-columns: 1fr; }
        .section-head h2, .roles h2, .seo-box h2 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="page" data-theme="${escapeHtml(theme)}" data-theme-label="${escapeHtml(themeName)}">
      <header class="hero">
        <p class="eyebrow">${escapeHtml(themeName)}</p>
        <h1>${escapeHtml(result.headline)}</h1>
        <p>${escapeHtml(result.sub_headline)}</p>
        ${sections[0]?.image ? `<div class="hero-image"><img src="${sections[0].image.dataUrl}" alt="${escapeHtml(result.headline)}" /></div>` : ''}
        <div class="meta">
          <div><strong>상품명</strong>${escapeHtml(formValues.productName)}</div>
          <div><strong>가격/옵션</strong>${escapeHtml(formValues.price || result.product_info.price_note)}</div>
          <div><strong>타깃</strong>${escapeHtml(formValues.audience)}</div>
        </div>
      </header>
      <main class="content">
${sectionMarkup}
        <section class="roles">
          <p class="eyebrow">Image Roles</p>
          <h2>업로드 이미지를 섹션용으로 자동 분류</h2>
          <div class="role-grid">${roleBadges}</div>
        </section>
        <section class="seo-box">
          <p class="eyebrow">SEO</p>
          <h2>${escapeHtml(result.seo.naver_title)}</h2>
          <p>${escapeHtml(result.seo.short_marketing_copy)}</p>
          <div class="tags">${tags}</div>
        </section>
      </main>
    </div>
  </body>
</html>`;
};
