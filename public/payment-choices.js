/* The original tool request remains blocked until approval and fulfillment are deployed. */
window.manytoolShowPaymentChoices = function () {
  if (document.getElementById('manytool-payment-choices')) return;
  const path=location.pathname.replace(/^\/(?!ai(?:-|\/))[a-z]{2,3}(?:-[A-Za-z]{2,4})?(?=\/)/,'').replace(/\/$/,'');
  const catalog=Object.values(window.manytoolAiCatalog||{});
  const detailCount=Number(document.querySelector?.('[data-ai-page-count]')?.value||7);
  const configured=catalog.find(p=>p.paths?.includes(path))||(['/tools/product-detail-studio','/product-detail-studio'].includes(path)?catalog.find(p=>p.pageCount===detailCount):null);
  const product = configured ? [configured.id,configured.name] : {
    '/ai-calorie-calculator': ['calorie', 'AI 칼로리 분석'],
    '/ai-image-generator': ['image', 'AI 이미지 생성'],
    '/ai-pet-translator': ['pet', 'AI 펫 번역기 30일 이용권']
  }[path];
  const dialog = document.createElement('dialog');
  dialog.id = 'manytool-payment-choices';
  dialog.setAttribute('aria-labelledby', 'manytool-payment-title');
  dialog.style.cssText = 'position:fixed;inset:0;margin:auto;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:20px;padding:20px;max-width:380px;width:calc(100% - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;color:#0f172a;background:white;box-shadow:0 24px 80px #0005';
  const previousFocus = document.activeElement;
  const title = document.createElement('h2'); title.id = 'manytool-payment-title'; title.textContent = '결제 방법 선택'; title.style.cssText = 'font-size:18px;font-weight:800;margin:0 0 10px';
  const summary = document.createElement('div'); summary.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px';
  const name = document.createElement('p'); name.textContent = product?.[1] || '선택한 AI 상품'; name.style.cssText = 'font-size:13px;color:#475569;margin:0';
  const price = document.createElement('p'); price.textContent = configured ? configured.amount.toLocaleString('ko-KR')+'원' : product?.[0] === 'image' ? '9,900원' : '가격 확정 전'; price.style.cssText = 'font-size:18px;font-weight:800;margin:0;white-space:nowrap'; summary.append(name,price);
  const note = document.createElement('p'); note.textContent = '결제창 연결 테스트 · 실제 결제 없음'; note.style.cssText = 'font-size:11px;color:#64748b;margin:0';
  const actions = document.createElement('div'); actions.style.cssText = 'display:grid;gap:8px;margin-top:14px';
  const secondary = document.createElement('div'); secondary.setAttribute('aria-label','추가 간편결제'); secondary.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:2px';
  const style = 'display:flex;align-items:center;justify-content:center;gap:12px;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px;font-size:14px;font-weight:700;text-align:center;text-decoration:none;background:white;color:#0f172a;cursor:pointer';
  const agreements=document.createElement('div');agreements.style.cssText='font-size:12px;margin-top:10px';
  const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px';
  const label=document.createElement('label'),all=document.createElement('input'),caption=document.createElement('span');all.type='checkbox';all.id='manytool-payment-agree-all';all.style.cssText='width:15px;height:15px;vertical-align:middle;margin-right:6px';caption.textContent='필수 약관 전체 동의';label.append(all,caption);
  const expand=document.createElement('button');expand.type='button';expand.textContent='보기';expand.setAttribute('aria-expanded','false');expand.style.cssText='font-size:12px;color:#64748b;text-decoration:underline';line.append(label,expand);
  const details=document.createElement('div');details.hidden=true;details.style.cssText='margin-top:8px';const checks=[];
  for(const [key,text,url]of [['terms','전자금융거래 이용약관','https://www.nicepay.co.kr/cs/terms/policy1.do'],['collection','개인정보 수집·이용 안내','https://www.nicepay.co.kr/cs/terms/private.do'],['sharing','개인정보 제3자 제공 안내','https://www.nicepay.co.kr/cs/terms/private.do']]){
    const row=document.createElement('label'),check=document.createElement('input'),link=document.createElement('a');row.style.cssText='display:block;margin:6px 0';check.type='checkbox';check.name=key;check.style.cssText='vertical-align:middle;margin-right:6px';link.textContent=text;link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.style.cssText='text-decoration:underline';row.append(check,link);details.append(row);checks.push(check);
  }
  expand.onclick=()=>{details.hidden=!details.hidden;expand.setAttribute('aria-expanded',String(!details.hidden));expand.textContent=details.hidden?'보기':'접기';};agreements.append(line,details);
  const choices=[['CARD','카드결제','card.svg'],['NAVER','네이버페이','naverpay.svg'],['TOSS','토스페이','tosspay.svg'],['KAKAO','카카오페이','kakaopay.svg'],['SAMSUNG','삼성페이','samsungpay.png'],['APPLE','Apple Pay','applepay.svg'],['PAYCO','PAYCO','payco.png']];
  const paymentButtons=[];let busy=false,preparing=false,epoch=0,preparedAt=0,launching=false;const prepared=new Map(),unavailable=new Set();
  const retrySettings=document.createElement('button');retrySettings.type='button';retrySettings.textContent='설정 확인 후 다시 시도';retrySettings.style.cssText=style+';font-size:12px;display:none';retrySettings.hidden=true;
  const consentMessage=document.createElement('p');consentMessage.id='manytool-consent-message';consentMessage.setAttribute('role','status');consentMessage.style.cssText='font-size:12px;color:#b45309;margin:6px 0 0';
  agreements.append(consentMessage);
  function syncConsent(){const count=checks.filter(c=>c.checked).length;all.checked=count===checks.length;all.indeterminate=count>0&&count<checks.length;all.disabled=busy;checks.forEach(check=>check.disabled=busy);if(count===checks.length)line.style.boxShadow='none';for(const {button,method,title}of paymentButtons){const blocked=unavailable.has(method);button.disabled=!product||busy||blocked||(count===checks.length&&preparing);button.title=blocked?'NICE I009: 해당 MID의 결제수단 설정 확인이 필요합니다.':title;button.setAttribute('aria-describedby','manytool-consent-message');button.style.opacity=button.disabled?'.55':'1';}retrySettings.hidden=!unavailable.size;retrySettings.style.display=unavailable.size?'flex':'none';retrySettings.disabled=busy||preparing;}
  function nudgeConsent(){consentMessage.textContent='위 필수 약관에 동의해 주세요.';line.style.boxShadow='0 0 0 2px #f59e0b';line.style.borderRadius='6px';all.focus();if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)line.animate?.([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:320});}
  function consentChanged(){consentMessage.textContent='';if(checks.every(check=>check.checked))return warmup();epoch++;preparing=false;prepared.clear();syncConsent();}
  all.addEventListener('change',()=>{checks.forEach(check=>check.checked=all.checked);return consentChanged();});checks.forEach(check=>check.addEventListener('change',consentChanged));
  function sdk(){if(typeof window.goPay==='function')return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js';script.onload=()=>typeof window.goPay==='function'?resolve():reject(Error('결제창을 불러오지 못했습니다.'));script.onerror=()=>{script.remove();reject(Error('결제창 연결을 다시 시도해 주세요.'));};document.head.append(script);});}
  async function warmup(readyMessage=''){
    if(product?.[0]!=='image'){syncConsent();return;}
    const run=++epoch;preparing=true;prepared.clear();syncConsent();consentMessage.textContent='결제수단을 연결하고 있습니다.';
    try{
      const [,entries]=await Promise.all([sdk(),Promise.all(choices.map(async([method])=>{
        const body=new URLSearchParams({product:'image',method,consentVersion:'2026-11-13-review',terms:'1',collection:'1',sharing:'1'});
        const response=await window.fetch('/api/nicepay-review/window',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:String(body)});
        if(!response.ok)throw Error('결제창 연결 정보를 확인하지 못했습니다.');const data=await response.json().catch(()=>null);
        if(data?.testOnly!==true||data.method!==method||data.fields?.MID!=='000000002m'||data.fields?.Amt!=='9900'||data.fields?.ReturnURL!==location.origin+'/api/nicepay-review/return')throw Error('허용된 테스트 결제 정보가 아닙니다.');return [method,data];
      }))]);
      if(run!==epoch||!dialog.isConnected||!checks.every(check=>check.checked))return;entries.forEach(([method,data])=>prepared.set(method,data));preparedAt=Date.now();consentMessage.textContent=readyMessage;
    }catch(error){if(run===epoch)consentMessage.textContent=error instanceof Error?error.message:'결제창 연결을 다시 시도해 주세요.';}finally{if(run===epoch){preparing=false;syncConsent();}}
  }
  function openPayment(method){
    if(busy||preparing||unavailable.has(method))return;if(!checks.every(check=>check.checked)){nudgeConsent();return;}if(product?.[0]!=='image'){consentMessage.textContent='가격은 설정됐습니다. 현재 인증창 연결 테스트는 이미지 상품 9,900원만 허용돼 있으며 실제 결제는 처리하지 않습니다.';return;}
    const data=prepared.get(method);if(!data||Date.now()-preparedAt>120000){void warmup('연결 정보를 갱신했습니다. 결제수단을 다시 눌러 주세요.');return;}
    busy=true;syncConsent();
    try{
      document.getElementById('manytool-nicepay-form')?.remove();const target=document.createElement('form');target.id='manytool-nicepay-form';target.name='payForm';target.method='post';target.action='/api/nicepay-review/return';target.acceptCharset='euc-kr';target.hidden=true;
      for(const [key,value]of Object.entries(data.fields)){const input=document.createElement('input');input.type='hidden';input.name=key;input.value=String(value);target.append(input);}document.body.append(target);
      const finish=text=>{target.remove();launching=false;busy=false;if(dialog.isConnected){if(!dialog.open)dialog.showModal();consentMessage.textContent=text;syncConsent();}else{window.manytoolShowPaymentChoices();const message=document.getElementById('manytool-consent-message');if(message)message.textContent=text;}};
      // Never submits authentication for approval. Server return/approve routes remain HTTP 409.
      const notice=fallback=>{const read=name=>String(target.elements?.namedItem(name)?.value||'').replace(/[\r\n]/g,' ').slice(0,180);const code=read('AuthResultCode'),message=read('AuthResultMsg');if(code==='I009')unavailable.add(method);return code&&code!=='0000'?`NICE ${method} 오류 ${code}: ${message||'가맹점 또는 결제수단 설정을 확인해 주세요.'}${code==='I009'?' · 해당 MID의 결제수단 설정 확인이 필요합니다.':''}`:fallback;};
      window.nicepaySubmit=()=>finish(notice('연결 확인을 마쳤습니다. 실제 결제 승인은 처리하지 않았습니다.'));window.nicepayClose=()=>finish(notice('결제창을 닫았습니다. 실제 결제는 처리하지 않았습니다.'));
      // No await here: popup-based wallets need the original payment-button activation.
      launching=true;dialog.close();try{window.goPay(target);}catch{finish('결제창을 열지 못했습니다. 다시 시도해 주세요.');}
    }catch(error){consentMessage.textContent=error instanceof Error?error.message:'결제창 연결을 다시 시도해 주세요.';}finally{busy=false;syncConsent();}
  }
  for (const [method,label,logo] of choices) {
    const compact=['SAMSUNG','APPLE','PAYCO'].includes(method);
    const form = document.createElement('form'); form.method = 'post'; form.action = '/api/nicepay-review/window';
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'product'; input.value = product?.[0] || '';
    const selected = document.createElement('input'); selected.type = 'hidden'; selected.name = 'method'; selected.value = method;
    const button = document.createElement('button'); button.type = 'submit'; button.textContent = label; button.disabled = !product; button.style.cssText = style;
    if(compact)button.style.cssText += ';aspect-ratio:1;flex-direction:column;gap:10px;padding:10px 6px;font-size:12px;height:100%';
    if(method==='APPLE')button.title='지원 기기·지갑·가맹점 설정에 따라 NICE에서 연결을 제한할 수 있습니다.';
    const image = document.createElement('img'); image.src = '/payment-brands/'+logo; image.alt = ''; image.width = method==='CARD'?24:64; image.height = compact?28:20; image.style.cssText = 'height:'+(compact?28:20)+'px;object-fit:contain;flex-shrink:0'; button.prepend(image);
    if(method==='KAKAO')button.style.cssText += ';background:#fee500;border-color:#fee500';
    form.append(input, selected, button); (compact?secondary:actions).append(form);
    paymentButtons.push({button,method,title:button.title||''});
    form.addEventListener('submit',event=>{event.preventDefault();return openPayment(method);});
  }
  actions.append(secondary);
  retrySettings.onclick=()=>{unavailable.clear();if(checks.every(check=>check.checked))return warmup('연결 정보를 갱신했습니다. 결제수단을 선택해 주세요.');syncConsent();};actions.append(retrySettings);
  const credit = document.createElement('button'); credit.type = 'button'; credit.disabled = true; credit.textContent = '보유 크레딧으로 결제'; credit.title = '크레딧 사용 연결 준비 중'; credit.style.cssText = style + ';margin-top:8px;opacity:.5'; actions.append(credit);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기'; close.style.cssText = style + ';cursor:pointer'; close.onclick = () => dialog.close(); actions.append(close);
  dialog.addEventListener('close', () => { if(launching)return;dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); });
  syncConsent();dialog.append(title, summary, note, agreements, actions); document.body.append(dialog); dialog.showModal();
};
