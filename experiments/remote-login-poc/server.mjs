import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ApiError, SessionManager, secret } from './core.mjs';

export function makeHandler({ manager = new SessionManager(), origin = 'http://127.0.0.1:8789', html = '', scriptFile = './app.js' } = {}) {
  const host = new URL(origin).host;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      // Reject DNS rebinding and cross-origin requests even though listener is loopback.
      if (req.headers.host !== host) throw new ApiError(403, 'Host rejected');
      if (req.headers.origin && req.headers.origin !== origin) throw new ApiError(403, 'Origin rejected');
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Cross-site rejected');
      if (req.method === 'GET' && req.url === '/') {
        const owner = /(?:^|;\s*)poc_owner=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || secret();
        // Memory-only owner identity. HttpOnly session cookie, intentionally not persistent.
        res.setHeader('Set-Cookie', `poc_owner=${owner}; HttpOnly; SameSite=Strict; Path=/`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
      }
      if (req.method === 'GET' && req.url === '/app.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        return res.end(await readFile(new URL(scriptFile, import.meta.url), 'utf8'));
      }
      if (req.method !== 'POST' || req.url !== '/api') throw new ApiError(404, 'Not found');
      if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') throw new ApiError(403, 'Same-origin JSON required');
      let body = ''; let size = 0;
      for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 2048) throw new ApiError(413, 'Request too large'); body += chunk; }
      let data; try { data = JSON.parse(body); } catch { throw new ApiError(400, 'Invalid JSON'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, 'Invalid request');
      const owner = /(?:^|;\s*)poc_owner=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      if (!owner) throw new ApiError(401, 'Open the demo page first');
      if (data.action === 'create') return json(200, await manager.create(owner));
      const args = [owner, data.id, data.token];
      if (data.action === 'status') return json(200, await manager.status(...args));
      if (data.action === 'login') return json(200, await manager.login(...args));
      if (data.action === 'download') return json(200, await manager.download(...args, data.url));
      if (data.action === 'frame' && manager.frame) return json(200, await manager.frame(...args));
      if (data.action === 'click' && manager.click) return json(200, await manager.click(...args, data.x, data.y));
      if (data.action === 'close') return json(200, await manager.close(...args));
      throw new ApiError(400, 'Unknown action');
    } catch (error) { json(error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : 'Request failed' }); }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manager = new SessionManager();
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const server = createServer(makeHandler({ manager, html }));
  server.requestTimeout = 10_000; server.headersTimeout = 5_000;
  const timer = setInterval(() => manager.sweep(), 1000).unref();
  const stop = () => { clearInterval(timer); manager.shutdown(); server.close(); server.closeAllConnections(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  server.listen(8789, '127.0.0.1', () => console.log('MOCK ONLY: http://127.0.0.1:8789'));
}
