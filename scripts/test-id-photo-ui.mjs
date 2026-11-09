import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.ID_PHOTO_TEST_URL||'http://127.0.0.1:4339';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let outfit,styling,ready=true,fail=false;
 const sample=readFileSync(new URL('../public/images/product-model/women-01-model.webp',import.meta.url));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='api.manytool.net'){
   const json=(body,status=200)=>route.fulfill({json:body,status,headers:{'Access-Control-Allow-Origin':'*'}});
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'content-type'}});
   if(url.pathname==='/health')return json({ok:true});
   if(url.pathname==='/config')return json({paymentMode:'mock',readiness:{idPhotoReady:ready},providerAvailability:{openai_image:ready},imageProvider:'local_sharp'});
   if(url.pathname==='/upload')return json({photoId:'test-photo'},201);
   if(url.pathname==='/generate'){styling=route.request().postDataJSON();outfit=styling.outfitType;return json({jobId:'test-job',status:'processing'},202);}
   if(url.pathname==='/job/test-job')return json(fail?{status:'failed'}:{status:'done',candidates:[1,2,3].map(i=>({id:String(i),imageUrl:'/image.jpg'})),pipelineReport:{resolvedProvider:'openai_image'}});
   if(url.pathname==='/image.jpg')return route.fulfill({body:sample,contentType:'image/webp'});
   return json({});
  }
  if(url.origin===base||url.protocol==='data:'||url.protocol==='blob:')return route.continue();
  return route.abort();
 });
 await page.goto(base+'/ai-id-photo/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>Boolean(window.manytoolAiUnavailable)),false);
 assert.equal(await page.locator('#personal-comparison').isVisible(),false);
 const toggle=page.getByRole('switch',{name:'정장 입히기'});await toggle.waitFor();assert.equal(await toggle.isChecked(),false);
 await page.locator('#file-input').setInputFiles({name:'portrait.webp',mimeType:'image/webp',buffer:sample});
 await page.locator('#generate:enabled').waitFor({timeout:15000});
 await page.locator('#generate').click();await page.locator('#candidate-grid button').first().waitFor({timeout:15000});assert.equal(outfit,'current');assert.equal(styling.groomingMode,'natural');
 await page.locator('#personal-comparison').waitFor({state:'visible'});
 await page.locator('#compare-after').evaluate(el=>el.src='https://api.manytool.net/missing-image');
 await page.locator('#personal-comparison').waitFor({state:'hidden'});
 await page.locator('#grooming-mode').selectOption('neat');
 await toggle.check();await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#generate')?.disabled===false);assert.equal(outfit,'suit');assert.equal(styling.groomingMode,'neat');
 assert.equal(await page.locator('#candidate-grid button').count(),3);
 await page.locator('#grooming-mode').selectOption('passport');
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);assert.equal(styling.groomingMode,'passport');
 await page.locator('#grooming-mode').selectOption('custom');
 await page.locator('#hair-volume').uncheck();await page.locator('#hair-forehead').check();
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
 assert.equal(styling.groomingMode,'custom');assert.deepEqual(styling.hairOptions,{flyaways:true,smoothVolume:false,clearForehead:true,tuckSides:false});
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#personal-comparison').isVisible(),false);
 assert.equal(await page.locator('#grooming-mode').inputValue(),'custom');assert.equal(await page.locator('#hair-volume').isChecked(),false);assert.equal(await page.locator('#hair-forehead').isChecked(),true);
 await page.locator('#file-input').setInputFiles({name:'portrait.webp',mimeType:'image/webp',buffer:sample});await page.locator('#generate:enabled').waitFor();
 await page.locator('#retouch-enabled').check();await page.locator('#beauty-contour').check();
 const beforePackage = await page.evaluate(() => ({outfit:document.querySelector('#outfit').checked,groom:document.querySelector('#grooming-mode').value,makeup:document.querySelector('#beauty-makeup').checked}));
 await page.locator('#full-package').check();
 assert.equal(await page.locator('#outfit').isChecked(),true);assert.equal(await page.locator('#grooming-mode').inputValue(),'neat');assert.equal(await page.locator('#beauty-makeup').isChecked(),true);
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#generate').disabled);assert.equal(styling.fullPackage,true);assert.equal(styling.retouchEnabled,true);assert.equal(styling.beautyOptions.contour,true);
 await page.locator('#full-package').uncheck();assert.equal(await page.locator('#grooming-mode').inputValue(),beforePackage.groom);assert.equal(await page.locator('#beauty-makeup').isChecked(),beforePackage.makeup);
 await page.locator('#retouch-enabled').uncheck();assert.equal(await page.locator('#beauty-contour').isDisabled(),true);
 await page.locator('#grooming-mode').selectOption('passport');assert.equal(await page.locator('#retouch-enabled').isChecked(),false);assert.equal(await page.locator('#retouch-enabled').isDisabled(),true);
 await page.locator('#grooming-mode').selectOption('natural');
 await page.locator('[data-example="man"]').click();assert.match(await page.locator('[data-hero-after]').getAttribute('src'),/man-after/);
 assert.equal(await page.locator('.studio-example-card').count(),2);
 await page.screenshot({path:'C:/3.manytool/tmp/id-hair-mobile.png',fullPage:true});
 fail=true;await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#generate')?.disabled===false);assert.equal(await page.locator('#candidate-grid button').count(),0);
 ready=false;await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(200);assert.equal(await page.locator('#generate').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: beauty/full-package restoration/passport lock, real sample tabs, grooming presets/manual payload and persistence, mobile ON/OFF payload, async results, failed generation without fallback, readiness and no maintenance popup');
}finally{await browser.close();}
