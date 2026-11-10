import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {CreditStore} from '../credits/store.js';import {createNicepayVideoService} from './nicepay-video.js';import {createVideoUploadQuota} from './nicepay-video-quota.js';
test('upload reservations enforce paid order, concurrency bytes and rate, cleanup keeps history',async t=>{
 const dir=await fs.mkdtemp(path.join(tmpdir(),'nice-quota-'));const wallet=new CreditStore(':memory:');t.after(async()=>{wallet.close();await fs.rm(dir,{recursive:true,force:true});});
 wallet.db.exec("CREATE TABLE nice_entitlements(order_id TEXT PRIMARY KEY,owner TEXT,product TEXT,state TEXT);INSERT INTO nice_entitlements VALUES('one','buyer','video_mkv_mp4','ready'),('two','buyer','video_mkv_mp4','ready')");createNicepayVideoService({wallet,inputRoot:dir,outputRoot:dir+'-out',enabled:true});
 const quota=createVideoUploadQuota({wallet,inputRoot:dir,maxBytes:100,maxOwnerBytes:100,maxGlobalBytes:200,maxOwnerFiles:2,hourlyLimit:2});
 assert.throws(()=>quota.reserve('buyer','unpaid'));const a=quota.reserve('buyer','one');assert.throws(()=>quota.reserve('buyer','one'));assert.throws(()=>quota.reserve('buyer','two'));
 await fs.writeFile(a.file,'fixture');await quota.remove(a.id,'buyer');assert.equal((await fs.readdir(dir)).length,0);
 const b=quota.reserve('buyer','two');await quota.remove(b.id,'buyer');assert.throws(()=>quota.reserve('buyer','one'));assert.equal(wallet.db.prepare('SELECT count(*) n FROM nice_video_reservations').get().n,2);
});
