import test from 'node:test';
import assert from 'node:assert/strict';
import {CreditStore} from '../credits/store.js';
import {createNicepayBundleAccess} from './nicepay-bundle-access.js';
import {AI_PRODUCTS} from '../commerce/ai-products.js';
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
test('disabled by default, no database needed',()=>assert.deepEqual(createNicepayBundleAccess(),{}));
test('pet access is 30 days from receipt, does not renew on use',async t=>{
  const f=fixture(t); const end=start+30*86400000;
  assert.equal(f.api.petStatus(f.args).expiresAt,end);
  await f.api.executePet(f.args); f.setNow(end-1);
  assert.equal(f.api.petStatus(f.args).expiresAt,end);
  f.setNow(end); assert.throws(()=>f.api.petStatus(f.args),/expired/);
});
test('paid pass preserves repeat text and voice modes without token daily cap',async t=>{
  const f=fixture(t);
  for(let i=0;i<7;i++) await f.api.executePet({...f.args,requestId:`r${i}`,input:{textInput:'hello',mode:i%2?'command':'analyze'}});
  assert.equal(f.creditStore.db.prepare('SELECT count(*) AS n FROM nice_bundle_runs').get().n,7);
});
test('replay is cached, request mutation and wrong owner/product blocked',async t=>{
  const f=fixture(t); let calls=0; const args={...f.args,runner:async()=>{calls++;return {ok:true};}};
  await f.api.executePet(args); await f.api.executePet(args); assert.equal(calls,1);
  await assert.rejects(f.api.executePet({...args,input:{textInput:'different'}}),/mismatch/);
  await assert.rejects(f.api.executePet({...args,owner:'intruder'}),/unavailable/);
  await assert.rejects(f.api.executeName({...args,operation:'analyze',input:identity}),/unavailable/);
});
test('refund hold and refunded states block execution before runner',async t=>{
  const f=fixture(t); for(const state of ['refund_hold','refunded']) {
    f.creditStore.db.prepare('UPDATE nice_entitlements SET state=?').run(state);
    await assert.rejects(f.api.executePet(f.args),/unavailable/);
  }
});
test('name analysis and recommendation share durable input lock',async t=>{
  const f=fixture(t,'ai_name_premium'); const args={...f.args,input:identity,operation:'analyze'};
  await f.api.executeName(args);
  await f.api.executeName({...args,requestId:'r2',operation:'recommend'});
  const reopened=createNicepayBundleAccess({enabled:true,creditStore:f.creditStore,clock:()=>start});
  await assert.rejects(reopened.executeName({...args,requestId:'r3',input:{...identity,displayName:'changed'}}),/changed/);
  assert.equal(f.creditStore.db.prepare('SELECT count(*) AS n FROM nice_bundle_runs').get().n,2);
});
test('invalid input does not claim or lock entitlement',async t=>{
  const f=fixture(t,'ai_name_premium');
  await assert.rejects(f.api.executeName({...f.args,operation:'analyze',input:{...identity,surname:'李'}}),/mismatch/);
  assert.equal(f.creditStore.db.prepare('SELECT count(*) AS n FROM nice_bundle_locks').get().n,0);
  assert.equal(f.creditStore.db.prepare('SELECT state FROM nice_entitlements').get().state,'ready');
});
test('uncertain operation blocks retries and new requests',async t=>{
  const f=fixture(t);
  await assert.rejects(f.api.executePet({...f.args,runner:async()=>{throw Error('timeout');}}),/timeout/);
  await assert.rejects(f.api.executePet(f.args),/reconciliation/);
  await assert.rejects(f.api.executePet({...f.args,requestId:'new'}),/reconciliation/);
});
test('concurrent operation does not call another runner',async t=>{
  const f=fixture(t); let release; const wait=new Promise(resolve=>{release=resolve;});
  const first=f.api.executePet({...f.args,runner:async()=>{await wait;return {ok:true};}});
  await assert.rejects(f.api.executePet({...f.args,requestId:'second'}),/reconciliation/);
  release(); await first;
});

function limitedFixture(t){
  const f=fixture(t);
  f.creditStore.db.exec('ALTER TABLE nice_orders ADD COLUMN intent TEXT');
  f.creditStore.db.prepare('UPDATE nice_orders SET intent=?').run(JSON.stringify({entitlementPolicy:AI_PRODUCTS.pet.entitlementPolicy}));
  f.api=createNicepayBundleAccess({enabled:true,creditStore:f.creditStore,clock:()=>f.now??start});
  f.setNow=value=>{f.now=value;};return f;
}
test('new pass reserves five uses atomically, replay is free, KST midnight resets daily only',async t=>{
  const f=limitedFixture(t);let calls=0;
  const args={...f.args,runner:async()=>{calls++;return {ok:true};}};
  for(let i=0;i<5;i++)await f.api.executePet({...args,requestId:'daily-'+i});
  await f.api.executePet({...args,requestId:'daily-0'});assert.equal(calls,5);
  await assert.rejects(f.api.executePet({...args,requestId:'sixth'}),/limit/);
  assert.equal(f.api.petStatus(args).remainingToday,0);
  f.setNow(Date.UTC(2026,10,1,15));
  assert.equal(f.api.petStatus(args).remainingToday,5);
  await f.api.executePet({...args,requestId:'tomorrow'});assert.equal(calls,6);
  assert.equal(f.api.petStatus(args).remainingToday,4);
});
test('new pass keeps total limit over 31 calendar dates and rejects oversized text before provider',async t=>{
  const f=limitedFixture(t);
  await assert.rejects(f.api.executePet({...f.args,input:{textInput:'x'.repeat(501)}}),/500/);
  for(let day=0;day<30;day++){
    f.setNow(start+day*86400000);
    for(let i=0;i<5;i++)await f.api.executePet({...f.args,requestId:`day-${day}-${i}`});
  }
  assert.equal(f.api.petStatus(f.args).remainingToday,0);
  await assert.rejects(f.api.executePet({...f.args,requestId:'extra'}),/limit/);
});
test('uncertain provider usage remains reserved; timeouts cannot manufacture free attempts',async t=>{
  const f=limitedFixture(t);
  await assert.rejects(f.api.executePet({...f.args,runner:async()=>{throw Error('timeout');}}),/timeout/);
  assert.equal(f.api.petStatus(f.args).remainingToday,4);
  assert.equal(f.creditStore.db.prepare('SELECT count(*) AS n FROM nice_pet_usage').get().n,1);
});
