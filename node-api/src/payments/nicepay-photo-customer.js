import express from 'express';
import { createHash } from 'node:crypto';
import { renderNicepayPgForm } from './nicepay-pg.js';
import { executeNicepayTool } from './nicepay-execution.js';
import { createNicepayPrivatePhotoRouter } from './nicepay-photo-router.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ident = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

/** Mount only in explicit staging. surfaces.photo/image contain their assembled
 * runtime/storage plus reviewed catalog/config/policy. choices use server-owned
 * input templates that the existing immutable checkout resolver validates again.
 */
export function createNicepayPhotoCustomer({ enabled = false, store, creditStore, authenticate, origin, surfaces = {}, choices = [] } = {}) {
  const router = express.Router();
  if (!enabled) { router.use((_req,res) => res.status(503).set('Cache-Control','no-store').send('사진 서비스를 준비 중입니다.')); return router; }
  if (typeof authenticate !== 'function' || new URL(origin).origin !== origin || new URL(origin).protocol !== 'https:') throw Error('Verified customer staging dependencies required');
  const orderFile=store?.db.prepare('PRAGMA database_list').all().find(row=>row.name==='main')?.file;
  const walletFile=creditStore?.db.prepare('PRAGMA database_list').all().find(row=>row.name==='main')?.file;
  if(!orderFile||orderFile!==walletFile)throw Error('Customer orders require the same persistent wallet database');
  const options = new Map();
  for (const choice of choices) {
    const surface = surfaces[choice.group], product = surface?.catalog?.[choice.productId];
    if (!ident(choice.id) || options.has(choice.id) || !['photo','image'].includes(choice.group) || typeof choice.label !== 'string'
      || !product || product.category !== 'direct' || product.currency !== 'KRW' || product.recurring !== false || !Number.isSafeInteger(product.amount) || product.amount <= 0
      || ![undefined,true,false].includes(choice.allowPrompt) || ![undefined,true,false].includes(choice.needsParent)
      || !surface.runtime?.adapters?.[choice.productId] || !surface.storage || !surface.config || !surface.policy
      || (choice.needsParent === true && (choice.group !== 'photo' || !['add2','add3','add7'].includes(choice.productId)))
      || (['add2','add3','add7'].includes(choice.productId) && choice.needsParent !== true)
      || !choice.input || typeof choice.input !== 'object' || Array.isArray(choice.input)
      || Object.keys(choice.input).some(key => ['photoId','userInput','parentOrderId'].includes(key))) throw Error('Explicit reviewed photo/image choices required');
    options.set(choice.id, { ...choice, input: structuredClone(choice.input) });
  }
  const db = creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_photo_customer_orders(order_id TEXT PRIMARY KEY,owner TEXT NOT NULL,choice TEXT NOT NULL,
    photo_id TEXT NOT NULL,input TEXT NOT NULL,state TEXT NOT NULL);`);
  router.use(async (req,res,next) => {
    res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
    try { const owner = await authenticate(req); if (typeof owner !== 'string' || !owner) throw Error(); res.locals.owner = owner; next(); }
    catch { res.status(401).send('먼저 Manytool 크레딧 계정으로 로그인해 주세요.'); }
  });
  function owned(orderId, owner) {
    const order = store.owned(orderId, owner);
    const binding = db.prepare('SELECT * FROM nice_photo_customer_orders WHERE order_id=? AND owner=?').get(orderId, owner);
    const choice = binding && options.get(binding.choice), surface = choice && surfaces[choice.group];
    if (!binding || !choice || order.productId !== choice.productId) throw Error('Customer order unavailable');
    return { order, binding, choice, surface };
  }
  function summary(record, baseUrl) {
    const { order, binding } = record;
    const job = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='nice_tool_jobs'").get()
      && db.prepare('SELECT state,result FROM nice_tool_jobs WHERE order_id=?').get(order.id);
    const entitlement = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='nice_entitlements'").get()
      && db.prepare('SELECT state FROM nice_entitlements WHERE order_id=? AND owner=?').get(order.id, order.ownerId);
    return { orderId: order.id, state: order.state, bindingState: binding.state, amount: order.amount, currency: order.currency,
      jobState: job?.state ?? 'not_started', ready: binding.state === 'bound' && order.state === 'verified' && entitlement?.state === 'ready',
      checkoutUrl: binding.state === 'bound' && order.state === 'created' && order.expires > Date.now() ? `${baseUrl}/pay/${encodeURIComponent(order.id)}` : null,
      ...(job?.state === 'done' ? { result: JSON.parse(job.result) } : {}) };
  }
  router.get('/', (req,res) => {
    res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; img-src blob:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    const recent=db.prepare('SELECT c.order_id,o.state FROM nice_photo_customer_orders c JOIN nice_orders o ON o.id=c.order_id WHERE c.owner=? ORDER BY o.created DESC LIMIT 10').all(res.locals.owner);
    res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Manytool 사진·이미지</title><style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.7}label{display:block;margin:16px 0}input,select,button,textarea{font:inherit;max-width:100%}button,a{margin:8px 8px 8px 0}img{max-width:100%}[hidden]{display:none!important}</style><body data-session="${hash([res.locals.owner,req.baseUrl]).slice(0,24)}"><h1>사진·이미지 만들기</h1><p>테스트 환경입니다. 결제와 생성은 각각 버튼을 눌러야 진행됩니다.</p>
<form id="purchase"><label>서비스 <select id="choice">${[...options.values()].map(c=>`<option value="${esc(c.id)}" data-prompt="${c.allowPrompt===true}" data-parent="${c.needsParent===true}" data-group="${esc(c.group)}">${esc(c.label)} · ${surfaces[c.group].catalog[c.productId].amount.toLocaleString('ko-KR')}원</option>`).join('')}</select></label>
<label id="source-label">원본 사진 <input id="source" type="file" accept="image/png,image/jpeg,image/webp" required></label><p>PNG/JPEG/WebP 한 장, 20MB 이하. 사진은 로그인한 계정에만 연결됩니다.</p><label id="prompt-label" hidden>추가 요청 <textarea id="prompt" maxlength="50"></textarea></label><label id="parent-label" hidden>기본 사진 주문 번호 <input id="parent" maxlength="128"></label><button id="prepare"${options.size?'':' disabled'}>입력 확인 후 결제 준비</button></form>
<p id="message" role="status">${options.size?'사진과 서비스를 선택해 주세요.':'설정된 사진 상품이 없습니다.'}</p><a id="pay" target="_blank" rel="noopener" hidden>결제창 열기</a><button id="status" hidden>결제·처리 상태 확인</button><button id="execute" hidden>이미지 생성 시작</button><button id="cancel" hidden>결제 전 요청 취소</button><button id="new" hidden>새 작업 시작</button><section id="results" aria-live="polite"></section><h2>최근 주문 이어하기</h2><ul>${recent.map(row=>`<li><a href="?order=${esc(row.order_id)}">${esc(row.order_id)} · ${esc(row.state)}</a></li>`).join('')}</ul><script src="${esc(req.baseUrl)}/client.js"></script></body></html>`);
  });
  router.get('/client.js', (_req,res) => res.type('js').send(client));
  router.get('/pay/:id', (req,res) => {
    try {
      const record = owned(req.params.id,res.locals.owner), { order, surface, binding } = record;
      if (binding.state !== 'bound' || order.state !== 'created' || order.expires <= Date.now() || order.merchantId !== surface.config.id) throw Error();
      res.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline' https://pg-web.nicepay.co.kr; connect-src https://*.nicepay.co.kr; frame-src https://*.nicepay.co.kr; img-src https://*.nicepay.co.kr data:; style-src 'unsafe-inline'; form-action https:; base-uri 'none'; frame-ancestors 'none'");
      res.type('html').send(renderNicepayPgForm(order,surface.config,new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'' ).slice(0,14)));
    } catch { res.status(404).send('결제창을 열 수 없습니다. 기존 주문 상태를 확인해 주세요.'); }
  });
  for (const group of ['photo','image']) if (surfaces[group]) router.use(`/files/${group}`, createNicepayPrivatePhotoRouter({ enabled:true, storage:surfaces[group].storage, runtime:surfaces[group].runtime, authenticate, origin }));
  router.use((req,res,next) => req.headers.origin === origin ? next() : res.status(403).json({error:'허용되지 않은 요청입니다.'}));
  router.use(express.json({limit:'8kb'}));
  function parentPhoto(orderId, owner) {
    const order=store.owned(orderId,owner);
    if(order.productId!=='base'||!db.prepare("SELECT 1 FROM nice_photo_jobs WHERE order_id=? AND owner=? AND state='done'").get(orderId,owner))throw Error('Completed owned base photo required');
    const row=db.prepare("SELECT spec FROM nice_photo_purchases WHERE order_id=? AND owner=? AND product='base'").get(orderId,owner);
    if(!row)throw Error();return JSON.parse(row.spec).photoId;
  }
  router.post('/parent',(req,res)=>{try{res.json({photoId:parentPhoto(req.body?.orderId,res.locals.owner)});}catch{res.status(404).json({error:'완료된 본인 기본 사진 주문을 확인해 주세요.'});}});
  router.post('/prepare', async (req,res) => {
    let order, admitted = false, attempted = false;
    try {
      const body=req.body, choice=options.get(body?.choice), owner=res.locals.owner;
      if (!choice || !ident(body?.photoId) || typeof body?.requestKey !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestKey)
        || typeof body?.userInput !== 'string' || body.userInput.length>50 || (!choice.allowPrompt && body.userInput)
        || (choice.needsParent && !ident(body?.parentOrderId))) throw Error();
      if(choice.needsParent && parentPhoto(body.parentOrderId,owner)!==body.photoId)throw Error('Addon source mismatch');
      const surface=surfaces[choice.group]; await surface.storage.resolve({artifactId:body.photoId,owner,kind:'source'});
      const input={...choice.input,photoId:body.photoId,...((choice.allowPrompt||choice.group==='image')?{userInput:choice.allowPrompt?body.userInput:''}:{}),...(choice.needsParent?{parentOrderId:body.parentOrderId}:{})};
      creditStore.rateLimit('nice-photo-customer:'+owner,30,3600000);
      attempted=true;order=store.create({ownerId:owner,productId:choice.productId,requestKey:body.requestKey,inputHash:hash([choice.group,choice.id,input])},surface.catalog,surface.policy,surface.config.id);
      const inserted=db.prepare("INSERT OR IGNORE INTO nice_photo_customer_orders VALUES(?,?,?,?,?,'binding')").run(order.id,owner,choice.id,body.photoId,JSON.stringify(input));
      admitted=true;
      if(inserted.changes){
        try { await surface.runtime.adapters[choice.productId].bindCheckout(input,{orderId:order.id,owner}); db.prepare("UPDATE nice_photo_customer_orders SET state='bound' WHERE order_id=?").run(order.id); }
        catch { store.rejectCreated(order.id,owner); db.prepare("UPDATE nice_photo_customer_orders SET state='rejected' WHERE order_id=?").run(order.id); return res.status(422).json({editable:true,error:'사진과 선택 내용을 확인해 주세요.',orderId:order.id}); }
      }
      const record=owned(order.id,owner);
      if(record.binding.state!=='bound')return res.status(409).json({orderId:order.id,error:'요청 확인 중입니다. 새로 결제하지 말고 상태를 확인해 주세요.'});
      res.json(summary(record,req.baseUrl));
    } catch { res.status(admitted?409:422).json({editable:!attempted,error:'사진·입력·기존 요청을 확인해 주세요. 결제를 반복하지 마세요.'}); }
  });
  router.post('/status',(req,res)=>{try{res.json(summary(owned(req.body?.orderId,res.locals.owner),req.baseUrl));}catch{res.status(404).json({error:'주문을 찾을 수 없습니다.'});}});
  router.post('/cancel',(req,res)=>{try{const {order}=owned(req.body?.orderId,res.locals.owner);if(order.state!=='created')throw Error();store.rejectCreated(order.id,res.locals.owner);if(store.owned(order.id,res.locals.owner).state!=='abandoned')throw Error();res.json({cancelled:true});}catch{res.status(409).json({error:'진행된 결제는 여기서 취소할 수 없습니다. 상태를 확인해 주세요.'});}});
  router.post('/execute',async(req,res)=>{try{
    const owner=res.locals.owner,{order,binding,surface}=owned(req.body?.orderId,owner);if(binding.state!=='bound')throw Error();
    const adapter=surface.runtime.adapters[order.productId],context={orderId:order.id,owner};
    const input=await adapter.validate({photoId:binding.photo_id},context);
    const result=await executeNicepayTool({creditStore,...context,product:order.productId,validatedInput:input,runner:()=>adapter.execute(input,context)});res.json({result});
  }catch{res.status(409).json({error:'생성 결과를 확인할 수 없습니다. 새로 결제하지 말고 처리 상태를 확인해 주세요.'});}});
  router.post('/download',async(req,res)=>{try{
    const owner=res.locals.owner,{order,surface}=owned(req.body?.orderId,owner);
    const data=await surface.runtime.download({owner,orderId:order.id,candidateId:req.body?.candidateId});res.set('Content-Disposition','attachment; filename="manytool-photo.png"').type('png').send(data);
  }catch{res.status(404).json({error:'사진을 내려받을 수 없습니다.'});}});
  router.use((error,_req,res,_next)=>res.status(error?.status===413?413:400).json({error:'입력 내용을 확인해 주세요.'}));
  return router;
}

