import express from 'express';
import {createHash} from 'node:crypto';
import {renderNicepayPgForm} from './nicepay-pg.js';
import {executeNicepayTool} from './nicepay-execution.js';
const ids=['ai_manseryeok','calorie','ai_personal_color',...([5,7,10,15,20].map(n=>'detail_page_'+n))];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digest=input=>createHash('sha256').update(JSON.stringify(input)).digest('hex');

// Customer-facing preview remains opt-in independently of operator diagnostics.
export function createNicepayCustomerStaging({enabled=false,store,creditStore,authenticate,origin,payment,toolAdapters={}}={}){
 const router=express.Router();
 if(!enabled){router.use((_req,res)=>res.status(503).set('Cache-Control','no-store').send('결제 기능을 준비 중입니다.'));return router;}
 const products=Object.entries(payment?.catalog??{}).filter(([id,p])=>ids.includes(id)&&p.category==='direct'&&toolAdapters[id]);
 store.db.exec('CREATE TABLE IF NOT EXISTS nice_customer_orders(order_id TEXT PRIMARY KEY,owner TEXT NOT NULL,input_hash TEXT NOT NULL)');
 router.use((req,res,next)=>{
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
  try{res.locals.owner=authenticate(req);next();}catch{res.status(401).send('먼저 Manytool 크레딧 계정으로 로그인해 주세요.');}
 });
 const owned=(id,owner)=>{
  const order=store.owned(id,owner),binding=store.db.prepare('SELECT input_hash FROM nice_customer_orders WHERE order_id=? AND owner=?').get(id,owner);
  if(!binding||!products.some(([key])=>key===order.productId))throw Error('Unavailable order');return {order,binding};
 };
 router.get('/',(req,res)=>{
  const sourceProducts={'/ai-manseryeok':'ai_manseryeok','/ai-calorie-calculator':'calorie','/ai-personal-color':'ai_personal_color'};
  const preferred=sourceProducts[req.query.source]??(req.query.source==='/tools/product-detail-studio'?products.find(([id])=>id.startsWith('detail_page_'))?.[0]:null);
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Manytool 도구 이용</title><body>
  <h1>Manytool 도구 이용</h1><p>테스트 환경입니다. 결제와 AI 작업은 버튼을 눌러야 진행됩니다.</p>
  <form id="purchase"><label>도구 <select id="product">${products.map(([id,p])=>`<option value="${esc(id)}"${id===preferred?' selected':''}>${esc(p.goodsName)} · ${p.amount.toLocaleString('ko-KR')}원</option>`).join('')}</select></label>
  <fieldset data-tool="ai_manseryeok"><legend>생년월일 정보</legend><label>이름 <input name="name" maxlength="80"></label><label>생일 <input name="birthDate" type="date"></label><label>출생시간 <input name="birthTime" type="time" value="12:00"></label><label>달력 <select name="calendarType"><option value="solar">양력</option><option value="lunar">음력</option></select></label><label><input name="isLeapMonth" type="checkbox">윤달</label><label><input name="timeUnknown" type="checkbox">시간 모름</label></fieldset>
  <fieldset data-tool="images"><legend>이미지 선택</legend><input id="images" type="file" accept="image/png,image/jpeg,image/webp" multiple><p>이미지마다 550KB 이하, PNG/JPEG/WebP. 상세페이지는 최대 30장입니다.</p></fieldset>
  <fieldset data-tool="calorie"><legend>식단 목표</legend><select name="goal"><option value="maintain">유지</option><option value="lose">감량</option><option value="gain">증량</option></select></fieldset>
  <fieldset data-tool="ai_personal_color"><legend>추가 요청</legend><textarea name="notes" maxlength="1000"></textarea></fieldset>
  <fieldset data-tool="detail"><legend>상품 정보</legend><label>상품명 <input name="productName" maxlength="200"></label><label>상품 표시 가격 <input name="price" maxlength="200"></label><label>고객층 <input name="audience" maxlength="1000"></label><label>장점 <textarea name="sellingPoints" maxlength="3000"></textarea></label><label>추가 요청 <textarea name="prompt" maxlength="3000"></textarea></label></fieldset>
  <button id="prepare" type="submit"${products.length?'':' disabled'}>입력 확인 후 결제 준비</button></form>
  <p id="message" role="status">${products.length?'':'이용 가능한 상품을 준비 중입니다.'}</p><a id="pay" target="_blank" rel="noopener" hidden>안전한 결제창 열기</a>
  <button id="check" hidden>결제 완료 확인</button><button id="execute" hidden>분석 시작</button><button id="new" hidden>새 분석 시작</button>
  <section id="result" aria-live="polite"></section><script src="${esc(req.baseUrl)}/client.js"></script></body></html>`);
 });
 router.get('/client.js',(_req,res)=>res.type('js').send(client));
 router.get('/pay/:id',(req,res)=>{
  try{const {order}=owned(req.params.id,res.locals.owner);if(order.state!=='created'||order.expires<=Date.now()||order.merchantId!==payment.config.id)throw Error();
   res.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline' https://pg-web.nicepay.co.kr; connect-src https://*.nicepay.co.kr; frame-src https://*.nicepay.co.kr; img-src https://*.nicepay.co.kr data:; style-src 'unsafe-inline'; form-action https:; base-uri 'none'; frame-ancestors 'none'");
   res.type('html').send(renderNicepayPgForm(order,payment.config,new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14)));
  }catch{res.status(404).send('결제창을 열 수 없습니다. 기존 결제 상태를 확인해 주세요.');}
 });
 router.use((req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'허용되지 않은 요청입니다.'}));
 router.use(express.json({limit:'24mb'}));
 router.post('/prepare',async(req,res)=>{
  let validated=false;
  try{
   const owner=res.locals.owner,id=req.body?.productId;
   if(!products.some(([key])=>key===id)||typeof req.body?.requestKey!=='string')throw Error();
   const input=await toolAdapters[id].validate(req.body?.input);validated=true;
   creditStore.rateLimit('nice-customer:'+owner,20,3600000);
   const inputHash=digest(input),order=store.create({ownerId:owner,productId:id,requestKey:req.body?.requestKey,inputHash},payment.catalog,payment.policy,payment.config.id);
   store.db.prepare('INSERT OR IGNORE INTO nice_customer_orders VALUES(?,?,?)').run(order.id,owner,inputHash);
   if(order.state!=='created'||order.expires<=Date.now())return res.json({orderId:order.id,state:order.state,amount:order.amount,currency:order.currency,checkoutUrl:null});
   res.json({orderId:order.id,amount:order.amount,currency:order.currency,checkoutUrl:req.baseUrl+'/pay/'+encodeURIComponent(order.id)});
  }catch{res.status(validated?400:422).json({editable:!validated,error:validated?'기존 요청을 다시 확인해 주세요. 새로 결제하지 마세요.':'입력과 선택한 상품을 확인해 주세요.'});}
 });
 router.post('/status',(req,res)=>{
  try{const {order}=owned(req.body?.orderId,res.locals.owner);const ready=order.state==='verified'&&Boolean(creditStore.db.prepare("SELECT 1 FROM nice_entitlements WHERE order_id=? AND owner=? AND state IN ('ready','claimed')").get(order.id,res.locals.owner));res.json({state:order.state,ready});}
  catch{res.status(404).json({error:'주문을 찾을 수 없습니다.'});}
 });
 router.post('/execute',async(req,res)=>{
  try{const owner=res.locals.owner,{order,binding}=owned(req.body?.orderId,owner),adapter=toolAdapters[order.productId],input=await adapter.validate(req.body?.input);
   if(digest(input)!==binding.input_hash)throw Error('Purchased input changed');
   const result=await executeNicepayTool({creditStore,orderId:order.id,owner,product:order.productId,validatedInput:input,runner:()=>adapter.execute(input,{orderId:order.id,owner})});res.json({result});
  }catch{res.status(409).json({error:'입력·결제 상태를 확인해 주세요. 처리 결과가 불명확하면 재결제하지 마세요.'});}
 });
 router.use((error,_req,res,_next)=>res.status(error.status===413?413:400).json({error:'입력 크기를 확인해 주세요.'}));
 return router;
}

const client=String.raw`
const $=id=>document.getElementById(id),form=$('purchase'),base=location.pathname.replace(/\/$/,'');
let input,orderId,requestKey,productId,locked=false;
const message=text=>$('message').textContent=text;
function visible(){const id=$('product').value;document.querySelectorAll('fieldset').forEach(el=>{const kind=el.dataset.tool;el.hidden=!(kind===id||(kind==='images'&&id!=='ai_manseryeok')||(kind==='detail'&&id.startsWith('detail_page_')));});}
$('product').onchange=visible;visible();
const read=file=>new Promise((resolve,reject)=>{if(file.size>550000)return reject(Error('이미지당 550KB 이하 파일을 선택해 주세요.'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
async function api(route,body){const r=await fetch(base+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'요청을 확인해 주세요.'),{editable:data.editable===true});return data;}
async function build(){
 const id=$('product').value,f=new FormData(form),v=key=>String(f.get(key)||'');
 if(id==='ai_manseryeok')return {name:v('name'),birthDate:v('birthDate'),birthTime:v('birthTime')||'12:00',calendarType:v('calendarType'),isLeapMonth:f.has('isLeapMonth'),timeUnknown:f.has('timeUnknown'),locale:'ko'};
 const files=Array.from($('images').files);if(!files.length||files.length>(id.startsWith('detail_page_')?30:1))throw Error('선택한 도구에 맞는 사진 수를 확인해 주세요.');
 const images=await Promise.all(files.map(read));
 if(id==='calorie')return {imageDataUrl:images[0],goal:v('goal'),locale:'ko'};
 if(id==='ai_personal_color')return {imageDataUrl:images[0],notes:v('notes'),locale:'ko'};
 return {images,productName:v('productName'),price:v('price'),audience:v('audience'),sellingPoints:v('sellingPoints'),prompt:v('prompt'),theme:'premium',pageCount:Number(id.split('_').at(-1))};
}
form.onsubmit=async event=>{
 event.preventDefault();if(locked)return;locked=true;$('prepare').disabled=true;
 try{if(!input){input=await build();productId=$('product').value;const key='nice-customer:'+productId;requestKey=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,requestKey);}
  form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
  const data=await api('/prepare',{productId,input,requestKey});orderId=data.orderId;
  form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);if(data.checkoutUrl)$('pay').href=data.checkoutUrl;$('pay').hidden=!data.checkoutUrl;$('check').hidden=false;message(data.amount.toLocaleString()+' '+data.currency+' · 결제창에서 금액을 확인하세요.');}
 catch(e){if(e.editable||!input){input=undefined;form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=false);}message(e.message+' 같은 요청 ID로만 다시 확인합니다.');locked=false;$('prepare').disabled=false;}
};
$('check').onclick=async()=>{try{const s=await api('/status',{orderId});$('execute').hidden=!s.ready;message(s.ready?'결제가 확인되었습니다. 분석 시작을 눌러 주세요.':'현재 상태: '+s.state+' · 다시 결제하지 말고 확인해 주세요.');}catch(e){message(e.message);}};
function render(value,target){if(value===null||typeof value!=='object'){const p=document.createElement('p');p.textContent=String(value??'');target.append(p);return;}for(const [key,v]of Object.entries(value)){const section=document.createElement('section'),h=document.createElement('h3');h.textContent=key;section.append(h);target.append(section);render(v,section);}}
$('execute').onclick=async()=>{$('execute').disabled=true;message('분석 중입니다. 이 창을 유지해 주세요.');try{const data=await api('/execute',{orderId,input});$('result').replaceChildren();render(data.result,$('result'));message('분석이 완료되었습니다.');$('new').hidden=false;}catch(e){message(e.message);$('execute').disabled=false;}};
$('new').onclick=()=>{sessionStorage.removeItem('nice-customer:'+productId);location.reload();};
`;
