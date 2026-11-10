import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import fs from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {CreditStore} from '../credits/store.js';import {createNicepayVideoRouter} from './nicepay-video-router.js';
test('video HTTP authenticates before upload; private status/download and size bound',async t=>{
 const root=await fs.mkdtemp(path.join(tmpdir(),'nice-video-http-'));const publicRoot=path.join(root,'public'),inputRoot=path.join(root,'input'),outputRoot=path.join(root,'output');await fs.mkdir(publicRoot);
 const wallet=new CreditStore(':memory:');wallet.db.exec("CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT);INSERT INTO nice_entitlements VALUES('order','buyer','video_mkv_mp4','ready')");
 const app=express();app.use('/video',await createNicepayVideoRouter({enabled:true,wallet,authenticate:async req=>req.headers['x-test-user'],origin:'https://manytool.net',inputRoot,outputRoot,publicRoot,maxBytes:1000,run:async args=>fs.writeFile(args.at(-1),'private-mp4')}));app.use('/off',await createNicepayVideoRouter({}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));wallet.close();await fs.rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;const form=(size=10)=>{const f=new FormData();f.append('video',new Blob([new Uint8Array(size)]),'clip.mkv');return f;};
 assert.equal((await fetch(base+'/off/upload',{method:'POST'})).status,503);
 assert.equal((await fetch(base+'/video/upload',{method:'POST',body:form()})).status,401);assert.equal((await fs.readdir(inputRoot)).length,0);
 const headers={'x-test-user':'buyer',Origin:'https://manytool.net','x-manytool-order':'order'};
 assert.equal((await fetch(base+'/video/upload',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:form()})).status,403);
 assert.equal((await fetch(base+'/video/upload',{method:'POST',headers,body:form(1100)})).status,413);
 await new Promise(r=>setTimeout(r,20));
 const upload=await fetch(base+'/video/upload',{method:'POST',headers,body:form()});assert.equal(upload.status,201);const {uploadId}=await upload.json();
 const started=await fetch(base+'/video/convert',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({orderId:'order',uploadId})});assert.equal(started.status,202);const {jobId}=await started.json();
 for(let i=0;i<100;i++){const s=await (await fetch(`${base}/video/job/${jobId}`,{headers})).json();if(s.state==='done')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal((await fetch(`${base}/video/download/${jobId}`,{headers:{'x-test-user':'other'}})).status,404);
 const download=await fetch(`${base}/video/download/${jobId}`,{headers});assert.equal(download.status,200);assert.equal(await download.text(),'private-mp4');assert.equal(download.headers.get('cache-control'),'no-store');
});
