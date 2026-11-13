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
  dialog.style.cssText = 'position:fixed;inset:0;margin:auto;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:24px;padding:28px;max-width:460px;width:calc(100% - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;color:#0f172a;background:white;box-shadow:0 24px 80px #0005';
  const previousFocus = document.activeElement;
  const title = document.createElement('h2'); title.id = 'manytool-payment-title'; title.textContent = '결제 방법 선택'; title.style.cssText = 'font-size:24px;font-weight:800;margin:0 0 12px';
  const name = document.createElement('p'); name.textContent = product?.[1] || '선택한 AI 상품';
  const price = document.createElement('p'); price.textContent = product?.[0] === 'image' ? '9,900원 · 결과 1회' : '가격 확정 전'; price.style.cssText = 'font-size:24px;font-weight:800;margin:16px 0';
  const note = document.createElement('p'); note.textContent = '출시 예정가입니다. 현재 실제 결제는 진행되지 않습니다.'; note.style.cssText = 'font-size:13px;line-height:1.6;color:#64748b';
  const actions = document.createElement('div'); actions.style.cssText = 'display:grid;gap:12px;margin-top:20px';
  const style = 'display:block;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:14px;font-weight:700;text-align:center;text-decoration:none;background:white;color:#0f172a';
  if (product) {
    const form = document.createElement('form'); form.method = 'post'; form.action = '/api/nicepay-review/window';
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'product'; input.value = product[0];
    const card = document.createElement('button'); card.type = 'submit'; card.textContent = '카드결제'; card.style.cssText = style + ';background:#0f172a;color:white;cursor:pointer';
    form.append(input, card); actions.append(form);
  } else {
    const card = document.createElement('button'); card.type = 'button'; card.disabled = true; card.textContent = '카드결제'; card.style.cssText = style + ';opacity:.5'; actions.append(card);
  }
  for (const label of ['네이버페이', '토스페이', '카카오페이']) {
    const button = document.createElement('button'); button.type = 'button'; button.disabled = true; button.textContent = label;
    button.title = '매니툴 가맹점 이용 가능 여부 확인 중'; button.style.cssText = style + ';opacity:.45'; actions.append(button);
  }
  const pending = document.createElement('p'); pending.textContent = '간편결제는 이용 가능 여부 확인 중입니다.'; pending.style.cssText = 'font-size:12px;color:#64748b;margin:0'; actions.append(pending);
  const credit = document.createElement('button'); credit.type = 'button'; credit.disabled = true; credit.textContent = '보유 크레딧으로 결제'; credit.title = '크레딧 사용 연결 준비 중'; credit.style.cssText = style + ';margin-top:8px;opacity:.5'; actions.append(credit);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기'; close.style.cssText = style + ';cursor:pointer'; close.onclick = () => dialog.close(); actions.append(close);
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.append(title, name, price, note, actions); document.body.append(dialog); dialog.showModal();
};
