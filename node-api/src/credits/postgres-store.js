import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {PostgresPaymentLedger,changePostgresCredits as change} from '../payments/postgres-ledger.js';
import {calculateRefund,REFUND_POLICY_VERSION} from './refunds.js';

const one=async(c,sql,args=[])=>(await c.query(sql,args)).rows[0];
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const getOrder=async(c,id)=>{const row=await one(c,'SELECT data FROM purchases WHERE id=$1',[id]);return row?JSON.parse(row.data):null;};
async function restoreRow(c,row){
  await change(c,'restore:'+row.id,row.email,row.credits,'실패 복구');
  const order={...JSON.parse(row.data),status:'refunded',refundStatus:'succeeded',refundedAt:new Date().toISOString()};
  await c.query("UPDATE purchases SET state='refunded',data=$1 WHERE id=$2",[JSON.stringify(order),row.id]);
}
async function quote(c,email,id){
  const row=await one(c,'SELECT * FROM topups WHERE id=$1',[id]);
  if(!row||row.email!==email)fail('충전 주문을 찾을 수 없습니다.',404);
  if(row.currency==='play')fail('Google Play 구매 환불은 Google Play 절차를 이용해주세요.');
  if(row.id.startsWith('nicepay:'))fail('NICEPAY 전용 환불 접수 경로를 이용해주세요.');
  if(row.status!=='paid'||row.refunded)fail('이미 환불되었거나 결제 확인 전인 주문입니다.');
  if(await one(c,'SELECT 1 FROM refund_requests WHERE topup_id=$1',[id]))fail('이미 환불을 접수한 주문입니다.');
  const terms=await one(c,'SELECT * FROM topup_terms WHERE topup_id=$1',[id]);
  if(terms?.policy!==REFUND_POLICY_VERSION)fail('구매 당시 환불 조건을 고객센터에서 확인해야 합니다.');
  if(await one(c,"SELECT 1 FROM purchases p WHERE email=$1 AND state!='refunded' AND NOT EXISTS(SELECT 1 FROM allocations a WHERE a.purchase_id=p.id)",[email]))fail('이전 사용 내역을 고객센터에서 확인해야 합니다.');
  if(await one(c,"SELECT 1 FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=$1 AND p.state IN ('ready','processing')",[id]))fail('미사용 주문을 취소하거나 진행 중인 작업이 끝난 후 환불을 신청해주세요.');
  const used=await one(c,"SELECT COALESCE(SUM(a.credits),0)::bigint AS amount FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=$1 AND p.state='done'",[id]);
  return {topupId:id,...calculateRefund({paidAmount:row.amount,totalCredits:row.credits,usedCredits:used.amount,unitKrw:terms.unit_krw})};
}

