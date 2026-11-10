// Internal execution adapter only. Existing production tool routes are not modified.
export async function executeNicepayTool({creditStore,orderId,owner,product,runner,now=Date.now()}){
 if(typeof runner!=='function')throw Error('Tool adapter missing');
 const db=creditStore.db;
 db.exec('CREATE TABLE IF NOT EXISTS nice_tool_jobs(order_id TEXT PRIMARY KEY,state TEXT NOT NULL,attempts INTEGER NOT NULL,result TEXT,updated INTEGER NOT NULL)');
 const prior=creditStore.tx(()=>{
   const entitlement=db.prepare('SELECT * FROM nice_entitlements WHERE order_id=? AND owner=? AND product=?').get(orderId,owner,product);
   if(!entitlement)throw Error('NICEPAY entitlement unavailable');
   const job=db.prepare('SELECT * FROM nice_tool_jobs WHERE order_id=?').get(orderId);
   if(job?.state==='done')return JSON.parse(job.result);
   if(entitlement.state!=='ready'||(job&&job.state!=='retryable')||(job?.attempts??0)>=2)throw Error('NICEPAY execution needs reconciliation');
   db.prepare("UPDATE nice_entitlements SET state='claimed' WHERE order_id=?").run(orderId);
   db.prepare("INSERT INTO nice_tool_jobs VALUES(?,'running',1,NULL,?) ON CONFLICT(order_id) DO UPDATE SET state='running',attempts=attempts+1,updated=excluded.updated").run(orderId,now);
   return undefined;
 });
 if(prior!==undefined)return prior;
 let result;
 try{result=await runner();}
 catch(error){
   creditStore.tx(()=>{
     // Only a trusted adapter which proves no tool work began may restore the entitlement.
     const retry=error?.executionNotStarted===true;
     db.prepare('UPDATE nice_tool_jobs SET state=?,updated=? WHERE order_id=?').run(retry?'retryable':'uncertain',Date.now(),orderId);
     if(retry)db.prepare("UPDATE nice_entitlements SET state='ready' WHERE order_id=?").run(orderId);
   });throw error;
 }
 try{
   const encoded=JSON.stringify(result);
   if(!encoded||Buffer.byteLength(encoded)>65536)throw Error('Store a bounded artifact reference');
   creditStore.tx(()=>{const changed=db.prepare("UPDATE nice_tool_jobs SET state='done',result=?,updated=? WHERE order_id=? AND state='running'").run(encoded,Date.now(),orderId);if(changed.changes!==1)throw Error();});
   return result;
 }catch{db.prepare("UPDATE nice_tool_jobs SET state='uncertain',updated=? WHERE order_id=?").run(Date.now(),orderId);throw Error('NICEPAY result persistence needs reconciliation');}
}
export function staleNicepayExecutions(creditStore,now=Date.now()){
 creditStore.db.exec('CREATE TABLE IF NOT EXISTS nice_tool_jobs(order_id TEXT PRIMARY KEY,state TEXT NOT NULL,attempts INTEGER NOT NULL,result TEXT,updated INTEGER NOT NULL)');
 return creditStore.tx(()=>{
   creditStore.db.prepare("UPDATE nice_tool_jobs SET state='uncertain',updated=? WHERE state='running' AND updated<?").run(now,now-15*60000);
   return creditStore.db.prepare("SELECT order_id,state FROM nice_tool_jobs WHERE state='uncertain'").all();
 });
}
