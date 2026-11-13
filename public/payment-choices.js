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
  dialog.style.cssText = 'border:1px solid #cbd5e1;border-radius:24px;padding:28px;max-width:460px;width:calc(100% - 32px);color:#0f172a;background:white;box-shadow:0 24px 80px #0005';
  const previousFocus = document.activeElement;
  const title = document.createElement('h2'); title.id = 'manytool-payment-title'; title.textContent = '결제 방법 선택'; title.style.cssText = 'font-size:24px;font-weight:800;margin:0 0 12px';
  const name = document.createElement('p'); name.textContent = product?.[1] || '선택한 AI 상품';
  const price = document.createElement('p'); price.textContent = '임시 검토 가격 100,000원'; price.style.cssText = 'font-size:22px;font-weight:800;margin:16px 0';
  const note = document.createElement('p'); note.textContent = '출시 전 연결 확인 단계입니다. 임시 가격은 최종 판매가가 아니며, 현재 실제 결제·상품 실행은 처리되지 않습니다.'; note.style.cssText = 'font-size:14px;line-height:1.7;color:#475569';
  const actions = document.createElement('div'); actions.style.cssText = 'display:grid;gap:12px;margin-top:20px';
  const style = 'display:block;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:14px;font-weight:700;text-align:center;text-decoration:none;background:white;color:#0f172a';
  if (product) {
    const form = document.createElement('form'); form.method = 'post'; form.action = '/api/nicepay-review/window';
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'product'; input.value = product[0];
    const card = document.createElement('button'); card.type = 'submit'; card.textContent = 'NICE 카드 결제창 확인 · 실제 승인 차단'; card.style.cssText = style + ';background:#0f172a;color:white;cursor:pointer';
    form.append(input, card); actions.append(form);
  } else {
    const card = document.createElement('button'); card.type = 'button'; card.disabled = true; card.textContent = 'NICE 카드 결제 · 상품 연결 준비 중'; card.style.cssText = style + ';opacity:.5'; actions.append(card);
  }
  const credit = document.createElement('button'); credit.type = 'button'; credit.disabled = true; credit.textContent = '크레딧으로 이용 · 실제 차감 연결 준비 중'; credit.style.cssText = style + ';opacity:.5'; actions.append(credit);
  const login = document.createElement('a'); login.href = '/credit-review/'; login.textContent = 'Google 로그인 · 모의 크레딧 충전·사용 확인'; login.style.cssText = style; actions.append(login);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기'; close.style.cssText = style + ';cursor:pointer'; close.onclick = () => dialog.close(); actions.append(close);
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.append(title, name, price, note, actions); document.body.append(dialog); dialog.showModal();
};
