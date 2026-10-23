import type { APIRoute } from 'astro';

import { getAiImageSeoPathEntries } from '../lib/ai-image-seo';
import { hasTranslation } from '../lib/i18n';

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
  '/tools/scoreboard',
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
  '/maps/hidden-cafe',
  '/maps/local-eats',
  '/new-tools',
  '/lol-champion-recommender',
  '/valorant-agent-picker',
  '/overwatch-hero-picker',
  '/game-team-balancer',
  '/rank-goal-calculator',
  '/mbti-game-character',
  '/today-lucky-color'
];

// 한국어 페이지를 그대로 감싼 en/ja 래퍼는 canonical이 한국어 URL이라 sitemap에서 제외한다.
const localePaths = (['en', 'ja'] as const).flatMap((locale) =>
  paths
    .filter((path) => hasTranslation(locale, path))
    .map((path) => (path === '/' ? `/${locale}` : `/${locale}${path}`))
);
const aiImageSeoPaths = getAiImageSeoPathEntries().map((entry) => entry.path);
const allPaths = [...new Set([...paths, ...localePaths, ...aiImageSeoPaths])];

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
    const loc = new URL(path, base).toString();
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
