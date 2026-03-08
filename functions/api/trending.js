const DEFAULT_LIMIT = 10;
const CACHE_TTL_SECONDS = 60 * 15;

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readTag(block, tagName) {
  const cdataRegex = new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const plainRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const cdataMatch = block.match(cdataRegex);
  if (cdataMatch?.[1]) return decodeXml(cdataMatch[1].trim());
  const plainMatch = block.match(plainRegex);
  if (plainMatch?.[1]) return decodeXml(plainMatch[1].trim());
  return '';
}

function parseRss(xml, limit = DEFAULT_LIMIT) {
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return itemBlocks.slice(0, limit).map((match, index) => {
    const block = match[1] || '';
    const title = readTag(block, 'title');
    const pubDate = readTag(block, 'pubDate');
    const traffic = readTag(block, 'ht:approx_traffic');
    return {
      rank: index + 1,
      title,
      traffic,
      pubDate
    };
  }).filter((item) => item.title);
}

function normalize(value, fallback, allowedPattern) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (!allowedPattern.test(trimmed)) return fallback;
  return trimmed;
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const geo = normalize(url.searchParams.get('geo'), 'KR', /^[A-Za-z]{2}$/);
    const hl = normalize(url.searchParams.get('hl'), 'ko', /^[A-Za-z-]{2,8}$/);
    const limitParam = Number(url.searchParams.get('limit') || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : DEFAULT_LIMIT;

    const rssUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}&hl=${encodeURIComponent(hl)}`;
    const response = await fetch(rssUrl, {
      cf: {
        cacheEverything: true,
        cacheTtl: CACHE_TTL_SECONDS
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream error: ${response.status}`);
    }

    const xml = await response.text();
    const items = parseRss(xml, limit);

    return Response.json(
      {
        ok: true,
        source: rssUrl,
        updatedAt: new Date().toISOString(),
        geo,
        hl,
        items
      },
      {
        headers: {
          'cache-control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}`
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: 'Failed to fetch trending topics.',
        items: []
      },
      { status: 502 }
    );
  }
}
