import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
export function runNicepayFfmpeg(args,{binary='ffmpeg',timeoutMs=30*60000}={}){
 return new Promise((resolve,reject)=>{const child=spawn(binary,args,{stdio:['ignore','ignore','pipe'],shell:false});let error='';const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
 child.stderr.on('data',b=>{error=(error+b.toString()).slice(-4096);});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`Video conversion failed (${code})`));});});
}
// Roots are trusted, private persistent directories, never request parameters or /files.
export function createNicepayVideoService({wallet,inputRoot,outputRoot,enabled=false,run=runNicepayFfmpeg}){
 if(!enabled)throw Error('NICE video disabled');
 wallet.db.exec(`CREATE TABLE IF NOT EXISTS nice_video_uploads(id TEXT PRIMARY KEY,owner TEXT NOT NULL,file TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS nice_video_jobs(id TEXT PRIMARY KEY,order_id TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,upload_id TEXT NOT NULL,state TEXT NOT NULL,output TEXT NOT NULL,attempts INTEGER NOT NULL,updated INTEGER NOT NULL)`);
 const requireRoots=async()=>{const roots=[await fs.realpath(inputRoot),await fs.realpath(outputRoot)];if(roots[0]===roots[1]||inside(roots[0],roots[1])||inside(roots[1],roots[0]))throw Error('Separate private video roots required');return roots;};
 async function registerUpload({owner,file,originalName}){
  if(typeof owner!=='string'||!owner||typeof originalName!=='string'||!['.mkv','.mov','.avi','.m4v'].includes(path.extname(originalName).toLowerCase()))throw Error('Invalid video upload');
  const [root]=await requireRoots(),real=await fs.realpath(file),stat=await fs.stat(real);if(!inside(root,real)||!stat.isFile()||!stat.size||stat.size>1.5*1024**3)throw Error('Invalid private video file');
  const id=randomUUID();wallet.db.prepare('INSERT INTO nice_video_uploads VALUES(?,?,?,?,?)').run(id,owner,real,path.basename(originalName),stat.size);return {uploadId:id};
 }
 function ownedJob(jobId,owner){const job=wallet.db.prepare('SELECT * FROM nice_video_jobs WHERE id=? AND owner=?').get(jobId,owner);if(!job)throw Error('Video job unavailable');return job;}
 async function process(jobId){
  const job=wallet.db.prepare('SELECT * FROM nice_video_jobs WHERE id=?').get(jobId),upload=wallet.db.prepare('SELECT * FROM nice_video_uploads WHERE id=?').get(job.upload_id);
  const changed=wallet.db.prepare("UPDATE nice_video_jobs SET state='processing',updated=? WHERE id=? AND state='queued'").run(Date.now(),jobId);if(changed.changes!==1)return;
  try{
   const [root,out]=await requireRoots();if(!inside(root,await fs.realpath(upload.file))||!inside(out,job.output))throw Error('Private video path changed');
   const common=['-nostdin','-y','-protocol_whitelist','file,pipe','-format_whitelist','matroska,webm,mov,avi','-i',upload.file];
   try{await run([...common,'-c','copy','-movflags','+faststart',job.output]);}
   catch{await fs.rm(job.output,{force:true});await run([...common,'-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-b:a','192k','-movflags','+faststart',job.output]);}
   const output=await fs.stat(job.output);if(!output.isFile()||!output.size)throw Error('Missing conversion output');
   const completed=wallet.db.prepare("UPDATE nice_video_jobs SET state='done',updated=? WHERE id=? AND state='processing'").run(Date.now(),jobId);
   // A quarantined job keeps its output for manual reconciliation, never releases allowance.
   if(completed.changes!==1)return;
  }catch{
   await fs.rm(job.output,{force:true}).catch(()=>{});
   wallet.tx(()=>{wallet.db.prepare("UPDATE nice_video_jobs SET state='failed',updated=? WHERE id=?").run(Date.now(),jobId);wallet.db.prepare("UPDATE nice_entitlements SET state='ready' WHERE order_id=? AND state='claimed'").run(job.order_id);});
  }
 }
 async function start({orderId,owner,uploadId}){
  const [root,out]=await requireRoots(),upload=wallet.db.prepare('SELECT * FROM nice_video_uploads WHERE id=? AND owner=?').get(uploadId,owner);if(!upload||!inside(root,await fs.realpath(upload.file)))throw Error('Owned upload required');
  const id=wallet.tx(()=>{
   const entitlement=wallet.db.prepare("SELECT * FROM nice_entitlements WHERE order_id=? AND owner=? AND product='video_mkv_mp4'").get(orderId,owner);if(!entitlement)throw Error('Video entitlement required');
   const prior=wallet.db.prepare('SELECT * FROM nice_video_jobs WHERE order_id=?').get(orderId);
   if(prior&&['queued','processing','done'].includes(prior.state))return prior.id;
   if(entitlement.state!=='ready'||(prior&&prior.state!=='failed')||(prior?.attempts??0)>=3)throw Error('Video execution unavailable');
   const jobId=prior?.id??randomUUID(),output=path.join(out,`${jobId}.mp4`);
   wallet.db.prepare("UPDATE nice_entitlements SET state='claimed' WHERE order_id=?").run(orderId);
   wallet.db.prepare("INSERT INTO nice_video_jobs VALUES(?,?,?,?,'queued',?,1,?) ON CONFLICT(order_id) DO UPDATE SET upload_id=excluded.upload_id,state='queued',attempts=attempts+1,updated=excluded.updated").run(jobId,orderId,owner,uploadId,output,Date.now());return jobId;
  });
  void process(id).catch(()=>{wallet.db.prepare("UPDATE nice_video_jobs SET state='uncertain',updated=? WHERE id=? AND state IN ('queued','processing')").run(Date.now(),id);});return {jobId:id};
 }
 return {registerUpload,start,process,
  status(jobId,owner){const j=ownedJob(jobId,owner);return {jobId:j.id,state:j.state,downloadReady:j.state==='done'};},
  async downloadPath(jobId,owner){const job=ownedJob(jobId,owner);if(job.state!=='done')throw Error('Video not ready');const [,out]=await requireRoots(),real=await fs.realpath(job.output);if(!inside(out,real))throw Error('Invalid output');return real;},
  recover(now=Date.now()){wallet.db.prepare("UPDATE nice_video_jobs SET state='uncertain',updated=? WHERE state='processing' AND updated<?").run(now,now-65*60000);return wallet.db.prepare("SELECT id,state FROM nice_video_jobs WHERE state IN ('queued','uncertain')").all();}
 };
}
