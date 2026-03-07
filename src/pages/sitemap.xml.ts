import type { APIRoute } from 'astro';

const paths = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/animal-test',
  '/personal-color',
  '/magic-book',
  '/pinball',
  '/random-food',
  '/reaction-test',
  '/mbti-test',
  '/love-compatibility',
  '/maps/fishbread',
  '/maps/fishbread/seoul',
  '/maps/fishbread/busan',
  '/maps/fishbread/ulsan',
  '/maps/fishbread/daegu',
  '/maps/fishbread/incheon',
  '/maps/hidden-cafe',
  '/maps/local-eats'
];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://fun.pages.dev');
  const now = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map((path) => {
    const loc = new URL(path, base).toString();
    return `  <url><loc>${loc}</loc><lastmod>${now}</lastmod></url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
