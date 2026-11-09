import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { CreditStore } from '../credits/store.js';
import { PACKS } from '../credits/pricing.js';

test('paid ID photo async completion, duplicate prevention and failure refund', {timeout:40000}, async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'manytool-id-http-'));
 const store=new CreditStore(path.join(dir,'credits.sqlite'));
 const email='id-photo-test@example.com';
 const row=store.createTopup(email,PACKS[0],'test-product');
 store.checkout(row.id,'checkout-test','https://example.com');
 store.applyPayment({type:'order.paid',data:{id:'test-payment',paid:true,product_id:row.product,currency:'krw',net_amount:row.amount,discount_amount:0,checkout_id:'checkout-test',metadata:{credit_topup_id:row.id}}});
 const session=store.token(email,'session',60000);
 const bytes=await sharp({create:{width:60,height:80,channels:3,background:'white'}}).png().toBuffer();
 const preload=path.join(dir,'provider.mjs');
 await fs.writeFile(preload,`globalThis.fetch=async (_url,init)=>{await new Promise(r=>setTimeout(r,600)); const suit=init.body.get('prompt').includes('business suit jacket'); return new Response(JSON.stringify(suit?{data:Array.from({length:3},()=>({b64_json:'${bytes.toString('base64')}'}))}:{error:{message:'test outage'}}),{status:suit?200:503,headers:{'content-type':'application/json'}});};`);
 const port=31000+Math.floor(Math.random()*10000);
 const child=spawn(process.execPath,['--import',pathToFileURL(preload).href,'node-api/src/server.js'],{cwd:new URL('../../../',import.meta.url),windowsHide:true,env:{...process.env,PORT:String(port),CREDITS_ENABLED:'true',CREDITS_DB_PATH:path.join(dir,'credits.sqlite'),CREDITS_TOOLS_READY:'true',CREDITS_TOOL_PRICING_JSON:'{"base":{"retailKrw":4500,"costKrw":1000}}',OPENAI_API_KEY:'test-key',EXTERNAL_AI_ENABLED:'false',ID_PHOTO_ENABLED:'true',PAYMENT_MODE:'polar',POLAR_ACCESS_TOKEN:'',RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 const base=`http://127.0.0.1:${port}`;
 const json=(body)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error(log);try{if((await fetch(base+'/health')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
  assert.equal((await (await fetch(base+'/config')).json()).readiness.idPhotoReady,true);
  assert.deepEqual((await (await fetch(base+'/config')).json()).idPhotoGroomingModes,['natural','neat','passport','custom']);
  assert.equal((await fetch(base+'/generate',json({groomingMode:'invalid'}))).status,400);
  assert.equal((await fetch(base+'/generate',json({groomingMode:'custom',hairOptions:{flyaways:'yes'}}))).status,400);
  const form=new FormData();form.append('image',new Blob([bytes],{type:'image/png'}),'test.png');
  const upload=await (await fetch(base+'/upload',{method:'POST',body:form})).json();
  assert.equal((await fetch(base+'/generate',json({photoId:upload.photoId}))).status,402);
  for(const outfitType of ['suit','current']){
   const purchase=await fetch(base+'/credits/purchase',{...json({productType:'base',requestKey:'id-photo-test-'+outfitType}),headers:{'Content-Type':'application/json',Origin:'https://manytool.net',Cookie:`manytool_credit_session=${session}`}});
   assert.equal(purchase.status,201);const {orderId}=await purchase.json();
   const body={photoId:upload.photoId,toolType:'id_photo',outfitType,orderId,groomingMode:'neat'};
   const start=await fetch(base+'/generate',json(body));assert.equal(start.status,202);const {jobId}=await start.json();
   assert.equal(store.state(orderId),'processing');
   assert.equal((await fetch(base+'/generate',json(body))).status,409);
   let job;
   for(let n=0;n<100;n++){job=await (await fetch(base+'/job/'+jobId)).json();if(job.status!=='processing')break;await new Promise(r=>setTimeout(r,100));}
   assert.equal(job.status,outfitType==='suit'?'done':'failed');
   if(outfitType==='suit'){
    assert.equal(job.pipelineReport.groomingMode,'neat');assert.equal(job.pipelineReport.hairOptions.smoothVolume,true);assert.equal(job.candidates.length,3);assert.equal(store.state(orderId),'done');
    assert.equal((await fetch(base+job.candidates[0].imageUrl)).status,200);
   } else {assert.equal(job.creditRefunded,true);assert.equal(store.state(orderId),'refunded');}
  }
  assert.equal(store.balance(email),5);
 }finally{
  child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));store.close();
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'manytool-id-http-'));
  await fs.rm(dir,{recursive:true,force:true});
 }
});
