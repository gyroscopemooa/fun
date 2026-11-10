import express from 'express';
import {createHash} from 'node:crypto';
import {renderNicepayPgForm} from './nicepay-pg.js';
const fingerprint=createHash('sha256').update('video_mkv_mp4:one-conversion').digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createNicepayVideoCustomer({enabled=false,store,creditStore,authenticate,origin,payment}={}){
 const router=express.Router();
 const product=payment?.catalog?.video_mkv_mp4;
 if(!enabled||product?.category!=='direct'){router.use((_req,res)=>res.status(503).set('Cache-Control','no-store').send('영상 변환 결제를 준비 중입니다.'));return router;}
 router.use((req,res,next)=>{
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
  try{res.locals.owner=authenticate(req);next();}catch{res.status(401).send('Manytool 크레딧 계정으로 먼저 로그인해 주세요.');}
 });
 const owned=(id,owner)=>{const order=store.owned(id,owner);if(order.productId!=='video_mkv_mp4'||order.category!=='direct'||order.merchantId!==payment.config.id)throw Error();return order;};
 router.get('/',(req,res)=>{
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Manytool MP4 변환</title><body><h1>MP4로 변환</h1><p>테스트 환경입니다. MKV·MOV·AVI·M4V, 최대 1.5GB. 결제 후 영상 한 개를 변환합니다.</p>
  <p>${esc(product.goodsName)} · ${product.amount.toLocaleString('ko-KR')}원</p><button id="prepare">결제 준비 / 이전 주문 확인</button><a id="pay" target="_blank" rel="noopener" hidden>결제창 열기</a>
  <p><label>이전 영상 주문 <select id="history"></select></label><button id="load">선택한 주문 보기</button></p><button id="check" hidden>결제·작업 상태 확인</button><p id="message" role="status"></p>
  <section id="upload" hidden><label>변환할 영상 <input id="file" type="file" accept=".mkv,.mov,.avi,.m4v"></label><button id="send">업로드</button></section>
  <button id="convert" hidden>MP4 변환 시작</button><a id="download" hidden>완료된 MP4 다운로드</a><button id="replace" hidden>실패한 업로드 삭제 후 다른 영상 선택</button><button id="remove" hidden>보관 중인 입력·결과 삭제</button><button id="new" hidden>새 영상 변환</button>
  <p>통신이 끊겨도 새로 결제하지 말고 기존 주문 상태를 확인해 주세요. 변환 중에는 창을 닫아도 작업 상태를 다시 확인할 수 있습니다.</p>
  <script src="${esc(req.baseUrl)}/client.js"></script></body></html>`);
 });
 router.get('/client.js',(_req,res)=>res.type('js').send(script));
 router.get('/pay/:id',(req,res)=>{
  try{const order=owned(req.params.id,res.locals.owner);if(order.state!=='created'||order.expires<=Date.now())throw Error();
   res.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline' https://pg-web.nicepay.co.kr; connect-src https://*.nicepay.co.kr; frame-src https://*.nicepay.co.kr; img-src https://*.nicepay.co.kr data:; style-src 'unsafe-inline'; form-action https:; base-uri 'none'; frame-ancestors 'none'");
   res.type('html').send(renderNicepayPgForm(order,payment.config,new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14)));
  }catch{res.status(404).send('결제 상태를 확인해 주세요. 새로 결제하지 마세요.');}
 });
 router.use((req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'허용되지 않은 요청입니다.'}));
 router.use(express.json({limit:'2kb'}));
 router.post('/prepare',(req,res)=>{
  try{const owner=res.locals.owner;if(typeof req.body?.requestKey!=='string')throw Error();
   creditStore.rateLimit('nice-video-customer:'+owner,20,3600000);
   const order=store.create({ownerId:owner,productId:'video_mkv_mp4',requestKey:req.body.requestKey,inputHash:fingerprint},payment.catalog,payment.policy,payment.config.id);
   res.json({orderId:order.id,state:order.state,checkoutUrl:order.state==='created'&&order.expires>Date.now()?req.baseUrl+'/pay/'+encodeURIComponent(order.id):null});
  }catch{res.status(400).json({error:'주문 설정을 확인해 주세요. 같은 요청으로 다시 확인하고 재결제하지 마세요.'});}
 });
 router.post('/orders',(_req,res)=>{
  const orders=store.db.prepare("SELECT o.id,o.state,o.created,j.state AS jobState FROM nice_orders o LEFT JOIN nice_video_jobs j ON j.order_id=o.id WHERE o.owner=? AND json_extract(o.intent,'$.productId')='video_mkv_mp4' ORDER BY o.created DESC LIMIT 50").all(res.locals.owner);
  res.json({orders});
 });
 router.post('/status',(req,res)=>{
  try{
   const owner=res.locals.owner,order=owned(req.body?.orderId,owner);
   const entitlement=order.state==='verified'&&creditStore.db.prepare('SELECT state FROM nice_entitlements WHERE order_id=? AND owner=?').get(order.id,owner);
   const upload=creditStore.db.prepare("SELECT upload_id,id FROM nice_video_reservations WHERE order_id=? AND owner=? AND state='complete'").get(order.id,owner);
   const job=creditStore.db.prepare('SELECT id,state FROM nice_video_jobs WHERE order_id=? AND owner=?').get(order.id,owner);
   res.json({orderId:order.id,paymentState:order.state,ready:order.state==='verified'&&entitlement?.state==='ready',
    ...(upload?{uploadId:upload.upload_id,reservationId:upload.id}:{}),...(job?{jobId:job.id,jobState:job.state}:{}),
    allowNew:['done','expired'].includes(job?.state)||(order.state==='created'&&order.expires<=Date.now())});
  }catch{res.status(404).json({error:'주문 상태를 확인할 수 없습니다.'});}
 });
 router.use((error,_req,res,_next)=>res.status(error.status===413?413:400).json({error:'요청을 확인해 주세요.'}));
 return router;
}
const script=String.raw`
const $=id=>document.getElementById(id),base=location.pathname.replace(/\/$/,''),parent=base.replace(/\/customer-video$/,'');
const key='nice-video-customer-request';let requestKey=sessionStorage.getItem(key)||crypto.randomUUID(),orderId,uploadId,current,destructive=false;
sessionStorage.setItem(key,requestKey);
const message=text=>$('message').textContent=text;
async function api(path,body){const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'상태를 확인해 주세요.');return data;}
async function check(){const s=await api(base+'/status',{orderId});current=s;uploadId=s.uploadId;
 $('upload').hidden=!s.ready||Boolean(uploadId);$('convert').hidden=!s.ready||!uploadId;
 $('download').hidden=s.jobState!=='done';if(s.jobId)$('download').href=parent+'/video/download/'+encodeURIComponent(s.jobId);
 $('replace').hidden=!(s.ready&&s.jobState==='failed'&&s.reservationId);$('remove').hidden=!['done','expired','deleting'].includes(s.jobState);$('new').hidden=!s.allowNew;message(s.jobState?'변환 상태: '+s.jobState:'결제 상태: '+s.paymentState);
}
$('prepare').onclick=async()=>{if(destructive)return;$('prepare').disabled=true;try{const s=await api(base+'/prepare',{requestKey});orderId=s.orderId;$('pay').hidden=!s.checkoutUrl;if(s.checkoutUrl)$('pay').href=s.checkoutUrl;$('check').hidden=false;await check();}catch(e){message(e.message);}finally{$('prepare').disabled=false;}};
$('check').onclick=()=>{if(!destructive)return check().catch(e=>message(e.message));};
$('send').onclick=async()=>{
 $('send').disabled=true;try{const file=$('file').files[0];if(!file||file.size>1.5*1024**3||!file.size||!/\.(mkv|mov|avi|m4v)$/i.test(file.name))throw Error('지원되는 1.5GB 이하 영상을 선택해 주세요.');
 const body=new FormData();body.append('video',file);
 const r=await fetch(parent+'/video/upload',{method:'POST',credentials:'same-origin',headers:{'X-Manytool-Order':orderId},body});const data=await r.json();if(!r.ok)throw Error(data.error||'업로드 상태를 확인해 주세요.');await check();
 }catch(e){message(e.message+' 기존 주문 상태를 확인해 주세요.');}finally{$('send').disabled=false;}
};
$('convert').onclick=async()=>{$('convert').disabled=true;try{await api(parent+'/video/convert',{orderId,uploadId});await check();}catch(e){message(e.message);}finally{$('convert').disabled=false;}};
async function history(){const {orders}=await api(base+'/orders',{});$('history').replaceChildren();for(const o of orders){const item=document.createElement('option');item.value=o.id;item.textContent=new Date(o.created).toLocaleString()+' · '+(o.jobState||o.state)+' · '+o.id.slice(0,8);$('history').append(item);}}
$('load').onclick=async()=>{if(destructive)return;orderId=$('history').value;if(!orderId)return;$('pay').hidden=true;$('check').hidden=false;try{await check();}catch(e){message(e.message);}};
async function removePath(path){const r=await fetch(parent+path,{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw Error('처리 중이거나 삭제할 수 없습니다. 상태를 다시 확인해 주세요.');}
function busy(value){destructive=value;for(const id of ['prepare','check','load','history','new','send','convert','replace','remove'])$(id).disabled=value;}
$('replace').onclick=async()=>{
 if(destructive||!current?.reservationId)return;const target={...current};
 if(!confirm('업로드한 입력 사본을 삭제하고 같은 결제로 다른 영상을 선택할까요? 원본 기기 파일은 삭제하지 않습니다.'))return;
 busy(true);try{await removePath('/video/upload/'+encodeURIComponent(target.reservationId));$('file').value='';if(orderId===target.orderId)await check();}
 catch(e){message(e.message);}finally{busy(false);}
};
$('remove').onclick=async()=>{
 if(destructive||!current?.jobId)return;const target={...current};
 if(!confirm('이 주문의 입력 사본과 MP4 결과를 영구 삭제할까요? 결과는 복구할 수 없고 결제 이용권이 복원되지 않습니다.'))return;
 busy(true);try{await removePath('/video/job/'+encodeURIComponent(target.jobId));if(target.reservationId)await removePath('/video/upload/'+encodeURIComponent(target.reservationId));if(orderId===target.orderId)await check();await history();}
 catch(e){message(e.message);}finally{busy(false);}
};
history().catch(e=>message(e.message));
$('new').onclick=()=>{sessionStorage.removeItem(key);location.reload();};
`;
