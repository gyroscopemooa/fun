import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import fs from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';import {Script,createContext} from 'node:vm';
import {CreditStore} from '../credits/store.js';import {NicepayOrderStore} from './nicepay-orders.js';import {createNicepayPgClient} from './nicepay-pg.js';import {createNicepayServerStaging} from './nicepay-server-staging.js';import {REFUND_POLICY_VERSION} from '../credits/refunds.js';
import {nicepayStagingEntry} from '../../../src/lib/nicepay-staging-entry.mjs';
test('NICE customer topup requires login, retries one order, credits once and spends persistent balance',async t=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'nice-credit-customer-')),file=join(dir,'wallet.db'),wallet=new CreditStore(file),store=new NicepayOrderStore(file);
 const config={variant:'legacy',id:'fake00000m',secret:'offline-test-merchant-secret',returnUrl:'https://manytool.net/nice/payment/return'};
 const policy={enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:50000}}};
 const catalog={pack10:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Credit pack'},pack50:{category:'credit_topup',amount:50000,credits:50,currency:'KRW',recurring:false,goodsName:'Large credit pack'}};
 let orderId,calls=0;const tid='e'.repeat(30),hash=s=>createHash('sha256').update(s).digest('hex');
 const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{calls++;const r={ResultCode:'3001',MID:config.id,Moid:orderId,Amt:'000000010000',TID:tid,PayMethod:'CARD'};r.Signature=hash(tid+config.id+r.Amt+config.secret);return Response.json(r);}});
 const opts={enabled:true,store,creditStore:wallet,origin:'https://manytool.net',payment:{config,policy,catalog,client}};
 const app=express();app.use('/nice',(await createNicepayServerStaging({...opts,customerEnabled:true})).router);app.use('/off',(await createNicepayServerStaging(opts)).router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));store.close();wallet.close();await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port,owner='buyer@example.com';
 const headers={Cookie:'manytool_credit_session='+wallet.token(owner,'session',60000),Origin:opts.origin,'Content-Type':'application/json'};
 const post=(route,body,h=headers)=>fetch(base+route,{method:'POST',headers:h,body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/off/customer-credits/',{headers})).status,503);
 assert.equal((await fetch(base+'/nice/customer-credits/')).status,401);
 const entry=nicepayStagingEntry({enabled:'true',basePath:'/nice',pathname:'/credits'});
 const page=await fetch(base+entry.href,{headers});assert.equal(page.status,200);assert.match(await page.text(),/10 크레딧/);
 const code=await (await fetch(base+'/nice/customer-credits/client.js',{headers})).text();new Script(code);await checkCreditClient(code);
 assert.equal((await post('/nice/customer-credits/wallet',{}, {...headers,Origin:'https://evil.invalid'})).status,403);
 const request={productId:'pack10',requestKey:'credit-customer-request-123',refundPolicyVersion:REFUND_POLICY_VERSION};
 assert.equal((await post('/nice/customer-credits/prepare',{...request,refundPolicyVersion:'wrong'})).status,400);
 assert.equal(store.db.prepare('SELECT count(*) n FROM nice_orders').get().n,0);
 const prepared=await Promise.all([post('/nice/customer-credits/prepare',request),post('/nice/customer-credits/prepare',request)]);
 const [one,two]=await Promise.all(prepared.map(r=>r.json()));orderId=one.orderId;assert.equal(one.orderId,two.orderId);
 assert.equal((await post('/nice/customer-credits/prepare',{...request,productId:'pack50'})).status,400);
 assert.equal((await fetch(base+one.checkoutUrl,{headers:{Cookie:headers.Cookie}})).status,200);
 const auth={AuthResultCode:'0000',MID:config.id,Moid:orderId,Amt:'10000',AuthToken:'fake-token',TxTid:tid,PayMethod:'CARD',NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp'};auth.Signature=hash(auth.AuthToken+config.id+auth.Amt+config.secret);
 const callback=body=>fetch(base+'/nice/payment/return',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
 assert.equal((await callback({...auth,Signature:'bad'})).status,409);assert.equal(calls,0);
 assert.equal((await callback(auth)).status,200);assert.equal((await callback(auth)).status,200);assert.equal(calls,1);assert.equal(wallet.balance(owner),10);
 const status=await (await post('/nice/customer-credits/status',{orderId})).json();assert.equal(status.credited,true);assert.equal(status.balance,10);assert.equal(status.canOpen,false);
 const other={...headers,Cookie:'manytool_credit_session='+wallet.token('other@example.com','session',60000)};
 assert.equal((await post('/nice/customer-credits/status',{orderId},other)).status,404);
 assert.equal((await fetch(base+one.checkoutUrl,{headers:other})).status,404);
 const purchase={id:'credit-spend-fixture',productType:'calorie',status:'paid',paymentMode:'credits'};
 wallet.purchase(owner,'credit-spend-request-123','same-input',3,purchase);wallet.purchase(owner,'credit-spend-request-123','same-input',3,purchase);assert.equal(wallet.balance(owner),7);
 assert.throws(()=>wallet.purchase(owner,'credit-insufficient-123','different',8,{...purchase,id:'too-much'}));assert.equal(wallet.balance(owner),7);
 const reopened=new CreditStore(file);assert.equal(reopened.balance(owner),7);assert.equal(reopened.topupHistory(owner)[0].provider,'nicepay');reopened.close();
 const refreshed=await (await post('/nice/customer-credits/wallet',{})).json();assert.equal(refreshed.balance,7);assert.equal(refreshed.orders.length,1);
 assert.equal((await (await post('/nice/customer-credits/prepare',request)).json()).checkoutUrl,null);
 assert.equal(wallet.db.prepare("SELECT count(*) n FROM ledger WHERE kind='NICEPAY 충전'").get().n,1);
});


async function checkCreditClient(code){
 for(const mode of ['normal','write-failure','malformed','read-failure']){
  const storageFails=mode==='write-failure',broken=['malformed','read-failure'].includes(mode);
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='pack'?'pack10':'',checked:true,disabled:false,hidden:false,textContent:'',replaceChildren(){},append(){}});return nodes.get(id);};
  const storage=new Map();let prepares=0;
  const context=createContext({document:{getElementById:node,createElement:()=>({}),body:{dataset:{account:'fixture'}}},location:{pathname:'/nice/customer-credits/'},crypto:{randomUUID:()=> 'stable-credit-request-123'},confirm:()=>true,
   sessionStorage:{getItem:k=>{if(mode==='read-failure')throw Error('Storage unavailable');if(mode==='malformed')return '{broken';return storage.get(k);},setItem:(k,v)=>{if(storageFails)throw Error('Storage unavailable');storage.set(k,v);},removeItem:k=>storage.delete(k)},
   fetch:async(url)=>{if(url.endsWith('/prepare')){prepares++;return {ok:true,json:async()=>({orderId:'one',canOpen:true,paymentState:'created'})};}if(url.endsWith('/wallet'))return {ok:true,json:async()=>({balance:0,orders:[],refundPolicyVersion:'normal-unit-v1'})};return {ok:true,json:async()=>({orderId:'one',productId:'pack10',canOpen:true,paymentState:'created',canStartNew:false})};}
  });
  new Script(code).runInContext(context);await new Promise(r=>setImmediate(r));
  await node('prepare').onclick();await node('prepare').onclick();
  assert.equal(prepares,storageFails||broken?0:1);if(broken)assert.equal(node('prepare').disabled,true);
  if(!storageFails&&!broken){node('history').value='one';await node('load').onclick();await node('prepare').onclick();assert.equal(prepares,1);}
 }
}
