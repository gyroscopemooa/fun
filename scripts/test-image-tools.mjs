import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.IMAGE_TOOLS_TEST_URL || 'http://127.0.0.1:8766';
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) });
try {
  const page=await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) || route.request().url().startsWith('blob:') ? route.continue() : route.abort());
  async function visit(path,component) {
    const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
    if(component) await page.waitForSelector(`astro-island[component-url*="${component}"]:not([ssr])`,{state:'attached'});
  }
  await visit('/');
  for(const slug of ['lotto-generator','image-tools','image-cropper','image-merger','image-converter']) assert(await page.locator(`[data-card] a[href="/${slug}"]`).count()>0,`Missing home card: ${slug}`);
  await visit('/lotto-generator/','LottoGenerator');
  await page.getByRole('button',{name:'번호 생성하기'}).click();
  const rows=await page.locator('[aria-live="polite"] > div').evaluateAll(rows=>rows.map(r=>Array.from(r.querySelectorAll('span')).slice(1).map(s=>Number(s.textContent))));
  assert.equal(rows.length,5);for(const nums of rows){assert.equal(new Set(nums).size,6);assert(nums.every(n=>n>=1&&n<=45));assert.deepEqual(nums,[...nums].sort((a,b)=>a-b));}
  const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,50,80);ctx.fillStyle='blue';ctx.fillRect(50,0,50,80);return c.toDataURL().split(',')[1];});
  const file={name:'sample.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')};
  await visit('/image-cropper/','ImageWorkshop');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByLabel('너비',{exact:true}).fill('50');await page.getByLabel('시작 X',{exact:true}).fill('50');
  await expect(page.getByRole('button',{name:'PNG 다운로드'})).toBeEnabled();
  assert.deepEqual(await page.locator('canvas[aria-label="편집 결과 미리보기"]').evaluate(c=>({w:c.width,h:c.height,p:[...c.getContext('2d').getImageData(0,0,1,1).data]})),{w:50,h:80,p:[0,0,255,255]});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'PNG 다운로드'}).click();assert.equal((await download).suggestedFilename(),'manytool-crop.png');
  await page.getByLabel('시작 X',{exact:true}).fill('90');await expect(page.getByRole('button',{name:'PNG 다운로드'})).toBeDisabled();
  await visit('/image-merger/','ImageWorkshop');await page.locator('input[type=file]').setInputFiles([file,{...file,name:'second.png'}]);
  await expect(page.getByRole('button',{name:'PNG 다운로드'})).toBeEnabled();assert.deepEqual(await page.locator('canvas').evaluate(c=>[c.width,c.height]),[100,160]);
  await page.locator('select').selectOption('horizontal');await expect.poll(()=>page.locator('canvas').evaluate(c=>[c.width,c.height])).toEqual([200,80]);
  await visit('/image-converter/','ImageConverter');await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('button',{name:'변환하고 다운로드'})).toBeEnabled();
  for(const format of ['png','jpeg','webp']) {
    await page.getByLabel('변환할 확장자').selectOption(format);
    const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'변환하고 다운로드'}).click();const download=await waiting;
    assert.equal(download.suggestedFilename(),`sample.${format==='jpeg'?'jpg':format}`);
    const bytes=await readFile(await download.path());
    if(format==='png') assert.equal(bytes.subarray(1,4).toString(),'PNG');
    if(format==='jpeg') assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
    if(format==='webp') assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  }
  await visit('/image-tools/');assert.equal(await page.locator('section[aria-label="이미지 기능"] a').count(),6);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow');
  await page.screenshot({path:'tmp/image-tools-mobile.png',fullPage:true});
  await visit('/');await page.screenshot({path:'tmp/image-tools-home.png',fullPage:true});
  console.log('PASS: existing home cards, lotto, actual crop pixels, bounds, merge dimensions, PNG/JPG/WebP signatures, mobile layout');
} finally {await browser.close();}
