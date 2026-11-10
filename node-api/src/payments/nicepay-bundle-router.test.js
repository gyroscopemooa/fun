import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {CreditStore} from '../credits/store.js';
import {createNicepayBundleAccess} from './nicepay-bundle-access.js';
import {createNicepayBundleRouter} from './nicepay-bundle-router.js';
const start = Date.UTC(2026, 10, 1);
const identity = {displayName:'김민수',hanjaName:'金民秀',surname:'金',given:['民','秀']};
function fixture(t, product='ai_pet_translator') {
  const creditStore = new CreditStore(':memory:'); t.after(()=>creditStore.close());
  creditStore.db.exec(`CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT);
    CREATE TABLE nice_orders(id TEXT PRIMARY KEY,owner TEXT,state TEXT,tid TEXT);
    CREATE TABLE nice_receipts(order_id TEXT PRIMARY KEY,tid TEXT,created INTEGER);`);
  creditStore.db.prepare("INSERT INTO nice_entitlements VALUES('o','owner',?,'ready')").run(product);
  creditStore.db.prepare("INSERT INTO nice_orders VALUES('o','owner','verified','tid')").run();
  creditStore.db.prepare("INSERT INTO nice_receipts VALUES('o','tid',?)").run(start);
  let now=start;
  return {creditStore, setNow:value=>{now=value;}, api:createNicepayBundleAccess({enabled:true,creditStore,clock:()=>now}),
    args:{orderId:'o',owner:'owner',requestId:'r1',input:{textInput:'hello'},runner:async()=>({ok:true})}};
}
test('staging HTTP authenticates, rejects owner spoofing and delivers private audio',async t=>{
  const f=fixture(t);let calls=0;
  const app=express();app.use('/off',createNicepayBundleRouter());
  app.use('/bundle',createNicepayBundleRouter({enabled:true,creditStore:f.creditStore,clock:()=>start,origin:'https://manytool.net',authenticate:async req=>req.headers['x-test-user'],analyzePetAudio:async()=>{calls++;return {audio:Buffer.from('private audio').toString('base64'),mimeType:'audio/mpeg'};}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={Origin:'https://manytool.net','x-test-user':'owner','Content-Type':'application/json'};
  const body=JSON.stringify({orderId:'o',requestId:'http',owner:'owner',input:{textInput:'hello',mode:'command'}});
  assert.equal((await fetch(base+'/off/pet',{method:'POST'})).status,503);
  assert.equal((await fetch(base+'/bundle/pet',{method:'POST',headers:{Origin:'https://manytool.net'},body})).status,401);
  assert.equal((await fetch(base+'/bundle/pet',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body})).status,403);
  assert.equal((await fetch(base+'/bundle/pet',{method:'POST',headers:{...headers,'x-test-user':'other'},body})).status,409);assert.equal(calls,0);
  const response=await fetch(base+'/bundle/pet',{method:'POST',headers,body});assert.equal(response.status,200);
  const {artifact}=await response.json();
  assert.equal((await fetch(base+`/bundle/artifact/${artifact.id}`,{headers:{...headers,'x-test-user':'other'}})).status,404);
  assert.equal(await (await fetch(base+`/bundle/artifact/${artifact.id}`,{method:'POST',headers})).text(),'private audio');
  assert.equal((await fetch(base+`/bundle/artifact/${artifact.id}`,{method:'POST',headers:{...headers,Origin:'https://evil.invalid'}})).status,403);
  const download=await fetch(base+`/bundle/artifact/${artifact.id}`,{headers});assert.equal(await download.text(),'private audio');assert.equal(download.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(base+`/bundle/artifact/${artifact.id}`,{method:'DELETE',headers})).status,200);
  assert.equal((await fetch(base+`/bundle/artifact/${artifact.id}`,{headers})).status,404);
});
test('name HTTP uses actual dataset and rejects changed identity',async t=>{
  const f=fixture(t,'ai_name_premium');const app=express();app.use(createNicepayBundleRouter({enabled:true,creditStore:f.creditStore,clock:()=>start,origin:'https://manytool.net',authenticate:async()=> 'owner'}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Origin:'https://manytool.net','Content-Type':'application/json'};
  const send=(operation,input=identity)=>fetch(base+'/name/'+operation,{method:'POST',headers,body:JSON.stringify({orderId:'o',requestId:operation,input})});
  assert.equal((await send('analyze')).status,200);assert.equal((await send('recommend')).status,200);
  assert.equal((await send('analyze',{...identity,displayName:'changed'})).status,409);
});
