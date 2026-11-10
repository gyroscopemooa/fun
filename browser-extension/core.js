export const SITE = 'https://manytool.net';
export const MAX_TEXT = 3000;
export const MAX_PNG = 4 * 1024 * 1024;
export const TTL = 10 * 60 * 1000;
export const PERMISSION = {origins: [`${SITE}/*`]};
export function webUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw Error('2048자 이하 웹 주소를 사용해 주세요.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('일반 웹페이지에서 실행해 주세요.');
  return url;
}
export function selectionText(value) {
  if (typeof value !== 'string' || !value.trim()) throw Error('먼저 글자를 선택해 주세요.');
  if (value.length > MAX_TEXT) throw Error(`한 번에 ${MAX_TEXT}자까지 선택해 주세요. 글을 나누면 됩니다.`);
  return value.trim();
}
export function videoTarget(value) {
  const u = webUrl(value);
  if (u.protocol !== 'https:') throw Error('HTTPS 영상 주소를 사용해 주세요.');
  const h = u.hostname.toLowerCase().replace(/^www\./, '');
  if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be') return u.pathname.startsWith('/shorts/') ? '/youtube-shorts-downloader/' : '/youtube-downloader/';
  if (h === 'instagram.com') {
    if (/^\/stories\//.test(u.pathname)) throw Error('로그인 스토리 다운로드는 이 확장 버전에서 지원하지 않습니다.');
    if (!/^\/(p|reel|reels)\/[^/]+/.test(u.pathname)) throw Error('인스타그램 게시물 또는 릴스 주소를 열어 주세요.');
    return /^\/reels?\//.test(u.pathname) ? '/instagram-reels-downloader/' : '/instagram-video-downloader/';
  }
  if (['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'].includes(h)) return '/tiktok-downloader/';
  if (['x.com', 'twitter.com', 'mobile.twitter.com'].includes(h)) return '/twitter-video-downloader/';
  if (h === 'chzzk.naver.com') return u.pathname.startsWith('/clips/') ? '/chzzk-clips-downloader/' : '/chzzk-downloader/';
  if (['vod.sooplive.com', 'vod.afreecatv.com'].includes(h)) return '/soop-downloader/';
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return '/video-link-downloader/';
  throw Error('현재 주소에 맞는 영상 도구가 없습니다. 공개 영상의 단건 주소를 사용해 주세요.');
}
export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw Error('전달할 내용이 없습니다.');
  if (payload.kind === 'text') return {kind: 'text', text: selectionText(payload.text)};
  if (payload.kind === 'video') {
    videoTarget(payload.url);
    return {kind: 'video', url: webUrl(payload.url).href};
  }
  if (payload.kind === 'image' && typeof payload.dataUrl === 'string' && payload.dataUrl.length <= MAX_PNG && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(payload.dataUrl)) return {kind: 'image', dataUrl: payload.dataUrl};
  throw Error('지원하지 않는 내용이거나 캡처가 너무 큽니다. 더 작은 영역을 선택해 주세요.');
}
export function payloadPath(payload,destination='default') {
  if(destination==='workbench'&&payload.kind==='text')return '/selection-workbench/';
  if(destination!=='default')throw Error('지원하지 않는 도구 연결입니다.');
  return payload.kind === 'text' ? '/text-translator/' : payload.kind === 'image' ? '/photo-to-document/' : videoTarget(payload.url);
}
export function cropBounds(rect, viewport, image) {
  const nums = [rect?.x, rect?.y, rect?.width, rect?.height, viewport?.width, viewport?.height, image?.width, image?.height];
  if (nums.some(n => !Number.isFinite(n)) || rect.x < 0 || rect.y < 0 || rect.width < 8 || rect.height < 8 || viewport.width <= 0 || viewport.height <= 0 || image.width <= 0 || image.height <= 0 || rect.x + rect.width > viewport.width + 1 || rect.y + rect.height > viewport.height + 1) throw Error('캡처 영역을 다시 선택해 주세요.');
  const sx = image.width / viewport.width, sy = image.height / viewport.height;
  const x = Math.floor(rect.x * sx), y = Math.floor(rect.y * sy);
  const width = Math.min(image.width - x, Math.ceil(rect.width * sx));
  const height = Math.min(image.height - y, Math.ceil(rect.height * sy));
  if (width * height > 16000000) throw Error('캡처가 너무 큽니다. 작은 영역을 선택해 주세요.');
  return {x, y, width, height};
}
export function isFresh(record, now = Date.now()) {
  return Boolean(record && Number.isFinite(record.createdAt) && record.createdAt <= now && now - record.createdAt < TTL);
}
