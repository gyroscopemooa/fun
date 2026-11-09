import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.VIDEO_TEST_URL||'http://127.0.0.1:8767';
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try {
 const page=await browser.newPage();
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const slugs=['youtube-downloader','youtube-shorts-downloader','tiktok-downloader','instagram-video-downloader','instagram-reels-downloader','chzzk-downloader','soop-downloader','video-link-downloader'];
 const titles=new Set();
 for(const slug of slugs){
  const response=await page.goto(`${base}/${slug}/`,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  titles.add(await page.title());assert.equal(await page.locator('main h1').count(),1);
  assert((await page.locator('link[rel=canonical]').getAttribute('href')).includes(slug));
  assert((await page.locator('meta[name=description]').getAttribute('content')).length>40);
  assert.equal(await page.locator('main details').count(),3);
 }
 assert.equal(titles.size,8);
 await page.waitForSelector('astro-island[component-url*=VideoDownloader]:not([ssr])',{state:'attached'});
 await expect(page.getByRole('button',{name:'영상 파일 준비하기'})).toBeEnabled();
 await page.getByLabel('영상 링크').fill('https://127.0.0.1/private.mp4');await page.getByRole('button',{name:'영상 파일 준비하기'}).click();await expect(page.getByRole('alert')).toBeVisible();
 await page.getByLabel('영상 링크').fill('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');await page.getByRole('button',{name:'영상 파일 준비하기'}).click();
 const link=page.getByRole('link',{name:'영상 다운로드',exact:true});await expect(link).toBeVisible({timeout:90000});
 const waiting=page.waitForEvent('download');await link.click();assert.equal((await waiting).suggestedFilename(),'manytool-video.mp4');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'tmp/video-download-mobile.png',fullPage:true});
 await page.goto(base+'/video-download-tools/',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('section[aria-label="영상 다운로드 기능"] a').count(),8);
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 for(const slug of [...slugs,'video-download-tools'])assert(await page.locator(`[data-card] a[href="/${slug}"]`).count()>0,slug);
 console.log('PASS: 8 unique SEO pages, hub, home cards, private URL rejection, real MP4 download, mobile layout');
} finally{await browser.close();}
