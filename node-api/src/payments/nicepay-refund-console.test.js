import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {CreditStore} from '../credits/store.js';import {NicepayOrderStore} from './nicepay-orders.js';import {readNicepayPolicy} from './nicepay-policy.js';import {fulfillNicepayOrder} from './nicepay-fulfillment.js';
import {reserveNicepayFullRefund,releaseUnsentNicepayRefund,dispatchNicepayFullRefund,recoverNicepayRefunds,reconcileNicepayFullRefund} from './nicepay-refund.js';
const config={id:'fake00000m',variant:'legacy',secret:'offline-not-real-secret'},tid='a'.repeat(30);
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'nice-refund-')),file=join(dir,'wallet.sqlite');const wallet=new CreditStore(file),store=new NicepayOrderStore(file);t.after(()=>{store.close();wallet.close();rmSync(dir,{recursive:true});});
 const policy=readNicepayPolicy(JSON.stringify({enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:10000}}}));
 const order=store.create({productId:'pack',ownerId:'owner'}, {pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Credits'}},policy,config.id);
 store.claim(order.id,tid);store.recordVerified({orderId:order.id,tid,amount:10000,currency:'KRW',verified:true});fulfillNicepayOrder(wallet,order.id);return {wallet,store,orderId:order.id};}

import express from 'express';import {createNicepayRefundConsole} from './nicepay-refund-console.js';
test('customer refund intake is owner-bound, stale-attempt safe, and operations are explicitly allowlisted',async t=>{
 const f=fixture(t),app=express(),origin='https://manytool.net';let calls=0;
 app.use('/refunds',createNicepayRefundConsole({enabled:true,store:f.store,creditStore:f.wallet,origin,authenticate:req=>{if(!req.headers['x-owner'])throw Error();return req.headers['x-owner'];},operators:['operator'],refundOperations:{enabled:true,config,client:{fullCancel:async(order,timestamp,cancelId)=>{calls++;return {orderId:order.id,tid,cancelOrderId:cancelId,amount:order.amount,cancelled:true};}}}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port+'/refunds';
 const post=(path,body={},owner='owner',o=origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','x-owner':owner,Origin:o},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/')).status,401);
 assert.equal((await post('/reserve',{orderId:f.orderId,cancelId:null},'other')).status,409);
 assert.equal((await post('/reserve',{orderId:f.orderId,cancelId:null},'owner','https://evil.invalid')).status,403);
 const first=await (await post('/reserve',{orderId:f.orderId,cancelId:null})).json();const id=first.orders[0].cancelId;assert.equal(f.wallet.balance('owner'),0);
 assert.equal((await post('/reserve',{orderId:f.orderId,cancelId:null})).status,409);
 assert.equal((await post('/withdraw',{orderId:f.orderId,cancelId:id})).status,200);assert.equal(f.wallet.balance('owner'),10);
 const second=await (await post('/reserve',{orderId:f.orderId,cancelId:id})).json();assert.notEqual(second.orders[0].cancelId,id);
 assert.equal((await post('/withdraw',{orderId:f.orderId,cancelId:id})).status,409);assert.equal(f.wallet.balance('owner'),0);
 assert.equal((await post('/operations/recover')).status,403);
 assert.equal((await post('/operations/recover',{},'operator')).status,200);
 assert.equal(f.wallet.db.prepare('SELECT state FROM nice_refunds').get().state,'reserved');
 assert.equal((await (await post('/orders',{},'other')).json()).orders.length,0);
 const target={orderId:f.orderId,cancelId:second.orders[0].cancelId,amount:10000,confirmed:true};
 assert.equal((await post('/operations/dispatch',target)).status,403);
 assert.equal((await post('/operations/dispatch',{...target,cancelId:id},'operator')).status,409);
 assert.equal((await post('/operations/dispatch',{...target,amount:1},'operator')).status,409);
 assert.equal((await post('/operations/dispatch',{...target,confirmed:false},'operator')).status,409);assert.equal(calls,0);
 assert.equal((await post('/operations/dispatch',target,'operator')).status,200);assert.equal(calls,1);
 assert.equal((await post('/operations/dispatch',target,'operator')).status,409);assert.equal(calls,1);
 assert.equal(f.wallet.topup('nicepay:'+f.orderId).status,'refunded');

});
test('uncertain dispatch holds rights until matching signed cancellation, default transport stays disabled',async t=>{
 const f=fixture(t),app=express(),origin='https://manytool.net';let calls=0;
 const options={enabled:true,store:f.store,creditStore:f.wallet,origin,authenticate:()=> 'operator',operators:['operator']};
 app.use('/off',createNicepayRefundConsole(options));
 app.use('/on',createNicepayRefundConsole({...options,refundOperations:{enabled:true,config,client:{fullCancel:async()=>{calls++;throw Error('uncertain timeout');}}}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 const r=reserveNicepayFullRefund(f.wallet,f.orderId,'owner'),target={orderId:f.orderId,cancelId:r.cancel_id,amount:10000,confirmed:true};
 assert.equal((await post('/off/operations/dispatch',target)).status,503);assert.equal(calls,0);
 assert.equal((await post('/on/operations/dispatch',target)).status,409);assert.equal(calls,1);
 assert.equal((await post('/on/operations/dispatch',target)).status,409);assert.equal(calls,1);assert.equal(f.wallet.balance('owner'),0);
 const receipt={ResultCode:'2001',MID:config.id,TID:tid,Moid:r.cancel_id,PayMethod:'CARD',CancelAmt:'000000010000',RemainAmt:'000000000000'};
 assert.equal((await post('/on/operations/reconcile',{orderId:f.orderId,receipt})).status,409);
 receipt.Signature=createHash('sha256').update(tid+config.id+receipt.CancelAmt+config.secret).digest('hex');
 assert.equal((await post('/on/operations/reconcile',{orderId:f.orderId,receipt})).status,200);
 assert.equal((await post('/on/operations/reconcile',{orderId:f.orderId,receipt})).status,200);
 assert.equal(f.wallet.topup('nicepay:'+f.orderId).status,'refunded');assert.equal(calls,1);
});
