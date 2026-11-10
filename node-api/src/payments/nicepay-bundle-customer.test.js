import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {Script,createContext} from 'node:vm';
import {createNicepayBundleCustomer,bundleCustomerClient} from './nicepay-bundle-customer.js';

function browser({saved=new Map(),fetcher=async()=>({ok:true,json:async()=>({text:'safe <script>'})})}={}) {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',files:[],hidden:false,disabled:false,textContent:'',append(){},replaceChildren(){},click(){}});return nodes.get(id);};
  for(const [id,value]of Object.entries({tool:'pet',order:'paid-order',animal:'dog',mode:'analyze',text:'hello',topK:'5',length:'2',surname:'金',given:'民秀',displayName:'김민수',gender:'female',calendar:'solar'}))node(id).value=value;
  let id=0;const context=createContext({document:{getElementById:node,createElement:()=>node('generated'+id++)},location:{pathname:'/nice/customer-bundles/'},
    sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},crypto:{randomUUID:()=>`request-${id++}`},
    fetch:(url,options)=>url.endsWith('/catalog')?Promise.resolve({ok:true,json:async()=>({products:[]})}):fetcher(url,options),window:{addEventListener(){},confirm:()=>true},URL:{createObjectURL:()=> 'blob:private',revokeObjectURL(){}},Date,JSON,Error,Number,String});
  new Script(bundleCustomerClient).runInContext(context);return {node,saved};
}
test('customer text flow retains request on interruption and replays same ID',async()=>{
  const calls=[],saved=new Map();let fail=true;
  const fetcher=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(fail)throw Error('lost response');return {ok:true,json:async()=>({text:'hello'})};};
  const first=browser({saved,fetcher});await first.node('petRun').onclick();
  assert.equal(calls.length,1);assert.equal(first.node('retry').hidden,false);
  assert.equal(first.node('order').disabled,true);
  // Reload is read-only; restoring pending work never sends automatically.
  const reopened=browser({saved,fetcher});assert.equal(calls.length,1);assert.equal(reopened.node('retry').hidden,false);
  fail=false;await reopened.node('retry').onclick();assert.equal(calls.length,2);
  assert.deepEqual(calls[0],calls[1]);assert.equal(saved.has('nice-bundle-pending'),false);
  reopened.node('next').onclick();assert.equal(reopened.node('petRun').disabled,false);
});
test('name analysis then recommendation preserves identity and changes operation ID',async()=>{
  const calls=[];const f=browser({fetcher:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({report:'test'})};}});
  await f.node('analyze').onclick();assert.equal(f.node('identity').disabled,true);
  f.node('next').onclick();f.node('surname').value='李';await f.node('recommend').onclick();
  assert.equal(calls[0].url,'/nice/bundles/name/analyze');assert.equal(calls[1].url,'/nice/bundles/name/recommend');
  assert.deepEqual(calls[0].body.input,calls[1].body.input);assert.notEqual(calls[0].body.requestId,calls[1].body.requestId);
});
test('double click cannot start duplicate work; storage failure never calls provider',async()=>{
  let release,calls=0;const f=browser({fetcher:async()=>{calls++;await new Promise(r=>{release=r;});return {ok:true,json:async()=>({})};}});
  const first=f.node('petRun').onclick();await f.node('petRun').onclick();assert.equal(calls,1);release();await first;
  const broken=new Map();broken.set=()=>{throw Error('quota');};const g=browser({saved:broken,fetcher:async()=>{throw Error('must not execute');}});
  await g.node('petRun').onclick();assert.match(g.node('message').textContent,/시작하지 않았습니다/);
});
test('customer form router is opt-in and requires authenticated session',async t=>{
  const app=express();app.use('/off',createNicepayBundleCustomer());app.use('/nice/customer-bundles',createNicepayBundleCustomer({enabled:true,origin:'https://manytool.net',authenticate:async req=>req.headers['x-test-user']}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/off')).status,503);assert.equal((await fetch(base+'/nice/customer-bundles')).status,401);
  const page=await fetch(base+'/nice/customer-bundles',{headers:{'x-test-user':'owner'}});const html=await page.text();
  assert.match(html,/30일/);assert.match(html,/분석과 추천/);assert.match(html,/이미 결제한 주문/);assert.match(page.headers.get('content-security-policy'),/media-src blob:/);
  const code=await fetch(base+'/nice/customer-bundles/client.js',{headers:{'x-test-user':'owner'}});new Script(await code.text());
});
test('customer approved checkout preparation is repeat-safe and preview is owned',async t=>{
  const {NicepayOrderStore}=await import('./nicepay-orders.js');const store=new NicepayOrderStore(':memory:');t.after(()=>store.close());
  const payment={config:{variant:'legacy',id:'fake00000m',secret:'offline-only-test-secret',returnUrl:'https://manytool.net/nice/payment/return'},
    policy:{enabled:true,apiConfirmed:true,variant:'legacy',categories:{direct:{approved:true,methods:['card'],maxAmountKrw:10000}}},
    catalog:{ai_pet_translator:{category:'direct',amount:1000,currency:'KRW',recurring:false,goodsName:'Pet pass'},ai_name_premium:{category:'direct',amount:1000,currency:'KRW',recurring:false,goodsName:'Name bundle'}}};
  const app=express();app.use('/nice/customer-bundles',createNicepayBundleCustomer({enabled:true,store,payment,origin:'https://manytool.net',authenticate:async req=>req.headers['x-test-user']}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={'x-test-user':'owner',Origin:'https://manytool.net','Content-Type':'application/json'};
  const post=(body,custom=headers)=>fetch(base+'/nice/customer-bundles/prepare',{method:'POST',headers:custom,body:JSON.stringify(body)});
  const body={productId:'ai_pet_translator',requestKey:'safe-pet-purchase-12345'};
  assert.equal((await post(body,{...headers,Origin:'https://evil.test'})).status,403);
  assert.equal((await post({...body,productId:'not-configured'})).status,409);
  const a=await (await post(body)).json(),b=await (await post(body)).json();assert.equal(a.orderId,b.orderId);assert.equal(a.amount,1000);
  assert.equal((await fetch(base+a.checkoutUrl,{headers:{'x-test-user':'other'}})).status,404);
  const preview=await fetch(base+a.checkoutUrl,{headers});assert.equal(preview.status,200);assert.match(await preview.text(),/Moid/);
  store.db.prepare("UPDATE nice_orders SET state='verified' WHERE id=?").run(a.orderId);
  assert.equal((await fetch(base+a.checkoutUrl,{headers})).status,404);
  const done=await (await post(body)).json();assert.equal(done.checkoutUrl,null);assert.equal(done.orderId,a.orderId);
  const reset=key=>fetch(base+'/nice/customer-bundles/new-purchase',{method:'POST',headers,body:JSON.stringify({requestKey:key})});
  store.db.prepare("UPDATE nice_orders SET state='created',expires=? WHERE id=?").run(Date.now()-1,a.orderId);
  assert.equal((await (await post(body)).json()).newPurchaseReason,'expired_checkout');
  const resets=await Promise.all([reset(body.requestKey),reset(body.requestKey)]);const [one,two]=await Promise.all(resets.map(r=>r.json()));assert.equal(one.requestKey,two.requestKey);
  for(const state of ['approving','uncertain','refunded']){store.db.prepare('UPDATE nice_orders SET state=? WHERE id=?').run(state,a.orderId);assert.equal((await reset(body.requestKey)).status,409);}
  store.db.exec("CREATE TABLE nice_bundle_runs(order_id TEXT,request_id TEXT,state TEXT);CREATE TABLE nice_bundle_locks(order_id TEXT,input TEXT);CREATE TABLE nice_entitlements(order_id TEXT,owner TEXT,product TEXT,state TEXT)");
  store.db.prepare("UPDATE nice_orders SET state='verified',tid='test-tid' WHERE id=?").run(a.orderId);
  store.db.prepare('INSERT INTO nice_receipts VALUES(?,?,?,?)').run(a.orderId,'test-tid',1000,Date.now()-31*86400000);
  store.db.prepare("INSERT INTO nice_entitlements VALUES(?,'owner','ai_pet_translator','claimed')").run(a.orderId);
  assert.equal((await (await post(body)).json()).newPurchaseReason,'expired_pass');
  store.db.prepare("INSERT INTO nice_bundle_runs VALUES(?,'running-request','uncertain')").run(a.orderId);assert.equal((await reset(body.requestKey)).status,409);
  store.db.prepare('DELETE FROM nice_bundle_runs').run();store.db.prepare("UPDATE nice_entitlements SET state='refund_hold'").run();assert.equal((await reset(body.requestKey)).status,409);
  const nameBody={productId:'ai_name_premium',requestKey:'name-purchase-new-12345'},name=await(await post(nameBody)).json();
  store.db.prepare("UPDATE nice_orders SET state='verified',tid='name-tid' WHERE id=?").run(name.orderId);
  store.db.prepare('INSERT INTO nice_receipts VALUES(?,?,?,?)').run(name.orderId,'name-tid',1000,Date.now());
  store.db.prepare("INSERT INTO nice_entitlements VALUES(?,'owner','ai_name_premium','claimed')").run(name.orderId);
  store.db.prepare("INSERT INTO nice_bundle_locks VALUES(?,'original identity')").run(name.orderId);
  assert.equal((await(await post(nameBody)).json()).newPurchaseReason,'new_identity');assert.equal((await reset(nameBody.requestKey)).status,200);
  assert.equal(store.db.prepare('SELECT input FROM nice_bundle_locks WHERE order_id=?').get(name.orderId).input,'original identity');

});
test('lost checkout response reuses the same purchase key without operator preview',async()=>{
  const bodies=[];let fail=true;const f=browser({fetcher:async(url,options)=>{bodies.push(JSON.parse(options.body));if(fail)throw Error('network');return {ok:true,json:async()=>({orderId:'existing-order',state:'created',amount:1000,currency:'KRW',checkoutUrl:'/nice/customer-bundles/pay/existing-order'})};}});
  await f.node('prepare').onclick();fail=false;await f.node('prepare').onclick();
  assert.equal(bodies[0].requestKey,bodies[1].requestKey);assert.equal(f.node('order').value,'existing-order');
  assert.equal(f.node('pay').href,'/nice/customer-bundles/pay/existing-order');
});
test('known preflight failure unlocks correction; ambiguous failure stays pending',async()=>{
  const f=browser({fetcher:async()=>({ok:false,json:async()=>({editable:true,error:'invalid input'})})});
  await f.node('analyze').onclick();assert.equal(f.node('analyze').disabled,false);assert.equal(f.node('retry').hidden,true);assert.equal(f.saved.has('nice-bundle-pending'),false);
  const g=browser({fetcher:async()=>({ok:false,json:async()=>({error:'uncertain provider'})})});
  await g.node('analyze').onclick();assert.equal(g.node('analyze').disabled,true);assert.equal(g.node('retry').hidden,false);assert.equal(g.saved.has('nice-bundle-pending'),true);
});
test('explicit new purchase rotates only server-approved key and retains prior order',async()=>{
  let resetFails=true;const f=browser({fetcher:async(url)=>{
    if(url.endsWith('/new-purchase')){if(resetFails)throw Error('lost reset');return {ok:true,json:async()=>({requestKey:'server-approved-next-key'})};}
    return {ok:true,json:async()=>({orderId:'old-order',state:'verified',amount:1000,currency:'KRW',newPurchaseReason:'expired_pass'})};
  }});
  await f.node('prepare').onclick();const key=f.saved.get('nice-bundle-purchase:ai_pet_translator');
  await f.node('newPurchase').onclick();assert.equal(f.saved.get('nice-bundle-purchase:ai_pet_translator'),key);
  resetFails=false;await f.node('newPurchase').onclick();assert.equal(f.saved.get('nice-bundle-purchase:ai_pet_translator'),'server-approved-next-key');
  assert.match(f.node('previousOrders').textContent,/old-order/);assert.equal(f.node('order').value,'');
});
