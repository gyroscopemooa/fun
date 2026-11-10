import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import express from 'express';
import {renderNicepayPgForm,buildPgAuthorization,createNicepayPgClient,installDisabledNicepayPgRoutes} from './nicepay-pg.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const config={variant:'legacy',id:'fake00000m',secret:'fake-not-a-merchant-key',returnUrl:'https://manytool.net/payments/nicepay/return'};
const order={id:'test-order',amount:10000,currency:'KRW'};
const tid='a'.repeat(30), timestamp='20261111090000';
const auth={AuthResultCode:'0000',MID:config.id,Moid:order.id,Amt:'10000',AuthToken:'fake-token',TxTid:tid,PayMethod:'CARD',NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp',NetCancelURL:'https://dc1-api.nicepay.co.kr/webapi/cancel_process.jsp'};
auth.Signature=hash(auth.AuthToken+config.id+auth.Amt+config.secret);
const paid={ResultCode:'3001',MID:config.id,Moid:order.id,Amt:'000000010000',TID:tid,PayMethod:'CARD'};
paid.Signature=hash(tid+config.id+paid.Amt+config.secret);
const cancel={ResultCode:'2001',MID:config.id,CancelAmt:'000000010000',TID:tid,PayMethod:'CARD'};
cancel.Signature=hash(tid+config.id+cancel.CancelAmt+config.secret);
test('real PG request wire format and test form keep key private',()=>{
 const r=buildPgAuthorization(auth,order,config,timestamp), fields=new URLSearchParams(r.body);
 assert.equal(fields.get('SignData'),hash(auth.AuthToken+config.id+order.amount+timestamp+config.secret));
 assert.equal(fields.get('CharSet'),'utf-8');assert.ok(!r.body.includes(config.secret));
 const html=renderNicepayPgForm(order,config,timestamp);assert.match(html,/accept-charset="euc-kr"/);assert.match(html,/nicepaySubmit/);assert.ok(!html.includes(config.secret));
});
test('default transport never calls fetch',async()=>{
 let calls=0;const client=createNicepayPgClient({config,fetcher:()=>{calls++;}});
 await assert.rejects(client.approve(auth,order,timestamp),/disabled/);assert.equal(calls,0);
});
test('mocked approval sends exactly one nonredirecting bounded request',async()=>{
 let calls=0;const client=createNicepayPgClient({config,enabled:true,fetcher:async(url,options)=>{
 calls++;assert.equal(url,auth.NextAppURL);assert.equal(options.redirect,'error');assert.ok(options.signal);return Response.json(paid);}});
 assert.equal((await client.approve(auth,order,timestamp)).verified,true);assert.equal(calls,1);
});
test('tampered authentication never reaches network',async()=>{
 let calls=0;const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{calls++;}});
 await assert.rejects(client.approve({...auth,Amt:'1'},order,timestamp));assert.equal(calls,0);
});
test('timeout, invalid approval, non-JSON and oversized response are uncertain, not auto-retried',async()=>{
 for(const response of [()=>{throw Error('timeout')},()=>Response.json({...paid,Amt:'1'}),()=>new Response('bad'),()=>new Response('a'.repeat(70000)),()=>new Response('',{status:500})]){
 let calls=0;const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{calls++;return response();}});
 await assert.rejects(client.approve(auth,order,timestamp),e=>e.code==='NICEPAY_UNCERTAIN');assert.equal(calls,1);
 }
});
test('explicit network cancel validates same DC destination and signed cancel amount',async()=>{
 let calls=0;const client=createNicepayPgClient({config,enabled:true,fetcher:async(url,options)=>{
 calls++;assert.equal(url,auth.NetCancelURL);assert.equal(new URLSearchParams(options.body).get('NetCancel'),'1');return Response.json(cancel);}});
 assert.equal((await client.networkCancel(auth,order,timestamp)).cancelled,true);
 await assert.rejects(client.networkCancel({...auth,NetCancelURL:'https://evil.test'},order,timestamp));assert.equal(calls,1);
 const bad=createNicepayPgClient({config,enabled:true,fetcher:async()=>Response.json({...cancel,Signature:'0'.repeat(64)})});
 await assert.rejects(bad.networkCancel(auth,order,timestamp),e=>e.code==='NICEPAY_UNCERTAIN');
});
test('public config disabled and callback/checkout return 503 without processing',async t=>{
 const app=express();installDisabledNicepayPgRoutes(app);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await (await fetch(base+'/payments/nicepay/config')).json()).enabled,false);
 for(const path of ['checkout','return'])assert.equal((await fetch(base+'/payments/nicepay/'+path,{method:'POST'})).status,503);
});
