import test from 'node:test';
import assert from 'node:assert/strict';
import {CreditStore} from '../credits/store.js';
import {createNicepayBundleAccess} from './nicepay-bundle-access.js';
import {createNicepayBundleRunners} from './nicepay-bundle-runners.js';
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
test('runners are disabled without opt-in',()=>assert.deepEqual(createNicepayBundleRunners(),{}));
test('actual offline name dataset produces analysis and recommendations',async t=>{
  const f=fixture(t,'ai_name_premium');
  const api=createNicepayBundleRunners({enabled:true,creditStore:f.creditStore,clock:()=>start});
  const args={...f.args,input:identity,operation:'analyze'};
  const analysis=await api.name(args); assert.equal(analysis.ok,true); assert.equal(analysis.parts.length,3);
  const recommended=await api.name({...args,requestId:'recommend',operation:'recommend',options:{topK:3,givenLength:1}});
  assert.equal(recommended.ok,true); assert.equal(recommended.recommendations.length,3);
  assert.equal(recommended.input.givenLength,1);
  assert.deepEqual(await api.name(args),analysis);
  await assert.rejects(api.name({...args,requestId:'other',input:{...identity,displayName:'changed'}}),/changed/);
});
test('name recommendation options are fingerprinted without changing identity lock',async t=>{
  const f=fixture(t,'ai_name_premium');
  const api=createNicepayBundleRunners({enabled:true,creditStore:f.creditStore,clock:()=>start});
  const args={...f.args,input:identity,operation:'recommend',options:{topK:2,givenLength:2}};
  await api.name(args);
  await assert.rejects(api.name({...args,options:{topK:3}}),/mismatch/);
  assert.equal((await api.name({...args,requestId:'next',options:{topK:3}})).recommendations.length,3);
});
test('pet audio is private, persistent and replayed without another paid call',async t=>{
  const f=fixture(t); let calls=0;
  const bytes=Buffer.alloc(100000,7);
  const api=createNicepayBundleRunners({enabled:true,creditStore:f.creditStore,clock:()=>start,analyzePetAudio:async()=>{calls++;return {audio:bytes.toString('base64'),mimeType:'audio/mpeg',text:'hello'};}});
  const args={...f.args,input:{textInput:'hello',mode:'command'}};
  const result=await api.pet(args); assert.equal(result.audio,undefined); assert.equal(result.artifact.size,100000);
  assert.deepEqual(await api.pet(args),result); assert.equal(calls,1);
  const reopened=createNicepayBundleRunners({enabled:true,creditStore:f.creditStore,clock:()=>start});
  assert.deepEqual(reopened.readArtifact({artifactId:result.artifact.id,owner:'owner'}).bytes,bytes);
  assert.throws(()=>reopened.readArtifact({artifactId:result.artifact.id,owner:'wrong'}),/unavailable/);
  f.creditStore.db.prepare("UPDATE nice_entitlements SET state='refunded'").run();
  assert.throws(()=>reopened.readArtifact({artifactId:result.artifact.id,owner:'owner'}),/unavailable/);
});
test('name missing data and invalid options do not consume rights',async t=>{
  const f=fixture(t,'ai_name_premium');
  const api=createNicepayBundleRunners({enabled:true,creditStore:f.creditStore,clock:()=>start});
  await assert.rejects(api.name({...f.args,operation:'analyze',input:{...identity,hanjaName:'X民秀',surname:'X'}}),/unavailable/);
  await assert.rejects(api.name({...f.args,operation:'recommend',input:identity,options:{topK:NaN}}),/options/);
  assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_entitlements').get().state,'ready');
});
test('invalid pet output is quarantined instead of repeated',async t=>{
  const f=fixture(t);
  const api=createNicepayBundleRunners({enabled:true,creditStore:f.creditStore,clock:()=>start,analyzePetAudio:async()=>({audio:'not-base64',mimeType:'audio/mpeg'})});
  const args={...f.args,input:{textInput:'hello',mode:'command'}};
  await assert.rejects(api.pet(args),/encoding/);
  await assert.rejects(api.pet({...args,requestId:'second'}),/reconciliation/);
});
