import { randomBytes, timingSafeEqual } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const secret = () => randomBytes(32).toString('base64url');
const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// No browser, network, passwords, cookies, or real media are used by this adapter.
export class MockBrowserContext {
  authenticated = false;
  closed = false;
  login() { this.authenticated = true; }
  close() { this.authenticated = false; this.closed = true; }
}

export function validateMediaUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 512) throw new ApiError(400, '모의 주소를 입력해 주세요.');
  let url;
  try { url = new URL(raw); } catch { throw new ApiError(400, '잘못된 주소입니다.'); }
  // Exact fixed mock origin; no fetching, DNS, redirects, or external navigation.
  if (raw !== url.href || url.origin !== 'https://media.example.test' || url.username || url.password || url.search || url.hash || !/^\/(videos|stories)\/[a-z0-9-]{1,60}$/.test(url.pathname)) {
    throw new ApiError(400, '이 시제품은 media.example.test 모의 영상·스토리 주소만 지원합니다.');
  }
  return url.href;
}

export class SessionManager {
  #sessions = new Map();
  constructor({ now = Date.now, ttl = 300_000, max = 20 } = {}) {
    this.now = now; this.ttl = ttl; this.max = max;
  }
  sweep() {
    for (const [id, session] of this.#sessions) if (session.expiresAt <= this.now()) this.#destroy(id, session);
  }
  #destroy(id, session) {
    session.context.close(); session.owner = ''; session.token = ''; this.#sessions.delete(id);
  }
  create(owner) {
    this.sweep();
    if (typeof owner !== 'string' || owner.length !== 43) throw new ApiError(401, '접속 인증이 필요합니다.');
    // At most one live context per browser owner. Repeated starts do not leak contexts.
    for (const [id, session] of this.#sessions) if (equal(owner, session.owner)) this.#destroy(id, session);
    if (this.#sessions.size >= this.max) throw new ApiError(429, '시제품 세션 한도입니다.');
    const id = secret(), token = secret(), expiresAt = this.now() + this.ttl;
    this.#sessions.set(id, { owner, token, expiresAt, context: new MockBrowserContext() });
    return { id, token, expiresAt, mode: 'mock', authenticated: false };
  }
  #get(owner, id, token) {
    this.sweep();
    const session = this.#sessions.get(id);
    if (!session || !equal(owner, session.owner) || !equal(token, session.token)) throw new ApiError(404, '세션이 없거나 만료되었습니다. 다시 시작해 주세요.');
    return session;
  }
  status(owner, id, token) {
    const s = this.#get(owner, id, token);
    return { authenticated: s.context.authenticated, expiresAt: s.expiresAt, mode: 'mock' };
  }
  login(owner, id, token) {
    this.#get(owner, id, token).context.login();
    return this.status(owner, id, token);
  }
  download(owner, id, token, url) {
    const s = this.#get(owner, id, token);
    const media = validateMediaUrl(url);
    if (!s.context.authenticated) throw new ApiError(409, '먼저 모의 로그인을 완료해 주세요.');
    return { filename: 'manytool-mock-download.txt', content: `MOCK ONLY: no video downloaded\n${media}\n` };
  }
  close(owner, id, token) { const s = this.#get(owner, id, token); this.#destroy(id, s); return { closed: true }; }
  shutdown() { for (const [id, s] of this.#sessions) this.#destroy(id, s); }
}
export { secret };
