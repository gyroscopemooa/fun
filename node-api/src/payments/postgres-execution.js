import {createHash} from 'node:crypto';
import {isNicepayExecutionDeferred} from './nicepay-preflight.js';

// A committed claim precedes provider I/O. Unknown outcomes never auto-retry.
export async function executePostgresNicepayTool({creditStore,orderId,owner,product,runner,validatedInput,now}){
 const prior=await creditStore.tx(async c=>{
  const entitlement=(await c.query('SELECT * FROM nice_entitlements WHERE order_id=$1 AND owner=$2 AND product=$3',[orderId,owner,product])).rows[0];
  if(!entitlement)throw Error('NICEPAY entitlement unavailable');
  const binding=(await c.query('SELECT input_hash FROM nice_customer_orders WHERE order_id=$1 AND owner=$2',[orderId,owner])).rows[0];
  if(binding&&(validatedInput===undefined||createHash('sha256').update(JSON.stringify(validatedInput)).digest('hex')!==binding.input_hash))throw Error('Purchased input mismatch');
  const job=(await c.query('SELECT * FROM nice_tool_jobs WHERE order_id=$1',[orderId])).rows[0];
  if(job?.state==='done')return {replay:true,result:JSON.parse(job.result)};
  if(entitlement.state!=='ready'||(job&&job.state!=='retryable')||(job?.attempts??0)>=2)throw Error('NICEPAY execution needs reconciliation');
  await c.query("UPDATE nice_entitlements SET state='claimed' WHERE order_id=$1",[orderId]);
  await c.query("INSERT INTO nice_tool_jobs VALUES($1,'running',1,NULL,$2) ON CONFLICT(order_id) DO UPDATE SET state='running',attempts=nice_tool_jobs.attempts+1,updated=excluded.updated",[orderId,now]);
  return {replay:false};
 });
 if(prior.replay)return prior.result;
 let result;
 try{result=await runner();}
 catch(error){
  await creditStore.tx(async c=>{
   const deferred=isNicepayExecutionDeferred(error),retry=deferred||error?.executionNotStarted===true;
   const changed=await c.query("UPDATE nice_tool_jobs SET state=$2,updated=$3,attempts=GREATEST(0,attempts-$4) WHERE order_id=$1 AND state='running' RETURNING order_id",[orderId,retry?'retryable':'uncertain',Date.now(),deferred?1:0]);
   if(retry&&changed.rowCount===1)await c.query("UPDATE nice_entitlements SET state='ready' WHERE order_id=$1 AND state='claimed'",[orderId]);
  });throw error;
 }
 try{
  const encoded=JSON.stringify(result);if(!encoded||Buffer.byteLength(encoded)>65536)throw Error('Store a bounded artifact reference');
  await creditStore.tx(async c=>{const changed=await c.query("UPDATE nice_tool_jobs SET state='done',result=$2,updated=$3 WHERE order_id=$1 AND state='running' RETURNING order_id",[orderId,encoded,Date.now()]);if(changed.rowCount!==1)throw Error('Execution state changed');});
  return result;
 }catch{
  await creditStore.tx(c=>c.query("UPDATE nice_tool_jobs SET state='uncertain',updated=$2 WHERE order_id=$1 AND state='running'",[orderId,Date.now()]));
  throw Error('NICEPAY result persistence needs reconciliation');
 }
}
export function stalePostgresNicepayExecutions(store,now){
 return store.tx(async c=>{
  await c.query("UPDATE nice_tool_jobs SET state='uncertain',updated=$1 WHERE state='running' AND updated<$2",[now,now-15*60000]);
  return (await c.query("SELECT order_id,state FROM nice_tool_jobs WHERE state='uncertain'")).rows;
 });
}
