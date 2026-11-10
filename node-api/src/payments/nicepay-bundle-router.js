import express from 'express';
import {createNicepayBundleRunners} from './nicepay-bundle-runners.js';

// Unmounted staging assembly. authenticate is supplied by the trusted server, not request JSON.
export function createNicepayBundleRouter({enabled=false,authenticate,origin,...options}={}) {
  const router=express.Router();
  if (enabled && (typeof authenticate!=='function' || new URL(origin).origin!==origin || new URL(origin).protocol!=='https:')) throw Error('Verified bundle configuration required');
  const service=enabled?createNicepayBundleRunners({...options,enabled:true}):null;
  router.use(async(req,res,next)=>{
    res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
    if (!enabled) return res.status(503).json({error:'NICE bundles unavailable'});
    if (req.headers.origin!==origin) return res.status(403).json({error:'Origin rejected'});
    try {const owner=await authenticate(req);if (typeof owner!=='string'||!owner) throw Error();res.locals.owner=owner;next();}
    catch {res.status(401).json({error:'Authentication required'});}
  });
  router.get('/pet/:orderId',(req,res)=>{
    try {res.json(service.petStatus({orderId:req.params.orderId,owner:res.locals.owner}));}
    catch {res.status(404).json({error:'Pet pass unavailable'});}
  });
  router.post('/pet',express.json({limit:'15mb'}),async(req,res)=>{
    try {
      const body=req.body??{}, supplied=body.input??{};
      // Never deserialize a browser-supplied Buffer, filesystem path or original filename.
      const input={animal:supplied.animal,mode:supplied.mode,textInput:supplied.textInput,locale:supplied.locale};
      if (supplied.audio!==undefined) {
        const mime=supplied.audioMimeType??'audio/webm';
        if (!['audio/webm','audio/wav','audio/mpeg','audio/mp4','audio/ogg'].includes(mime) || typeof supplied.audio!=='string' || supplied.audio.length>14*1024*1024) throw Error();
        const buffer=Buffer.from(supplied.audio,'base64');
        if (!buffer.length||buffer.length>10*1024*1024||buffer.toString('base64')!==supplied.audio) throw Error();
        const extension={'audio/webm':'webm','audio/wav':'wav','audio/mpeg':'mp3','audio/mp4':'m4a','audio/ogg':'ogg'}[mime];
        input.audioInput={buffer,mimeType:mime,filename:`pet-input.${extension}`};
      }
      res.json(await service.pet({orderId:body.orderId,requestId:body.requestId,owner:res.locals.owner,input}));
    } catch {res.status(409).json({error:'Pet request unavailable; check input, access, storage or pending execution'});}
  });
  router.post('/name/:operation',express.json({limit:'8kb'}),async(req,res)=>{
    try {res.json(await service.name({orderId:req.body?.orderId,requestId:req.body?.requestId,owner:res.locals.owner,
      operation:req.params.operation,input:req.body?.input,options:req.body?.options}));}
    catch {res.status(409).json({error:'Name request unavailable; check input, access or pending execution'});}
  });
  router.get('/artifact/:id',(req,res)=>{
    try {const artifact=service.readArtifact({artifactId:req.params.id,owner:res.locals.owner});res.set('Content-Disposition','attachment; filename="pet-command.mp3"').type(artifact.mimeType).send(artifact.bytes);}
    catch {res.status(404).json({error:'Artifact unavailable'});}
  });
  router.delete('/artifact/:id',(req,res)=>{
    try {res.json(service.removeArtifact({artifactId:req.params.id,owner:res.locals.owner}));}
    catch {res.status(404).json({error:'Artifact unavailable'});}
  });
  router.use((error,_req,res,_next)=>res.status(error?.status===413?413:400).json({error:'Invalid bundle request'}));
  return router;
}
