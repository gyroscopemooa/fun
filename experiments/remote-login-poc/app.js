let session = null, busy = false, authenticated = false, generation = 0;
const $ = id => document.getElementById(id);
function render() {
  $('start').disabled = busy || !!session;
  $('login').disabled = busy || !session || authenticated;
  $('download').disabled = busy || !session || !authenticated;
  $('close').disabled = !busy && !session;
}
async function api(action, extra = {}) {
  const started = generation;
  const response = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: session?.id, token: session?.token, ...extra }) });
  const result = await response.json();
  if (started !== generation) {
    if (action === 'create' && response.ok) release(result);
    throw new Error('화면 전환으로 취소되었습니다.');
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 401) { session = null; authenticated = false; }
    throw new Error(result.error);
  }
  return result;
}
async function run(action) {
  if (busy) return;
  const started = generation;
  busy = true; render();
  try { await action(); } catch (error) { if (started === generation) $('status').textContent = error.message; }
  finally { if (started === generation) { busy = false; render(); } }
}
$('start').onclick = () => run(async () => {
  session = await api('create'); authenticated = false;
  $('status').textContent = '개인 모의 세션이 열렸습니다. 모의 로그인을 진행해 주세요.';
});
$('login').onclick = () => run(async () => {
  const result = await api('login'); authenticated = result.authenticated;
  $('status').textContent = '모의 로그인 완료. 이 세션에서만 테스트 결과를 받을 수 있습니다.';
});
$('download').onclick = () => run(async () => {
  const result = await api('download', { url: $('url').value });
  const object = URL.createObjectURL(new Blob([result.content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = object; a.download = result.filename; a.click();
  setTimeout(() => URL.revokeObjectURL(object), 1000);
  $('status').textContent = '테스트 파일을 생성했습니다. 실제 영상 다운로드가 아닙니다.';
});
function release(value) {
  if (value) fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', id: value.id, token: value.token }), keepalive: true }).catch(() => {});
}
function reset(message) {
  generation++; release(session); session = null; authenticated = false; busy = false;
  render(); $('status').textContent = message;
}
$('close').onclick = () => reset('종료 요청을 보냈습니다. 연결이 끊겼으면 최대 5분 후 서버 세션이 만료됩니다.');
setInterval(() => {
  if (session && Date.now() >= session.expiresAt) {
    reset('세션이 만료되었습니다. 다시 시작해 주세요.');
  }
}, 1000);
// Best-effort close on navigation; server TTL is authoritative when the tab crashes.
window.addEventListener('pagehide', () => reset('세션을 종료했습니다.'));
window.addEventListener('pageshow', event => {
  if (event.persisted) reset('화면을 다시 열었습니다. 새 세션을 시작해 주세요.');
});
render();
