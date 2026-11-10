import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CreditStore} from '../credits/store.js';
import {NicepayOrderStore} from './nicepay-orders.js';
import {readNicepayPolicy} from './nicepay-policy.js';
import {fulfillNicepayOrder,pendingNicepayFulfillments,claimNicepayEntitlement} from './nicepay-fulfillment.js';
const rule={approved:true,methods:['card'],maxAmountKrw:10000};
const policy=readNicepayPolicy(JSON.stringify({enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:rule,direct:rule}}));
const catalog={pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Credits'},tool:{category:'direct',amount:4900,currency:'KRW',recurring:false,goodsName:'Tool'}};
function fixture(t,productId='pack'){
 const dir=mkdtempSync(join(tmpdir(),'nice-fulfill-')),file=join(dir,'wallet.sqlite');const wallet=new CreditStore(file),orders=new NicepayOrderStore(file);
 t.after(()=>{orders.close();wallet.close();rmSync(dir,{recursive:true});});
 const order=orders.create({productId,ownerId:'buyer@example.com'},catalog,policy,'fake00000m');
 return {wallet,orders,order,verify(){orders.claim(order.id,'a'.repeat(30));orders.recordVerified({orderId:order.id,tid:'a'.repeat(30),amount:order.amount,currency:'KRW',verified:true});}};
}
test('verified receipt grants common-wallet credit once, available as spendable lot',t=>{
 const f=fixture(t);assert.throws(()=>fulfillNicepayOrder(f.wallet,f.order.id));f.verify();
 assert.deepEqual(pendingNicepayFulfillments(f.wallet),[f.order.id]);
 assert.equal(fulfillNicepayOrder(f.wallet,f.order.id),true);assert.equal(fulfillNicepayOrder(f.wallet,f.order.id),false);
 assert.equal(f.wallet.balance('buyer@example.com'),10);assert.deepEqual(pendingNicepayFulfillments(f.wallet),[]);
 assert.equal(f.wallet.topupHistory('buyer@example.com')[0].provider,'nicepay');
 assert.throws(()=>f.wallet.refundQuote('buyer@example.com',`nicepay:${f.order.id}`),/NICEPAY/);
 assert.throws(()=>f.wallet.applyPayment({type:'order.paid',data:{metadata:{credit_topup_id:`nicepay:${f.order.id}`}}}),/provider/);
});
test('wallet mutation failure rolls back lot, ledger and fulfillment together',t=>{
 const f=fixture(t);f.verify();const change=f.wallet.change.bind(f.wallet);f.wallet.change=()=>{throw Error('simulated crash');};
 assert.throws(()=>fulfillNicepayOrder(f.wallet,f.order.id));assert.equal(f.wallet.balance('buyer@example.com'),0);
 assert.equal(f.wallet.topup(`nicepay:${f.order.id}`),undefined);f.wallet.change=change;
 assert.equal(fulfillNicepayOrder(f.wallet,f.order.id),true);assert.equal(f.wallet.balance('buyer@example.com'),10);
});
test('direct entitlement is owner/product-bound, single claim, no credit grant',t=>{
 const f=fixture(t,'tool');f.verify();fulfillNicepayOrder(f.wallet,f.order.id);
 assert.equal(f.wallet.balance('buyer@example.com'),0);
 assert.throws(()=>claimNicepayEntitlement(f.wallet,f.order.id,'attacker','tool'));
 assert.throws(()=>claimNicepayEntitlement(f.wallet,f.order.id,'buyer@example.com','other'));
 claimNicepayEntitlement(f.wallet,f.order.id,'buyer@example.com','tool');
 assert.throws(()=>claimNicepayEntitlement(f.wallet,f.order.id,'buyer@example.com','tool'));
});
test('refund terms stay frozen at order creation',t=>{
 const f=fixture(t);f.verify();fulfillNicepayOrder(f.wallet,f.order.id);
 const terms=f.wallet.db.prepare('SELECT * FROM topup_terms WHERE topup_id=?').get(`nicepay:${f.order.id}`);
 assert.equal(terms.policy,f.order.refundPolicyVersion);assert.equal(terms.unit_krw,f.order.unitKrw);
});
