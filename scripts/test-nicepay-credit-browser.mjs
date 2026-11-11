// Real Chromium UI regression. All browser traffic stays on an intercepted test
// origin and a loopback server; no merchant, email or paid provider is contacted.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { CreditStore } from '../node-api/src/credits/store.js';
import { NicepayOrderStore } from '../node-api/src/payments/nicepay-orders.js';
import { createNicepayServerStaging } from '../node-api/src/payments/nicepay-server-staging.js';
import { fulfillNicepayOrder } from '../node-api/src/payments/nicepay-fulfillment.js';
import { createPostgresTestFixture } from '../node-api/scripts/postgres-test-fixture.mjs';
const require = createRequire(new URL('../node-api/package.json', import.meta.url));
const express = require('express');
const postgres=process.env.NICEPAY_TEST_DATABASE==='postgres';
const fixture=postgres?await createPostgresTestFixture():null;
const dir = postgres?null:await mkdtemp(join(tmpdir(), 'nice-browser-'));
const file = dir?join(dir, 'wallet.sqlite'):null, wallet = fixture?.store??new CreditStore(file), store = fixture?.store??new NicepayOrderStore(file);
const origin = 'https://nicepay.test', owner = 'browser@example.invalid';
const config = {variant:'legacy',id:'fake00000m',secret:'offline-only',returnUrl:origin+'/nice/payment/return'};
// Fictional fixtures only; these values never configure the product catalog.
const catalog = {pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Fixture'}};
const policy = {enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:10000}}};
let browser, context, server, providerCalls = 0;
try {
 const order = await store.create({productId:'pack',ownerId:owner},catalog,policy,config.id);
 await store.claim(order.id,'b'.repeat(30));
 await store.recordVerified({orderId:order.id,tid:'b'.repeat(30),amount:10000,currency:'KRW',verified:true});
 await fulfillNicepayOrder(wallet,order.id);
 const client = {approve:async()=>{providerCalls++;throw Error('No provider calls allowed');}};
 const app = express();
 app.use('/nice',(await createNicepayServerStaging({enabled:true,customerEnabled:true,store,creditStore:wallet,origin,payment:{config,catalog,policy,client}})).router);
 app.use('/off',(await createNicepayServerStaging()).router);
 server = app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const loopback = 'http://127.0.0.1:'+server.address().port;
 browser = await chromium.launch({headless:true,...(process.env.NICEPAY_TEST_BROWSER_CHANNEL?{channel:process.env.NICEPAY_TEST_BROWSER_CHANNEL}:{})});
 context = await browser.newContext();
 await context.addCookies([{name:'manytool_credit_session',value:await wallet.token(owner,'session',600000),url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
 const blocked = [],routeErrors=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){blocked.push(url.origin);return route.abort();}
  const headers=await request.allHeaders();delete headers.host;
  try{const response=await context.request.fetch(loopback+url.pathname+url.search,{method:request.method(),headers,data:request.postDataBuffer()??undefined,maxRedirects:0});
  await route.fulfill({response});}catch{routeErrors.push('Loopback browser request failed');await route.abort().catch(()=>{});}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/nice/customer-credits/');
 await page.locator('#balance').filter({hasText:'10'}).waitFor();
 await page.locator('#consent').check();await page.locator('#prepare').click();
 await page.locator('#pay').waitFor({state:'visible'});
 const checkout=await page.locator('#pay').getAttribute('href');
 await page.reload();await page.locator('#pay').waitFor({state:'visible'});
 assert.equal(await page.locator('#pay').getAttribute('href'),checkout);
 await page.locator('#consent').check();await page.locator('#prepare').click();
 assert.equal(postgres?await store.read(async c=>(await c.query('SELECT count(*) n FROM nice_orders')).rows[0].n):store.db.prepare('SELECT count(*) n FROM nice_orders').get().n,2);
 await page.getByRole('link',{name:'환불 접수·처리 상태'}).click();
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'환불 접수',exact:true}).click();
 await page.getByRole('button',{name:'접수 철회',exact:true}).waitFor();
 assert.equal(await wallet.balance(owner),0);
 await page.getByRole('button',{name:'접수 철회',exact:true}).click();
 await page.getByRole('button',{name:'환불 접수',exact:true}).waitFor();
 assert.equal(await wallet.balance(owner),10);
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/nice/customer-credits/');
 await page.locator('#balance').filter({hasText:'10'}).waitFor();
 assert.ok(await page.locator('#prepare').isVisible());
 const disabled=await page.goto(origin+'/off/customer-credits/');assert.equal(disabled.status(),503);
 await context.clearCookies();
 const unauthenticated=await page.goto(origin+'/nice/customer-credits/');assert.equal(unauthenticated.status(),401);
 await context.unrouteAll({behavior:'wait'});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(routeErrors,[]);assert.equal(providerCalls,0);
 console.log('PASS Chromium ('+(postgres?'PostgreSQL':'SQLite')+'): balance, prepare/reload/retry, refund hold/withdraw, mobile controls, default-off and unauthenticated access; zero external browser/provider requests.');
} finally {
 await context?.unrouteAll({behavior:'wait'});
 await browser?.close();
 if(server)await new Promise(r=>server.close(r));
 if(fixture)await fixture.close();else{store.close();wallet.close();await rm(dir,{recursive:true,force:true});}
}
