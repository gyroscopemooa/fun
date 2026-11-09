/* Explicitly used by supported purchase buttons; never intercepts other fetches. */
// Loaded before analytics: remove the one-time login secret from the URL first.
if (/^\/credits\/?$/.test(location.pathname)) {
  const loginToken = new URLSearchParams(location.hash.slice(1)).get('login');
  if (loginToken) {
    window.manytoolCreditLoginToken = loginToken;
    history.replaceState({}, '', location.pathname + location.search);
  }
}
window.manytoolCreditCheckout = async function (url, init) {
  const original = () => fetch(url, init);
  if (window.manytoolAiUnavailable) return original();
  const base = String(url).replace(/\/checkout$/, '');
  let body;
  let quote;
  try {
    body = JSON.parse(init.body);
    const response = await fetch(`${base}/credits/quote`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productType: body.productType, detailPageRequest: body.productType === 'detail_page' ? { pageCount: body.detailPageRequest?.pageCount } : undefined }),
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) return original();
    quote = await response.json();
  } catch { return original(); }
  const choice = await new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', '결제 방법 선택');
    dialog.style.cssText = 'border:1px solid #cbd5e1;border-radius:20px;padding:28px;max-width:440px;width:calc(100% - 32px);color:#0f172a;background:white;box-shadow:0 24px 80px #0004';
    const title = document.createElement('h2'); title.textContent = '결제 방법 선택'; title.style.cssText = 'font-size:22px;font-weight:800;margin-bottom:12px';
    const info = document.createElement('p'); info.textContent = `${quote.label}: ${quote.credits} 크레딧 (${quote.amountKrw.toLocaleString()}원 상당) · ${quote.balance === null ? '로그인 필요' : `잔액 ${quote.balance}개`}`;
    const buttons = document.createElement('div'); buttons.style.cssText = 'display:grid;gap:10px;margin-top:24px';
    const add = (label, value, disabled = false) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = disabled;
      button.style.cssText = `padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-weight:700;${disabled ? 'opacity:.4' : 'cursor:pointer'}`;
      button.onclick = () => { dialog.close(); dialog.remove(); resolve(value); }; buttons.append(button);
    };
    add('기존 가격으로 개별구매', 'single');
    add(`${quote.credits} 크레딧 사용`, 'credits', quote.balance === null || quote.balance < quote.credits);
    const link = document.createElement('a'); link.href = '/credits/'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '크레딧 로그인·충전 (새 창)'; link.style.cssText = 'text-align:center;padding:10px;color:#0e7490'; buttons.append(link);
    add('취소', 'cancel');
    dialog.addEventListener('cancel', () => { dialog.remove(); resolve('cancel'); });
    dialog.append(title, info, buttons); document.body.append(dialog); dialog.showModal();
  });
  if (choice === 'single') return original();
  if (choice !== 'credits') throw new Error('결제를 취소했습니다.');
  // Retain the idempotency key after an uncertain network response; retrying must
  // retrieve the same purchase instead of spending credits twice.
  const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body))))).map(n => n.toString(16).padStart(2, '0')).join('');
  const storageKey = `manytool-credit-request:${signature}`;
  let requestKey = sessionStorage.getItem(storageKey);
  if (!requestKey) { requestKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, requestKey); }
  const response = await fetch(`${base}/credits/purchase`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, requestKey }) });
  if (response.ok) {
    const confirmed = await response.clone().json();
    if (confirmed.orderId) sessionStorage.removeItem(storageKey);
  }
  return response;
};
