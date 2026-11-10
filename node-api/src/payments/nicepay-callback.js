import express from 'express';
import {prepareNicepayIntent} from './nicepay-policy.js';
import {processPgAuthentication} from './nicepay-orders.js';
import {renderNicepayPgForm} from './nicepay-pg.js';
import {fulfillNicepayOrder} from './nicepay-fulfillment.js';
import {executeNicepayTool} from './nicepay-execution.js';
const time=()=>new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14);
// Not installed in server.js. Only explicit staging wiring can enable this router.
export function createNicepayStagingRouter({enabled=false,store,creditStore,config,policy,catalog,authenticate,origin,client,toolAdapters={},timestamp=time}){
  if(enabled){
    const orderFile=store?.db.prepare('PRAGMA database_list').all().find(row=>row.name==='main')?.file;
    const walletFile=creditStore?.db.prepare('PRAGMA database_list').all().find(row=>row.name==='main')?.file;
    if(!orderFile||orderFile!==walletFile)throw new Error('NICE orders and wallet require the same persistent database');
    if(config?.variant!=='legacy'||policy?.variant!=='legacy'||!policy.apiConfirmed||!policy.enabled||typeof authenticate!=='function'||!client)throw new Error('NICE staging dependencies incomplete');
    if(new URL(origin).protocol!=='https:')throw new Error('HTTPS web origin required');
  }
  const router=express.Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');if(!enabled)return res.status(503).json({error:'NICEPAY disabled'});next();});
  router.post('/checkout',express.json({limit:'4kb'}),async(req,res)=>{
    try{
      if(req.headers.origin!==origin) return res.status(403).json({error:'Origin rejected'});
      if(typeof authenticate!=='function')throw Error('Authentication unavailable');
      const ownerId=await authenticate(req); // Must return the verified wallet email, not a browser claim/Supabase ID guess.
      const request={productId:req.body?.productId,ownerId};prepareNicepayIntent(request,catalog,policy);
      const order=store.create(request,catalog,policy,config.id);
      const adapter=Object.hasOwn(toolAdapters,order.productId)?toolAdapters[order.productId]:null;
      // Tool-specific upload/options rights must be frozen before exposing a payable form.
      if(adapter?.bindCheckout){try{await adapter.bindCheckout(req.body?.input,{orderId:order.id,owner:ownerId});}catch(error){store.rejectCreated(order.id,ownerId);throw error;}}
      res.type('html').send(renderNicepayPgForm(order,config,timestamp()));
    }catch{res.status(400).json({error:'NICEPAY checkout unavailable'});}
  });
  router.post('/execute',express.json({limit:'24mb'}),async(req,res)=>{
    try{
      if(req.headers.origin!==origin)return res.status(403).json({error:'Origin rejected'});
      const owner=await authenticate(req),order=store.owned(req.body?.orderId,owner);
      if(order.category!=='direct'||!Object.hasOwn(toolAdapters,order.productId))throw Error('Tool integration unavailable');
      const adapter=toolAdapters[order.productId];
      // Validation must run before entitlement claim and before any paid tool work.
      const input=await adapter.validate(req.body?.input,{orderId:order.id,owner});
      const result=await executeNicepayTool({creditStore,orderId:order.id,owner,product:order.productId,validatedInput:input,
        runner:()=>adapter.execute(input,{orderId:order.id,owner})});
      res.json({result});
    }catch{res.status(409).json({error:'Tool execution unavailable or needs verification'});}
  });
  router.post('/return' ,express.urlencoded({extended:false,limit:'16kb',parameterLimit:40}),async(req,res)=>{
    try{
      const order=await processPgAuthentication({body:req.body,store,config,client,timestamp:timestamp()});
      fulfillNicepayOrder(creditStore,order.id);
      res.json({status:'fulfilled',orderId:order.id});
    }catch{res.status(409).json({error:'Payment requires verification; do not retry payment'});}
  });
  return router;
}
