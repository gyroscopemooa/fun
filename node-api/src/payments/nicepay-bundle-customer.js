import express from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {renderNicepayPgForm} from './nicepay-pg.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Default-off customer workflow with explicit approved catalog and owned checkout preview.
export function createNicepayBundleCustomer({enabled=false,authenticate,origin,store,payment,creditStore}={}) {
  const router=express.Router();
  const ids=['ai_pet_translator','ai_name_premium'];
  if(enabled&&store)store.db.exec('CREATE TABLE IF NOT EXISTS nice_bundle_purchase_resets(owner TEXT NOT NULL,prior_key TEXT NOT NULL,next_key TEXT NOT NULL,PRIMARY KEY(owner,prior_key))');
  const products=Object.entries(payment?.catalog??{}).filter(([id,p])=>ids.includes(id)&&p.category==='direct');
  if(enabled&&(typeof authenticate!=='function'||new URL(origin).origin!==origin||new URL(origin).protocol!=='https:')) throw Error('Verified customer configuration required');
  router.use(async(req,res,next)=>{
    res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
    if(!enabled)return res.status(503).send('이용권 기능을 준비 중입니다.');
    try{const owner=await authenticate(req);if(typeof owner!=='string'||!owner)throw Error();res.locals.owner=owner;next();}
    catch{res.status(401).send('결제한 Manytool 계정으로 먼저 로그인해 주세요.');}
  });
  router.get('/',(req,res)=>{
    res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; media-src blob:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Manytool 펫·이름 이용권</title><style>
:root{font-family:system-ui,sans-serif;color:#17243b;background:#f4f6fb}body{max-width:760px;margin:32px auto;padding:24px}section{background:white;border:1px solid #dae1ec;border-radius:16px;padding:20px;margin:20px 0}label{display:block;margin:14px 0}input,select,textarea{display:block;box-sizing:border-box;width:100%;max-width:520px;border:1px solid #b5c2d5;border-radius:8px;padding:10px;margin-top:6px;font:inherit}button{background:#234fbe;color:white;border:0;border-radius:8px;padding:11px 16px;margin:6px 6px 6px 0;font:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:wait}fieldset{border:1px solid #dae1ec;border-radius:12px}audio{max-width:100%}p{line-height:1.6}#message{font-weight:600}#result section{padding:10px;margin:10px 0}#result h3{font-size:1rem}[hidden]{display:none!important}@media(max-width:600px){body{margin:0;padding:16px}section{padding:16px}}
</style><body>
<h1>펫·이름 이용권</h1><p>테스트 환경입니다. 승인된 테스트 상품의 결제를 준비하거나 이미 결제한 주문으로 이용합니다. 자동으로 결제하거나 갱신하지 않습니다.</p>
<label>도구 <select id="tool"><option value="pet">펫 번역 30일 이용권</option><option value="name"${req.query.source==='/name-premium'?' selected':''}>이름 분석·추천 묶음</option></select></label>
<p id="price"></p><button id="prepare">선택한 이용권 결제 준비</button><button id="newPurchase" hidden>새 이용권 구매 준비</button><a id="pay" target="_blank" rel="noopener" hidden>결제창 열기</a><p>불명확한 결제는 새로 구매하지 말고 같은 요청으로 다시 확인하세요.</p>
<p id="previousOrders"></p><label>주문 번호 <input id="order" maxlength="128" autocomplete="off"></label>
<section id="pet"><h2>반려동물 소리와 명령</h2><p>결제일로부터 30일, 자동갱신 없음. 음성 분석과 명령 음성을 이용할 수 있습니다.</p><button id="status">이용기간 확인</button><p id="period"></p>
<label>동물 <select id="animal"><option value="dog">강아지</option><option value="cat">고양이</option></select></label>
<label>모드 <select id="mode"><option value="analyze">소리 분석</option><option value="command">명령 음성 만들기</option></select></label>
<label>짧은 문장 <textarea id="text"></textarea></label><label>녹음 파일 <input id="audio" type="file" accept="audio/webm,audio/wav,audio/mpeg,audio/mp4,audio/ogg"></label><p>최대 10MB. 문장을 입력하면 파일 대신 문장을 사용합니다.</p>
<button id="petRun">펫 작업 시작</button><audio id="player" controls hidden></audio><button id="download" hidden>음성 저장</button></section>
<section id="name" hidden><h2>이름 분석과 추천</h2><p>하나의 이용권에서 동일한 이름 정보로 분석과 추천을 이용합니다. 첫 실행 후에는 이름 정보가 고정됩니다.</p>
<fieldset id="identity"><label>이름 <input id="displayName" maxlength="80"></label><label>한자 성 <input id="surname" maxlength="1"></label><label>한자 이름 <input id="given" maxlength="2"></label><label>생년월일 <input id="birthDate" type="date"></label><label>성별 <select id="gender"><option value="female">여성</option><option value="male">남성</option></select></label><label>달력 <select id="calendar"><option value="solar">양력</option><option value="lunar">음력</option></select></label></fieldset>
<label>추천 개수 <input id="topK" type="number" min="1" max="20" value="5"></label><label>추천 이름 길이 <select id="length"><option value="2">두 글자</option><option value="1">한 글자</option></select></label><button id="analyze">이름 분석</button><button id="recommend">이름 추천</button></section>
<p id="message" role="status"></p><button id="retry" hidden>같은 작업 다시 확인</button><button id="next" hidden>새 작업 준비</button><section id="result" aria-live="polite"></section>
<script src="${escape(req.baseUrl)}/client.js"></script></body></html>`);
  });
  router.get('/client.js',(_req,res)=>res.type('js').send(bundleCustomerClient));
  router.get('/pay/:id',(req,res)=>{
    try{const order=store.owned(req.params.id,res.locals.owner);
      if(!products.some(([id])=>id===order.productId)||order.category!=='direct'||order.merchantId!==payment.config.id||order.state!=='created'||order.expires<=Date.now())throw Error();
      res.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline' https://pg-web.nicepay.co.kr; connect-src https://*.nicepay.co.kr; frame-src https://*.nicepay.co.kr; img-src https://*.nicepay.co.kr data:; style-src 'unsafe-inline'; form-action https:; base-uri 'none'; frame-ancestors 'none'");
      res.type('html').send(renderNicepayPgForm(order,payment.config,new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14)));
    }catch{res.status(404).send('결제창을 열 수 없습니다. 기존 결제 상태를 확인해 주세요.');}
  });
  router.use((req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'Origin rejected'}));
  router.post('/catalog',(_req,res)=>res.json({products:products.map(([id,p])=>({id,label:p.goodsName,amount:p.amount,currency:p.currency}))}));
  const resetReason=order=>{
    if(order.state==='created'&&order.expires<=Date.now())return 'expired_checkout';
    if(order.state!=='verified')return null;
    const db=store.db;
    if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='nice_entitlements'").get())return null;
    if(!db.prepare("SELECT 1 FROM nice_entitlements e JOIN nice_receipts r ON r.order_id=e.order_id WHERE e.order_id=? AND e.owner=? AND e.product=? AND e.state IN ('ready','claimed') AND r.tid=?").get(order.id,order.ownerId,order.productId,order.tid))return null;
    if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='nice_bundle_runs'").get())return null;
    if(db.prepare("SELECT 1 FROM nice_bundle_runs WHERE order_id=? AND state!='done'").get(order.id))return null;
    if(order.productId==='ai_pet_translator'){
      const receipt=db.prepare('SELECT created FROM nice_receipts WHERE order_id=? AND tid=?').get(order.id,order.tid);
      return receipt&&Date.now()>=receipt.created+30*86400000?'expired_pass':null;
    }
    if(order.productId==='ai_name_premium'&&db.prepare('SELECT 1 FROM nice_bundle_locks WHERE order_id=?').get(order.id))return 'new_identity';
    return null;
  };
  router.post('/new-purchase',express.json({limit:'2kb'}),(req,res)=>{
    try{const key=req.body?.requestKey,owner=res.locals.owner;
      const result=store.transaction(()=>{
        const binding=store.db.prepare('SELECT order_id FROM nice_checkout_keys WHERE owner=? AND request_key=?').get(owner,key??'');
        if(!binding)throw Error();const order=store.owned(binding.order_id,owner);
        if(!products.some(([id])=>id===order.productId)||!resetReason(order))throw Error();
        const prior=store.db.prepare('SELECT next_key FROM nice_bundle_purchase_resets WHERE owner=? AND prior_key=?').get(owner,key);
        if(prior)return prior.next_key;
        const next=randomUUID();store.db.prepare('INSERT INTO nice_bundle_purchase_resets VALUES(?,?,?)').run(owner,key,next);return next;
      });res.json({requestKey:result});
    }catch{res.status(409).json({error:'기존 결제나 작업 상태가 확정되지 않았습니다. 같은 요청으로 확인해 주세요.'});}
  });
  router.post('/prepare',express.json({limit:'2kb'}),(req,res)=>{
    try{const productId=req.body?.productId;
      if(!products.some(([id])=>id===productId)||typeof req.body?.requestKey!=='string')throw Error();
      creditStore?.rateLimit('nice-bundle-customer:'+res.locals.owner,20,3600000);
      const inputHash=createHash('sha256').update(JSON.stringify({productId,entitlement:'existing-bundle-v1'})).digest('hex');
      const order=store.create({ownerId:res.locals.owner,productId,requestKey:req.body.requestKey,inputHash},payment.catalog,payment.policy,payment.config.id);
      res.json({orderId:order.id,state:order.state,amount:order.amount,currency:order.currency,newPurchaseReason:resetReason(order),checkoutUrl:order.state==='created'&&order.expires>Date.now()?req.baseUrl+'/pay/'+encodeURIComponent(order.id):null});
    }catch{res.status(409).json({error:'기존 구매 요청을 다시 확인하세요. 새로 결제하지 마세요.'});}
  });
  router.use((error,_req,res,_next)=>res.status(error?.status===413?413:400).json({error:'Invalid checkout request'}));
  return router;
}

export const bundleCustomerClient=String.raw`
const $=id=>document.getElementById(id),base=location.pathname.replace(/\/$/,'').replace(/\/customer-bundles$/,'');
let pending=null,busy=false,blobUrl=null,artifact=null,products=[],preparing=false,newPurchaseReason=null;
const say=text=>$('message').textContent=text;
function switchTool(){$('pet').hidden=$('tool').value!=='pet';$('name').hidden=$('tool').value!=='name';}
$('tool').onchange=()=>{switchTool();showPrice();};switchTool();
function controls(locked){for(const id of ['tool','order','petRun','analyze','recommend','status','prepare','newPurchase'])$(id).disabled=locked;}
function render(value,target){if(value===null||typeof value!=='object'){const p=document.createElement('p');p.textContent=String(value??'');target.append(p);return;}for(const [key,item] of Object.entries(value)){const s=document.createElement('section'),h=document.createElement('h3');h.textContent=key;s.append(h);target.append(s);render(item,s);}}
async function request(route,body){const response=await fetch(base+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'요청을 확인해 주세요.'),{editable:data.editable===true});return data;}
function productId(){return $('tool').value==='pet'?'ai_pet_translator':'ai_name_premium';}
function showPrice(){const p=products.find(p=>p.id===productId());$('price').textContent=p?p.label+' · '+p.amount.toLocaleString()+' '+p.currency:'이용 가능한 신규 구매 상품을 준비 중입니다. 기존 주문은 이용할 수 있습니다.';$('prepare').disabled=!p||busy||Boolean(pending);$('pay').hidden=true;$('newPurchase').hidden=true;newPurchaseReason=null;}
$('prepare').onclick=async()=>{if(preparing||busy||pending)return;preparing=true;controls(true);try{
  const id=productId(),key='nice-bundle-purchase:'+id;let requestKey=sessionStorage.getItem(key);if(!requestKey){requestKey=crypto.randomUUID();sessionStorage.setItem(key,requestKey);}
  const result=await request('/customer-bundles/prepare',{productId:id,requestKey});$('order').value=result.orderId;restoreIdentity();newPurchaseReason=result.newPurchaseReason;$('newPurchase').hidden=!newPurchaseReason;
  if(result.checkoutUrl)$('pay').href=result.checkoutUrl;$('pay').hidden=!result.checkoutUrl;say(result.amount.toLocaleString()+' '+result.currency+' · 상태: '+result.state+' · 결제창에서 금액을 확인하세요.');
}catch(e){say(e.message+' 같은 구매 요청으로만 다시 확인합니다.');}finally{preparing=false;controls(false);}};
$('newPurchase').onclick=async()=>{if(preparing||busy||pending||!newPurchaseReason)return;
  const description=newPurchaseReason==='new_identity'?'다른 이름 정보용 새 이용권을 준비할까요? 기존 이용권은 그대로 유지됩니다.':'만료된 요청 대신 새 이용권 구매를 준비할까요?';
  if(!window.confirm(description))return;preparing=true;controls(true);
  try{const key='nice-bundle-purchase:'+productId(),oldKey=sessionStorage.getItem(key);const data=await request('/customer-bundles/new-purchase',{requestKey:oldKey});const history=JSON.parse(sessionStorage.getItem('nice-bundle-previous-orders')||'[]');if($('order').value&&!history.includes($('order').value))history.push($('order').value);sessionStorage.setItem('nice-bundle-previous-orders',JSON.stringify(history));sessionStorage.setItem(key,data.requestKey);$('previousOrders').textContent='이전 주문 번호: '+history.join(', ');
    $('order').value='';$('pay').hidden=true;$('newPurchase').hidden=true;newPurchaseReason=null;restoreIdentity();say('새 구매 요청이 준비되었습니다. 입력을 확인하고 결제 준비를 눌러 주세요.');}
  catch(e){say(e.message);}finally{preparing=false;controls(false);}
};
function order(){const id=$('order').value.trim();if(!id)throw Error('결제한 주문 번호를 입력해 주세요.');return id;}
function lockIdentity(){const key='nice-name-lock:'+order(),saved=sessionStorage.getItem(key);if(saved)return JSON.parse(saved);const surname=$('surname').value.trim(),given=$('given').value.trim().split('');if(surname.length!==1||given.length<1||given.length>2)throw Error('한자 성 한 글자와 이름 한두 글자를 입력해 주세요.');return {displayName:$('displayName').value.trim(),surname,given,hanjaName:surname+given.join(''),birthDate:$('birthDate').value,gender:$('gender').value,calendarType:$('calendar').value};}
function restoreIdentity(){const saved=sessionStorage.getItem('nice-name-lock:'+$('order').value.trim());$('identity').disabled=Boolean(saved);if(saved){const i=JSON.parse(saved);$('displayName').value=i.displayName;$('surname').value=i.surname;$('given').value=i.given.join('');$('birthDate').value=i.birthDate;$('gender').value=i.gender;$('calendar').value=i.calendarType;}}
$('order').onchange=()=>{try{restoreIdentity();}catch{say('저장된 입력을 확인해 주세요.');}};
async function readAudio(file){if(file.size>10*1024*1024)throw Error('녹음 파일은 10MB 이하로 선택해 주세요.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('파일을 읽을 수 없습니다.'));r.readAsDataURL(file);});}
function persist(){try{sessionStorage.setItem('nice-bundle-pending',JSON.stringify(pending));}catch{throw Error('재시도용 작업을 안전하게 저장할 공간이 없습니다. 더 작은 녹음 파일을 선택하거나 브라우저 저장 공간을 확인해 주세요. 작업은 시작하지 않았습니다.');}}
async function perform(){if(busy||!pending)return;busy=true;controls(true);$('retry').hidden=true;$('next').hidden=true;say('처리 중입니다. 중복 요청이나 재결제하지 마세요.');
try{const result=await request(pending.route,pending.body);$('result').replaceChildren();render(result,$('result'));
if(pending.route.startsWith('/bundles/name/')){sessionStorage.setItem('nice-name-lock:'+pending.body.orderId,JSON.stringify(pending.body.input));restoreIdentity();}
if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}$('player').hidden=true;$('download').hidden=true;artifact=result.artifact?.id??null;
if(artifact){$('download').hidden=false;await loadAudio().catch(()=>say('작업 완료. 음성 저장 버튼으로 다시 다운로드할 수 있습니다.'));}
pending=null;sessionStorage.removeItem('nice-bundle-pending');$('next').hidden=false;say('작업이 완료되었습니다. 새 작업은 같은 이용권에서 별도로 시작할 수 있습니다.');}
catch(e){if(e.editable){pending=null;sessionStorage.removeItem('nice-bundle-pending');controls(false);restoreIdentity();$('retry').hidden=true;say(e.message+' 입력을 수정한 뒤 다시 실행해 주세요. 작업은 시작되지 않았습니다.');}else{say(e.message+' 같은 요청 ID로만 다시 확인하세요. 입력을 바꾸거나 재결제하지 마세요.');$('retry').hidden=false;}}
finally{busy=false;}}
async function start(kind){if(busy||pending)return;busy=true;controls(true);try{const orderId=order();let input,options,route;
if(kind==='pet'){input={animal:$('animal').value,mode:$('mode').value,textInput:$('text').value.trim(),locale:'ko'};const file=$('audio').files[0];if(!input.textInput&&file){input.audio=await readAudio(file);input.audioMimeType=file.type;}if(!input.textInput&&!input.audio)throw Error('문장이나 녹음 파일을 입력해 주세요.');route='/bundles/pet';}
else{input=lockIdentity();options={topK:Number($('topK').value),givenLength:Number($('length').value)};route='/bundles/name/'+kind;}
pending={route,body:{orderId,requestId:crypto.randomUUID(),input,options},tool:kind==='pet'?'pet':'name'};persist();busy=false;await perform();}
catch(e){pending=null;say(e.message);controls(false);}finally{busy=false;}}
$('petRun').onclick=()=>start('pet');$('analyze').onclick=()=>start('analyze');$('recommend').onclick=()=>start('recommend');$('retry').onclick=perform;
$('next').onclick=()=>{controls(false);$('next').hidden=true;restoreIdentity();say('다음 작업을 입력해 주세요.');};
$('status').onclick=async()=>{try{const data=await request('/bundles/pet/'+encodeURIComponent(order()),{});$('period').textContent='이용 종료: '+new Date(data.expiresAt).toLocaleString()+' · 자동갱신 없음';}catch(e){say(e.message);}};
async function loadAudio(){const response=await fetch(base+'/bundles/artifact/'+encodeURIComponent(artifact),{method:'POST',credentials:'same-origin'});if(!response.ok)throw Error('음성을 불러올 수 없습니다.');if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(await response.blob());$('player').src=blobUrl;$('player').hidden=false;}
$('download').onclick=async()=>{try{if(!blobUrl)await loadAudio();const a=document.createElement('a');a.href=blobUrl;a.download='pet-command.mp3';a.click();}catch(e){say(e.message);}};
window.addEventListener('pagehide',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);});
try{$('previousOrders').textContent='이전 주문 번호: '+JSON.parse(sessionStorage.getItem('nice-bundle-previous-orders')||'[]').join(', ');}catch{}
request('/customer-bundles/catalog',{}).then(data=>{products=data.products;showPrice();}).catch(()=>{$('prepare').disabled=true;});
try{const saved=sessionStorage.getItem('nice-bundle-pending');if(saved){pending=JSON.parse(saved);$('order').value=pending.body.orderId;$('tool').value=pending.tool;switchTool();controls(true);$('retry').hidden=false;say('미완료 작업이 있습니다. 같은 작업 다시 확인을 눌러 주세요.');}}catch{controls(true);say('저장된 요청을 읽을 수 없습니다. 새로 결제하지 말고 지원을 요청해 주세요.');}
`;
