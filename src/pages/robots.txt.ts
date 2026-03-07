import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://fun.pages.dev');
  const body = `User-agent: *
Allow: /

Sitemap: ${new URL('/sitemap.xml', base).toString()}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
