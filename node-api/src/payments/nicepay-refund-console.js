import express from 'express';
import {assertSharedPaymentStorage,isPostgresPaymentStore} from './payment-storage.js';
import {reserveNicepayFullRefund,releaseUnsentNicepayRefund,recoverNicepayRefunds,dispatchNicepayFullRefund,reconcileNicepayFullRefund} from './nicepay-refund.js';
import {runNicepayLocalRecovery} from './nicepay-recovery.js';
// Intentionally no provider client: intake and local recovery cannot dispatch money movement.
export function createNicepayRefundConsole({enabled=false,store,creditStore,authenticate,origin,operators=[],refundOperations}={}){
 const router=express.Router();
 if(!enabled){router.use((_q,r)=>r.status(503).json({error:'Refund staging disabled'}));return router;}
 if(new URL(origin).origin!==origin||new URL(origin).protocol!=='https:')throw Error('Exact HTTPS origin required');
 assertSharedPaymentStorage(store,creditStore);
 const postgres=isPostgresPaymentStore(store);
 // Initialize only; do not age/recover any rows while assembling routes.
 if(!postgres)recoverNicepayRefunds(creditStore,0);
 router.use(async(req,res,next)=>{res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff');try{res.locals.owner=await authenticate(req);if(!res.locals.owner)throw Error();next();}catch{res.status(401).json({error:'Login required'});}});
 router.use((req,res,next)=>{if(req.method!=='GET'&&req.headers.origin!==origin)return res.status(403).json({error:'Origin rejected'});next();});
 router.use(express.json({limit:'2kb'}));
 const rows=owner=>postgres?creditStore.refundOrders(owner):creditStore.db.prepare(`SELECT o.id,o.intent,o.state AS order_state,r.cancel_id,r.state AS refund_state FROM nice_orders o LEFT JOIN nice_refunds r ON r.order_id=o.id WHERE o.owner=? AND o.state IN ('verified','refunded') ORDER BY o.created DESC LIMIT 100`).all(owner).map(r=>({orderId:r.id,amount:JSON.parse(r.intent).amount,category:JSON.parse(r.intent).category,orderState:r.order_state,cancelId:r.cancel_id??null,refundState:r.refund_state??null}));
 router.post('/orders',async(req,res,next)=>{try{res.json({orders:await rows(res.locals.owner)});}catch(error){next(error);}});
 for(const action of ['reserve','withdraw'])router.post('/'+action,async(req,res)=>{try{
  const {orderId,cancelId}=req.body??{};if(typeof orderId!=='string'||orderId.length>100||!(cancelId===null||typeof cancelId==='string'&&cancelId.length<=100))throw Error();
  await store.owned(orderId,res.locals.owner);
  if(action==='reserve')await reserveNicepayFullRefund(creditStore,orderId,res.locals.owner,cancelId);
  else {if(!cancelId)throw Error();await releaseUnsentNicepayRefund(creditStore,orderId,res.locals.owner,cancelId);}
  res.json({orders:await rows(res.locals.owner)});
 }catch{res.status(409).json({error:'접수 상태가 바뀌었거나 미사용 전액 환불 대상이 아닙니다. 목록을 새로 확인하세요.'});}});
 // Explicitly injected merchant transport only. Default assembly never supplies it.
 router.post('/operations/queue',async(req,res,next)=>{
  if(!operators.includes(res.locals.owner))return res.status(403).json({error:'Operator required'});
  try{res.json({refunds:postgres?await creditStore.refundQueue():creditStore.db.prepare("SELECT order_id,cancel_id,amount,category,state,updated FROM nice_refunds WHERE state IN ('reserved','sending','uncertain') ORDER BY updated LIMIT 100").all()});}catch(error){next(error);}
 });
 router.post('/operations/dispatch',async(req,res)=>{
  if(!operators.includes(res.locals.owner))return res.status(403).json({error:'Operator required'});
  if(refundOperations?.enabled!==true||typeof refundOperations.client?.fullCancel!=='function')return res.status(503).json({error:'Refund transport disabled'});
  try{
   const {orderId,cancelId,amount,confirmed}=req.body??{};
   const order=await store.get(orderId),row=postgres?await creditStore.refundRecord(orderId):creditStore.db.prepare('SELECT * FROM nice_refunds WHERE order_id=?').get(orderId);
   if(confirmed!==true||!row||row.state!=='reserved'||row.cancel_id!==cancelId||row.amount!==amount||order?.merchantId!==refundOperations.config?.id)throw Error('Attempt confirmation mismatch');
   const timestamp=new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14);
   await dispatchNicepayFullRefund({wallet:creditStore,store,orderId,client:refundOperations.client,timestamp,expectedCancelId:cancelId,expectedAmount:amount});
   res.json({state:'cancelled'});
  }catch{res.status(409).json({error:'Inspect refund state before any further action; dispatch is never automatically retried'});}
 });
 router.post('/operations/reconcile',async(req,res)=>{
  if(!operators.includes(res.locals.owner))return res.status(403).json({error:'Operator required'});
  if(refundOperations?.enabled!==true||!refundOperations.config)return res.status(503).json({error:'Refund reconciliation disabled'});
  try{
   const order=await store.get(req.body?.orderId);if(order?.merchantId!==refundOperations.config.id)throw Error();
   await reconcileNicepayFullRefund({wallet:creditStore,store,orderId:order.id,body:req.body.receipt,config:refundOperations.config});
   res.json({state:'cancelled'});
  }catch{res.status(409).json({error:'Verified matching full-cancel receipt required'});}
 });
 router.post('/operations/recover',async(req,res)=>{
  if(!operators.includes(res.locals.owner))return res.status(403).json({error:'Operator required'});
  try{res.json(postgres?await creditStore.recover():runNicepayLocalRecovery({wallet:creditStore,store}));}catch{res.status(409).json({error:'Recovery requires investigation'});}
 });
 router.get('/',(req,res,next)=>{if(!req.originalUrl.split('?')[0].endsWith('/'))return res.redirect(303,req.baseUrl+'/');next();});
 router.get('/',(_req,res)=>res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'").type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>환불 접수</title><h1>미사용 전액 환불 접수</h1><p>접수하면 해당 크레딧·이용권이 보류됩니다. 카드 취소 완료를 뜻하지 않습니다. 사용한 상품·부분 환불은 별도 문의가 필요합니다. 처리 전에는 접수를 철회할 수 있습니다.</p><button id="refresh">목록 확인</button><p id="message"></p><div id="orders"></div><script src="./client.js"></script></html>`));
 router.get('/client.js',(_req,res)=>res.type('js').send(client));
 router.use((_error,_req,res,_next)=>res.status(503).json({error:'Refund storage temporarily unavailable'}));
 return router;
}
const client=`const $=id=>document.getElementById(id);let busy=false;async function call(action,body={}){const r=await fetch('./'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'실패');return data;}async function load(){if(busy)return;busy=true;try{render((await call('orders')).orders);$('message').textContent='접수는 카드 취소 완료가 아닙니다.';}catch(e){$('message').textContent=e.message;}finally{busy=false;}}function render(rows){$('orders').replaceChildren();for(const row of rows){const p=document.createElement('p');p.textContent=row.orderId+' / '+row.amount+'원 / '+(row.refundState||'미접수');for(const action of row.refundState==='reserved'?['withdraw']:(!row.refundState||row.refundState==='released')&&row.orderState==='verified'?['reserve']:[]){const b=document.createElement('button');b.textContent=action==='reserve'?'환불 접수':'접수 철회';b.onclick=async()=>{if(busy)return;const target={orderId:row.orderId,cancelId:row.cancelId};if(!confirm(action==='reserve'?'미사용 크레딧·이용권을 보류하고 환불을 접수할까요?':'아직 전송하지 않은 환불 접수를 철회할까요?'))return;busy=true;try{render((await call(action,target)).orders);$('message').textContent='접수 상태가 반영되었습니다.';}catch(e){$('message').textContent=e.message+' 목록 확인 후 다시 선택하세요.';}finally{busy=false;}};p.append(b);}$('orders').append(p);}}$('refresh').onclick=load;load();`;
