import type { APIRoute } from 'astro';

import { getAiImageSeoPathEntries } from '../lib/ai-image-seo';
import { hasTranslation, localeCodes, seoLocaleCodes } from '../lib/i18n';

const paths = [
  '/',
  '/tools',
  '/games',
  '/tests',
  '/maps',
  '/what-is-manytool',
  '/online-tools',
  '/ai-search',
  '/ai-calorie-calculator',
  '/ai-headshot',
  '/ai-id-photo',
  '/ai-image-generator',
  '/ai-passport-photo',
  '/ai-photoshop',
  '/about',
  '/contact',
  '/editorial-policy',
  '/content-disclaimer',
  '/privacy',
  '/terms',
  '/animal-test',
  '/personal-color',
  '/ai-personal-color',
  '/lip-color-simulator',
  '/tone-outfit-board',
  '/ai-manseryeok',
  '/magic-book',
  '/pinball',
  '/random-food',
  '/name-meaning',
  '/name-compatibility',
  '/name-premium',
  '/today-fortune',
  '/fortune-cookie-2026',
  '/daily-english-word',
  '/daily-sentence',
  '/daily-spanish',
  '/daily-japanese',
  '/korean-study-today',
  '/reaction-test',
  '/mbti-test',
  '/love-compatibility',
  '/ladder-game',
  '/streamer-battle',
  '/tools/product-detail-studio',
  '/tools/video-to-mp4',
  '/random-picker',
  '/roulette',
  '/team-split',
  '/text-counter',
  '/face-shape-test',
  '/nickname-generator',
  '/chat-random-picker',
  '/meme-generator',
  '/maps/fishbread',
  '/maps/solo-dining',
  '/new-tools',
  '/lol-champion-recommender',
  '/valorant-agent-picker',
  '/overwatch-hero-picker',
  '/game-team-balancer',
  '/rank-goal-calculator',
  '/mbti-game-character',
  '/today-lucky-color'
  ,'/crosshair-generator'
  ,'/fps-aim-sensitivity'
  ,'/fps-aim-trainer'
  ,'/fps-sensitivity-converter'
  ,'/dpi-edpi-calculator'
  ,'/fov-calculator'
  ,'/game-character-picker'
  ,'/image-compressor'
  ,'/image-resizer'
  ,'/image-blur'
  ,'/image-cropper'
  ,'/unit-converter'
  ,'/bmi-calculator'
  ,'/percentage-calculator'
  ,'/color-converter'
  ,'/time-zone-converter'
  ,'/tip-calculator'
  ,'/age-calculator'
  ,'/file-converter'
  ,'/love-type-test'
  ,'/office-type-test'
  // Working Korean pages that were missing from the sitemap.
  ,'/ai-pet-translator'
  ,'/balance-game'
  ,'/bulk-file-renamer'
  ,'/choseong-quiz'
  ,'/date-calculator'
  ,'/food-taste-test'
  ,'/fortune-card'
  ,'/friend-type-test'
  ,'/game-damage-calculator'
  ,'/game-keybinds'
  ,'/game-session-tracker'
  ,'/ideal-world-cup'
  ,'/image-blur'
  ,'/image-compressor'
  ,'/image-resizer'
  ,'/json-formatter'
  ,'/korean-quiz'
  ,'/logo-quiz'
  ,'/lol-terrain-quiz'
  ,'/menu-roulette'
  ,'/mid-lease-loan-calculator'
  ,'/name-character'
  ,'/past-life-test'
  ,'/penalty-picker'
  ,'/qr-generator'
  ,'/refund-policy'
  ,'/severance-calculator'
  ,'/song-initial-quiz'
  ,'/typing-speed'
  ,'/url-encoder'
  ,'/villain-test'
  ,'/youtube-thumbnail'
];

// 한국어 페이지를 그대로 감싼 en/ja 래퍼는 canonical이 한국어 URL이라 sitemap에서 제외한다.
const localePaths = localeCodes.filter((locale) => locale !== 'ko').flatMap((locale) =>
  paths
    .filter((path) => hasTranslation(locale, path))
    .map((path) => (path === '/' ? `/${locale}` : `/${locale}${path}`))
);
const seoLandingPaths = seoLocaleCodes.filter((locale) => !localeCodes.includes(locale as typeof localeCodes[number])).flatMap((locale) => [
  `/${locale}`,
  `/${locale}/ai-personal-color`,
  `/${locale}/ai-calorie-calculator`,
  `/${locale}/valorant-agent-picker`,
  `/${locale}/crosshair-generator`,
  `/${locale}/name-compatibility`,
  `/${locale}/random-picker`,
  `/${locale}/image-compressor`,
  `/${locale}/image-resizer`,
  `/${locale}/image-blur`,
  `/${locale}/image-cropper`,
  `/${locale}/unit-converter`,
  `/${locale}/bmi-calculator`,
  `/${locale}/percentage-calculator`,
  `/${locale}/color-converter`,
  `/${locale}/time-zone-converter`,
  `/${locale}/tip-calculator`,
  `/${locale}/age-calculator`,
]);
const aiImageSeoPaths = getAiImageSeoPathEntries().map((entry) => entry.path);
// Locale pages are noindex for now (see indexLocalePages in Layout.astro), so only Korean pages are listed.
const indexLocalePages = false;
// Some paths above only exist as locale pages; listing them in Korean would point crawlers at missing pages.
const koreanRoutes = new Set(
  Object.keys(import.meta.glob('./**/*.astro'))
    .filter((file) => !file.includes('['))
    .map((file) => file.replace(/^\./, '').replace(/\.astro$/, '').replace(/\/index$/, '') || '/')
);
const allPaths = [...new Set([
  ...paths.filter((path) => koreanRoutes.has(path)),
  ...(indexLocalePages ? [...localePaths, ...seoLandingPaths] : []),
  ...aiImageSeoPaths.filter((path) => indexLocalePages || !path.startsWith('/en/'))
])];
// Pages are served from /path/ and /path redirects there, so list the final URL.
const withSlash = (path: string) => (path === '/' || path.endsWith('/') ? path : `${path}/`);

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://manytool.net');
  const now = new Date().toISOString().split('T')[0];

  const priorityFor = (path: string) => {
    if (path === '/') return '1.0';
    if (path.startsWith('/maps/')) return '0.9';
    if (
      path === '/privacy' ||
      path === '/terms' ||
      path === '/contact' ||
      path === '/about' ||
      path === '/editorial-policy' ||
      path === '/content-disclaimer'
    ) {
      return '0.5';
    }
    return '0.8';
  };

  const changefreqFor = (path: string) => {
    if (path === '/') return 'daily';
    if (path.startsWith('/maps/')) return 'daily';
    if (
      path === '/privacy' ||
      path === '/terms' ||
      path === '/about' ||
      path === '/editorial-policy' ||
      path === '/content-disclaimer'
    ) {
      return 'monthly';
    }
    return 'weekly';
  };

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map((path) => {
    const loc = new URL(withSlash(path), base).toString();
    return `  <url><loc>${loc}</loc><lastmod>${now}</lastmod><changefreq>${changefreqFor(path)}</changefreq><priority>${priorityFor(path)}</priority></url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