const client = String.raw`
const $=id=>document.getElementById(id),base=location.pathname.replace(/\/$/,''),form=$('purchase');
const key='nice-photo:'+document.body.dataset.session;let current,working=false,urls=[];
try{current=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
const resume=new URLSearchParams(location.search).get('order');if(resume)current={orderId:resume};
const say=text=>$('message').textContent=text;
function save(){sessionStorage.setItem(key,JSON.stringify(current));}
function fields(disabled){form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=disabled);}
function selected(){return $('choice').selectedOptions[0];}
function visibility(){const option=selected();$('prompt-label').hidden=option?.dataset.prompt!=='true';$('parent-label').hidden=option?.dataset.parent!=='true';$('source-label').hidden=option?.dataset.parent==='true';$('source').required=option?.dataset.parent!=='true';}
$('choice').onchange=visibility;visibility();
async function api(route,body){const response=await fetch(base+route,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'요청을 확인해 주세요.'),data);return data;}
function render(result){$('results').replaceChildren();urls.forEach(URL.revokeObjectURL);urls=[];for(const [index,candidate]of(result?.candidates||[]).entries()){
 const button=document.createElement('button');button.textContent='후보 '+(index+1)+' 보기 / 다운로드';
 button.onclick=async()=>{button.disabled=true;try{const response=await fetch(base+'/download',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:current.orderId,candidateId:candidate.id})});if(!response.ok)throw Error('사진을 가져오지 못했습니다.');const url=URL.createObjectURL(await response.blob());urls.push(url);const image=document.createElement('img'),link=document.createElement('a');image.src=url;image.alt='생성된 사진 후보 '+(index+1);link.href=url;link.download='manytool-photo.png';link.textContent='이 사진 저장';button.after(image,link);}catch(error){say(error.message);button.disabled=false;}};$('results').append(button);
}}
function apply(data){current.orderId=data.orderId;save();fields(true);$('status').hidden=false;$('pay').hidden=!data.checkoutUrl;if(data.checkoutUrl)$('pay').href=data.checkoutUrl;$('execute').hidden=!data.ready;$('cancel').hidden=data.state!=='created';$('new').hidden=!(data.jobState==='done'||data.state==='abandoned');if(data.result)render(data.result);say(data.jobState==='done'?'완료되었습니다. 후보를 눌러 확인하고 저장하세요.':data.ready?'결제가 확인되었습니다. 이미지 생성 시작을 눌러 주세요.':data.amount.toLocaleString()+' '+data.currency+' · 현재 상태: '+data.state+' / '+data.jobState+' · 결제나 생성을 반복하지 마세요.');}
async function status(){if(!current?.orderId)return;say('상태 확인 중입니다.');try{apply(await api('/status',{orderId:current.orderId}));}catch(error){say(error.message);}}
form.onsubmit=async event=>{event.preventDefault();if(working)return;working=true;fields(true);try{
 if(!current){const file=$('source').files[0],option=selected();let photoId;
 if(option.dataset.parent==='true'){try{photoId=(await api('/parent',{orderId:$('parent').value})).photoId;}catch(error){throw Object.assign(error,{editable:true});}}
 else{if(!file||file.size>20000000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Object.assign(Error('20MB 이하 PNG/JPEG/WebP 한 장을 선택해 주세요.'),{editable:true});
 const uploaded=await fetch(base+'/files/'+option.dataset.group+'/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},body:file});const data=await uploaded.json();if(!uploaded.ok)throw Object.assign(Error(data.error||'사진 업로드 실패'),{editable:true});photoId=data.artifactId;}
 current={choice:option.value,photoId,requestKey:crypto.randomUUID(),userInput:option.dataset.prompt==='true'?$('prompt').value:'',...(option.dataset.parent==='true'?{parentOrderId:$('parent').value}:{})};save();}
 apply(await api('/prepare',current));
 }catch(error){if(error.editable){current=null;sessionStorage.removeItem(key);fields(false);}else{$('prepare').disabled=false;fields(true);$('prepare').disabled=false;}say(error.message+' 같은 요청으로 다시 확인할 수 있습니다.');}finally{working=false;}};
$('status').onclick=status;
$('execute').onclick=async()=>{if(working||!current?.orderId)return;working=true;$('execute').disabled=true;say('생성 중입니다. 다시 방문하면 최근 주문에서 상태를 확인할 수 있습니다.');try{await api('/execute',{orderId:current.orderId});await status();}catch(error){say(error.message);$('status').hidden=false;}finally{working=false;$('execute').disabled=false;}};
$('cancel').onclick=async()=>{if(working)return;working=true;try{await api('/cancel',{orderId:current.orderId});await status();}catch(error){say(error.message);}finally{working=false;}};
$('new').onclick=()=>{current=null;sessionStorage.removeItem(key);urls.forEach(URL.revokeObjectURL);location.href=base;};
window.addEventListener('pageshow',event=>{if(event.persisted&&current?.orderId)status();});
if(current?.orderId){fields(true);$('status').hidden=false;status();}else if(current){fields(true);$('prepare').disabled=false;say('중단된 요청이 있습니다. 같은 요청 ID로 결제 준비를 다시 확인하세요.');}
`;
