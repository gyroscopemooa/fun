import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreditStore } from './store.js';
import { verifyPlayCredit, playAccountBinding, readPlayConfig, playTokenHash, installPlayCreditRoutes, reconcilePlayVoids, retryPlayConsumes, sealPlayToken, openPlayToken } from './play.js';
const email = 'buyer@example.com', token = 'a-long-purchase-token';
const config = { enabled: true, tokenKey: 'ab'.repeat(32), recoveryAvailable: true, bindingSecret: 'x'.repeat(32), packageName: 'net.manytool.app', products: { credits_small: 10 } };
const purchase = () => ({ purchaseState: 0, consumptionState: 0, quantity: 1, orderId: 'GPA.TEST', obfuscatedExternalAccountId: playAccountBinding(email, config.bindingSecret) });
function fixture(t, override = {}) { const store = new CreditStore(':memory:'); store.markPlaySynced(config.packageName,Date.now()); t.after(() => store.close()); let consumes = 0; const publisher = { get: async () => ({ ...purchase(), ...override }), consume: async () => { consumes++; } }; return { store, publisher, args: { store, publisher, config, email, productId: 'credits_small', purchaseToken: token }, consumes: () => consumes }; }
test('disabled without complete release configuration and reconciliation gate', () => {
 assert.equal(readPlayConfig({}).enabled, false);
 assert.equal(readPlayConfig({ PLAY_CREDITS_ENABLED:'true' }).enabled, false);
 assert.throws(() => readPlayConfig({PLAY_CREDIT_PRODUCTS_JSON:'{"bad":0}'}));
});
test('verified purchase grants once, durable receipt before consume, retries idempotent', async t => {
 const f = fixture(t); f.publisher.consume = async () => { assert.equal(f.store.balance(email),10); };
 await verifyPlayCredit(f.args); await verifyPlayCredit(f.args);
 assert.equal(f.store.balance(email),10); assert.equal(f.store.playReceipt(playTokenHash(token)).consumed,1);
 assert.equal(f.store.history(email).length,1);
});
test('consume failure retains grant and retry can finish without duplicate', async t => {
 const f = fixture(t); f.publisher.consume = async () => { throw new Error('network'); };
 assert.equal((await verifyPlayCredit(f.args)).consumptionPending,true);
 f.publisher.consume = async () => {}; assert.equal((await verifyPlayCredit(f.args)).consumptionPending,false);
 assert.equal(f.store.balance(email),10);
});
for (const [name, override] of Object.entries({ pending:{purchaseState:2}, canceled:{purchaseState:1}, wrongAccount:{obfuscatedExternalAccountId:'wrong'}, quantity:{quantity:2}, wrongProduct:{productId:'other'}, consumed:{consumptionState:1} })) {
 test(`reject ${name} without grant or consume`, async t => { const f=fixture(t,override); await assert.rejects(verifyPlayCredit(f.args)); assert.equal(f.store.balance(email),0); assert.equal(f.consumes(),0); });
}
test('same token cannot be claimed by another account', async t => { const f=fixture(t); await verifyPlayCredit(f.args); await assert.rejects(verifyPlayCredit({...f.args,email:'other@example.com'})); assert.equal(f.store.balance('other@example.com'),0); });
test('unknown product and invalid token reject before contacting Google', async t => { const f=fixture(t); f.publisher.get = async () => { assert.fail('must not call Google'); }; await assert.rejects(verifyPlayCredit({...f.args,productId:'unknown'})); await assert.rejects(verifyPlayCredit({...f.args,purchaseToken:'bad'})); });
test('credits can be allocated, web refund route refuses Play lot', async t => {
 const f=fixture(t); await verifyPlayCredit(f.args); const id='play:'+playTokenHash(token);
 assert.throws(()=>f.store.refundQuote(email,id),/Google Play/);
 assert.equal(f.store.topupHistory(email)[0].amount,null); assert.equal(f.store.topupHistory(email)[0].provider,'google_play');
 f.store.purchase(email,'request_key_12345','fingerprint',3,{id:'tool1',productType:'example'}); assert.equal(f.store.balance(email),7);
});
test('consumed retry with known receipt is accepted', async t => { const f=fixture(t); await verifyPlayCredit(f.args); f.publisher.get=async()=>({...purchase(),consumptionState:1}); await verifyPlayCredit(f.args); assert.equal(f.store.balance(email),10); });
test('same Google order with different token cannot grant twice', async t => { const f=fixture(t); await verifyPlayCredit(f.args); await assert.rejects(verifyPlayCredit({...f.args,purchaseToken:'different-token'})); assert.equal(f.store.balance(email),10); });
test('receipt keeps original credits across catalog changes', async t => { const f=fixture(t); await verifyPlayCredit(f.args); await verifyPlayCredit({...f.args,config:{...config,products:{credits_small:50}}}); assert.equal(f.store.balance(email),10); });
test('route catalog no auth and verify wrong origin reject safely', async t => {
 const f=fixture(t); const routes=new Map(); installPlayCreditRoutes({get:(p,h)=>routes.set(p,h),post:(p,h)=>routes.set(p,h)},{store:f.store,env:{},publisher:f.publisher});
 const res={setHeader(){},status(n){this.code=n;return this;},json(x){this.body=x;}};
 await routes.get('/credits/play/catalog')({headers:{}},res); assert.equal(res.code,401);
 await routes.get('/credits/play/verify')({headers:{origin:'https://evil.example'}},res); assert.equal(res.code,403);
});
test('publisher failure never credits or consumes', async t => { const f=fixture(t); f.publisher.get=async()=>{throw new Error('offline');}; await assert.rejects(verifyPlayCredit(f.args)); assert.equal(f.store.balance(email),0); assert.equal(f.consumes(),0); });
test('durable grant failure never consumes', async t => { const f=fixture(t); f.store.applyPlayPurchase=()=>{throw new Error('disk full');}; await assert.rejects(verifyPlayCredit(f.args)); assert.equal(f.store.balance(email),0); assert.equal(f.consumes(),0); });
test('cancelled retry never adds credits', async t => { const f=fixture(t); await verifyPlayCredit(f.args); f.publisher.get=async()=>({...purchase(),purchaseState:1}); await assert.rejects(verifyPlayCredit(f.args)); assert.equal(f.store.balance(email),0); });
test('recovery is independent of new purchase gates and supports an empty catalog', () => {
 const env={PLAY_SERVICE_ACCOUNT_FILE:'/private/play.json',PLAY_ACCOUNT_BINDING_SECRET:'s'.repeat(32),PLAY_PACKAGE_NAME:'net.manytool.app'};
 assert.equal(readPlayConfig(env).recoveryAvailable,true); assert.equal(readPlayConfig(env).enabled,false);
 assert.equal(readPlayConfig({...env,PLAY_ACCOUNT_BINDING_SECRET:''}).recoveryAvailable,false);
 assert.throws(()=>readPlayConfig({PLAY_CREDIT_PRODUCTS_JSON:JSON.stringify(Object.fromEntries(Array.from({length:21},(_,i)=>['product'+i,10])))}));
});
for (const enabled of [true,false]) test(`retired product receipt recovery when enabled=${enabled} never invokes grant`, async t => {
 const f=fixture(t); f.publisher.consume=async()=>{throw Error('offline');}; await verifyPlayCredit(f.args);
 f.publisher.consume=async()=>{}; f.store.applyPlayPurchase=()=>assert.fail('recovery must not grant');
 const result=await verifyPlayCredit({...f.args,config:{...config,enabled,products:{}}});
 assert.equal(result.consumptionPending,false); assert.equal(result.balance,10);
 assert.equal(f.store.playReceipt(playTokenHash(token)).consumed,1);
});
test('disabled new purchases reject unknown receipt before Google, even allowed product', async t => {
 const f=fixture(t); f.publisher.get=async()=>assert.fail('must not call Google');
 await assert.rejects(verifyPlayCredit({...f.args,config:{...config,enabled:false}})); assert.equal(f.store.balance(email),0);
});
test('disabled recovery requires valid recovery configuration and matching owner', async t => {
 const f=fixture(t); await verifyPlayCredit(f.args); f.publisher.get=async()=>assert.fail('must not call Google');
 await assert.rejects(verifyPlayCredit({...f.args,config:{...config,enabled:false,recoveryAvailable:false}}));
 await assert.rejects(verifyPlayCredit({...f.args,email:'other@example.com',config:{...config,enabled:false}}));
});
test('disabled recovery still rejects revoked purchase without consuming', async t => {
 const f=fixture(t); await verifyPlayCredit(f.args); f.publisher.get=async()=>({...purchase(),purchaseState:1});
 f.publisher.consume=async()=>assert.fail('must not consume');
 await assert.rejects(verifyPlayCredit({...f.args,config:{...config,enabled:false,products:{}}})); assert.equal(f.store.balance(email),0);
});
test('disabled catalog advertises recovery with binding but no products', async t => {
 const f=fixture(t), routes=new Map(); f.store.authenticate=()=>email;
 installPlayCreditRoutes({get:(p,h)=>routes.set(p,h),post:(p,h)=>routes.set(p,h)},{store:f.store,publisher:f.publisher,env:{PLAY_SERVICE_ACCOUNT_FILE:'/private/play.json',PLAY_ACCOUNT_BINDING_SECRET:config.bindingSecret,PLAY_PACKAGE_NAME:config.packageName}});
 const res={setHeader(){},status(n){this.code=n;return this;},json(x){this.body=x;}};
 await routes.get('/credits/play/catalog')({headers:{}},res);
 assert.deepEqual(res.body,{enabled:false,recoveryAvailable:true,accountBinding:playAccountBinding(email,config.bindingSecret),products:[]});
});

