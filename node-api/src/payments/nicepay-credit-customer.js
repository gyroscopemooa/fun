import express from 'express';
import {assertSharedPaymentStorage,isPostgresPaymentStore} from './payment-storage.js';
import {createHash} from 'node:crypto';
import {REFUND_POLICY_VERSION} from '../credits/refunds.js';
import {prepareNicepayIntent} from './nicepay-policy.js';
import {renderNicepayPgForm} from './nicepay-pg.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Explicit customer staging only. Existing /credits topup remains Polar, unchanged.
export function createNicepayCreditCustomer({enabled=false,store,creditStore,authenticate,origin,payment}={}){
 const router=express.Router();
 const products=Object.entries(payment?.catalog??{}).filter(([,p])=>p.category==='credit_topup');
 if(!enabled||!products.length){router.use((_req,res)=>res.status(503).set('Cache-Control','no-store').send('크레딧 충전을 준비 중입니다.'));return router;}
 if(typeof authenticate!=='function'||new URL(origin).origin!==origin||new URL(origin).protocol!=='https:')throw Error('Verified credit customer configuration required');
 assertSharedPaymentStorage(store,creditStore);
 for(const [id]of products)prepareNicepayIntent({productId:id,ownerId:'configuration-check'},payment.catalog,payment.policy);
 const fingerprint=hash('nice-credit-consent:'+REFUND_POLICY_VERSION);
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
  try{const owner=await authenticate(req);if(typeof owner!=='string'||!owner)throw Error();res.locals.owner=owner;next();}
  catch{res.status(401).send('크레딧을 보관할 Manytool 이메일 계정으로 먼저 로그인해 주세요.');}
 });
 const owned=async(id,owner)=>{const order=await store.owned(id,owner);if(order.category!=='credit_topup'||order.merchantId!==payment.config.id)throw Error();return order;};
 async function state(order,owner){
  const candidate=await creditStore.topup('nicepay:'+order.id),topup=candidate?.email===owner?candidate:null;
  return {orderId:order.id,productId:order.productId,paymentState:order.state,credited:order.state==='verified'&&Boolean(topup),topupState:topup?.status??null,credits:order.credits,amount:order.amount,currency:order.currency,
   canOpen:order.state==='created'&&order.expires>Date.now()&&products.some(([id])=>id===order.productId),canStartNew:(order.state==='verified'&&Boolean(topup))||order.state==='abandoned'||(order.state==='created'&&order.expires<=Date.now())};
 }
 router.get('/',(req,res)=>{
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Manytool 크레딧 충전</title><body data-account="${hash(res.locals.owner).slice(0,24)}"><h1>크레딧 충전</h1><p><a href="${escape(req.baseUrl.replace(/\/customer-credits$/,'/refunds/'))}">환불 접수·처리 상태</a></p><p>테스트 환경입니다. 이메일 계정에 잔액이 보관됩니다. 실제 서비스 개방 전에는 승인된 테스트 결제만 사용하세요.</p>
  <p>현재 잔액 <strong id="balance">확인 중</strong> 크레딧</p><label>충전 상품 <select id="pack">${products.map(([id,p])=>`<option value="${escape(id)}">${p.credits} 크레딧 · ${p.amount.toLocaleString('ko-KR')}원</option>`).join('')}</select></label>
  <p>사용한 크레딧은 환불 계산에서 차감됩니다. 결제 취소·환불 접수는 아직 이 화면에서 처리하지 않으며 고객지원 확인이 필요합니다. 기존 환불 정책 버전: ${escape(REFUND_POLICY_VERSION)}</p>
  <label><input id="consent" type="checkbox">충전 금액과 크레딧 수, 사용분 차감 및 환불 안내를 확인했습니다.</label><button id="prepare">충전 주문 준비</button><a id="pay" hidden target="_blank" rel="noopener">카드 결제창 열기</a>
  <button id="check">잔액·결제 상태 확인</button><button id="new" hidden>다른 충전 준비</button><p id="message" role="status"></p>
  <label>최근 충전 주문 <select id="history"></select></label><button id="load">선택 주문 확인</button><p>승인 확인이 늦어도 다시 결제하지 마세요. 같은 주문을 다시 확인하면 됩니다.</p><script src="${escape(req.baseUrl)}/client.js"></script></body></html>`);
 });
 router.get('/client.js',(_req,res)=>res.type('js').send(script));
 router.get('/pay/:id',async(req,res)=>{
  try{const order=await owned(req.params.id,res.locals.owner);if(!(await state(order,res.locals.owner)).canOpen)throw Error();
   res.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline' https://pg-web.nicepay.co.kr; connect-src https://*.nicepay.co.kr; frame-src https://*.nicepay.co.kr; img-src https://*.nicepay.co.kr data:; style-src 'unsafe-inline'; form-action https:; base-uri 'none'; frame-ancestors 'none'");
   res.type('html').send(renderNicepayPgForm(order,payment.config,new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14)));
  }catch{res.status(404).send('기존 주문 상태를 확인해 주세요. 새로 결제하지 마세요.');}
 });
 router.use((req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'허용되지 않은 요청입니다.'}));
 router.use(express.json({limit:'2kb'}));
 router.post('/prepare',async(req,res)=>{
  try{const owner=res.locals.owner,body=req.body??{};
   if(body.refundPolicyVersion!==REFUND_POLICY_VERSION||typeof body.requestKey!=='string'||!products.some(([id])=>id===body.productId))throw Error();
   await creditStore.rateLimit('nice-credit-customer:'+owner,20,3600000);
   const order=await store.create({ownerId:owner,productId:body.productId,requestKey:body.requestKey,inputHash:fingerprint},payment.catalog,payment.policy,payment.config.id);
   const status=await state(order,owner);res.json({...status,checkoutUrl:status.canOpen?req.baseUrl+'/pay/'+encodeURIComponent(order.id):null});
  }catch{res.status(400).json({error:'동의·상품·기존 요청을 확인해 주세요. 결과가 불명확하면 다시 결제하지 마세요.'});}
 });
 router.post('/wallet',async(_req,res,next)=>{try{
  const owner=res.locals.owner;
  const found=isPostgresPaymentStore(store)?await store.creditOrders(owner,payment.config.id):await Promise.all(store.db.prepare("SELECT id FROM nice_orders WHERE owner=? AND json_extract(intent,'$.category')='credit_topup' AND json_extract(intent,'$.merchantId')=? ORDER BY created DESC LIMIT 30").all(owner,payment.config.id).map(({id})=>owned(id,owner)));
  const orders=await Promise.all(found.map(order=>state(order,owner)));
  res.json({balance:await creditStore.balance(owner),orders,refundPolicyVersion:REFUND_POLICY_VERSION});
 }catch(error){next(error);}
 });
 router.post('/status',async(req,res)=>{try{res.json({...await state(await owned(req.body?.orderId,res.locals.owner),res.locals.owner),balance:await creditStore.balance(res.locals.owner)});}catch{res.status(404).json({error:'충전 주문을 찾을 수 없습니다.'});}});
 router.use((error,_req,res,_next)=>res.status(error.status===413?413:400).json({error:'요청을 확인해 주세요.'}));
 return router;
}
const script=String.raw`
const $=id=>document.getElementById(id),base=location.pathname.replace(/\/$/,''),key='nice-credit:'+document.body.dataset.account;
let pending,terms,busy=false,generation=0,storageBroken=false;try{const raw=sessionStorage.getItem(key);if(raw!=null){pending=JSON.parse(raw);if(!pending||typeof pending!=='object'||Array.isArray(pending)||typeof pending.productId!=='string'||(!pending.orderId&&!pending.requestKey))throw Error('Invalid stored request');}}catch{storageBroken=true;}
const say=text=>$('message').textContent=text;
function locked(value){busy=value;for(const id of ['prepare','load','check','new'])$(id).disabled=value;$('load').disabled=value||Boolean(pending&&!pending.orderId);$('pack').disabled=Boolean(pending)||storageBroken;$('prepare').disabled=value||storageBroken;}
async function api(route,body){const r=await fetch(base+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'다시 결제하지 말고 상태를 확인해 주세요.');return data;}
function display(s){$('balance').textContent=s.balance??$('balance').textContent;$('pay').hidden=!s.canOpen;if(s.canOpen)$('pay').href=base+'/pay/'+encodeURIComponent(s.orderId);$('new').hidden=!s.canStartNew||storageBroken;say(s.topupState==='refunded'?'환불된 충전 주문입니다. 현재 잔액을 확인하세요.':s.credited?'충전 반영이 확인되었습니다. 현재 잔액을 확인하세요.':'결제 상태: '+s.paymentState+' · 확인이 늦어도 재결제하지 마세요.');}
async function refresh(){const run=++generation,orderId=pending?.orderId;const data=await api('/wallet',{});if(run!==generation)return;terms=data.refundPolicyVersion;$('balance').textContent=data.balance;$('history').replaceChildren();for(const item of data.orders){const option=document.createElement('option');option.value=item.orderId;option.textContent=item.credits+'개 · '+(item.topupState||item.paymentState)+' · '+item.orderId.slice(0,8);$('history').append(option);}if(orderId){const s=await api('/status',{orderId});if(run===generation)display(s);}}
$('prepare').onclick=async()=>{if(busy||storageBroken)return say('브라우저 저장정보를 읽을 수 없습니다. 최근 주문에서 기존 결제 상태부터 확인해 주세요.');if(!$('consent').checked)return say('금액과 환불 안내를 먼저 확인해 주세요.');locked(true);generation++;
 try{if(!terms)throw Error('상품 정보를 먼저 불러와 주세요.');if(pending?.orderId){display(await api('/status',{orderId:pending.orderId}));return;}if(!pending)pending={productId:$('pack').value,requestKey:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(pending));const data=await api('/prepare',{...pending,refundPolicyVersion:terms});pending.orderId=data.orderId;sessionStorage.setItem(key,JSON.stringify(pending));display(data);await refresh();}catch(e){say(e.message);}finally{locked(false);}};
$('check').onclick=async()=>{if(busy)return;locked(true);try{await refresh();}catch(e){say(e.message);}finally{locked(false);}};
$('load').onclick=async()=>{if(busy||!$('history').value)return;if(pending&&!pending.orderId)return say('기존 충전 요청을 먼저 다시 확인해 주세요.');locked(true);generation++;const id=$('history').value;try{const s=await api('/status',{orderId:id});pending={orderId:id,productId:s.productId,requestKey:crypto.randomUUID()};if(!storageBroken)sessionStorage.setItem(key,JSON.stringify(pending));display(s);}catch(e){say(e.message);}finally{locked(false);}};
$('new').onclick=async()=>{if(busy||storageBroken||!pending?.orderId)return;locked(true);generation++;try{const s=await api('/status',{orderId:pending.orderId});if(!s.canStartNew)throw Error('기존 결제가 확인 중입니다. 새 주문을 만들지 마세요.');if(!confirm('기존 주문 내역은 유지하고 새 충전을 준비할까요?'))return;sessionStorage.removeItem(key);pending=null;$('pay').hidden=true;$('new').hidden=true;$('consent').checked=false;say('충전할 상품을 선택해 주세요.');}catch(e){say(e.message);}finally{locked(false);}};
locked(false);refresh().then(()=>{if(storageBroken)say('브라우저 저장정보를 읽을 수 없습니다. 최근 주문에서 기존 결제 상태부터 확인해 주세요.');}).catch(e=>say(e.message));
`;
