import type { APIRoute } from 'astro';

const items = [
  { title: 'ManyTool 메인', path: '/' },
  { title: '온라인 도구', path: '/tools' },
  { title: '브라우저 게임', path: '/games' },
  { title: '온라인 테스트', path: '/tests' },
  { title: '지도 기반 도구', path: '/maps' },
  { title: 'ManyTool 소개', path: '/what-is-manytool' }
];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://manytool.net');
  const now = new Date().toUTCString();
  const channelLink = new URL('/', base).toString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ManyTool RSS</title>
    <link>${channelLink}</link>
    <description>ManyTool tools and pages</description>
    <lastBuildDate>${now}</lastBuildDate>
${items
  .map((item) => {
    const link = new URL(item.path, base).toString();
    return `    <item><title>${item.title}</title><link>${link}</link><guid>${link}</guid><pubDate>${now}</pubDate></item>`;
  })
  .join('\n')}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8'
    }
  });
};
