import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { verifyNicepayAuthentication, verifyNicepayApproval } from './nicepay.js';
import { prepareNicepayIntent } from './nicepay-policy.js';
const fail=()=>{throw new Error('Invalid NICEPAY order transition');};
// Separate private database: no wallet credits and no authentication tokens are stored here.
export class NicepayOrderStore {
  constructor(filename){
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS nice_orders(id TEXT PRIMARY KEY, owner TEXT NOT NULL, intent TEXT NOT NULL,
        state TEXT NOT NULL, tid TEXT UNIQUE, created INTEGER NOT NULL, expires INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nice_receipts(order_id TEXT PRIMARY KEY, tid TEXT UNIQUE NOT NULL, amount INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nice_events(id INTEGER PRIMARY KEY, order_id TEXT NOT NULL, state TEXT NOT NULL, created INTEGER NOT NULL);`);
  }
  close(){this.db.close();}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  get(id){const row=this.db.prepare('SELECT * FROM nice_orders WHERE id=?').get(id);return row?{...JSON.parse(row.intent),id:row.id,state:row.state,tid:row.tid,created:row.created,expires:row.expires}:null;}
  owned(id,owner){const order=this.get(id);if(!order||order.ownerId!==owner)fail();return order;}
  create(request,catalog,policy,merchantId,now=Date.now()){
    if(typeof merchantId!=='string'||!/^[a-zA-Z0-9]{10}$/.test(merchantId))fail();
    const intent={...prepareNicepayIntent(request,catalog,policy),merchantId},id=randomUUID();
    this.transaction(()=>{this.db.prepare('INSERT INTO nice_orders VALUES(?,?,?,?,?,?,?,?)').run(id,intent.ownerId,JSON.stringify(intent),'created',null,now,now+15*60000,now);
      this.event(id,'created',now);});return this.get(id);
  }
  event(id,state,now){this.db.prepare('INSERT INTO nice_events(order_id,state,created) VALUES(?,?,?)').run(id,state,now);}
  claim(id,tid,now=Date.now()){
    if(typeof tid!=='string'||!/^[a-zA-Z0-9]{30}$/.test(tid))fail();
    return this.transaction(()=>{
      const changed=this.db.prepare("UPDATE nice_orders SET state='approving',tid=?,updated=? WHERE id=? AND state='created' AND expires>?").run(tid,now,id,now);
      if(changed.changes!==1)fail();this.event(id,'approving',now);return this.get(id);
    });
  }
  markUncertain(id,now=Date.now()){
    return this.transaction(()=>{const changed=this.db.prepare("UPDATE nice_orders SET state='uncertain',updated=? WHERE id=? AND state='approving'").run(now,id);
      if(changed.changes)this.event(id,'uncertain',now);});
  }
  recoverStale(now=Date.now(),ageMs=60000){
    if(!Number.isSafeInteger(ageMs)||ageMs<60000)fail();
    return this.transaction(()=>{const rows=this.db.prepare("SELECT id FROM nice_orders WHERE state='approving' AND updated<=?").all(now-ageMs);
      for(const {id} of rows){this.db.prepare("UPDATE nice_orders SET state='uncertain',updated=? WHERE id=?").run(now,id);this.event(id,'uncertain',now);}return rows.length;});
  }
  // Called only with an authenticated provider receipt by the coordinator, never browser JSON.
  recordVerified(receipt,now=Date.now()){
    return this.transaction(()=>{
      const order=this.get(receipt.orderId);
      if(!order||receipt.verified!==true||receipt.tid!==order.tid||receipt.amount!==order.amount||receipt.currency!=='KRW')fail();
      if(order.state==='verified')return false;
      if(!['approving','uncertain'].includes(order.state))fail();
      this.db.prepare('INSERT INTO nice_receipts VALUES(?,?,?,?)').run(order.id,order.tid,order.amount,now);
      this.db.prepare("UPDATE nice_orders SET state='verified',updated=? WHERE id=?").run(now,order.id);this.event(order.id,'verified',now);return true;
    });
  }
  pendingReconciliation(){return this.db.prepare("SELECT id,tid,state,updated FROM nice_orders WHERE state IN ('approving','uncertain') ORDER BY updated").all();}
}
export async function processPgAuthentication({body,store,config,client,timestamp,now=Date.now()}){
  const order=store.get(body?.Moid);
  if(!order||order.variant!=='legacy'||config.variant!=='legacy'||order.merchantId!==config.id)fail();
  if(order.category==='credit_topup'&&(!Number.isSafeInteger(order.credits)||order.credits<1||order.amount!==order.credits*1000))fail();
  const auth=verifyNicepayAuthentication(body,order,config);
  if(order.state==='verified'&&order.tid===auth.tid)return order;
  // Persist the unique transaction claim BEFORE any network request; duplicates never reapprove.
  store.claim(order.id,auth.tid,now);
  try{
    const receipt=await client.approve(body,order,timestamp);
    store.recordVerified(receipt);return store.get(order.id);
  }catch(error){store.markUncertain(order.id);throw error;}
}
// Reconcile a provider response without sending a second approval or trusting browser status.
export function reconcilePgApproval({body,orderId,store,config}){
  const order=store.get(orderId);if(!order||order.variant!=='legacy'||!order.tid||config.variant!=='legacy'||order.merchantId!==config.id)fail();
  const receipt=verifyNicepayApproval(body,order,{authenticated:true,orderId,amount:order.amount,tid:order.tid},config);
  store.recordVerified(receipt);return store.get(orderId);
}
