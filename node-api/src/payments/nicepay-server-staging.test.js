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
 let calls=0;const client={approve:async()=>{calls++;throw Error('No network');}};
 const publicRoot=join(dir,'public');mkdirSync(publicRoot);
 const image={root:join(dir,'private'),publicRoots:[publicRoot],config,policy,
  catalog:{base:{category:'direct',amount:10000,currency:'KRW',recurring:false,goodsName:'Image'}},
  client,resolveCheckoutRights:async()=>{throw Error('No rights configured in this fixture');},
  provider:async()=>{throw Error('No paid call allowed');},authenticate:()=> 'attacker'};
 const app=express();app.use('/off',(await createNicepayServerStaging()).router);
 app.use('/nice',(await createNicepayServerStaging({enabled:true,store,creditStore,origin:'https://manytool.net',image,tools:{analyzeSaju:async()=>({fixture:true})},payment:{config,policy,catalog,client}})).router);
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
 assert.equal(store.db.prepare('SELECT owner FROM nice_orders').get().owner,'owner@example.com');
 assert.equal((await fetch(base+'/nice/payment/checkout',{method:'POST',headers,body:JSON.stringify({productId:'ai_manseryeok'})})).status,200);
 creditStore.logout(token);assert.equal((await checkout()).status,400);
 assert.equal(store.db.prepare('SELECT count(*) n FROM nice_orders').get().n,2);assert.equal(calls,0);
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
