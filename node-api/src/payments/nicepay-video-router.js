import express from 'express';import multer from 'multer';import fs from 'node:fs/promises';import path from 'node:path';
import {createNicepayVideoService} from './nicepay-video.js';
import {createVideoUploadQuota} from './nicepay-video-quota.js';
const isWithin=(root,file)=>{const rel=path.relative(root,file);return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};
// Unmounted staging controller; no cookies, credentials or payment secrets are created here.
export async function createNicepayVideoRouter({enabled=false,wallet,authenticate,origin,inputRoot,outputRoot,publicRoot,run,maxBytes=1.5*1024**3}){
 const router=express.Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');if(!enabled)return res.status(503).json({error:'NICE video unavailable'});next();});
 if(!enabled)return router;
 if(typeof authenticate!=='function'||new URL(origin).protocol!=='https:'||!publicRoot||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1.5*1024**3)throw Error('Verified video configuration required');
 const publicPath=await fs.realpath(publicRoot);
 for(const dir of [inputRoot,outputRoot]){await fs.mkdir(dir,{recursive:true,mode:0o700});if(isWithin(publicPath,await fs.realpath(dir)))throw Error('Video storage must be private');}
 const service=createNicepayVideoService({wallet,inputRoot,outputRoot,enabled:true,run});
 router.use(async(req,res,next)=>{try{const owner=await authenticate(req);if(typeof owner!=='string'||!owner)throw Error();req.niceOwner=owner;next();}catch{res.status(401).json({error:'Authentication required'});}});
 const quota=createVideoUploadQuota({wallet,inputRoot,maxBytes});
 const requireOrigin=(req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'Origin rejected'});
 const upload=multer({storage:multer.diskStorage({destination:inputRoot,filename:(req,_file,done)=>done(null,path.basename(req.niceUpload.file))}),limits:{fileSize:maxBytes,files:1,fields:0,parts:1},fileFilter:(_req,file,done)=>done(null,['.mkv','.mov','.avi','.m4v'].includes(path.extname(file.originalname).toLowerCase()))});
 router.post('/upload',requireOrigin,(req,res,next)=>{try{req.niceUpload=quota.reserve(req.niceOwner,req.headers['x-manytool-order']);req.setTimeout(10*60000,()=>req.destroy());req.once('aborted',()=>{void quota.remove(req.niceUpload.id,req.niceOwner).catch(()=>{});});next();}catch{res.status(429).json({error:'Unused video order and available upload quota required'});}},upload.single('video'),async(req,res)=>{
  try{if(!req.file)throw Error();await fs.chmod(req.file.path,0o600);const result=await service.registerUpload({owner:req.niceOwner,file:req.file.path,originalName:req.file.originalname});quota.complete(req.niceUpload.id,result.uploadId,req.file.size);res.status(201).json({...result,reservationId:req.niceUpload.id});}
  catch{if(req.niceUpload)await quota.remove(req.niceUpload.id,req.niceOwner).catch(()=>{});res.status(400).json({error:'Video upload rejected'});}
 });
 router.delete('/upload/:id',requireOrigin,async(req,res)=>{try{await quota.remove(req.params.id,req.niceOwner);res.json({removed:true});}catch{res.status(409).json({error:'Upload cannot be removed'});}});
 router.post('/convert',requireOrigin,express.json({limit:'2kb'}),async(req,res)=>{
  try{if(!wallet.db.prepare("SELECT 1 FROM nice_video_reservations WHERE upload_id=? AND order_id=? AND owner=? AND state='complete'").get(req.body?.uploadId,req.body?.orderId,req.niceOwner))throw Error('Upload order mismatch');const job=await service.start({orderId:req.body?.orderId,uploadId:req.body?.uploadId,owner:req.niceOwner});res.status(202).json(job);}
  catch{res.status(409).json({error:'Owned video order and upload required'});}
 });
 router.delete('/job/:id',requireOrigin,async(req,res)=>{try{await service.removeOutput(req.params.id,req.niceOwner);res.json({removed:true});}catch{res.status(409).json({error:'Job cannot be removed'});}});
 router.get('/job/:id',(req,res)=>{try{res.json(service.status(req.params.id,req.niceOwner));}catch{res.status(404).json({error:'Job unavailable'});}});
 router.get('/download/:id',async(req,res)=>{try{const file=await service.downloadPath(req.params.id,req.niceOwner);res.set('X-Content-Type-Options','nosniff');res.download(file,'manytool-video.mp4');}catch{res.status(404).json({error:'Download unavailable'});}});
 router.use((error,req,res,_next)=>{if(req.niceUpload)void quota.remove(req.niceUpload.id,req.niceOwner).catch(()=>{});res.status(error?.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Video upload failed'});});
 return router;
}
