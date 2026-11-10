import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {CreditStore} from '../credits/store.js';import {createNicepayVideoService,runNicepayFfmpeg} from './nicepay-video.js';
async function fixture(t,run){const root=await fs.mkdtemp(path.join(tmpdir(),'nice-video-')),inputRoot=path.join(root,'in'),outputRoot=path.join(root,'out');await fs.mkdir(inputRoot);await fs.mkdir(outputRoot);const wallet=new CreditStore(':memory:');wallet.db.exec("CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT);INSERT INTO nice_entitlements VALUES('o','buyer','video_mkv_mp4','ready')");t.after(async()=>{wallet.close();await fs.rm(root,{recursive:true,force:true});});const service=createNicepayVideoService({wallet,inputRoot,outputRoot,enabled:true,run});return {service,wallet,inputRoot,outputRoot};}
async function finish(service,id){for(let i=0;i<200;i++){const s=service.status(id,'buyer');if(!['queued','processing'].includes(s.state))return s;await new Promise(r=>setTimeout(r,10));}throw Error('Job timeout');}
test('video owns upload and output; duplicate start uses same conversion',async t=>{let calls=0;const f=await fixture(t,async args=>{calls++;await fs.writeFile(args.at(-1),'fake-mp4');});const file=path.join(f.inputRoot,'clip.mkv');await fs.writeFile(file,'input');const {uploadId}=await f.service.registerUpload({owner:'buyer',file,originalName:'clip.mkv'});await assert.rejects(f.service.start({owner:'other',orderId:'o',uploadId}));const a=await f.service.start({owner:'buyer',orderId:'o',uploadId});assert.equal((await finish(f.service,a.jobId)).state,'done');assert.equal((await f.service.start({owner:'buyer',orderId:'o',uploadId})).jobId,a.jobId);assert.equal(calls,1);await assert.rejects(f.service.downloadPath(a.jobId,'other'));assert.ok((await f.service.downloadPath(a.jobId,'buyer')).startsWith(f.outputRoot));});
test('copy failure falls back; complete failure restores conversion allowance',async t=>{let calls=0;const f=await fixture(t,async()=>{calls++;throw Error('bad video');});const file=path.join(f.inputRoot,'clip.mov');await fs.writeFile(file,'bad');const {uploadId}=await f.service.registerUpload({owner:'buyer',file,originalName:'clip.mov'});const job=await f.service.start({owner:'buyer',orderId:'o',uploadId});assert.equal((await finish(f.service,job.jobId)).state,'failed');assert.equal(calls,2);assert.equal(f.wallet.db.prepare("SELECT state FROM nice_entitlements WHERE order_id='o'").get().state,'ready');});
test('local real ffmpeg smoke: generated fixture MKV becomes privately owned MP4',async t=>{const f=await fixture(t,runNicepayFfmpeg);const file=path.join(f.inputRoot,'fixture.mkv');await runNicepayFfmpeg(['-nostdin','-y','-f','lavfi','-i','color=c=black:s=32x32:d=0.2','-c:v','mpeg4',file]);const {uploadId}=await f.service.registerUpload({owner:'buyer',file,originalName:'fixture.mkv'});const job=await f.service.start({owner:'buyer',orderId:'o',uploadId});assert.equal((await finish(f.service,job.jobId)).state,'done');assert.ok((await fs.stat(await f.service.downloadPath(job.jobId,'buyer'))).size>0);});
test('recovery allows both 30-minute phases before quarantining stale work',async t=>{
 const f=await fixture(t,async()=>{}),now=Date.now();
 f.wallet.db.prepare("INSERT INTO nice_video_jobs VALUES('job','o','buyer','upload','processing',?,1,?)").run(path.join(f.outputRoot,'job.mp4'),now-36*60000);
 assert.deepEqual(f.service.recover(now),[]);
 assert.equal(f.wallet.db.prepare("SELECT state FROM nice_video_jobs WHERE id='job'").get().state,'processing');
 assert.equal(f.service.recover(now+30*60000)[0].state,'uncertain');
});
async function failedJob(t,run){
 const f=await fixture(t,run),file=path.join(f.inputRoot,'retry.mkv');
 await fs.writeFile(file,'input');
 const {uploadId}=await f.service.registerUpload({owner:'buyer',file,originalName:'retry.mkv'});
 f.wallet.db.prepare("INSERT INTO nice_video_jobs VALUES('retry','o','buyer',?,'failed',?,1,?)").run(uploadId,path.join(f.outputRoot,'retry.mp4'),Date.now());
 return {...f,uploadId};
}
test('delete-first claims job before filesystem awaits and prevents concurrent retry',async t=>{
 let calls=0;const f=await failedJob(t,async()=>{calls++;});
 const deleting=f.service.removeOutput('retry','buyer');
 assert.equal(f.service.status('retry','buyer').state,'deleting');
 await assert.rejects(f.service.start({owner:'buyer',orderId:'o',uploadId:f.uploadId}),/unavailable/);
 await deleting;
 assert.equal(f.service.status('retry','buyer').state,'expired');
 assert.equal(calls,0);
 assert.equal(f.wallet.db.prepare("SELECT state FROM nice_entitlements WHERE order_id='o'").get().state,'ready');
});
test('retry-first denies concurrent deletion and preserves completed output',async t=>{
 let release,entered;const running=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
 const f=await failedJob(t,async args=>{entered();await gate;await fs.writeFile(args.at(-1),'output');});
 await f.service.start({owner:'buyer',orderId:'o',uploadId:f.uploadId});
 await running;
 await assert.rejects(f.service.removeOutput('retry','buyer'),/Active job/);
 release();
 assert.equal((await finish(f.service,'retry')).state,'done');
 assert.ok(await f.service.downloadPath('retry','buyer'));
});
test('upload removal claim prevents retry after filesystem validation',async t=>{
 let calls=0;const f=await failedJob(t,async()=>{calls++;});
 f.wallet.db.exec('CREATE TABLE nice_video_reservations(upload_id TEXT,state TEXT)');
 f.wallet.db.prepare("INSERT INTO nice_video_reservations VALUES(?,'removing')").run(f.uploadId);
 await assert.rejects(f.service.start({owner:'buyer',orderId:'o',uploadId:f.uploadId}),/removal/);
 assert.equal(calls,0);assert.equal(f.service.status('retry','buyer').state,'failed');
});
