import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {withPaymentTransaction} from './postgres.js';
import {prepareNicepayIntent} from './nicepay-policy.js';

// Async PostgreSQL persistence. Deliberately not mounted in server.js until all
// callers and production data have been migrated. Provider I/O stays outside tx.
export const PAYMENT_TABLES = `
CREATE TABLE wallets(email text PRIMARY KEY,balance bigint NOT NULL DEFAULT 0);
CREATE TABLE tokens(hash text PRIMARY KEY,email text NOT NULL,kind text NOT NULL,expires bigint NOT NULL);
CREATE TABLE limits(key text PRIMARY KEY,count bigint NOT NULL,expires bigint NOT NULL);
CREATE TABLE ledger(id text PRIMARY KEY,email text NOT NULL,delta bigint NOT NULL,kind text NOT NULL,created bigint NOT NULL,position bigint GENERATED ALWAYS AS IDENTITY);
CREATE TABLE topups(id text PRIMARY KEY,email text NOT NULL,credits bigint NOT NULL,amount bigint NOT NULL,currency text NOT NULL,product text NOT NULL,checkout text,provider_order text UNIQUE,status text NOT NULL DEFAULT 'pending',refunded bigint NOT NULL DEFAULT 0,url text,position bigint GENERATED ALWAYS AS IDENTITY);
CREATE TABLE topup_terms(topup_id text PRIMARY KEY,unit_krw bigint NOT NULL,policy text NOT NULL);
CREATE TABLE purchases(id text PRIMARY KEY,email text NOT NULL,request_key text NOT NULL,fingerprint text NOT NULL,credits bigint NOT NULL,state text NOT NULL DEFAULT 'ready',data text NOT NULL,UNIQUE(email,request_key));
CREATE TABLE allocations(purchase_id text NOT NULL,topup_id text NOT NULL,credits bigint NOT NULL,PRIMARY KEY(purchase_id,topup_id));
CREATE TABLE refund_requests(id text PRIMARY KEY,topup_id text UNIQUE NOT NULL,email text NOT NULL,credits bigint NOT NULL,amount bigint NOT NULL,quote text NOT NULL,status text NOT NULL,created bigint NOT NULL);
CREATE TABLE refund_receipts(topup_id text NOT NULL,amount bigint NOT NULL,payload text NOT NULL,PRIMARY KEY(topup_id,amount));
CREATE TABLE play_jobs(token_hash text PRIMARY KEY,sealed_token text NOT NULL,attempts bigint NOT NULL DEFAULT 0,next_attempt bigint NOT NULL DEFAULT 0);
CREATE TABLE play_voids(token_hash text PRIMARY KEY,package text NOT NULL,created bigint NOT NULL);
CREATE TABLE play_sync(package text PRIMARY KEY,completed bigint NOT NULL);
CREATE TABLE play_receipts(token_hash text PRIMARY KEY,email text NOT NULL,product text NOT NULL,package text NOT NULL,credits bigint NOT NULL,order_id text UNIQUE,consumed bigint NOT NULL DEFAULT 0,created bigint NOT NULL);
CREATE TABLE nice_orders(id text PRIMARY KEY,owner text NOT NULL,intent text NOT NULL,state text NOT NULL,tid text UNIQUE,created bigint NOT NULL,expires bigint NOT NULL,updated bigint NOT NULL);
CREATE TABLE nice_receipts(order_id text PRIMARY KEY,tid text UNIQUE NOT NULL,amount bigint NOT NULL,created bigint NOT NULL);
CREATE TABLE nice_checkout_keys(owner text NOT NULL,request_key text NOT NULL,order_id text NOT NULL,fingerprint text NOT NULL,PRIMARY KEY(owner,request_key));
CREATE TABLE nice_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id text NOT NULL,state text NOT NULL,created bigint NOT NULL);
CREATE TABLE nice_fulfillments(order_id text PRIMARY KEY,category text NOT NULL,created bigint NOT NULL);
CREATE TABLE nice_entitlements(order_id text PRIMARY KEY,owner text NOT NULL,product text NOT NULL,state text NOT NULL);
CREATE TABLE nice_tool_jobs(order_id text PRIMARY KEY,state text NOT NULL,attempts bigint NOT NULL,result text,updated bigint NOT NULL);
CREATE TABLE nice_customer_orders(order_id text PRIMARY KEY,owner text NOT NULL,input_hash text NOT NULL);
CREATE TABLE nice_refunds(order_id text PRIMARY KEY,cancel_id text UNIQUE NOT NULL,owner text NOT NULL,category text NOT NULL,credits bigint NOT NULL,amount bigint NOT NULL,state text NOT NULL,updated bigint NOT NULL);
CREATE TABLE nice_refund_history(cancel_id text PRIMARY KEY,order_id text NOT NULL,snapshot text NOT NULL);
`;
const one=async(c,sql,args=[]) => (await c.query(sql,args)).rows[0];
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const orderFrom=row=>row?{...JSON.parse(row.intent),id:row.id,state:row.state,tid:row.tid,created:row.created,expires:row.expires}:null;
const getOrder=async(c,id)=>orderFrom(await one(c,'SELECT * FROM nice_orders WHERE id=$1',[id]));
const balance=async(c,email)=>(await one(c,'SELECT balance FROM wallets WHERE email=$1',[email]))?.balance??0;
async function change(c,id,email,delta,kind){
  if(!Number.isSafeInteger(delta))fail('Invalid credit amount');
  const inserted=await c.query('INSERT INTO ledger(id,email,delta,kind,created) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id',[id,email,delta,kind,Date.now()]);
  if(!inserted.rowCount)return false;
  await c.query('INSERT INTO wallets VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET balance=wallets.balance+excluded.balance',[email,delta]);
  if(!Number.isSafeInteger(await balance(c,email)))fail('Wallet outside safe range');
  return true;
}
async function event(c,id,state){await c.query('INSERT INTO nice_events(order_id,state,created) VALUES($1,$2,$3)',[id,state,Date.now()]);}