test('recovery token encryption is authenticated and not stored as plaintext',()=>{
 const hash=playTokenHash(token), sealed=sealPlayToken(token,hash,config.tokenKey);
 assert.equal(sealed.includes(token),false); assert.equal(openPlayToken(sealed,hash,config.tokenKey),token);
 assert.throws(()=>openPlayToken(sealed,'wrong-hash',config.tokenKey));
 assert.throws(()=>openPlayToken(sealed,hash,'cd'.repeat(32)));
});
test('consume failure has durable encrypted job, retries independently of catalog and removes secret after success',async t=>{
 const f=fixture(t); f.publisher.consume=async()=>{throw Error('offline');}; await verifyPlayCredit(f.args);
 const job=f.store.pendingPlayConsumes(Date.now())[0]; assert.ok(job); assert.ok(!job.sealed_token.includes(token));
 f.publisher.consume=async()=>{};
 const result=await retryPlayConsumes({...f.args,config:{...config,enabled:false,products:{}}});
 assert.equal(result.completed,1); assert.equal(f.store.pendingPlayConsumes(Date.now()).length,0); assert.equal(f.store.balance(email),10);
});
test('durable retry backs off on failure and never grants more credits',async t=>{
 const f=fixture(t); f.publisher.consume=async()=>{throw Error('offline');};await verifyPlayCredit(f.args);
 const now=Date.now(); assert.equal((await retryPlayConsumes({...f.args,now})).pending,1);
 assert.equal(f.store.pendingPlayConsumes(now).length,0); assert.equal(f.store.pendingPlayConsumes(now+60001).length,1);
 assert.equal(f.store.balance(email),10);
});
test('paginated voids reverse spent credits to debt once, stop retry and prevent regrant',async t=>{
 const f=fixture(t); f.publisher.consume=async()=>{throw Error('offline');};await verifyPlayCredit(f.args);
 f.store.change('spent',email,-8,'usage');let calls=0;
 f.publisher.listVoided=async(pkg,options)=>{calls++;return options.pageToken?{voidedPurchases:[{purchaseToken:token,voidedQuantity:1}]}:{tokenPagination:{nextPageToken:'page2'}};};
 await reconcilePlayVoids(f.args);await reconcilePlayVoids(f.args);
 assert.equal(calls,4);assert.equal(f.store.balance(email),-8);assert.equal(f.store.pendingPlayConsumes(Date.now()).length,0);
 await assert.rejects(verifyPlayCredit(f.args),/voided/);
});
test('void arriving before grant leaves tombstone',async t=>{
 const f=fixture(t); f.publisher.listVoided=async()=>({voidedPurchases:[{purchaseToken:token}]});
 await reconcilePlayVoids(f.args); await assert.rejects(verifyPlayCredit(f.args),/voided/);assert.equal(f.store.balance(email),0);
});
test('failed pagination keeps old cursor; unsupported refund quantity fails closed',async t=>{
 const f=fixture(t), before=f.store.playSyncTime(config.packageName);
 f.publisher.listVoided=async()=>({tokenPagination:{nextPageToken:'loop'}});
 await assert.rejects(reconcilePlayVoids(f.args),/pagination/);assert.equal(f.store.playSyncTime(config.packageName),before);
 f.publisher.listVoided=async()=>({voidedPurchases:[{purchaseToken:token,voidedQuantity:2}]});
 await assert.rejects(reconcilePlayVoids(f.args),/quantity/);assert.equal(f.store.playSyncTime(config.packageName),before);
});
test('stale sync blocks new grant and history gap is not silently cleared',async t=>{
 const f=fixture(t);f.store.markPlaySynced(config.packageName,Date.now()-900001);
 await assert.rejects(verifyPlayCredit(f.args),/stale/);
 f.store.markPlaySynced(config.packageName,Date.now()-30*86400000);
 f.publisher.listVoided=async()=>assert.fail('history gap requires operator reconciliation');
 await assert.rejects(reconcilePlayVoids(f.args),/history gap/);
});
test('cancelled purchase found by durable retry claws back and erases encrypted job',async t=>{
 const f=fixture(t);f.publisher.consume=async()=>{throw Error('offline');};await verifyPlayCredit(f.args);
 f.publisher.get=async()=>({...purchase(),purchaseState:1});await retryPlayConsumes(f.args);
 assert.equal(f.store.balance(email),0);assert.equal(f.store.pendingPlayConsumes(Date.now()).length,0);
});

