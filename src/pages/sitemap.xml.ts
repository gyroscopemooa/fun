import type { APIRoute } from 'astro';

const paths = [
  '/',
  '/about',
  '/contact',
  '/editorial-policy',
  '/content-disclaimer',
  '/privacy',
  '/terms',
  '/animal-test',
  '/personal-color',
  '/magic-book',
  '/pinball',
  '/random-food',
  '/name-meaning',
  '/name-compatibility',
  '/today-fortune',
  '/fortune-cookie-2026',
  '/reaction-test',
  '/mbti-test',
  '/love-compatibility',
  '/ladder-game',
  '/maps/fishbread',
  '/maps/hidden-cafe',
  '/maps/local-eats'
];

const localePaths = ['en', 'ja'].flatMap((locale) =>
  paths.map((path) => (path === '/' ? `/${locale}` : `/${locale}${path}`))
);
const allPaths = [...paths, ...localePaths];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://fun.pages.dev');
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
