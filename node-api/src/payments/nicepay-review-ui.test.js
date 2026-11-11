import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createNicepayCheckoutPreview} from './nicepay-staging-ui.js';

test('checkout preview awaits session and owned order, excluding unauthorized owners',async t=>{
 const app=express();
 const config={variant:'legacy',id:'000000002m',secret:'fictional-test-key-only',returnUrl:'https://example.invalid/return'};
 const store={async owned(id,owner){assert.equal(owner,'operator');return {id,owner,productId:'credits',state:'created',expires:Date.now()+60000,merchantId:config.id,amount:1000,currency:'KRW',goodsName:'Test credits'};}};
 app.use(createNicepayCheckoutPreview({store,authenticate:async req=>req.headers['x-test-owner'],payment:{config,catalog:{credits:{}}},operators:['operator']}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const url='http://127.0.0.1:'+server.address().port+'/payment/test-order';
 assert.equal((await fetch(url)).status,404);
 const response=await fetch(url,{headers:{'x-test-owner':'operator'}});
 assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/nicepay-pgweb.js/);assert.match(html,/test-order/);assert.ok(!html.includes(config.secret));
});
