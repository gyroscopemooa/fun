import test from 'node:test';
import assert from 'node:assert/strict';
import {CreditStore} from '../credits/store.js';
import {executeNicepayTool,staleNicepayExecutions} from './nicepay-execution.js';
function fixture(t){const creditStore=new CreditStore(':memory:');t.after(()=>creditStore.close());creditStore.db.exec("CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT);INSERT INTO nice_entitlements VALUES('order','owner','tool','ready')");return {creditStore,orderId:'order',owner:'owner',product:'tool'};}
test('direct execution persists result and replay does not execute again',async t=>{const f=fixture(t);let calls=0;const run=()=>executeNicepayTool({...f,runner:async()=>{calls++;return {artifact:'private-result-id'};}});await run();assert.deepEqual(await run(),{artifact:'private-result-id'});assert.equal(calls,1);await assert.rejects(executeNicepayTool({...f,owner:'wrong',runner:async()=>({})}));});
test('known pre-execution failure restores entitlement once',async t=>{const f=fixture(t);await assert.rejects(executeNicepayTool({...f,runner:async()=>{throw Object.assign(Error(),{executionNotStarted:true});}}));assert.deepEqual(await executeNicepayTool({...f,runner:async()=>({ok:true})}),{ok:true});});
test('unknown failure or stale running cannot auto retry',async t=>{const f=fixture(t);await assert.rejects(executeNicepayTool({...f,runner:async()=>{throw Error('timeout');}}));assert.equal(staleNicepayExecutions(f.creditStore).length,1);await assert.rejects(executeNicepayTool({...f,runner:async()=>({})}));});
test('fresh wallet reconciliation is safe before any execution',t=>{
 const creditStore=new CreditStore(':memory:');t.after(()=>creditStore.close());
 assert.deepEqual(staleNicepayExecutions(creditStore),[]);
});
