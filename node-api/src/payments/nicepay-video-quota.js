import {randomUUID} from 'node:crypto';import path from 'node:path';import fs from 'node:fs/promises';
export function createVideoUploadQuota({wallet,inputRoot,maxBytes,maxOwnerBytes=3*1024**3,maxGlobalBytes=20*1024**3,maxOwnerFiles=2,hourlyLimit=6}){
 for(const n of [maxBytes,maxOwnerBytes,maxGlobalBytes,maxOwnerFiles,hourlyLimit])if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid video quota');
 const db=wallet.db;db.exec(`CREATE TABLE IF NOT EXISTS nice_video_reservations(id TEXT PRIMARY KEY,owner TEXT NOT NULL,order_id TEXT NOT NULL,bytes INTEGER NOT NULL,state TEXT NOT NULL,upload_id TEXT,created INTEGER NOT NULL)`);
 const quota={
 reserve(owner,orderId,now=Date.now()){
  return wallet.tx(()=>{
   const e=db.prepare("SELECT 1 FROM nice_entitlements WHERE order_id=? AND owner=? AND product='video_mkv_mp4' AND state='ready'").get(orderId,owner);if(!e)throw Error('Unused video entitlement required');
   if(db.prepare("SELECT 1 FROM nice_video_reservations WHERE order_id=? AND state!='removed'").get(orderId))throw Error('Delete prior upload first');
   if(db.prepare("SELECT count(*) n FROM (SELECT order_id FROM nice_video_jobs WHERE owner=? AND state IN ('queued','processing','done','uncertain','deleting') UNION SELECT order_id FROM nice_video_reservations WHERE owner=? AND state!='removed')").get(owner,owner).n>=maxOwnerFiles)throw Error('Remove completed outputs before another upload');
   if(db.prepare("SELECT count(*) n FROM (SELECT order_id FROM nice_video_jobs WHERE state IN ('queued','processing','done','uncertain','deleting') UNION SELECT order_id FROM nice_video_reservations WHERE state!='removed')").get().n>=Math.max(1,Math.floor(maxGlobalBytes/(2*1024**3))))throw Error('Global output quota reached');
   const ownerUsage=db.prepare("SELECT count(*) n,coalesce(sum(bytes),0) bytes FROM nice_video_reservations WHERE owner=? AND state!='removed'").get(owner);
   const all=db.prepare("SELECT coalesce(sum(bytes),0) bytes FROM nice_video_reservations WHERE state!='removed'").get();
   const rate=db.prepare('SELECT count(*) n FROM nice_video_reservations WHERE owner=? AND created>?').get(owner,now-3600000);
   if(ownerUsage.n>=maxOwnerFiles||ownerUsage.bytes+maxBytes>maxOwnerBytes||all.bytes+maxBytes>maxGlobalBytes||rate.n>=hourlyLimit)throw Error('Upload quota reached');
   const id=randomUUID();db.prepare("INSERT INTO nice_video_reservations VALUES(?,?,?,?,'reserved',NULL,?)").run(id,owner,orderId,maxBytes,now);return {id,file:path.join(inputRoot,`${id}.upload`)};
  });
 },
 complete(id,uploadId,size){if(!Number.isSafeInteger(size)||size<=0||size>maxBytes)throw Error('Upload size mismatch');const r=db.prepare("UPDATE nice_video_reservations SET state='complete',bytes=?,upload_id=? WHERE id=? AND state='reserved'").run(size,uploadId,id);if(r.changes!==1)throw Error('Upload reservation unavailable');},
 async remove(id,owner){
  const row=wallet.tx(()=>{const r=db.prepare('SELECT * FROM nice_video_reservations WHERE id=? AND owner=?').get(id,owner);if(!r)throw Error('Owned upload reservation required');
   if(r.upload_id&&db.prepare("SELECT 1 FROM nice_video_jobs WHERE upload_id=? AND state IN ('queued','processing','uncertain')").get(r.upload_id))throw Error('Video still active or uncertain');
   db.prepare("UPDATE nice_video_reservations SET state='removing' WHERE id=?").run(id);return r;});
  await fs.rm(path.join(inputRoot,`${id}.upload`),{force:true});
  wallet.tx(()=>{if(row.upload_id)db.prepare('DELETE FROM nice_video_uploads WHERE id=?').run(row.upload_id);db.prepare("UPDATE nice_video_reservations SET state='removed',bytes=0 WHERE id=?").run(id);});
 },
 async cleanup(now=Date.now()){const results=[];for(const row of quota.candidates(now)){try{await quota.remove(row.id,row.owner);results.push({id:row.id,removed:true});}catch{results.push({id:row.id,removed:false});}}return results;},
 candidates(now=Date.now()){return db.prepare("SELECT id,owner FROM nice_video_reservations WHERE (state='reserved' AND created<?) OR (state IN ('complete','removing') AND created<?)").all(now-3600000,now-86400000);}
 };
 return quota;
}
