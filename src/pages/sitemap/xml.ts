import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://manytool.net');
  return new Response(null, {
    status: 301,
    headers: {
      Location: new URL('/sitemap.xml', base).toString()
    }
  });
};
