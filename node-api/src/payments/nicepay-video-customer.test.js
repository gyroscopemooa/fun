import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import fs from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';import {Script,createContext} from 'node:vm';
import {CreditStore} from '../credits/store.js';import {NicepayOrderStore} from './nicepay-orders.js';import {createNicepayPgClient} from './nicepay-pg.js';import {createNicepayServerStaging} from './nicepay-server-staging.js';
test('video customer prepares once, verifies payment, uploads converts and downloads privately',async t=>{
 const root=await fs.mkdtemp(join(tmpdir(),'nice-video-customer-')),publicRoot=join(root,'public');await fs.mkdir(publicRoot);
 const file=join(root,'wallet.db'),creditStore=new CreditStore(file),store=new NicepayOrderStore(file);
 const config={variant:'legacy',id:'fake00000m',secret:'offline-merchant-test-secret',returnUrl:'https://manytool.net/nice/payment/return'};
 const policy={enabled:true,apiConfirmed:true,variant:'legacy',categories:{direct:{approved:true,methods:['card'],maxAmountKrw:10000}}};
 const catalog={video_mkv_mp4:{category:'direct',amount:1000,currency:'KRW',recurring:false,goodsName:'MP4 conversion'}};
 let orderId,calls=0,failConversion=true,tid='d'.repeat(30);const hash=s=>createHash('sha256').update(s).digest('hex');
 const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{const p={ResultCode:'3001',MID:config.id,Moid:orderId,Amt:'000000001000',TID:tid,PayMethod:'CARD'};p.Signature=hash(tid+config.id+p.Amt+config.secret);return Response.json(p);}});
 const opts={enabled:true,store,creditStore,origin:'https://manytool.net',payment:{config,policy,catalog,client},
  video:{inputRoot:join(root,'in'),outputRoot:join(root,'out'),publicRoot,maxBytes:4096,run:async args=>{calls++;if(failConversion)throw Error('bad fixture');await fs.writeFile(args.at(-1),'mock-private-mp4');}}};
 const app=express();app.use('/nice',(await createNicepayServerStaging({...opts,customerEnabled:true})).router);
 app.use('/off',(await createNicepayServerStaging(opts)).router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));store.close();creditStore.close();await fs.rm(root,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const headers={Cookie:'manytool_credit_session='+creditStore.token('buyer@example.com','session',60000),Origin:'https://manytool.net','Content-Type':'application/json'};
 const post=(route,body,h=headers)=>fetch(base+route,{method:'POST',headers:h,body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/off/customer-video/',{headers})).status,503);
 assert.equal((await fetch(base+'/nice/customer-video/')).status,401);
 assert.match(await (await fetch(base+'/nice/customer-video/',{headers})).text(),/MP4로 변환/);
 const browserScript=await (await fetch(base+'/nice/customer-video/client.js',{headers})).text();new Script(browserScript);await verifyDeleteSnapshot(browserScript);
 const request={requestKey:'video-customer-request-123'};
 const first=await (await post('/nice/customer-video/prepare',request)).json();orderId=first.orderId;
 assert.equal((await (await post('/nice/customer-video/prepare',request)).json()).orderId,orderId);
 assert.equal((await post('/nice/customer-video/prepare',request,{...headers,Origin:'https://evil.invalid'})).status,403);
 const status=async()=>await (await post('/nice/customer-video/status',{orderId})).json();
 assert.equal((await status()).ready,false);
 assert.equal((await fetch(base+first.checkoutUrl,{headers:{Cookie:headers.Cookie}})).status,200);
 const auth={AuthResultCode:'0000',MID:config.id,Moid:orderId,Amt:'1000',AuthToken:'fake-token',TxTid:tid,PayMethod:'CARD',NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp'};auth.Signature=hash(auth.AuthToken+config.id+auth.Amt+config.secret);
 assert.equal((await fetch(base+'/nice/payment/return',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(auth)})).status,200);
 assert.equal((await status()).ready,true);
 const body=new FormData();body.append('video',new Blob(['mock-video']),'clip.mkv');
 const upload=await fetch(base+'/nice/video/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:headers.Origin,'X-Manytool-Order':orderId},body});assert.equal(upload.status,201);
 let saved=await status();assert.ok(saved.uploadId);
 assert.equal((await post('/nice/video/convert',{orderId,uploadId:saved.uploadId})).status,202);
 let done;for(let i=0;i<100;i++){done=await status();if(['done','failed'].includes(done.jobState))break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(done.jobState,'failed');
 assert.equal((await fetch(base+'/nice/video/upload/'+saved.reservationId,{method:'DELETE',headers})).status,200);
 assert.equal((await status()).ready,true);assert.equal((await status()).uploadId,undefined);
 failConversion=false;
 const replacement=new FormData();replacement.append('video',new Blob(['replacement']),'clip.mov');
 assert.equal((await fetch(base+'/nice/video/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:headers.Origin,'X-Manytool-Order':orderId},body:replacement})).status,201);
 saved=await status();assert.equal((await post('/nice/video/convert',{orderId,uploadId:saved.uploadId})).status,202);
 for(let i=0;i<100;i++){done=await status();if(done.jobState==='done')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(done.jobState,'done');assert.equal(done.allowNew,true);assert.equal(calls,3);
 const download=await fetch(base+'/nice/video/download/'+done.jobId,{headers:{Cookie:headers.Cookie}});assert.equal(await download.text(),'mock-private-mp4');
 const other={...headers,Cookie:'manytool_credit_session='+creditStore.token('other@example.com','session',60000)};
 assert.equal((await post('/nice/customer-video/status',{orderId},other)).status,404);
 assert.equal((await fetch(base+first.checkoutUrl,{headers})).status,404);
 assert.equal((await (await post('/nice/customer-video/prepare',request)).json()).checkoutUrl,null);
 const firstJob=done.jobId,firstReservation=saved.reservationId;
 async function nextPaid(key){
  const p=await (await post('/nice/customer-video/prepare',{requestKey:key})).json();orderId=p.orderId;tid=hash(orderId).slice(0,30);
  const a={...auth,Moid:orderId,TxTid:tid};
  assert.equal((await fetch(base+'/nice/payment/return',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(a)})).status,200);
 }
 const uploadAgain=()=>{const b=new FormData();b.append('video',new Blob(['next']),'next.mkv');return fetch(base+'/nice/video/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:headers.Origin,'X-Manytool-Order':orderId},body:b});};
 await nextPaid('video-second-request-123');assert.equal((await uploadAgain()).status,201);
 saved=await status();await post('/nice/video/convert',{orderId,uploadId:saved.uploadId});
 for(let i=0;i<100;i++){if((await status()).jobState==='done')break;await new Promise(r=>setTimeout(r,10));}
 await nextPaid('video-third-request-123');assert.equal((await uploadAgain()).status,429);
 assert.equal((await fetch(base+'/nice/video/job/'+firstJob,{method:'DELETE',headers})).status,200);
 assert.equal((await fetch(base+'/nice/video/upload/'+firstReservation,{method:'DELETE',headers})).status,200);
 assert.equal((await uploadAgain()).status,201);
 assert.equal((await (await post('/nice/customer-video/orders',{})).json()).orders.length,3);
});


async function verifyDeleteSnapshot(script){
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:false,hidden:false,replaceChildren(){},append(){}});return elements.get(id);};
 let release,entered;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
 const deleted=[],storage=new Map();
 const context=createContext({document:{getElementById:element,createElement:()=>({})},location:{pathname:'/nice/customer-video/',reload(){}},crypto:{randomUUID:()=> 'test-request-123456'},confirm:()=>true,
  sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  fetch:async(url,options)=>{
   if(options.method==='DELETE'){deleted.push(url);if(deleted.length===1){entered();await gate;}return {ok:true};}
   if(url.endsWith('/orders'))return {ok:true,json:async()=>({orders:[]})};
   if(url.endsWith('/prepare'))return {ok:true,json:async()=>({orderId:'original',checkoutUrl:null})};
   return {ok:true,json:async()=>({orderId:'original',jobId:'job-original',reservationId:'upload-original',jobState:'done',allowNew:true})};
  }
 });
 new Script(script).runInContext(context);
 await element('prepare').onclick();
 const removing=element('remove').onclick();await started;
 assert.equal(element('load').disabled,true);assert.equal(element('check').disabled,true);
 element('history').value='another';await element('load').onclick();
 // Also model an already-in-flight response updating the display while deletion waits.
 new Script("current={orderId:'another',jobId:'job-another',reservationId:'upload-another'}").runInContext(context);
 release();await removing;
 assert.deepEqual(deleted,['/nice/video/job/job-original','/nice/video/upload/upload-original']);
 assert.equal(element('load').disabled,false);
}
