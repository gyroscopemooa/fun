import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createCreditOrderAccess,creditResponseSettlement,forwardAsyncRouteErrors,lockCachedNameInput,claimCachedPhotoJob,observeCreditBackground} from './runtime.js';

test('credit cache is published only after durable save and uses authoritative refunded data',async()=>{
  let finish;const wait=new Promise(resolve=>{finish=resolve;});const cache=new Map();
  const access=createCreditOrderAccess(cache,{saveOrder:()=>wait,order:async()=>({id:'one',status:'refunded',paymentMode:'credits'})});
  const pending=access.set('one',{id:'one',status:'paid',paymentMode:'credits'});assert.equal(cache.has('one'),false);finish();await pending;assert.equal(cache.get('one').status,'refunded');
});
test('failed durable save never changes cached order',async()=>{
  const cache=new Map([['one',{status:'old'}]]),access=createCreditOrderAccess(cache,{saveOrder:async()=>{throw Error('offline');}});
  await assert.rejects(access.set('one',{paymentMode:'credits'}));assert.equal(cache.get('one').status,'old');
});
test('response waits for settlement and returns 503 instead of false success on failure',async()=>{
  for(const fails of [false,true]){
    let resolve;const gate=new Promise(r=>{resolve=r;}),sent=[];
    const res={statusCode:200,headersSent:false,json(body){sent.push(body);},status(value){this.statusCode=value;return this;}};
    creditResponseSettlement({order:async()=>({}),finish:async()=>{await gate;if(fails)throw Error('offline');}})({method:'POST',path:'/ai-personal-color/analyze',body:{orderId:'one'},creditClaimed:'one'},res,()=>{});
    res.json({ok:true});assert.equal(sent.length,0);resolve();await new Promise(r=>setImmediate(r));assert.equal(sent.length,1);assert.equal(res.statusCode,fails?503:200);assert.equal(Boolean(sent[0].ok),!fails);
  }
});
test('Express 4 routes forward async rejection without leaking error details',async t=>{
  const app=express();forwardAsyncRouteErrors(app);app.get('/fail',[async()=>{throw Error('private detail');}]);app.use((_e,_q,res,_n)=>res.status(503).json({error:'unavailable'}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/fail');assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});
});
test('concurrent direct Polar name inputs cannot both lock a stale snapshot',async()=>{
  const cache=new Map([['one',{id:'one',productType:'ai_name_premium',status:'paid'}]]),access=createCreditOrderAccess(cache,null);
  const lock=async value=>{await access.get('one');return lockCachedNameInput(cache,'one',{given:[value]});};
  const results=await Promise.allSettled([lock('A'),lock('B')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(cache.get('one').namePremiumLock,{given:['A']});
});
test('concurrent direct Polar photo requests claim only one job',async()=>{
  const cache=new Map([['one',{id:'one',status:'paid'}]]),jobs=new Map([['a',{status:'processing'}],['b',{status:'processing'}]]),access=createCreditOrderAccess(cache,null);
  const claim=async id=>{await access.get('one');return claimCachedPhotoJob(cache,jobs,'one',id);};
  const results=await Promise.allSettled([claim('a'),claim('b')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(cache.get('one').aiPhotoJobId,'a');
});
test('failure inside detached settlement is observed and does not claim a refund',async()=>{
  const job={status:'done',imageUrl:'/fake-result'};
  await observeCreditBackground(Promise.reject(Error('provider')).catch(async()=>{throw Error('database unavailable');}),()=>job);
  assert.equal(job.creditSettlementPending,true);assert.equal(job.status,'done');assert.equal(job.creditRefunded,undefined);
});
