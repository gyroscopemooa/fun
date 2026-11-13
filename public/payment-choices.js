/* The original tool request remains blocked until approval and fulfillment are deployed. */
window.manytoolShowPaymentChoices = function () {
  if (document.getElementById('manytool-payment-choices')) return;
  const product = {
    '/ai-calorie-calculator': ['calorie', 'AI 칼로리 분석'],
    '/ai-image-generator': ['image', 'AI 이미지 생성'],
    '/ai-pet-translator': ['pet', 'AI 펫 번역기 30일 이용권']
  }[location.pathname.replace(/\/$/, '')];
  const dialog = document.createElement('dialog');
  dialog.id = 'manytool-payment-choices';
  dialog.setAttribute('aria-labelledby', 'manytool-payment-title');
  dialog.style.cssText = 'position:fixed;inset:0;margin:auto;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:20px;padding:20px;max-width:380px;width:calc(100% - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;color:#0f172a;background:white;box-shadow:0 24px 80px #0005';
  const previousFocus = document.activeElement;
  const title = document.createElement('h2'); title.id = 'manytool-payment-title'; title.textContent = '결제 방법 선택'; title.style.cssText = 'font-size:18px;font-weight:800;margin:0 0 10px';
  const summary = document.createElement('div'); summary.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px';
  const name = document.createElement('p'); name.textContent = product?.[1] || '선택한 AI 상품'; name.style.cssText = 'font-size:13px;color:#475569;margin:0';
  const price = document.createElement('p'); price.textContent = product?.[0] === 'image' ? '9,900원' : '가격 확정 전'; price.style.cssText = 'font-size:18px;font-weight:800;margin:0;white-space:nowrap'; summary.append(name,price);
  const note = document.createElement('p'); note.textContent = '결제창 연결 테스트 · 실제 결제 없음'; note.style.cssText = 'font-size:11px;color:#64748b;margin:0';
  const actions = document.createElement('div'); actions.style.cssText = 'display:grid;gap:8px;margin-top:14px';
  const style = 'display:flex;align-items:center;justify-content:center;gap:12px;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px;font-size:14px;font-weight:700;text-align:center;text-decoration:none;background:white;color:#0f172a;cursor:pointer';
  for (const [method,label,logo] of [['CARD','카드결제','card.svg'],['NAVER','네이버페이','naverpay.svg'],['TOSS','토스페이','tosspay.svg'],['KAKAO','카카오페이','kakaopay.svg']]) {
    const form = document.createElement('form'); form.method = 'post'; form.action = '/api/nicepay-review/window';
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'product'; input.value = product?.[0] || '';
    const selected = document.createElement('input'); selected.type = 'hidden'; selected.name = 'method'; selected.value = method;
    const button = document.createElement('button'); button.type = 'submit'; button.textContent = label; button.disabled = !product; button.style.cssText = style;
    const image = document.createElement('img'); image.src = '/payment-brands/'+logo; image.alt = ''; image.width = method==='CARD'?24:64; image.height = 20; image.style.cssText = 'height:20px;object-fit:contain;flex-shrink:0'; button.prepend(image);
    if(method==='KAKAO')button.style.cssText += ';background:#fee500;border-color:#fee500';
    form.append(input, selected, button); actions.append(form);
  }
  const credit = document.createElement('button'); credit.type = 'button'; credit.disabled = true; credit.textContent = '보유 크레딧으로 결제'; credit.title = '크레딧 사용 연결 준비 중'; credit.style.cssText = style + ';margin-top:8px;opacity:.5'; actions.append(credit);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기'; close.style.cssText = style + ';cursor:pointer'; close.onclick = () => dialog.close(); actions.append(close);
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.append(title, summary, note, actions); document.body.append(dialog); dialog.showModal();
};
