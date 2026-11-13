// Explicit manual provider verification. Never imports server.js, payment transports or a DB.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=process.env.AI_VERIFY_OUTPUT;
if(!target||process.env.AI_VERIFY_LIVE!=='true')throw Error('Explicit AI_VERIFY_LIVE=true and AI_VERIFY_OUTPUT required');
const output=path.resolve(target);await fs.mkdir(output,{recursive:true});
const envFile=process.env.AI_VERIFY_ENV;
if(envFile){const env=dotenv.parse(await fs.readFile(envFile));for(const key of ['OPENAI_API_KEY','FFMPEG_PATH'])if(env[key])process.env[key]=env[key];}
if(!process.env.OPENAI_API_KEY)throw Error('OpenAI key missing');
const fetcher=globalThis.fetch,requests=[];let sent=0;
globalThis.fetch=async(url,init)=>{
  if(!String(url).startsWith('https://api.openai.com/v1/'))throw Error('Unexpected provider destination');
  if(++sent>30)throw Error('Manual verification request limit reached');
  const started=Date.now(),r=await fetcher(url,init);
  let body;try{body=typeof init?.body==='string'?JSON.parse(init.body):null;}catch{}
  const entry={endpoint:new URL(url).pathname,model:body?.model??init?.body?.get?.('model')??null,status:r.status,elapsedMs:Date.now()-started};
  if(r.headers.get('content-type')?.includes('application/json')){
    const data=await r.clone().json().catch(()=>null);if(data?.usage)entry.usage=data.usage;
    if(data?.error)entry.errorCode=data.error.code??data.error.type??'provider_error';
  }
  requests.push(entry);return r;
};
const {generateWithOpenAiImage}=await import('../src/providers/openAiPortraitProvider.js');
const {generateAiImageOnce}=await import('../src/commerce/aiImageGenerator.js');
const {analyzeMealCalories}=await import('../src/commerce/calorieAnalyzer.js');
const {analyzePersonalColor}=await import('../src/commerce/personalColorAnalyzer.js');
const {analyzeSaju}=await import('../src/commerce/sajuAnalyzer.js');
const {generateCommerceDetailPage}=await import('../src/commerce/detailPage.js');
const {analyzePetAudio}=await import('../src/commerce/petTranslator.js');
const portrait=path.join(root,'public/images/product-model/women-01-model.webp');
const portraitBytes=await fs.readFile(portrait);
const inline=async file=>'data:image/jpeg;base64,'+(await sharp(await fs.readFile(file)).resize({width:768,withoutEnlargement:true}).jpeg({quality:85}).toBuffer()).toString('base64');
const face=await inline(portrait),meal=await inline(path.join(root,'public/images/calorie-samples/chicken-salad.webp'));
const garment=await inline(path.join(root,'public/images/product-model/women-01-garment.webp'));
const results=[];
const check=(ok,message)=>{if(!ok)throw Error(message);};
const tasks=[
  ...['headshot','id_photo','passport_photo'].map(tool=>[tool,async()=>{
    const value=await generateWithOpenAiImage({inputPath:portrait,storageDir:output,jobId:tool,toolType:tool,outfitType:'current'});
    check(value.generated.length===3,'Candidate count mismatch');
    const artifacts=[];for(const g of value.generated){const file=g.filePath??g.path;const metadata=await sharp(file).metadata();check(metadata.width>0&&metadata.height>0,'Invalid portrait');artifacts.push(path.basename(file));}
    return {candidates:3,artifacts};
  }]),
  ...['figure','body','free','animation','modelcut'].map(mode=>['image_'+mode,async()=>{
    const value=await generateAiImageOnce({id:'verify-'+mode,provider:'openai',mode,userInput:'Clean studio product illustration, preserve the uploaded subject.',imageBuffer:portraitBytes,mimeType:'image/webp',originalFilename:'sample.webp',outputDir:output});
    const m=await sharp(value.filePath).metadata();check(m.width>0,'Invalid generated image');return {artifact:path.basename(value.filePath),width:m.width,height:m.height};
  }]),
  ['calorie',async()=>{const value=await analyzeMealCalories({imageDataUrl:meal,locale:'ko'});check(value&&Object.keys(value).length>3,'Invalid calorie report');await fs.writeFile(path.join(output,'calorie.json'),JSON.stringify(value,null,2));return {artifact:'calorie.json'};}],
  ['personal_color',async()=>{const value=await analyzePersonalColor({imageDataUrl:face,locale:'ko'});check(value&&Object.keys(value).length>3,'Invalid color report');await fs.writeFile(path.join(output,'personal-color.json'),JSON.stringify(value,null,2));return {artifact:'personal-color.json'};}],
  ['saju',async()=>{const value=await analyzeSaju({name:'검수 샘플',birthDate:'1995-06-15',birthTime:'12:00',locale:'ko'});check(value?.profile?.pillars&&value?.report&&Object.keys(value.report).length>3,'Invalid saju report');await fs.writeFile(path.join(output,'saju.json'),JSON.stringify(value,null,2));return {artifact:'saju.json'};}],
  ...[5,20].map(pageCount=>['detail_'+pageCount,async()=>{const value=await generateCommerceDetailPage({productName:'샘플 의류',audience:'성인',sellingPoints:'기본 의류 제품',theme:'premium',pageCount,images:[garment]});check(value.sections?.length===pageCount,'Page count mismatch');await fs.writeFile(path.join(output,'detail-'+pageCount+'.json'),JSON.stringify(value,null,2));return {artifact:'detail-'+pageCount+'.json',sections:value.sections.length};}]),
  ...['analyze','command'].map(mode=>['pet_'+mode,async()=>{const value=await analyzePetAudio({animal:'dog',mode,textInput:'반갑게 짧게 멍멍 짖어요',locale:'ko'});check(value.text?.trim(),'Empty pet translation');if(mode==='command'){const bytes=Buffer.from(value.audio??'','base64');check(bytes.length>100,'No pet voice');await fs.writeFile(path.join(output,'pet-command.mp3'),bytes);}return {hasText:true,hasAudio:!!value.audio,audioSource:value.audioSource};}])
];
const selected=process.env.AI_VERIFY_ONLY?.split(',');
let cursor=0;
async function worker(){while(cursor<tasks.length){const [name,run]=tasks[cursor++];if(selected&&!selected.includes(name))continue;const start=Date.now();try{const result=await run();const row={name,ok:true,elapsedMs:Date.now()-start,...result};results.push(row);console.log(JSON.stringify(row));}catch(error){const row={name,ok:false,elapsedMs:Date.now()-start,errorType:error?.name??'Error',status:error?.status??null,errorCode:error?.code??null};results.push(row);console.log(JSON.stringify(row));}await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({date:new Date().toISOString(),providerOnly:true,paymentApproval:false,results,requests},null,2));}}
await Promise.all([worker(),worker(),worker()]);
process.exitCode=results.some(r=>!r.ok)?1:0;
