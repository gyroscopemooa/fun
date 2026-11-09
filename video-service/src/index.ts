import { Container } from '@cloudflare/containers';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export class VideoContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '10m';
  enableInternet = true;
  private imageReady?: Promise<void>;
  private ensureImage(): Promise<void> {
    // A rollout can finish while this Durable Object still talks to the old process.
    // Restart at most once for this release; preserve rate-limit storage.
    return this.imageReady ??= this.ctx.blockConcurrencyWhile(async () => {
      const release = 'tiktok-20261109-4';
      const health = await this.containerFetch(new Request('http://container/health'));
      const data = await health.json() as { serviceVersion?: string };
      if (data.serviceVersion !== release && await this.ctx.storage.get('imageRestart') !== release) {
        await this.destroy();
        await this.ctx.storage.put('imageRestart', release);
      }
    }).catch(error => { this.imageReady = undefined; throw error; });
  }
  async fetch(request: Request): Promise<Response> {
    await this.ensureImage();
    if (request.method === 'POST') {
      const day = new Date().toISOString().slice(0, 10);
      const allowed = await this.ctx.storage.transaction(async txn => {
        const counter = await txn.get<{ day: string; count: number }>('daily');
        const count = counter?.day === day ? counter.count : 0;
        if (count >= 100) return false;
        await txn.put('daily', { day, count: count + 1 });
        return true;
      });
      if (!allowed) return json({ error: '오늘의 서버 처리 한도에 도달했습니다. 내일 다시 이용해주세요.' }, 429);
    }
    return this.containerFetch(request);
  }
}

async function boundedBody(request: Request): Promise<string> {
  if (!request.body) throw new Error('Empty body');
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4096) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/video(?=\/|$)/, '');
    if (request.method === 'GET' && path === '/health') return json({ ready: true, maxBytes: 314572800, maxDuration: 1800, retentionMinutes: 10 });
    const isCreate = request.method === 'POST' && path === '/jobs';
    const isRead = request.method === 'GET' && /^\/jobs\/[A-Za-z0-9_-]{43}(\/file)?$/.test(path);
    if (!isCreate && !isRead) return json({ error: 'Not found' }, 404);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin && origin !== 'https://manytool.net') return json({ error: '허용되지 않은 요청입니다.' }, 403);
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: '사이트에서 다시 요청해주세요.' }, 403);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const limiter = isCreate ? env.CREATE_LIMIT : env.READ_LIMIT;
    if (!(await limiter.limit({ key: ip })).success) return json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' }, 429);
    let body: string | undefined;
    if (isCreate) {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'JSON 요청만 지원합니다.' }, 415);
      try {
        body = await boundedBody(request);
        const value = JSON.parse(body);
        if (!value || typeof value.url !== 'string' || typeof value.platform !== 'string') throw new Error('Invalid payload');
      } catch { return json({ error: '올바른 영상 링크를 입력해주세요.' }, 400); }
    }
    try {
      const upstream = new Request(`http://container${path}`, { method: request.method, headers: { 'Content-Type': 'application/json' }, body });
      const response = await env.VIDEO.getByName('downloads-v1').fetch(upstream);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'no-referrer');
      return new Response(response.body, { status: response.status, headers });
    } catch {
      console.error(JSON.stringify({ event: 'video_container_unavailable' }));
      return json({ error: '다운로드 서버를 준비하고 있습니다. 잠시 후 다시 시도해주세요.' }, 503);
    }
  }
} satisfies ExportedHandler<Env>;