// Wallet facade is separate from NICE order store: claim(id) claims a tool
// purchase here, whereas PostgresPaymentLedger.claim(id,tid) claims PG approval.
export class PostgresCreditStore extends PostgresPaymentLedger {
  logout(raw){return this.tx(c=>c.query('DELETE FROM tokens WHERE hash=$1',[createHash('sha256').update(String(raw)).digest('hex')]));}
  history(email){return this.read(async c=>(await c.query('SELECT delta,kind,created FROM ledger WHERE email=$1 ORDER BY created DESC,position DESC LIMIT 50',[email])).rows);}
  order(id){return this.read(c=>getOrder(c,id));}
  allOrders(){return this.read(async c=>(await c.query('SELECT data FROM purchases')).rows.map(row=>JSON.parse(row.data)));}
  state(id){return this.read(async c=>(await one(c,'SELECT state FROM purchases WHERE id=$1',[id]))?.state);}
  saveOrder(order){return this.tx(async c=>{
    const row=await one(c,'SELECT state,data FROM purchases WHERE id=$1',[order.id]);if(!row||(row.state==='refunded'&&order.status!=='refunded'))return;
    const current=JSON.parse(row.data);if(current.namePremiumLock)order={...order,namePremiumLock:current.namePremiumLock,namePremiumLockedAt:current.namePremiumLockedAt};
    await c.query('UPDATE purchases SET data=$1 WHERE id=$2',[JSON.stringify(order),order.id]);
  });}
  lockNameInput(id,input){return this.tx(async c=>{
    const order=await getOrder(c,id);if(!order||order.productType!=='ai_name_premium'||order.status!=='paid')fail('Paid name order required');
    if(order.namePremiumLock&&!isDeepStrictEqual(order.namePremiumLock,input))fail('name premium input changed');
    if(!order.namePremiumLock){order.namePremiumLock=input;order.namePremiumLockedAt=new Date().toISOString();await c.query('UPDATE purchases SET data=$1 WHERE id=$2',[JSON.stringify(order),id]);}return order;
  });}
  claim(id){return this.tx(async c=>{const result=await c.query("UPDATE purchases SET state='processing' WHERE id=$1 AND state='ready'",[id]);if(result.rowCount!==1)fail('이미 사용했거나 처리 중인 크레딧 주문입니다.');});}
  finish(id,success){return this.tx(async c=>{const row=await one(c,'SELECT * FROM purchases WHERE id=$1',[id]);if(!row||row.state!=='processing')return;if(success)await c.query("UPDATE purchases SET state='done' WHERE id=$1",[id]);else await restoreRow(c,row);});}
  restore(id){return this.tx(async c=>{const row=await one(c,'SELECT * FROM purchases WHERE id=$1',[id]);if(!row||['done','refunded'].includes(row.state))return;await restoreRow(c,row);});}
  cancel(email,id){return this.tx(async c=>{const row=await one(c,'SELECT * FROM purchases WHERE id=$1 AND email=$2',[id,email]);if(!row||row.state!=='ready')fail('아직 사용하지 않은 주문만 취소할 수 있습니다.');await restoreRow(c,row);});}
  pending(email){return this.read(async c=>(await c.query("SELECT id,credits,data FROM purchases WHERE email=$1 AND state='ready'",[email])).rows.map(r=>({id:r.id,credits:r.credits,productType:JSON.parse(r.data).productType})));}
  lots(email){return this.read(async c=>(await c.query(`SELECT t.*,COALESCE((SELECT SUM(a.credits) FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=t.id AND p.state!='refunded'),0)::bigint AS allocated,EXISTS(SELECT 1 FROM refund_requests r WHERE r.topup_id=t.id) AS locked FROM topups t WHERE t.email=$1 ORDER BY position`,[email])).rows.map(row=>({...row,available:['paid','refunded'].includes(row.status)&&!row.locked?Math.max(0,row.credits-row.refunded-row.allocated):0})));}
  createTopup(email,pack,product){return this.tx(async c=>{const id=randomUUID();await c.query('INSERT INTO topups(id,email,credits,amount,currency,product) VALUES($1,$2,$3,$4,$5,$6)',[id,email,pack.credits,pack.amount,pack.currency.toLowerCase(),product]);await c.query('INSERT INTO topup_terms VALUES($1,$2,$3)',[id,1000,REFUND_POLICY_VERSION]);return one(c,'SELECT * FROM topups WHERE id=$1',[id]);});}
  checkout(id,checkout,url){return this.tx(c=>c.query('UPDATE topups SET checkout=$1,url=$2 WHERE id=$3',[checkout,url,id]));}
  applyPayment(event){return this.tx(async c=>{
    const data=event.data,id=data?.metadata?.credit_topup_id;
    const row=await one(c,'SELECT * FROM topups WHERE id=$1',[id??'']);
    if(!row)fail('Unknown credit top-up',404);
    if(row.id.startsWith('nicepay:')||row.currency==='play')fail('Wrong payment provider',400);
    if(!['order.paid','order.refunded'].includes(event.type))return;
    if(!data.id||data.product_id!==row.product||data.currency!==row.currency||data.net_amount!==row.amount||(data.discount_amount??0)!==0||(row.checkout&&data.checkout_id!==row.checkout)||!data.checkout_id||(row.provider_order&&row.provider_order!==data.id))fail('Credit payment mismatch',400);
    if(event.type==='order.paid'&&data.paid!==true)fail('Payment not settled',400);
    await c.query('UPDATE topups SET provider_order=$1,checkout=$2 WHERE id=$3',[data.id,data.checkout_id,row.id]);
    if(event.type==='order.paid'){
      if(row.status==='refunded')return;
      await change(c,'topup:'+id,row.email,row.credits,'충전');await c.query("UPDATE topups SET status='paid' WHERE id=$1",[id]);return;
    }
    if(!Number.isSafeInteger(data.refunded_amount)||data.refunded_amount<0)fail('Invalid refund',400);
    const request=await one(c,'SELECT * FROM refund_requests WHERE topup_id=$1',[id]);
    if(request){
      await c.query('INSERT INTO refund_receipts VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,data.refunded_amount,JSON.stringify(data)]);
      if(request.status==='completed'&&data.refunded_amount<=request.amount)return;
      if(data.refunded_amount!==request.amount){await c.query("UPDATE refund_requests SET status='review' WHERE id=$1",[request.id]);return;}
      if(request.status==='review')return;
      await c.query("UPDATE refund_requests SET status='completed' WHERE id=$1",[request.id]);await c.query("UPDATE topups SET status='refunded',refunded=$1 WHERE id=$2",[request.credits,id]);return;
    }
    const reversed=Math.min(row.credits,Math.ceil(row.credits*data.refunded_amount/row.amount)),delta=reversed-row.refunded;
    if(delta<=0)return;
    await change(c,'topup:'+id,row.email,row.credits,'충전');await change(c,`refund:${id}:${reversed}`,row.email,-delta,'충전 환불 회수');await c.query("UPDATE topups SET status='refunded',refunded=$1 WHERE id=$2",[reversed,id]);
  });}
  refundQuote(email,id){return this.read(c=>quote(c,email,id));}
  requestRefund(email,id,expected){return this.tx(async c=>{
    const prior=await one(c,'SELECT * FROM refund_requests WHERE topup_id=$1 AND email=$2',[id,email]);if(prior)return {id:prior.id,status:prior.status,...JSON.parse(prior.quote)};
    const result=await quote(c,email,id);
    if(result.refundAmount!==expected.refundAmount||result.usedCredits!==expected.usedCredits||expected.policyVersion!==result.policyVersion)fail('사용 내역이 변경되었습니다. 환불 예상액을 다시 확인해주세요.');
    if(!result.remainingCredits||!result.refundAmount)fail('자동 접수 가능한 환불 잔액이 없습니다.');
    const wallet=await one(c,'SELECT balance FROM wallets WHERE email=$1',[email]);if((wallet?.balance??0)<result.remainingCredits)fail('잔액 확인이 필요합니다.');
    const requestId=randomUUID();await change(c,'refund-hold:'+id,email,-result.remainingCredits,'충전 환불 대기');
    await c.query('INSERT INTO refund_requests VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[requestId,id,email,result.remainingCredits,result.refundAmount,JSON.stringify(result),'requested',Date.now()]);return {id:requestId,status:'requested',...result};
  });}
  topupHistory(email){return this.read(async c=>(await c.query(`SELECT t.id,t.credits,t.amount,t.currency,t.status,r.status AS "refundStatus",r.amount AS "refundAmount" FROM topups t LEFT JOIN refund_requests r ON r.topup_id=t.id WHERE t.email=$1 AND t.status!='pending' ORDER BY t.position DESC LIMIT 50`,[email])).rows.map(row=>({...row,provider:row.id.startsWith('nicepay:')?'nicepay':row.currency==='play'?'google_play':'polar',amount:row.currency==='play'?null:row.amount})));}
  initPlayStore(){} // Tables belong to the explicit schema migration, not request-time DDL.
  playReceipt(tokenHash){return this.read(c=>one(c,'SELECT * FROM play_receipts WHERE token_hash=$1',[tokenHash]));}
  isPlayVoided(tokenHash,packageName){return this.read(async c=>{const row=await one(c,'SELECT package FROM play_voids WHERE token_hash=$1',[tokenHash]);if(row&&row.package!==packageName)fail('Play package mismatch');return Boolean(row);});}
  applyPlayPurchase({tokenHash,email,productId,packageName,credits,orderId,sealedToken}){return this.tx(async c=>{
    if(await one(c,'SELECT 1 FROM play_voids WHERE token_hash=$1',[tokenHash]))fail('Play purchase was voided');
    const prior=await one(c,'SELECT * FROM play_receipts WHERE token_hash=$1',[tokenHash]);if(prior){if(prior.email!==email||prior.product!==productId||prior.package!==packageName)fail('Play purchase binding mismatch');return;}
    if(!sealedToken)fail('Durable Play recovery unavailable',503);if(!Number.isSafeInteger(credits)||credits<=0)fail('Invalid Play credits',400);
    await c.query('INSERT INTO play_jobs(token_hash,sealed_token) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET sealed_token=excluded.sealed_token',[tokenHash,sealedToken]);
    await c.query('INSERT INTO play_receipts(token_hash,email,product,package,credits,order_id,created) VALUES($1,$2,$3,$4,$5,$6,$7)',[tokenHash,email,productId,packageName,credits,orderId,Date.now()]);
    const id='play:'+tokenHash;await c.query("INSERT INTO topups(id,email,credits,amount,currency,product,provider_order,status) VALUES($1,$2,$3,0,'play',$4,$5,'paid')",[id,email,credits,productId,orderId?'google-play:'+orderId:null]);await change(c,'topup:'+id,email,credits,'Google Play 충전');
  });}
  queuePlayConsume(tokenHash,sealedToken){return this.tx(c=>c.query('INSERT INTO play_jobs(token_hash,sealed_token) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET sealed_token=excluded.sealed_token',[tokenHash,sealedToken]));}
  markPlayConsumed(tokenHash){return this.tx(async c=>{await c.query('UPDATE play_receipts SET consumed=1 WHERE token_hash=$1',[tokenHash]);await c.query('DELETE FROM play_jobs WHERE token_hash=$1',[tokenHash]);});}
  pendingPlayConsumes(now,limit=100){return this.read(async c=>(await c.query('SELECT j.*,r.email,r.product,r.package FROM play_jobs j JOIN play_receipts r USING(token_hash) WHERE j.next_attempt<=$1 ORDER BY j.next_attempt LIMIT $2',[now,limit])).rows);}
  retryPlayConsume(tokenHash,now){return this.tx(c=>c.query('UPDATE play_jobs SET attempts=attempts+1,next_attempt=$1+LEAST(3600000,60000*(1::bigint << LEAST(attempts,6)::int)) WHERE token_hash=$2',[now,tokenHash]));}
  voidPlayPurchase(tokenHash,packageName,now=Date.now()){return this.tx(async c=>{
    const receipt=await one(c,'SELECT * FROM play_receipts WHERE token_hash=$1',[tokenHash]);if(receipt&&receipt.package!==packageName)fail('Play package mismatch');
    const prior=await one(c,'SELECT package FROM play_voids WHERE token_hash=$1',[tokenHash]);if(prior&&prior.package!==packageName)fail('Play package mismatch');
    await c.query('INSERT INTO play_voids VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[tokenHash,packageName,now]);
    if(receipt){await change(c,'play-void:'+tokenHash,receipt.email,-receipt.credits,'Google Play 환불 회수');await c.query("UPDATE topups SET status='refunded',refunded=credits WHERE id=$1",['play:'+tokenHash]);}
    await c.query('DELETE FROM play_jobs WHERE token_hash=$1',[tokenHash]);
  });}
  oldestPlayReceipt(packageName){return this.read(async c=>(await one(c,'SELECT MIN(created) AS created FROM play_receipts WHERE package=$1',[packageName]))?.created??0);}
  playSyncTime(packageName){return this.read(async c=>(await one(c,'SELECT completed FROM play_sync WHERE package=$1',[packageName]))?.completed??0);}
  markPlaySynced(packageName,now){return this.tx(c=>c.query('INSERT INTO play_sync VALUES($1,$2) ON CONFLICT(package) DO UPDATE SET completed=excluded.completed',[packageName,now]));}
}
