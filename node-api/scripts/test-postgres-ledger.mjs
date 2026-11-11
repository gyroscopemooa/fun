// Explicit integration test: isolated random schema, fake identities/receipts,
// no external payment requests. Always drop only this run's own test schema.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import dotenv from 'dotenv';
import {createPaymentPool} from '../src/payments/postgres.js';
import {PostgresPaymentLedger,PAYMENT_TABLES} from '../src/payments/postgres-ledger.js';
import {fulfillNicepayOrder} from '../src/payments/nicepay-fulfillment.js';
import {reserveNicepayFullRefund,releaseUnsentNicepayRefund,dispatchNicepayFullRefund} from '../src/payments/nicepay-refund.js';
dotenv.config({path:new URL('../.env.nicepay-migration',import.meta.url)});
const schema='manytool_payment_test_'+randomUUID().replaceAll('-','');
if(!/^manytool_payment_test_[a-f0-9]{32}$/.test(schema))throw Error('Invalid isolated schema');
const pool=createPaymentPool(process.env.MANYTOOL_DATABASE_URL);
const scoped={async connect(){const c=await pool.connect();return {connection:c.connection,release:discard=>c.release(discard),query:(sql,args)=>c.query(sql==='SET LOCAL search_path = manytool_payments, pg_catalog'?`SET LOCAL search_path = ${schema}, pg_catalog`:sql,args)};}};
const store=new PostgresPaymentLedger(scoped),other=new PostgresPaymentLedger(scoped);
const policy={enabled:true,apiConfirmed:true,variant:'legacy',categories:{credit_topup:{approved:true,methods:['card'],maxAmountKrw:10000}}};
const catalog={pack:{category:'credit_topup',amount:10000,credits:10,currency:'KRW',recurring:false,goodsName:'Test credits'}};
const passed=[];let created=false,providerCalls=0;
let tidCounter=0;
async function paid(owner){const o=await store.create({productId:'pack',ownerId:owner},catalog,policy,'fake00000m');const tid=String(++tidCounter).padStart(30,'0');await store.claim(o.id,tid);await store.recordVerified({orderId:o.id,tid,amount:10000,currency:'KRW',verified:true});await fulfillNicepayOrder(store,o.id);return {...o,tid};}
const fakeClient={async fullCancel(order,_timestamp,cancelId){providerCalls++;return {orderId:order.id,tid:order.tid,cancelOrderId:cancelId,amount:order.amount,cancelled:true};}};
try{
  const c=await pool.connect();
  try{await c.query('BEGIN');await c.query(`CREATE SCHEMA ${schema}`);await c.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);await c.query(`SET LOCAL search_path = ${schema}, pg_catalog`);await c.query(PAYMENT_TABLES);await c.query('COMMIT');created=true;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  const request={productId:'pack',ownerId:'checkout-test',requestKey:'checkout-request-12345',inputHash:'a'.repeat(64)};
  const [a,b]=await Promise.all([store.create(request,catalog,policy,'fake00000m'),other.create(request,catalog,policy,'fake00000m')]);
  assert.equal(a.id,b.id);
  await assert.rejects(store.create({...request,inputHash:'b'.repeat(64)},catalog,policy,'fake00000m'));
  const claims=await Promise.allSettled([store.claim(a.id,'a'.repeat(30)),other.claim(a.id,'a'.repeat(30))]);assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
  const receipt={orderId:a.id,tid:'a'.repeat(30),amount:10000,currency:'KRW',verified:true};
  await assert.rejects(store.recordVerified({...receipt,amount:1}));
  await Promise.all([store.recordVerified(receipt),other.recordVerified(receipt)]);
  assert.deepEqual((await Promise.all([fulfillNicepayOrder(store,a.id),fulfillNicepayOrder(other,a.id)])).sort(),[false,true]);
  assert.equal(await store.balance('checkout-test'),10);passed.push('concurrent checkout/approval/fulfillment are idempotent; mismatched receipt rejected');
  const rollbackOrder=await store.create({productId:'pack',ownerId:'rollback-test'},catalog,policy,'fake00000m');
  await store.claim(rollbackOrder.id,'r'.repeat(30));
  await store.recordVerified({orderId:rollbackOrder.id,tid:'r'.repeat(30),amount:10000,currency:'KRW',verified:true});
  const failingPool={async connect(){const c=await scoped.connect();return {...c,query:(sql,args)=>{if(sql.startsWith('INSERT INTO nice_fulfillments'))throw Error('Injected fulfillment failure');return c.query(sql,args);}};}};
  await assert.rejects(new PostgresPaymentLedger(failingPool).fulfill(rollbackOrder.id));
  assert.equal(await store.balance('rollback-test'),0);
  assert.equal(await store.topup('nicepay:'+rollbackOrder.id),undefined);
  assert.equal(await store.fulfill(rollbackOrder.id),true);
  assert.equal(await store.balance('rollback-test'),10);passed.push('fulfillment failure rolls back topup and credit together before successful replay');
  const spend={id:randomUUID(),productType:'calorie'};
  await Promise.all([store.purchase('checkout-test','purchase-request-12345','fp',3,spend),other.purchase('checkout-test','purchase-request-12345','fp',3,spend)]);
  assert.equal(await store.balance('checkout-test'),7);
  await assert.rejects(store.purchase('checkout-test','insufficient-request-123','fp',8,{...spend,id:randomUUID()}));
  assert.equal(await store.balance('checkout-test'),7);
  await assert.rejects(reserveNicepayFullRefund(store,a.id,'checkout-test',null));
  passed.push('debit replay deducts once; insufficient/spent refund rolls back');
  const o=await paid('refund-test');
  await assert.rejects(reserveNicepayFullRefund(store,o.id,'wrong-owner',null));
  const first=await reserveNicepayFullRefund(store,o.id,'refund-test',null);
  assert.equal(await store.balance('refund-test'),0);
  await releaseUnsentNicepayRefund(other,o.id,'refund-test',first.cancel_id);
  assert.equal(await store.balance('refund-test'),10);
  await assert.rejects(releaseUnsentNicepayRefund(store,o.id,'refund-test',first.cancel_id));
  const next=await reserveNicepayFullRefund(other,o.id,'refund-test',first.cancel_id);
  const dispatch=(cancelId,amount,client=fakeClient)=>dispatchNicepayFullRefund({wallet:store,store,orderId:o.id,client,expectedCancelId:cancelId,expectedAmount:amount});
  await assert.rejects(dispatch(first.cancel_id,10000));await assert.rejects(dispatch(next.cancel_id,1));assert.equal(providerCalls,0);
  const sent=await Promise.allSettled([dispatch(next.cancel_id,10000),dispatch(next.cancel_id,10000)]);
  assert.equal(sent.filter(r=>r.status==='fulfilled').length,1);assert.equal(providerCalls,1);
  assert.equal(await store.balance('refund-test'),0);assert.equal((await store.get(o.id)).state,'refunded');
  assert.equal(await store.applyCancelled(o.id,{orderId:o.id,tid:o.tid,cancelOrderId:next.cancel_id,amount:10000,cancelled:true}),false);
  passed.push('other-session withdrawal/re-reservation rejects stale confirmation; duplicate dispatch calls fake provider once');
  const timeout=await paid('timeout-test'),hold=await reserveNicepayFullRefund(store,timeout.id,'timeout-test',null);
  await assert.rejects(dispatchNicepayFullRefund({wallet:store,store,orderId:timeout.id,client:{async fullCancel(){throw Error('fake timeout');}},expectedCancelId:hold.cancel_id,expectedAmount:hold.amount}));
  await assert.rejects(releaseUnsentNicepayRefund(store,timeout.id,'timeout-test',hold.cancel_id));
  assert.equal(await store.balance('timeout-test'),0);
  await assert.rejects(store.applyCancelled(timeout.id,{orderId:timeout.id,tid:timeout.tid,cancelOrderId:first.cancel_id,amount:10000,cancelled:true}));
  assert.equal(await store.applyCancelled(timeout.id,{orderId:timeout.id,tid:timeout.tid,cancelOrderId:hold.cancel_id,amount:10000,cancelled:true}),true);
  passed.push('timeout retains hold; only matching cancellation reconciles');
  const race=await paid('race-test');
  const outcomes=await Promise.allSettled([store.purchase('race-test','race-purchase-request','fp',1,{id:randomUUID(),productType:'calorie'}),other.reserveRefund(race.id,'race-test',null)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.ok([0,9].includes(await store.balance('race-test')));passed.push('concurrent debit/refund has exactly one winner');
}catch(error){process.exitCode=1;console.error(JSON.stringify({ok:false,passed,code:/^[A-Z0-9_]{2,40}$/.test(error.code??'')?error.code:'LEDGER_TEST_FAILED'}));}
finally{
  try{if(created){await pool.query(`DROP SCHEMA ${schema} CASCADE`);const remaining=await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema]);assert.equal(remaining.rowCount,0);}}
  catch{process.exitCode=1;console.error(JSON.stringify({cleanupFailed:true,testSchema:schema}));}
  await pool.end();
}
if(!process.exitCode)console.log(JSON.stringify({ok:true,passed,testSchemaRemoved:true,externalProviderCalls:0,fakeCancellationCalls:providerCalls}));
