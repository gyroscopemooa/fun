import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPgInquiry,verifyPgInquiry,buildPgFullCancel,verifyPgFullCancel} from './nicepay-operations.js';
import {createNicepayPgClient} from './nicepay-pg.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const config={variant:'legacy',id:'fake00000m',secret:'offline-not-real-secret'};
const order={id:'order',merchantId:config.id,tid:'a'.repeat(30),amount:10000,currency:'KRW',state:'verified'};
const time='20261111090000';
test('inquiry request uses documented signature; status cannot authorize credit',()=>{
 const r=buildPgInquiry(order,config,time),p=new URLSearchParams(r.body);
 assert.equal(p.get('SignData'),hash(order.tid+config.id+time+config.secret));
 for(const Status of ['0','1','9'])assert.equal(verifyPgInquiry({ResultCode:'0000',TID:order.tid,Status},order).fulfillmentAllowed,false);
 assert.throws(()=>verifyPgInquiry({ResultCode:'0000',TID:'wrong',Status:'0'},order));
});
test('full cancellation signs exact amount and checks remaining balance',async()=>{
 const r=buildPgFullCancel(order,config,time,'cancel-1');assert.equal(new URLSearchParams(r.body).get('PartialCancelCode'),'0');
 const result={ResultCode:'2001',MID:config.id,TID:order.tid,Moid:'cancel-1',PayMethod:'CARD',CancelAmt:'000000010000',RemainAmt:'000000000000'};
 result.Signature=hash(order.tid+config.id+result.CancelAmt+config.secret);
 assert.equal(verifyPgFullCancel(result,order,config,'cancel-1').cancelled,true);
 for(const change of [{RemainAmt:'1'},{CancelAmt:'1'},{Moid:'wrong'},{Signature:'0'.repeat(64)}])assert.throws(()=>verifyPgFullCancel({...result,...change},order,config,'cancel-1'));
 const client=createNicepayPgClient({config,enabled:true,fetcher:async(url)=>{assert.equal(url,r.url);return Response.json(result);}});
 assert.equal((await client.fullCancel(order,time,'cancel-1')).cancelled,true);
 await assert.rejects(createNicepayPgClient({config}).fullCancel(order,time,'cancel-1'),/disabled/);
});
