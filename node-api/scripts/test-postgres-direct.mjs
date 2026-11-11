import assert from 'node:assert/strict';
import {createPostgresTestFixture} from './postgres-test-fixture.mjs';
import {PostgresPaymentLedger} from '../src/payments/postgres-ledger.js';
import {executeNicepayTool,staleNicepayExecutions} from '../src/payments/nicepay-execution.js';
const fixture=await createPostgresTestFixture(),store=new PostgresPaymentLedger(fixture.pool);
try{
 const seed=id=>store.tx(c=>c.query("INSERT INTO nice_entitlements VALUES($1,'owner','tool','ready')",[id]));
 const run=(id,runner,extra={})=>executeNicepayTool({creditStore:store,orderId:id,owner:'owner',product:'tool',runner,...extra});
 await seed('concurrent');let calls=0,release;const gate=new Promise(r=>release=r);
 const first=run('concurrent',async()=>{calls++;await gate;return {artifact:'fake-private-id'};});
 for(let n=0;n<100;n++){const rows=await store.tx(c=>c.query("SELECT state FROM nice_tool_jobs WHERE order_id='concurrent'"));if(rows.rows[0]?.state==='running')break;await new Promise(r=>setTimeout(r,10));}
 await assert.rejects(run('concurrent',async()=>{calls++;return {};}));release();await first;
 assert.deepEqual(await run('concurrent',async()=>{throw Error('must not run');}),{artifact:'fake-private-id'});assert.equal(calls,1);
 await assert.rejects(run('concurrent',async()=>({}),{owner:'other'}));
 await seed('retry');await assert.rejects(run('retry',async()=>{throw Object.assign(Error(),{executionNotStarted:true});}));assert.deepEqual(await run('retry',async()=>({ok:true})),{ok:true});
 await seed('uncertain');await assert.rejects(run('uncertain',async()=>{throw Error('unknown provider result');}));await assert.rejects(run('uncertain',async()=>({})));
 assert.ok((await staleNicepayExecutions(store)).some(r=>r.order_id==='uncertain'));
 await seed('hold');await store.tx(c=>c.query("UPDATE nice_entitlements SET state='refund_hold' WHERE order_id='hold'"));await assert.rejects(run('hold',async()=>({})));
 console.log(JSON.stringify({passed:true,concurrentProviderCalls:calls,externalProviderCalls:0,productionDataChanged:false}));
}finally{await fixture.close();}
