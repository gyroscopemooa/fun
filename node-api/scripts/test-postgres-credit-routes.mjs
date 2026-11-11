import assert from 'node:assert/strict';
import express from 'express';
import {createPostgresTestFixture} from './postgres-test-fixture.mjs';
import {PostgresCreditStore} from '../src/credits/postgres-store.js';
import {installCreditRoutes} from '../src/credits/routes.js';
import {REFUND_POLICY_VERSION} from '../src/credits/refunds.js';
const fixture=await createPostgresTestFixture(),store=new PostgresCreditStore(fixture.pool);
const orders=new Map(),origin='https://manytool.test',owner='native-http@example.invalid';
let server,loginToken,topupId,price=1,externalCalls=0;
const env={PUBLIC_WEB_BASE_URL:origin,CREDITS_ENABLED:'true',CREDITS_TOOLS_READY:'true',CREDITS_TOOL_PRICING_JSON:JSON.stringify({calorie:{retailKrw:4500,costKrw:1000}}),POLAR_PRODUCT_CREDITS_10:'fake-product',POLAR_ACCESS_TOKEN:'fake',POLAR_WEBHOOK_SECRET:'fake',RESEND_API_KEY:'fake',RESEND_FROM_EMAIL:'fake@example.invalid'};
const fetcher=async(url,options)=>{
  externalCalls++;
  if(url==='https://api.resend.com/emails'){const body=JSON.parse(options.body);loginToken=/login=([a-f0-9]{64})/.exec(body.text)?.[1];assert.ok(loginToken);return Response.json({id:'fake-email'});}
  if(url.endsWith('/v1/products/fake-product'))return Response.json({is_recurring:false,is_archived:false,prices:[{is_archived:false,amount_type:'fixed',price_currency:'krw',price_amount:price}]});
  if(url.endsWith('/v1/checkouts')){topupId=JSON.parse(options.body).metadata.credit_topup_id;return Response.json({id:'fake-checkout',url:'https://example.invalid/fake-checkout'});}
  throw Error('Unexpected fake provider request');
};
try{
  const app=express();app.use(express.json());installCreditRoutes(app,{store,orders,env,fetcher,verifyWebhook:req=>{if(req.headers['x-fixture-signature']!=='valid')throw Error('invalid');}});
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;let cookie='';
  const post=(path,body={},headers={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/credits/me')).status,401);
  assert.equal((await post('/credits/login',{email:owner},{Origin:'https://bad.invalid'})).status,403);
  assert.equal((await post('/credits/login',{email:owner})).status,200);
  const session=await post('/credits/session',{token:loginToken});assert.equal(session.status,200);cookie=session.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/credits/session',{token:loginToken})).status,401);
  const request={packId:'10',refundPolicyVersion:REFUND_POLICY_VERSION};
  assert.equal((await post('/credits/topup',request)).status,503);price=10000;
  assert.equal((await post('/credits/topup',request)).status,201);assert.ok(topupId);
  const event={type:'order.paid',data:{id:'fake-polar-order',paid:true,product_id:'fake-product',currency:'krw',net_amount:10000,discount_amount:0,checkout_id:'fake-checkout',metadata:{credit_topup_id:topupId}}};
  assert.equal((await post('/credits/webhook',event)).status,401);
  assert.equal((await post('/credits/webhook',event,{'x-fixture-signature':'valid'})).status,200);
  assert.equal((await post('/credits/webhook',event,{'x-fixture-signature':'valid'})).status,200);
  let me=await (await fetch(base+'/credits/me',{headers:{Cookie:cookie}})).json();assert.equal(me.balance,10);assert.equal(me.email,owner);
  const purchase={productType:'calorie',requestKey:'native-route-purchase-123'};
  const first=await post('/credits/purchase',purchase);assert.equal(first.status,201);const order=await first.json();
  const second=await (await post('/credits/purchase',purchase)).json();assert.equal(second.orderId,order.orderId);assert.equal(await store.balance(owner),5);assert.ok(orders.has(order.orderId));
  assert.equal((await post('/credits/cancel',{orderId:order.orderId})).status,200);assert.equal(await store.balance(owner),10);
  const quote=await (await post('/credits/refund/quote',{topupId})).json();assert.equal(quote.remainingCredits,10);
  assert.equal((await post('/credits/refund/request',{...quote,confirmed:true})).status,200);assert.equal(await store.balance(owner),0);
  assert.equal((await post('/credits/webhook',{...event,type:'order.refunded',data:{...event.data,refunded_amount:quote.refundAmount}},{'x-fixture-signature':'valid'})).status,200);
  me=await (await fetch(base+'/credits/me',{headers:{Cookie:cookie}})).json();assert.equal(me.topups[0].refundStatus,'completed');
  assert.equal((await post('/credits/logout')).status,200);assert.equal((await fetch(base+'/credits/me',{headers:{Cookie:cookie}})).status,401);
  console.log(JSON.stringify({ok:true,checks:['awaited email login/session/logout','server price and webhook gates','Polar grant replay','purchase retry and unused cancel','refund quote/hold/settlement'],fakeProviderCalls:externalCalls,externalProviderCalls:0}));
}catch(error){process.exitCode=1;console.error(JSON.stringify({ok:false,code:/^[A-Z0-9_]{2,40}$/.test(error.code??'')?error.code:'CREDIT_HTTP_TEST_FAILED'}));}
finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await fixture.close();}