export class PostgresPaymentLedger {
  constructor(pool){this.pool=pool;}
  tx(fn){return withPaymentTransaction(this.pool,fn);}
  read(fn){return withPaymentTransaction(this.pool,fn,{readOnly:true});}
  get(id){return this.read(c=>getOrder(c,id));}
  balance(email){return this.read(c=>balance(c,email));}
  token(email,kind,ttl){return this.tx(async c=>{const raw=randomBytes(32).toString('hex');await c.query('DELETE FROM tokens WHERE expires<$1',[Date.now()]);await c.query('INSERT INTO tokens VALUES($1,$2,$3,$4)',[createHash('sha256').update(raw).digest('hex'),email,kind,Date.now()+ttl]);return raw;});}
  authenticate(raw,kind='session',consume=false){return this.tx(async c=>{const hash=createHash('sha256').update(String(raw)).digest('hex');const row=await one(c,'SELECT * FROM tokens WHERE hash=$1 AND kind=$2 AND expires>$3',[hash,kind,Date.now()]);if(!row)fail('이메일 로그인이 필요합니다.',401);if(consume)await c.query('DELETE FROM tokens WHERE hash=$1',[hash]);return row.email;});}
  rateLimit(key,maximum,duration){return this.tx(async c=>{const now=Date.now();await c.query('DELETE FROM limits WHERE expires<$1',[now]);const row=await one(c,'SELECT count FROM limits WHERE key=$1',[key]);if(row?.count>=maximum)fail('잠시 후 다시 시도해주세요.',429);await c.query('INSERT INTO limits VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=limits.count+1',[key,now+duration]);});}
  topup(id){return this.read(c=>one(c,'SELECT * FROM topups WHERE id=$1',[id]));}
  creditOrders(owner,merchant){return this.read(async c=>(await c.query("SELECT * FROM nice_orders WHERE owner=$1 AND intent::jsonb->>'category'='credit_topup' AND intent::jsonb->>'merchantId'=$2 ORDER BY created DESC LIMIT 30",[owner,merchant])).rows.map(orderFrom));}
  refundRecord(id){return this.read(c=>one(c,'SELECT * FROM nice_refunds WHERE order_id=$1',[id]));}
  refundOrders(owner){return this.read(async c=>(await c.query("SELECT o.id,o.intent,o.state AS order_state,r.cancel_id,r.state AS refund_state FROM nice_orders o LEFT JOIN nice_refunds r ON r.order_id=o.id WHERE o.owner=$1 AND o.state IN ('verified','refunded') ORDER BY o.created DESC LIMIT 100",[owner])).rows.map(r=>({orderId:r.id,amount:JSON.parse(r.intent).amount,category:JSON.parse(r.intent).category,orderState:r.order_state,cancelId:r.cancel_id??null,refundState:r.refund_state??null})));}
  refundQueue(){return this.read(async c=>(await c.query("SELECT order_id,cancel_id,amount,category,state,updated FROM nice_refunds WHERE state IN ('reserved','sending','uncertain') ORDER BY updated LIMIT 100")).rows);}
  async recover(now=Date.now()){
    const staleApprovals=await this.tx(async c=>{const changed=await c.query("UPDATE nice_orders SET state='uncertain',updated=$1 WHERE state='approving' AND updated<=$2 RETURNING id",[now,now-60000]);for(const row of changed.rows)await event(c,row.id,'uncertain');return changed.rowCount;});
    const pending=await this.read(async c=>(await c.query("SELECT o.id FROM nice_orders o LEFT JOIN nice_fulfillments f ON f.order_id=o.id WHERE o.state='verified' AND f.order_id IS NULL")).rows);
    const fulfillments=[];
    for(const row of pending){try{fulfillments.push({orderId:row.id,fulfilled:await this.fulfill(row.id)});}catch{fulfillments.push({orderId:row.id,fulfilled:false,requiresReview:true});}}
    const refunds=await this.tx(async c=>{await c.query("UPDATE nice_refunds SET state='uncertain',updated=$1 WHERE state='sending' AND updated<$2",[now,now-60000]);return (await c.query("SELECT order_id,cancel_id,state FROM nice_refunds WHERE state='uncertain'")).rows;});
    return {staleApprovals,fulfillments,refunds,tools:[]};
  }
  async owned(id,owner){const order=await this.get(id);if(!order||order.ownerId!==owner)fail('Owned order required');return order;}
  create(request,catalog,policy,merchantId,now=Date.now()){
    if(typeof merchantId!=='string'||!/^[a-zA-Z0-9]{10}$/.test(merchantId))fail('Invalid merchant');
    const intent={...prepareNicepayIntent(request,catalog,policy),merchantId};
    const key=request.requestKey;
    if(key!==undefined&&(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key)||typeof request.inputHash!=='string'||!/^[a-f0-9]{64}$/.test(request.inputHash)))fail('Invalid checkout key');
    const fingerprint=createHash('sha256').update(JSON.stringify([intent,request.inputHash??null])).digest('hex');
    return this.tx(async c=>{
      if(key!==undefined){const prior=await one(c,'SELECT * FROM nice_checkout_keys WHERE owner=$1 AND request_key=$2',[intent.ownerId,key]);if(prior){if(prior.fingerprint!==fingerprint)fail('Checkout fingerprint mismatch');return getOrder(c,prior.order_id);}}
      const id=randomUUID();
      await c.query('INSERT INTO nice_orders VALUES($1,$2,$3,$4,NULL,$5,$6,$5)',[id,intent.ownerId,JSON.stringify(intent),'created',now,now+900000]);
      if(key!==undefined)await c.query('INSERT INTO nice_checkout_keys VALUES($1,$2,$3,$4)',[intent.ownerId,key,id,fingerprint]);
      await event(c,id,'created');return getOrder(c,id);
    });
  }
  claim(id,tid,now=Date.now()){
    if(typeof tid!=='string'||!/^[a-zA-Z0-9]{30}$/.test(tid))fail('Invalid transaction');
    return this.tx(async c=>{const r=await c.query("UPDATE nice_orders SET state='approving',tid=$1,updated=$2 WHERE id=$3 AND state='created' AND expires>$2",[tid,now,id]);if(r.rowCount!==1)fail('Order already claimed or expired');await event(c,id,'approving');return getOrder(c,id);});
  }
  markUncertain(id){return this.tx(async c=>{const r=await c.query("UPDATE nice_orders SET state='uncertain',updated=$1 WHERE id=$2 AND state='approving'",[Date.now(),id]);if(r.rowCount)await event(c,id,'uncertain');});}
  recordVerified(receipt){return this.tx(async c=>{
    const order=await getOrder(c,receipt.orderId);
    if(!order||receipt.verified!==true||receipt.tid!==order.tid||receipt.amount!==order.amount||receipt.currency!=='KRW')fail('Payment receipt mismatch');
    if(order.state==='verified')return false;
    if(!['approving','uncertain'].includes(order.state))fail('Invalid payment state');
    await c.query('INSERT INTO nice_receipts VALUES($1,$2,$3,$4)',[order.id,order.tid,order.amount,Date.now()]);
    await c.query("UPDATE nice_orders SET state='verified',updated=$1 WHERE id=$2",[Date.now(),order.id]);await event(c,order.id,'verified');return true;
  });}
  fulfill(orderId){return this.tx(async c=>{
    const row=await one(c,"SELECT o.*,r.amount AS receipt_amount,r.tid AS receipt_tid FROM nice_orders o JOIN nice_receipts r ON r.order_id=o.id WHERE o.id=$1 AND o.state='verified'",[orderId]);
    if(!row)fail('Verified receipt required');
    const intent=JSON.parse(row.intent);
    if(row.owner!==intent.ownerId||row.tid!==row.receipt_tid||intent.amount!==row.receipt_amount)fail('Fulfillment mismatch');
    if(await one(c,'SELECT 1 FROM nice_fulfillments WHERE order_id=$1',[orderId]))return false;
    if(intent.category==='credit_topup'){
      if(!Number.isSafeInteger(intent.credits)||intent.credits<=0||intent.amount!==intent.credits*1000||intent.unitKrw!==1000||typeof intent.refundPolicyVersion!=='string'||!intent.refundPolicyVersion)fail('Credit pack mismatch');
      const id='nicepay:'+orderId;
      await c.query("INSERT INTO topups(id,email,credits,amount,currency,product,provider_order,status) VALUES($1,$2,$3,$4,'krw',$5,$6,'paid')",[id,row.owner,intent.credits,intent.amount,intent.productId,'nicepay:'+row.tid]);
      await c.query('INSERT INTO topup_terms VALUES($1,$2,$3)',[id,intent.unitKrw,intent.refundPolicyVersion]);
      await change(c,'topup:'+id,row.owner,intent.credits,'NICEPAY 충전');
    }else if(intent.category==='direct')await c.query("INSERT INTO nice_entitlements VALUES($1,$2,$3,'ready')",[orderId,row.owner,intent.productId]);
    else if(intent.category!=='donation')fail('Unknown category');
    await c.query('INSERT INTO nice_fulfillments VALUES($1,$2,$3)',[orderId,intent.category,Date.now()]);return true;
  });}
  purchase(email,key,fingerprint,credits,order){
    if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key)||!Number.isSafeInteger(credits)||credits<=0)fail('Invalid debit',400);
    return this.tx(async c=>{
      const prior=await one(c,'SELECT * FROM purchases WHERE email=$1 AND request_key=$2',[email,key]);
      if(prior){if(prior.fingerprint!==fingerprint)fail('Purchase fingerprint mismatch');return JSON.parse(prior.data);}
      if(await one(c,"SELECT 1 FROM refund_requests WHERE email=$1 AND status='review'",[email]))fail('Refund requires review');
      if(await balance(c,email)<credits)fail('크레딧 잔액이 부족합니다.',402);
      const lots=(await c.query(`SELECT t.*,COALESCE((SELECT SUM(a.credits) FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=t.id AND p.state!='refunded'),0)::bigint AS allocated FROM topups t WHERE email=$1 AND status IN ('paid','refunded') AND NOT EXISTS(SELECT 1 FROM refund_requests r WHERE r.topup_id=t.id) ORDER BY position`,[email])).rows;
      let remaining=credits;
      for(const lot of lots){const count=Math.min(remaining,Math.max(0,lot.credits-lot.refunded-lot.allocated));if(count){await c.query('INSERT INTO allocations VALUES($1,$2,$3)',[order.id,lot.id,count]);remaining-=count;}if(!remaining)break;}
      if(remaining)fail('Credit allocation requires review');
      await change(c,'spend:'+order.id,email,-credits,'도구 사용');
      await c.query('INSERT INTO purchases(id,email,request_key,fingerprint,credits,state,data) VALUES($1,$2,$3,$4,$5,$6,$7)',[order.id,email,key,fingerprint,credits,order.productType==='ai_pet_translator'?'done':'ready',JSON.stringify(order)]);return order;
    });
  }
  reserveRefund(orderId,owner,expectedCancelId){return this.tx(async c=>{
    const row=await one(c,"SELECT * FROM nice_orders WHERE id=$1 AND owner=$2 AND state='verified'",[orderId,owner]);if(!row)fail('Verified owned order required');
    const prior=await one(c,'SELECT * FROM nice_refunds WHERE order_id=$1',[orderId]);
    if(expectedCancelId!==undefined&&(prior?.cancel_id??null)!==expectedCancelId)fail('Refund attempt changed');
    if(prior&&prior.state!=='released')return prior;
    const intent=JSON.parse(row.intent),cancelId=randomUUID();let credits=0;
    if(intent.category==='credit_topup'){
      const id='nicepay:'+orderId,lot=await one(c,'SELECT * FROM topups WHERE id=$1',[id]);
      if(!lot||lot.status!=='paid'||lot.refunded||lot.amount!==intent.amount||lot.email!==owner)fail('Refund lot unavailable');
      const used=await one(c,"SELECT 1 FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=$1 AND p.state!='refunded'",[id]);
      const legacy=await one(c,"SELECT 1 FROM purchases p WHERE email=$1 AND state!='refunded' AND NOT EXISTS(SELECT 1 FROM allocations a WHERE a.purchase_id=p.id)",[owner]);
      if(used||legacy||await balance(c,owner)<lot.credits)fail('Only unused full refunds supported');
      credits=lot.credits;await change(c,'nice-refund-hold:'+cancelId,owner,-credits,'NICEPAY 환불 대기');
      await c.query("UPDATE topups SET status='refund_hold' WHERE id=$1",[id]);
    }else if(intent.category==='direct'){
      const changed=await c.query("UPDATE nice_entitlements SET state='refund_hold' WHERE order_id=$1 AND owner=$2 AND state='ready'",[orderId,owner]);if(changed.rowCount!==1)fail('Unused entitlement required');
    }else if(intent.category!=='donation')fail('Unknown category');
    if(prior){await c.query('INSERT INTO nice_refund_history VALUES($1,$2,$3)',[prior.cancel_id,orderId,JSON.stringify(prior)]);await c.query('DELETE FROM nice_refunds WHERE order_id=$1',[orderId]);}
    return one(c,'INSERT INTO nice_refunds VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[orderId,cancelId,owner,intent.category,credits,intent.amount,'reserved',Date.now()]);
  });}
  releaseRefund(orderId,owner,expectedCancelId){return this.tx(async c=>{
    const row=await one(c,"SELECT * FROM nice_refunds WHERE order_id=$1 AND owner=$2 AND state='reserved'",[orderId,owner]);
    if(!row||expectedCancelId!==undefined&&row.cancel_id!==expectedCancelId)fail('Unsent matching refund required');
    if(row.category==='credit_topup'){await change(c,'nice-refund-release:'+row.cancel_id,owner,row.credits,'NICEPAY 환불 접수 취소');await c.query("UPDATE topups SET status='paid' WHERE id=$1",['nicepay:'+orderId]);}
    else if(row.category==='direct')await c.query("UPDATE nice_entitlements SET state='ready' WHERE order_id=$1 AND state='refund_hold'",[orderId]);
    await c.query("UPDATE nice_refunds SET state='released',updated=$1 WHERE order_id=$2",[Date.now(),orderId]);
  });}
  claimRefund(orderId,expectedCancelId,expectedAmount){return this.tx(async c=>{
    // Mandatory compare-and-swap: stale operator confirmation never claims a new attempt.
    if(typeof expectedCancelId!=='string'||!Number.isSafeInteger(expectedAmount)||expectedAmount<=0)fail('Refund confirmation required');
    const row=await one(c,"UPDATE nice_refunds SET state='sending',updated=$1 WHERE order_id=$2 AND cancel_id=$3 AND amount=$4 AND state='reserved' RETURNING *",[Date.now(),orderId,expectedCancelId,expectedAmount]);
    if(!row)fail('Confirmed refund attempt changed');return row;
  });}
  markRefundUncertain(orderId,cancelId){return this.tx(c=>c.query("UPDATE nice_refunds SET state='uncertain',updated=$1 WHERE order_id=$2 AND cancel_id=$3 AND state='sending'",[Date.now(),orderId,cancelId]));}
  applyCancelled(orderId,receipt){return this.tx(async c=>{
    const row=await one(c,'SELECT * FROM nice_refunds WHERE order_id=$1',[orderId]);
    const order=await getOrder(c,orderId);
    if(!row||!order||receipt.tid!==order.tid||receipt.cancelled!==true||receipt.orderId!==orderId||receipt.cancelOrderId!==row.cancel_id||receipt.amount!==row.amount)fail('Refund receipt mismatch');
    if(row.state==='cancelled')return false;
    if(!['sending','uncertain'].includes(row.state))fail('Refund not dispatched');
    if(row.category==='credit_topup')await c.query("UPDATE topups SET status='refunded',refunded=credits WHERE id=$1 AND status='refund_hold'",['nicepay:'+orderId]);
    else if(row.category==='direct')await c.query("UPDATE nice_entitlements SET state='refunded' WHERE order_id=$1 AND state='refund_hold'",[orderId]);
    await c.query("UPDATE nice_refunds SET state='cancelled',updated=$1 WHERE order_id=$2",[Date.now(),orderId]);
    await c.query("UPDATE nice_orders SET state='refunded',updated=$1 WHERE id=$2",[Date.now(),orderId]);return true;
  });}
}
export {change as changePostgresCredits};
