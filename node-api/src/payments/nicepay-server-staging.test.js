import {Script} from 'node:vm';
import {createHash} from 'node:crypto';
import {createNicepayPgClient} from './nicepay-pg.js';
import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {CreditStore} from '../credits/store.js';import {NicepayOrderStore} from './nicepay-orders.js';
import {readNicepayPolicy} from './nicepay-policy.js';
import {createNicepayWalletAuthenticator,createNicepayServerStaging} from './nicepay-server-staging.js';
test('wallet authentication rejects spoofed, ambiguous, expired, login-only and revoked cookies',t=>{
 const s=new CreditStore(':memory:');t.after(()=>s.close());const auth=createNicepayWalletAuthenticator(s);
 const token=s.token('owner@example.com','session',60000),header='manytool_credit_session='+token;
 assert.equal(auth({headers:{cookie:header}}),'owner@example.com');
 for(const cookie of [undefined,header+'; '+header,header+'extra','manytool_credit_session='+s.token('x','login',60000),'manytool_credit_session='+s.token('x','session',-1)]){
  assert.throws(()=>auth({headers:{cookie,'x-user':'owner@example.com'},body:{owner:'owner@example.com'}}));
 }
 s.logout(token);assert.throws(()=>auth({headers:{cookie:header}}));
});
test('assembled HTTP uses real wallet cookie and preserves disabled default without network calls',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'nice-server-')),file=join(dir,'db.sqlite');
 const creditStore=new CreditStore(file),store=new NicepayOrderStore(file);
 t.after(()=>{store.close();creditStore.close();rmSync(dir,{recursive:true});});
 const config={variant:'legacy',id:'fake00000m',secret:'offline-test-not-secret',returnUrl:'https://manytool.net/nice/payment/return'};
 const policy=readNicepayPolicy(JSON.stringify({enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:10000},direct:{approved:true,methods:['card'],maxAmountKrw:10000}}}));
 const catalog={pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Credits'}};
 catalog.ai_manseryeok={category:'direct',amount:10000,currency:'KRW',recurring:false,goodsName:'Saju'};
 let calls=0,paidOrderId;const hash=s=>createHash('sha256').update(s).digest('hex'),tid='b'.repeat(30);
 const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{
  calls++;const body={ResultCode:'3001',MID:config.id,Moid:paidOrderId,Amt:'000000010000',TID:tid,PayMethod:'CARD'};
  body.Signature=hash(tid+config.id+body.Amt+config.secret);return Response.json(body);
 }});
 const publicRoot=join(dir,'public');mkdirSync(publicRoot);
 const image={root:join(dir,'private'),publicRoots:[publicRoot],config,policy,
  catalog:{base:{category:'direct',amount:10000,currency:'KRW',recurring:false,goodsName:'Image'}},
  client,resolveCheckoutRights:async()=>{throw Error('No rights configured in this fixture');},
  provider:async()=>{throw Error('No paid call allowed');},authenticate:()=> 'attacker'};
 const app=express();app.use('/off',(await createNicepayServerStaging()).router);
 app.use('/no-operators',(await createNicepayServerStaging({enabled:true,store,creditStore,origin:'https://manytool.net',tools:{analyzeSaju:async()=>({})},payment:{config,policy,catalog,client}})).router);
 app.use('/nice',(await createNicepayServerStaging({enabled:true,store,creditStore,origin:'https://manytool.net',operators:['owner@example.com'],image,tools:{analyzeSaju:async()=>({fixture:true})},payment:{config,policy,catalog,client}})).router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const token=creditStore.token('owner@example.com','session',60000);
 const headers={Origin:'https://manytool.net',Cookie:'manytool_credit_session='+token,'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/off/session')).status,503);
 assert.equal((await fetch(base+'/nice/image/files/upload',{method:'POST',headers:{Origin:'https://manytool.net'}})).status,401);
 assert.equal((await fetch(base+'/nice/image/jobs/missing',{headers})).status,404);
 assert.equal((await fetch(base+'/nice/session',{headers:{Origin:headers.Origin,'x-user':'owner@example.com'}})).status,401);
 assert.equal((await fetch(base+'/nice/session',{headers:{...headers,Origin:'https://evil.invalid'}})).status,403);
 assert.equal((await fetch(base+'/nice/session',{headers})).status,200);
 const checkout=()=>fetch(base+'/nice/payment/checkout',{method:'POST',headers,body:JSON.stringify({productId:'pack',ownerId:'attacker'})});
 assert.equal((await checkout()).status,200);
 paidOrderId=store.db.prepare('SELECT id FROM nice_orders').get().id;
 assert.equal((await fetch(base+'/no-operators/ui/',{headers:{Cookie:headers.Cookie}})).status,401);
 assert.equal((await fetch(base+'/no-operators/checkout-preview/payment/'+paidOrderId,{headers:{Cookie:headers.Cookie}})).status,404);
 const ui=await fetch(base+'/nice/ui/',{headers:{Cookie:headers.Cookie}});
 assert.equal(ui.status,200);assert.match(await ui.text(),/주문 준비/);
 assert.equal((await fetch(base+'/nice/ui/')).status,401);
 const script=await fetch(base+'/nice/ui/client.js',{headers:{Cookie:headers.Cookie}});new Script(await script.text());
 assert.equal((await fetch(base+'/nice/ui/catalog',{method:'POST',headers:{Cookie:headers.Cookie}})).status,403);
 const listing=await fetch(base+'/nice/ui/catalog',{method:'POST',headers});assert.equal((await listing.json()).products.length,3);
 const preview=await fetch(base+'/nice/checkout-preview/payment/'+paidOrderId,{headers:{Cookie:headers.Cookie}});
 assert.equal(preview.status,200);assert.match(await preview.text(),/goPay/);
 const other=creditStore.token('other@example.com','session',60000);
 assert.equal((await fetch(base+'/nice/ui/',{headers:{Cookie:'manytool_credit_session='+other}})).status,401);
 assert.equal((await fetch(base+'/nice/checkout-preview/payment/'+paidOrderId,{headers:{Cookie:'manytool_credit_session='+other}})).status,404);
 const auth={AuthResultCode:'0000',MID:config.id,Moid:paidOrderId,Amt:'10000',AuthToken:'fake-token',TxTid:tid,PayMethod:'CARD',NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp'};
 auth.Signature=hash(auth.AuthToken+config.id+auth.Amt+config.secret);
 const callback=()=>fetch(base+'/nice/payment/return',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(auth)});
 assert.equal((await callback()).status,200);assert.equal((await callback()).status,200);
 assert.equal(creditStore.balance('owner@example.com'),10);assert.equal(calls,1);
 assert.equal((await fetch(base+'/nice/checkout-preview/payment/'+paidOrderId,{headers:{Cookie:headers.Cookie}})).status,404);
 const status=await fetch(base+'/nice/ui/status',{method:'POST',headers,body:JSON.stringify({orderId:paidOrderId})});
 assert.equal((await status.json()).state,'verified');
 assert.equal(store.db.prepare('SELECT owner FROM nice_orders').get().owner,'owner@example.com');
 assert.equal((await fetch(base+'/nice/payment/checkout',{method:'POST',headers,body:JSON.stringify({productId:'ai_manseryeok'})})).status,200);
 creditStore.logout(token);assert.equal((await checkout()).status,400);
 assert.equal(store.db.prepare('SELECT count(*) n FROM nice_orders').get().n,2);assert.equal(calls,1);
});

test('generic catalog cannot bypass photo purchase snapshot binding',async()=>{
 for(const product of ['base','add2','add3','add7','passport_addon','headshot_addon']){
  await assert.rejects(createNicepayServerStaging({enabled:true,origin:'https://manytool.net',payment:{catalog:{[product]:{category:'direct'}}}}),/dedicated photo checkout/);
 }
});

test('unconnected direct catalog fails closed before accepting payment',async()=>{
 for(const id of ['unknown','ai_name_premium','ai_pet_translator','video_mkv_mp4','calorie']){
  await assert.rejects(createNicepayServerStaging({enabled:true,origin:'https://manytool.net',tools:{},payment:{catalog:{[id]:{category:'direct'}}}}),/no execution route/);
 }
});
