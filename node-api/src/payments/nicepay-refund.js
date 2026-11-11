import {randomUUID} from 'node:crypto';
import {verifyPgFullCancel} from './nicepay-operations.js';
function init(wallet){wallet.db.exec(`CREATE TABLE IF NOT EXISTS nice_refunds(order_id TEXT PRIMARY KEY,cancel_id TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,category TEXT NOT NULL,credits INTEGER NOT NULL,amount INTEGER NOT NULL,state TEXT NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS nice_refund_history(cancel_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,snapshot TEXT NOT NULL)`);}
export function reserveNicepayFullRefund(wallet,orderId,owner,expectedCancelId=undefined){
 if(typeof wallet.reserveRefund==='function')return wallet.reserveRefund(orderId,owner,expectedCancelId);
 init(wallet);return wallet.tx(()=>{
  const row=wallet.db.prepare("SELECT * FROM nice_orders WHERE id=? AND owner=? AND state='verified'").get(orderId,owner);
  if(!row)throw Error('Verified owned NICE order required');
  const prior=wallet.db.prepare('SELECT * FROM nice_refunds WHERE order_id=?').get(orderId);if(expectedCancelId!==undefined&&(prior?.cancel_id??null)!==expectedCancelId)throw Error('Refund changed; refresh before requesting');if(prior&&prior.state!=='released')return prior;
  const cancelId=randomUUID();
  const intent=JSON.parse(row.intent);let credits=0;
  if(intent.category==='credit_topup'){
   const id=`nicepay:${orderId}`,lot=wallet.topup(id);
   if(!lot||lot.status!=='paid'||lot.refunded||lot.amount!==intent.amount||lot.email!==owner)throw Error('NICE refund lot unavailable');
   const used=wallet.db.prepare("SELECT 1 FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=? AND p.state!='refunded'").get(id);
   const legacy=wallet.db.prepare("SELECT 1 FROM purchases p WHERE email=? AND state!='refunded' AND NOT EXISTS(SELECT 1 FROM allocations a WHERE a.purchase_id=p.id)").get(owner);
   if(used||legacy||wallet.balance(owner)<lot.credits)throw Error('Only completely unused full refunds supported');
   credits=lot.credits;wallet.change(`nice-refund-hold:${cancelId}`,owner,-credits,'NICEPAY 환불 대기');
   wallet.db.prepare("UPDATE topups SET status='refund_hold' WHERE id=?").run(id);
  }else if(intent.category==='direct'){
   const changed=wallet.db.prepare("UPDATE nice_entitlements SET state='refund_hold' WHERE order_id=? AND owner=? AND state='ready'").run(orderId,owner);
   if(changed.changes!==1)throw Error('Only unused direct entitlements can be refunded');
  }else if(intent.category!=='donation')throw Error('Unknown refund category');
  if(prior){wallet.db.prepare('INSERT INTO nice_refund_history VALUES(?,?,?)').run(prior.cancel_id,orderId,JSON.stringify(prior));wallet.db.prepare('DELETE FROM nice_refunds WHERE order_id=?').run(orderId);}
  wallet.db.prepare('INSERT INTO nice_refunds VALUES(?,?,?,?,?,?,?,?)').run(orderId,cancelId,owner,intent.category,credits,intent.amount,'reserved',Date.now());
  return wallet.db.prepare('SELECT * FROM nice_refunds WHERE order_id=?').get(orderId);
 });
}
export function releaseUnsentNicepayRefund(wallet,orderId,owner,expectedCancelId=undefined){
 if(typeof wallet.releaseRefund==='function')return wallet.releaseRefund(orderId,owner,expectedCancelId);
 init(wallet);return wallet.tx(()=>{
  const row=wallet.db.prepare("SELECT * FROM nice_refunds WHERE order_id=? AND owner=? AND state='reserved'").get(orderId,owner);if(!row)throw Error('Only unsent refunds can be released');if(expectedCancelId!==undefined&&row.cancel_id!==expectedCancelId)throw Error('Refund attempt changed');
  if(row.category==='credit_topup'){wallet.change(`nice-refund-release:${row.cancel_id}`,owner,row.credits,'NICEPAY 환불 접수 취소');wallet.db.prepare("UPDATE topups SET status='paid' WHERE id=?").run(`nicepay:${orderId}`);}
  else if(row.category==='direct')wallet.db.prepare("UPDATE nice_entitlements SET state='ready' WHERE order_id=? AND state='refund_hold'").run(orderId);
  wallet.db.prepare("UPDATE nice_refunds SET state='released',updated=? WHERE order_id=?").run(Date.now(),orderId);
 });
}
function applyCancelled(wallet,orderId,receipt){
 return wallet.tx(()=>{
  const row=wallet.db.prepare('SELECT * FROM nice_refunds WHERE order_id=?').get(orderId);
  const order=wallet.db.prepare('SELECT tid FROM nice_orders WHERE id=?').get(orderId);
  if(!row||!order||receipt.tid!==order.tid||receipt.cancelled!==true||receipt.orderId!==orderId||receipt.cancelOrderId!==row.cancel_id||receipt.amount!==row.amount)throw Error('Refund receipt mismatch');
  if(row.state==='cancelled')return false;
  if(!['sending','uncertain'].includes(row.state))throw Error('Refund not dispatched');
  if(row.category==='credit_topup')wallet.db.prepare("UPDATE topups SET status='refunded',refunded=credits WHERE id=? AND status='refund_hold'").run(`nicepay:${orderId}`);
  else if(row.category==='direct')wallet.db.prepare("UPDATE nice_entitlements SET state='refunded' WHERE order_id=? AND state='refund_hold'").run(orderId);
  wallet.db.prepare("UPDATE nice_refunds SET state='cancelled',updated=? WHERE order_id=?").run(Date.now(),orderId);
  wallet.db.prepare("UPDATE nice_orders SET state='refunded',updated=? WHERE id=?").run(Date.now(),orderId);return true;
 });
}
export async function dispatchNicepayFullRefund({wallet,store,orderId,client,timestamp,expectedCancelId,expectedAmount}){
 const asyncStore=typeof wallet.claimRefund==='function';
 if(!asyncStore)init(wallet);
 const row=asyncStore?await wallet.claimRefund(orderId,expectedCancelId,expectedAmount):wallet.tx(()=>{const r=wallet.db.prepare("SELECT * FROM nice_refunds WHERE order_id=? AND state='reserved'").get(orderId);if(!r)throw Error('Refund already sent or unavailable');if(expectedCancelId!==undefined&&(r.cancel_id!==expectedCancelId||r.amount!==expectedAmount))throw Error('Confirmed refund attempt changed');wallet.db.prepare("UPDATE nice_refunds SET state='sending',updated=? WHERE order_id=?").run(Date.now(),orderId);return r;});
 try{const receipt=await client.fullCancel(await store.get(orderId),timestamp,row.cancel_id);return await (asyncStore?wallet.applyCancelled(orderId,receipt):applyCancelled(wallet,orderId,receipt));}
 catch(error){if(asyncStore)await wallet.markRefundUncertain(orderId,row.cancel_id);else wallet.db.prepare("UPDATE nice_refunds SET state='uncertain',updated=? WHERE order_id=? AND state='sending'").run(Date.now(),orderId);throw error;}
}
export function recoverNicepayRefunds(wallet,now=Date.now()){
 init(wallet);wallet.db.prepare("UPDATE nice_refunds SET state='uncertain',updated=? WHERE state='sending' AND updated<?").run(now,now-60000);
 return wallet.db.prepare("SELECT order_id,cancel_id,state FROM nice_refunds WHERE state='uncertain'").all();
}
export function reconcileNicepayFullRefund({wallet,store,orderId,body,config}){
 if(typeof wallet.refundRecord==='function')return (async()=>{const row=await wallet.refundRecord(orderId);if(!row)throw Error('Unknown refund');const receipt=verifyPgFullCancel(body,await store.get(orderId),config,row.cancel_id);return wallet.applyCancelled(orderId,receipt);})();
 init(wallet);const row=wallet.db.prepare('SELECT * FROM nice_refunds WHERE order_id=?').get(orderId);if(!row)throw Error('Unknown refund');
 const receipt=verifyPgFullCancel(body,store.get(orderId),config,row.cancel_id);return applyCancelled(wallet,orderId,receipt);
}
