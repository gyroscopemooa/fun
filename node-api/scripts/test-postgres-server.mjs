import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createPostgresTestFixture} from './postgres-test-fixture.mjs';
import {PostgresCreditStore} from '../src/credits/postgres-store.js';
import {PACKS} from '../src/credits/pricing.js';

const fixture=await createPostgresTestFixture(),store=new PostgresCreditStore(fixture.pool);
const dir=await mkdtemp(join(tmpdir(),'postgres-api-'));
let child;
try{
  const owner='server@example.invalid',row=await store.createTopup(owner,PACKS[0],'fake-product');
  await store.checkout(row.id,'fake-checkout','https://example.invalid');
  await store.applyPayment({type:'order.paid',data:{id:'fake-polar',paid:true,product_id:row.product,currency:'krw',net_amount:row.amount,checkout_id:'fake-checkout',metadata:{credit_topup_id:row.id}}});
  const session=await store.token(owner,'session',600000);
  const preload=join(dir,'no-provider-network.mjs');await writeFile(preload,"globalThis.fetch=async()=>{throw Error('External provider calls disabled by test');};\n");
  const port=19000+Math.floor(Math.random()*10000);
  child=spawn(process.execPath,['--import',pathToFileURL(preload).href,'node-api/src/server.js'],{cwd:new URL('../../',import.meta.url),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'test',PORT:String(port),CREDITS_STORAGE:'postgres',CREDITS_DATABASE_SCHEMA:fixture.schema,CREDITS_MIGRATION_CONFIRMED:'true',CREDITS_DB_PATH:'',CREDITS_ENABLED:'true',CREDITS_TOOLS_READY:'true',CREDITS_TOOL_PRICING_JSON:'{"ai_personal_color":{"retailKrw":4500,"costKrw":1000}}',PUBLIC_WEB_BASE_URL:'https://manytool.net',OPENAI_API_KEY:'fake-test-key',EXTERNAL_AI_ENABLED:'false',POLAR_ACCESS_TOKEN:'',RESEND_API_KEY:'',PAYMENT_MODE:'polar',PLAY_WORKER_ENABLED:'false'}});
  child.stdout.resume();child.stderr.resume();
  const base='http://127.0.0.1:'+port;let ready=false;
  for(let n=0;n<200;n++){if(child.exitCode!==null)throw Error('Test API exited');try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(ready);
  const buy=await fetch(base+'/credits/purchase',{method:'POST',headers:{Origin:'https://manytool.net',Cookie:'manytool_credit_session='+session,'Content-Type':'application/json'},body:JSON.stringify({productType:'ai_personal_color',requestKey:'postgres-api-request-123',amount:1})});
  assert.equal(buy.status,201);const purchase=await buy.json();assert.equal(await store.balance(owner),5);
  const analyze=()=>{const form=new FormData();form.append('orderId',purchase.orderId);form.append('image',new Blob(['fake-image'],{type:'image/png'}),'test.png');return fetch(base+'/ai-personal-color/analyze',{method:'POST',body:form});};
  const results=await Promise.all([analyze(),analyze()]);assert.deepEqual(results.map(r=>r.status).sort(),[409,500]);
  assert.equal(await store.balance(owner),10);assert.equal((await store.history(owner)).filter(r=>r.kind==='실패 복구').length,1);assert.equal((await store.order(purchase.orderId)).status,'refunded');
  assert.equal((await analyze()).status,402);
  await store.saveOrder({...await store.order(purchase.orderId),status:'paid'});assert.equal((await store.order(purchase.orderId)).status,'refunded');
  const stale=await store.purchase(owner,'native-name-lock-1234','name',2,{id:'native-name-lock',paymentMode:'credits',productType:'ai_name_premium',status:'paid'});
  const locks=await Promise.allSettled([store.lockNameInput(stale.id,{given:['A']}),store.lockNameInput(stale.id,{given:['B']})]);
  assert.equal(locks.filter(r=>r.status==='fulfilled').length,1);const winning=locks.find(r=>r.status==='fulfilled').value.namePremiumLock;
  await store.saveOrder(stale);assert.deepEqual((await store.order(stale.id)).namePremiumLock,winning);
  await assert.rejects(store.lockNameInput(stale.id,{given:[winning.given[0]==='A'?'B':'A']}));
  console.log(JSON.stringify({ok:true,checks:['real server PostgreSQL startup','server-authoritative price','concurrent tool claim has one winner','failed generation restored before response','replay and stale save cannot resurrect refunded order','competing name inputs and delayed replay preserve the winning lock'],externalProviderCalls:0}));
}catch(error){process.exitCode=1;console.error(JSON.stringify({ok:false,code:/^[A-Z0-9_]{2,40}$/.test(error.code??'')?error.code:'SERVER_TEST_FAILED'}));}
finally{if(child){child.kill();await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)resolve();else child.once('exit',resolve);});}await fixture.close();await rm(dir,{recursive:true,force:true});}
