import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {CreditStore} from '../credits/store.js';import {NicepayOrderStore} from './nicepay-orders.js';import {readNicepayPolicy} from './nicepay-policy.js';import {fulfillNicepayOrder} from './nicepay-fulfillment.js';
import {reserveNicepayFullRefund,releaseUnsentNicepayRefund,dispatchNicepayFullRefund,recoverNicepayRefunds,reconcileNicepayFullRefund} from './nicepay-refund.js';
const config={id:'fake00000m',variant:'legacy',secret:'offline-not-real-secret'},tid='a'.repeat(30);
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'nice-refund-')),file=join(dir,'wallet.sqlite');const wallet=new CreditStore(file),store=new NicepayOrderStore(file);t.after(()=>{store.close();wallet.close();rmSync(dir,{recursive:true});});
 const policy=readNicepayPolicy(JSON.stringify({enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:10000}}}));
 const order=store.create({productId:'pack',ownerId:'owner'}, {pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Credits'}},policy,config.id);
 store.claim(order.id,tid);store.recordVerified({orderId:order.id,tid,amount:10000,currency:'KRW',verified:true});fulfillNicepayOrder(wallet,order.id);return {wallet,store,orderId:order.id};}
function response(cancelId){const b={ResultCode:'2001',MID:config.id,TID:tid,Moid:cancelId,PayMethod:'CARD',CancelAmt:'000000010000',RemainAmt:'000000000000'};b.Signature=createHash('sha256').update(tid+config.id+b.CancelAmt+config.secret).digest('hex');return b;}
test('refund reserves full unused lot once and signed result cannot double debit',async t=>{const f=fixture(t),r=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');assert.equal(f.wallet.balance('owner'),0);assert.equal(f.wallet.lots('owner')[0].available,0);assert.equal(reserveNicepayFullRefund(f.wallet,f.orderId,'owner').cancel_id,r.cancel_id);
 let calls=0;await dispatchNicepayFullRefund({...f,client:{fullCancel:async()=>{calls++;return {orderId:f.orderId,tid,cancelOrderId:r.cancel_id,amount:10000,cancelled:true};}},timestamp:'20261111090000'});
 await assert.rejects(dispatchNicepayFullRefund({...f,client:{fullCancel:async()=>{calls++;}},timestamp:'20261111090000'}));assert.equal(calls,1);assert.equal(f.wallet.balance('owner'),0);
 assert.equal(reconcileNicepayFullRefund({...f,body:response(r.cancel_id),config}),false);});
test('timeout keeps hold across recovery and can reconcile signed full cancel',async t=>{const f=fixture(t),r=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');await assert.rejects(dispatchNicepayFullRefund({...f,client:{fullCancel:async()=>{throw Error('timeout');}},timestamp:'20261111090000'}));assert.equal(recoverNicepayRefunds(f.wallet).length,1);assert.throws(()=>releaseUnsentNicepayRefund(f.wallet,f.orderId,'owner'));assert.equal(f.wallet.balance('owner'),0);assert.equal(reconcileNicepayFullRefund({...f,body:response(r.cancel_id),config}),true);});
test('only unsent reservation can restore balance and never twice',t=>{const f=fixture(t);reserveNicepayFullRefund(f.wallet,f.orderId,'owner');releaseUnsentNicepayRefund(f.wallet,f.orderId,'owner');assert.equal(f.wallet.balance('owner'),10);assert.throws(()=>releaseUnsentNicepayRefund(f.wallet,f.orderId,'owner'));});
test('spent lots and wrong owner cannot reserve',t=>{const f=fixture(t);assert.throws(()=>reserveNicepayFullRefund(f.wallet,f.orderId,'other'));f.wallet.purchase('owner','request-key-123456','fp',1,{id:'purchase',productType:'calorie'});assert.throws(()=>reserveNicepayFullRefund(f.wallet,f.orderId,'owner'));assert.equal(f.wallet.balance('owner'),9);});
test('released refund can reserve again with new cancellation and ledger ids',async t=>{
 const f=fixture(t);const first=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');
 releaseUnsentNicepayRefund(f.wallet,f.orderId,'owner');
 const second=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');assert.notEqual(first.cancel_id,second.cancel_id);assert.equal(second.state,'reserved');assert.equal(f.wallet.balance('owner'),0);
 assert.equal(f.wallet.db.prepare('SELECT count(*) AS n FROM nice_refund_history').get().n,1);
 releaseUnsentNicepayRefund(f.wallet,f.orderId,'owner');assert.equal(f.wallet.balance('owner'),10);
 const third=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');assert.notEqual(second.cancel_id,third.cancel_id);assert.equal(f.wallet.balance('owner'),0);
 let calls=0;await dispatchNicepayFullRefund({...f,client:{fullCancel:async()=>{calls++;return {orderId:f.orderId,tid,cancelOrderId:third.cancel_id,amount:10000,cancelled:true};}},timestamp:'20261111090000'});assert.equal(calls,1);assert.equal(f.wallet.balance('owner'),0);
});
test('re-reservation rechecks spending after withdrawal without losing released history',t=>{
 const f=fixture(t);const first=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');releaseUnsentNicepayRefund(f.wallet,f.orderId,'owner');
 f.wallet.purchase('owner','new-spend-key-123456','fp',1,{id:'new-spend',productType:'calorie'});
 assert.throws(()=>reserveNicepayFullRefund(f.wallet,f.orderId,'owner'));assert.equal(f.wallet.balance('owner'),9);
 const row=f.wallet.db.prepare('SELECT * FROM nice_refunds WHERE order_id=?').get(f.orderId);assert.equal(row.state,'released');assert.equal(row.cancel_id,first.cancel_id);
});

test('sending claim rejects attempt replaced through another SQLite connection after operator confirmation',async t=>{
 const f=fixture(t),first=reserveNicepayFullRefund(f.wallet,f.orderId,'owner');
 const file=f.wallet.db.prepare('PRAGMA database_list').all().find(r=>r.name==='main').file;
 const secondWallet=new CreditStore(file);t.after(()=>secondWallet.close());
 // A second worker withdraws and renews after the operator read, before sending claim.
 releaseUnsentNicepayRefund(secondWallet,f.orderId,'owner',first.cancel_id);
 const next=reserveNicepayFullRefund(secondWallet,f.orderId,'owner',first.cancel_id);let calls=0;
 const client={fullCancel:async(order,timestamp,cancelId)=>{calls++;return {orderId:order.id,tid,cancelOrderId:cancelId,amount:order.amount,cancelled:true};}};
 await assert.rejects(dispatchNicepayFullRefund({...f,client,expectedCancelId:first.cancel_id,expectedAmount:first.amount}),/attempt changed/);
 await assert.rejects(dispatchNicepayFullRefund({...f,client,expectedCancelId:next.cancel_id,expectedAmount:1}),/attempt changed/);
 assert.equal(calls,0);assert.equal(secondWallet.db.prepare('SELECT state FROM nice_refunds WHERE order_id=?').get(f.orderId).state,'reserved');
 await dispatchNicepayFullRefund({...f,client,expectedCancelId:next.cancel_id,expectedAmount:next.amount});assert.equal(calls,1);
});
