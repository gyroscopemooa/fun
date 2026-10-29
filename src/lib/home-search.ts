import { getAiImageSeoEntries } from './ai-image-seo';

export type HomeSearchEntry = { href: string; sourceHref?: string; title: string; desc: string; keywords?: string; disabled?: boolean };
// Public page metadata is collected at build time, independently of the featured home cards.
const sources = import.meta.glob<string>(['../pages/*.astro', '../pages/tools/*.astro', '../pages/maps/*.astro', '../pages/sandbox/*.astro'], { query: '?raw', import: 'default', eager: true });
const nonTools = new Set(['/', '/about', '/contact', '/privacy', '/terms', '/refund-policy', '/editorial-policy', '/content-disclaimer', '/seo', '/ai-search', '/what-is-manytool', '/online-tools']);
const attribute = (source: string, name: string) => source.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] ?? '';
export const getHomeSearchEntries = (cards: HomeSearchEntry[], locale: string): HomeSearchEntry[] => {
  const entries = new Map<string, HomeSearchEntry>();
  for (const [file, source] of Object.entries(sources)) {
    const href = file.replace('../pages', '').replace(/\.astro$/, '').replace(/\/index$/, '') || '/';
    if (nonTools.has(href) || href.includes('[') || /\bnoindex(?:\s|=|>)/.test(source) || source.includes('Astro.redirect(') || /\/tools\/(?:ai-photo-|electric-practical)/.test(href)) continue;
    const title = attribute(source, 'title').split('|')[0].trim();
    if (title) entries.set(href, { href, title, desc: attribute(source, 'description'), keywords: attribute(source, 'keywords') });
  }
  // Explicit cards provide localized titles and preserve existing coming-soon restrictions.
  for (const card of cards) {
    const key = card.sourceHref ?? card.href;
    const existing = entries.get(key);
    entries.set(key, { ...existing, ...card, keywords: `${existing?.title ?? ''} ${existing?.keywords ?? ''} ${card.keywords ?? ''}` });
  }
  const english = getAiImageSeoEntries('en');
  for (const [index, entry] of getAiImageSeoEntries('ko').entries()) {
    const translated = locale === 'ko' ? entry : english[index];
    const href = `${locale === 'en' ? '/en' : ''}/ai-image-generator/${entry.slug}`;
    entries.set(href, { href, title: translated.heading, desc: translated.description, keywords: `${entry.heading} ${entry.keywords} ${english[index].heading} ${english[index].keywords}` });
  }
  // These tools currently have localized routes only; never link to a missing Korean URL.
  const localizedOnly = [
    ['age-calculator', '나이 계산기', 'Age Calculator', '생년월일 만 나이'],
    ['bmi-calculator', 'BMI 계산기', 'BMI Calculator', '체질량지수 키 몸무게'],
    ['color-converter', '색상 변환기', 'Color Converter', '색상 코드 HEX RGB'],
    ['game-character-picker', '게임 캐릭터 뽑기', 'Game Character Picker', '랜덤 캐릭터 추천'],
    ['image-cropper', '이미지 자르기', 'Image Cropper', '사진 크롭 잘라내기'],
    ['percentage-calculator', '퍼센트 계산기', 'Percentage Calculator', '백분율 비율'],
    ['time-zone-converter', '시간대 변환기', 'Time Zone Converter', '세계 시차 시간'],
    ['tip-calculator', '팁 계산기', 'Tip Calculator', '식사 팁 금액'],
    ['unit-converter', '단위 변환기', 'Unit Converter', '길이 무게 온도 단위']
  ];
  for (const [slug, ko, en, keywords] of localizedOnly) {
    const href = `/${locale === 'ko' ? 'en' : locale}/${slug}`;
    entries.set(href, { href, title: locale === 'ko' ? `${ko} (영문)` : en, desc: locale === 'ko' ? `${keywords} · 영어 화면으로 제공됩니다.` : en, keywords: `${ko} ${en} ${keywords}` });
  }
  return [...entries.values()];
};
