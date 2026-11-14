import assert from 'node:assert/strict';
import {readFile,readdirSync,existsSync} from 'node:fs';
import {promisify} from 'node:util';
import {chromium} from '@playwright/test';
import sharp from 'sharp';
const base=process.env.PHOTO_PURPOSE_URL||'http://127.0.0.1:4341';
const application='C:/Program Files/Naver/Naver Whale/Application';
const executablePath=process.env.PHOTO_TEST_BROWSER||readdirSync(application).filter(x=>/^\d+\./.test(x)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(x=>`${application}/${x}/whale.exe`).find(existsSync);
assert.ok(executablePath,'Whale is required; no other browser profile may be used');
const browser=await chromium.launch({executablePath,headless:true});
const portrait=await sharp({create:{width:826,height:1062,channels:3,background:'#1e5028'}}).jpeg().toBuffer();
const square=await sharp({create:{width:1000,height:1000,channels:3,background:'#71869e'}}).jpeg().toBuffer();
let posts=[],payloads=[],ready=true,fail=false,jobReads=0,checkoutCount=0;
try{
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='api.manytool.net'){
   const method=route.request().method();if(method==='POST')posts.push(url.pathname);
   const json=(body,status=200)=>route.fulfill({json:body,status,headers:{'Access-Control-Allow-Origin':'*'}});
   if(method==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'}});
   if(url.pathname==='/config')return json({headshotOptionsVersion:'2026-11-15-v1',readiness:{headshotReady:ready},paymentMode:'polar',paymentProducts:{base:true}});
   if(url.pathname==='/upload')return json({photoId:'portrait-input'},201);
   if(url.pathname==='/credits/quote')return json({error:'disabled'},404);
   if(url.pathname==='/checkout'){checkoutCount++;return json({orderId:'paid-'+checkoutCount,paid:true,status:'paid'},201);}
   if(url.pathname==='/generate'){payloads.push(route.request().postDataJSON());jobReads=0;return json({jobId:'profile-job',status:'processing'},202);}
   if(url.pathname==='/job/profile-job')return json(fail?{status:'failed',creditRefunded:true}:++jobReads===1?{status:'processing'}:{status:'done',candidates:[1,2,3].map(i=>({id:'profile-'+i,imageUrl:'/result-'+i+'.jpg'}))});
   if(url.pathname.startsWith('/download/')||url.pathname.startsWith('/result-'))return route.fulfill({body:square,contentType:'image/jpeg',headers:{'Access-Control-Allow-Origin':'*'}});
   if(url.pathname.startsWith('/order/'))return json({id:url.pathname.split('/').pop(),status:'paid'});
   return json({});
  }
  if(url.origin===new URL(base).origin||url.protocol==='data:'||url.protocol==='blob:')return route.continue();
  return route.abort();
 });
 await page.goto(base+'/ai-passport-photo/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-passport-tool]').waitFor();
 assert.equal(await page.locator('aside[aria-label="AI 상품 가격"]').count(),0);
 assert.equal(await page.locator('#passport-download').isDisabled(),true);
 assert.equal(await page.locator('[data-profile-studio]').count(),0);
 assert.match(await page.locator('h1').innerText(),/여권사진 규격/);
 await page.locator('#passport-file:enabled').waitFor();
 await page.locator('#passport-file').setInputFiles({name:'original.jpg',mimeType:'image/jpeg',buffer:portrait});
 for(const box of await page.locator('[data-passport-tool] input[type=checkbox]').all())await box.check();
 await page.locator('#passport-download:enabled').waitFor();
 const pending=page.waitForEvent('download');await page.locator('#passport-download').click();const download=await pending;
 const bytes=await promisify(readFile)(await download.path());const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,413);assert.equal(metadata.height,531);assert.equal(metadata.density,300);assert.ok(bytes.length<=500*1024);
 const pixels=await sharp(bytes).removeAlpha().raw().toBuffer();for(const index of [0,Math.floor(413*531/2)*3,(413*531-1)*3]){assert.ok(Math.abs(pixels[index]-30)<5);assert.ok(Math.abs(pixels[index+1]-80)<5);assert.ok(Math.abs(pixels[index+2]-40)<5);}
 assert.equal(posts.length,0,'passport must never upload, generate or charge');
 await page.getByRole('slider',{name:'사진 확대',exact:true}).focus();await page.getByRole('slider',{name:'사진 확대',exact:true}).press('ArrowRight');assert.equal(await page.locator('#passport-download').isDisabled(),true);
 const small=await sharp({create:{width:100,height:100,channels:3,background:'white'}}).jpeg().toBuffer();
 await page.locator('#passport-file').setInputFiles({name:'small.jpg',mimeType:'image/jpeg',buffer:small});await page.getByText('현재 자르기 영역의 원본 해상도가 부족합니다.',{exact:false}).waitFor();
 for(const box of await page.locator('[data-passport-tool] input[type=checkbox]').all())await box.check();assert.equal(await page.locator('#passport-download').isDisabled(),true);
 const alpha=await sharp({create:{width:500,height:700,channels:4,background:{r:255,g:255,b:255,alpha:0}}}).png().toBuffer();await page.locator('#passport-file').setInputFiles({name:'transparent.png',mimeType:'image/png',buffer:alpha});await page.getByText('투명 배경 사진은 사용할 수 없습니다.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.env.PHOTO_SCREENSHOT_DIR)await page.screenshot({path:process.env.PHOTO_SCREENSHOT_DIR+'/passport-mobile.png',fullPage:true});
 for(const slug of ['online-passport-photo','free-passport-photo']){await page.goto(base+'/'+slug+'/',{waitUntil:'domcontentloaded'});await page.locator('[data-passport-tool]').waitFor();assert.equal(await page.locator('[data-profile-studio]').count(),0);}
 assert.equal(posts.length,0);
 await page.goto(base+'/ai-headshot/',{waitUntil:'domcontentloaded'});await page.locator('[data-profile-studio]').waitFor();assert.match(await page.locator('h1').innerText(),/프로필사진을 만들어보세요/);assert.equal(await page.locator('aside[aria-label="AI 상품 가격"]').count(),0);assert.equal(await page.locator('[data-passport-tool]').count(),0);
 await page.getByRole('button',{name:/SNS · 개인 프로필/}).click();await page.getByRole('button',{name:'슬레이트 블루',exact:true}).click();
 for(const name of ['스마트 캐주얼','차분한 표정','여유 있는 상반신','정사각 1:1','원래 피부 유지'])await page.getByRole('button',{name,exact:true}).click();
 await page.locator('#profile-file').setInputFiles({name:'portrait.jpg',mimeType:'image/jpeg',buffer:portrait});await page.locator('#profile-generate:enabled').waitFor();await page.locator('#profile-generate').click();
 await page.getByRole('button',{name:'프로필 후보 1',exact:true}).waitFor({timeout:30000});
 assert.equal(payloads.length,1);assert.equal(payloads[0].toolType,'headshot');assert.equal(payloads[0].outfitType,'smart');assert.deepEqual(payloads[0].profileOptions,{purpose:'social',background:'blue',expression:'neutral',framing:'upper',ratio:'square',retouch:'off'});assert.equal(checkoutCount,1);
 await page.getByRole('button',{name:'프로필 후보 2',exact:true}).click();const profileDownload=page.waitForEvent('download');await page.locator('#profile-download').click();const saved=await profileDownload;assert.match(saved.suggestedFilename(),/1000x1000/);assert.equal(await page.getByRole('button',{name:'프로필 후보 1',exact:true}).isDisabled(),true);
 const savedMeta=await sharp(await promisify(readFile)(await saved.path())).metadata();assert.equal(savedMeta.width,1000);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.env.PHOTO_SCREENSHOT_DIR)await page.screenshot({path:process.env.PHOTO_SCREENSHOT_DIR+'/profile-mobile.png',fullPage:true});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'프로필 후보 2',exact:true}).waitFor({timeout:30000});assert.equal(checkoutCount,1,'refresh must resume the job without another purchase');
 await page.getByRole('button',{name:'새 프로필 준비하기',exact:true}).click();fail=true;await page.locator('#profile-file').setInputFiles({name:'portrait.jpg',mimeType:'image/jpeg',buffer:portrait});await page.locator('#profile-generate:enabled').waitFor();await page.locator('#profile-generate').click();await page.getByRole('alert').filter({hasText:'크레딧이 반환'}).waitFor({timeout:30000});assert.equal(await page.getByRole('button',{name:'프로필 후보 1',exact:true}).count(),0);
 ready=false;await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('status').filter({hasText:'프로필 생성 서버 준비 중'}).waitFor();assert.equal(await page.locator('#profile-generate').isDisabled(),true);
 await page.goto(base+'/ai-photoshop/',{waitUntil:'domcontentloaded'});await page.locator('[data-profile-studio]').waitFor();
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('[data-photo-studios] a[href="/ai-passport-photo"]').count(),1);assert.match(await page.locator('[data-photo-studios] a[href="/ai-passport-photo"]').innerText(),/무료/);assert.equal(await page.locator('aside a[href="/ai-headshot"]').count(),1);
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/ai-passport-photo/',{waitUntil:'domcontentloaded'});await page.locator('[data-passport-tool]').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.PHOTO_SCREENSHOT_DIR)await page.screenshot({path:process.env.PHOTO_SCREENSHOT_DIR+'/passport-desktop.png',fullPage:true});
 ready=true;await page.goto(base+'/ai-headshot/',{waitUntil:'domcontentloaded'});await page.locator('[data-profile-studio]').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.PHOTO_SCREENSHOT_DIR)await page.screenshot({path:process.env.PHOTO_SCREENSHOT_DIR+'/profile-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: distinct passport/profile UIs; private original-only 413x531 JPEG/300dpi/pixel preservation; manual/resolution guards; real headshot options; paid async results, one selection, resume without charging, failure/refund and readiness; desktop/mobile and navigation');
}finally{await browser.close();}