test('retry job and void cursor survive database close/reopen',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'play-recovery-'));let store;
 try {
  store=new CreditStore(join(dir,'credits.sqlite'));store.markPlaySynced(config.packageName,Date.now());
  const publisher={get:async()=>purchase(),consume:async()=>{throw Error('offline');}};
  await verifyPlayCredit({store,config,publisher,email,productId:'credits_small',purchaseToken:token});
  store.close();store=new CreditStore(join(dir,'credits.sqlite'));publisher.consume=async()=>{};
  assert.ok(store.playSyncTime(config.packageName));assert.equal(store.pendingPlayConsumes(Date.now()).length,1);
  await retryPlayConsumes({store,config,publisher});assert.equal(store.balance(email),10);
  assert.equal(store.pendingPlayConsumes(Date.now()).length,0);
 } finally {store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('atomic grant rolls back when durable queue persistence fails',async t=>{
 const f=fixture(t);f.store.queuePlayConsume=()=>{throw Error('disk full');};
 await assert.rejects(verifyPlayCredit(f.args));assert.equal(f.store.balance(email),0);assert.equal(f.consumes(),0);
 assert.equal(f.store.playReceipt(playTokenHash(token)),undefined);
});

test('freshness is rechecked after Google lookup before committing credits',async t=>{
 const f=fixture(t);f.publisher.get=async()=>{f.store.markPlaySynced(config.packageName,Date.now()-900001);return purchase();};
 await assert.rejects(verifyPlayCredit(f.args),/stale/);assert.equal(f.store.balance(email),0);assert.equal(f.consumes(),0);
});
test('catalog hides products when refund synchronization is stale',async t=>{
 const f=fixture(t),routes=new Map();f.store.authenticate=()=>email;f.store.markPlaySynced(config.packageName,Date.now()-900001);
 const env={PLAY_CREDITS_ENABLED:'true',CREDITS_ENABLED:'true',CREDITS_TOOLS_READY:'true',PLAY_REFUND_RECONCILIATION_READY:'true',PLAY_WORKER_ENABLED:'true',PLAY_TOKEN_ENCRYPTION_KEY:config.tokenKey,PLAY_ACCOUNT_BINDING_SECRET:config.bindingSecret,PLAY_PACKAGE_NAME:config.packageName,PLAY_SERVICE_ACCOUNT_FILE:'/test/not-real.json',PLAY_CREDIT_PRODUCTS_JSON:JSON.stringify(config.products)};
 // Real install enables worker; provider is deliberately unavailable to keep the cursor stale.
 f.publisher.listVoided=async()=>{throw Error('offline');};
 const stop=installPlayCreditRoutes({get:(p,h)=>routes.set(p,h),post:(p,h)=>routes.set(p,h)},{store:f.store,env,publisher:f.publisher});
 t.after(()=>stop?.());
 const res={setHeader(){},json(body){this.body=body;},status(){return this;}};
 await routes.get('/credits/play/catalog')({headers:{}},res);
 assert.equal(res.body.enabled,false);assert.deepEqual(res.body.products,[]);
});
