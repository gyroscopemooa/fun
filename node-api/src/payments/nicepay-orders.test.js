import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {NicepayOrderStore,processPgAuthentication,reconcilePgApproval} from './nicepay-orders.js';
import {readNicepayPolicy} from './nicepay-policy.js';
import {createNicepayPgClient} from './nicepay-pg.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const config={variant:'legacy',id:'fake00000m',secret:'fake-test-merchant-key'};
const policy=readNicepayPolicy(JSON.stringify({enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:10000}}}));
const catalog={pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Manytool credits'}};
const timestamp='20261111090000',tid='a'.repeat(30);
function create(store,now=Date.now()){return store.create({productId:'pack',ownerId:'verified-owner'},catalog,policy,config.id,now);}
function auth(order){const b={AuthResultCode:'0000',MID:config.id,Moid:order.id,Amt:'10000',AuthToken:'fake-token',TxTid:tid,PayMethod:'CARD',NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp'};b.Signature=hash(b.AuthToken+config.id+b.Amt+config.secret);return b;}
function paid(order){const b={ResultCode:'3001',MID:config.id,Moid:order.id,Amt:'000000010000',TID:tid,PayMethod:'CARD'};b.Signature=hash(tid+config.id+b.Amt+config.secret);return b;}
test('durable approval receipt and duplicate callback do not reapprove across restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nice-orders-')),file=join(dir,'orders.sqlite');let store=new NicepayOrderStore(file);
 try{const order=create(store);let calls=0;const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{calls++;return Response.json(paid(order));}});
 await processPgAuthentication({body:auth(order),store,config,client,timestamp});assert.equal(store.get(order.id).state,'verified');
 store.close();store=new NicepayOrderStore(file);
 await processPgAuthentication({body:auth(order),store,config,client,timestamp});assert.equal(calls,1);
 assert.equal(reconcilePgApproval({body:paid(order),orderId:order.id,store,config}).state,'verified');
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM nice_receipts').get().n,1);
 assert.throws(()=>store.owned(order.id,'other'));
 assert.ok(!readFileSync(file).includes(Buffer.from(config.secret)));
 }finally{store.close();rmSync(dir,{recursive:true});}
});
test('concurrent callbacks send approval once',async t=>{
 const store=new NicepayOrderStore(':memory:');t.after(()=>store.close());const order=create(store);let calls=0;
 const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return Response.json(paid(order));}});
 const run=()=>processPgAuthentication({body:auth(order),store,config,client,timestamp});
 const results=await Promise.allSettled([run(),run()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,1);
});
test('timeout remains uncertain, authenticated reconciliation resolves without new charge',async t=>{
 const store=new NicepayOrderStore(':memory:');t.after(()=>store.close());const order=create(store);let calls=0;
 const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{calls++;throw Error('timeout');}});
 await assert.rejects(processPgAuthentication({body:auth(order),store,config,client,timestamp}));assert.equal(store.get(order.id).state,'uncertain');
 await assert.rejects(processPgAuthentication({body:auth(order),store,config,client,timestamp}));assert.equal(calls,1);
 assert.throws(()=>reconcilePgApproval({body:{...paid(order),Amt:'1'},orderId:order.id,store,config}));
 assert.equal(reconcilePgApproval({body:paid(order),orderId:order.id,store,config}).state,'verified');
});
test('expired orders, wrong MID and reused transaction reject before network',async t=>{
 const store=new NicepayOrderStore(':memory:');t.after(()=>store.close());const order=create(store,0);let calls=0;const client={approve:async()=>{calls++;}};
 await assert.rejects(processPgAuthentication({body:auth(order),store,config,client,timestamp}));
 const fresh=create(store);await assert.rejects(processPgAuthentication({body:auth(fresh),store,config:{...config,id:'other0000m'},client,timestamp}));
 store.claim(fresh.id,tid);const second=create(store);assert.throws(()=>store.claim(second.id,tid));assert.equal(store.get(second.id).state,'created');assert.equal(calls,0);
});
test('crashed approving orders enter reconciliation queue without replay',t=>{
 const store=new NicepayOrderStore(':memory:');t.after(()=>store.close());const order=create(store,100000);store.claim(order.id,tid,100001);
 assert.equal(store.recoverStale(160002),1);assert.equal(store.pendingReconciliation()[0].state,'uncertain');assert.throws(()=>store.claim(order.id,tid,160003));
});
test('rejected checkout snapshot abandons only created owned order',t=>{
 const store=new NicepayOrderStore(':memory:');t.after(()=>store.close());const order=create(store);
 store.rejectCreated(order.id,'other');assert.equal(store.get(order.id).state,'created');
 store.rejectCreated(order.id,'verified-owner');assert.equal(store.get(order.id).state,'abandoned');assert.throws(()=>store.claim(order.id,tid));
});
