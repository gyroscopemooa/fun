import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({locale:'ko-KR',viewport:{width:1280,height:900}});
await context.addInitScript(()=>localStorage.setItem('manytool-locale','ko'));
await context.route('**/*',r=>{
 const u=new URL(r.request().url());
 if(u.pathname==='/api/trending') return r.fulfill({contentType:'application/json',body:JSON.stringify({items:[{title:'테스트',rank:1}],updatedAt:new Date().toISOString()})});
 if(u.pathname==='/api/locale') return r.fulfill({contentType:'application/json',body:'{"locale":"ko"}'});
 if(u.hostname!=='127.0.0.1') return r.abort();
 return r.continue();
});
const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.HOME_CARDS_URL || 'http://127.0.0.1:4341/',{waitUntil:'domcontentloaded'});
const search=page.locator('#tool-search');
const links=await page.locator('[data-search-result] a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
expect(new Set(links).size).toBe(links.length);
for(const href of links) expect(existsSync(`${process.env.HOME_CARDS_DIST || 'dist'}${href}/index.html`), `Search target exists: ${href}`).toBe(true);
console.log(`Verified ${links.length} unique searchable public tool routes.`);
for(const [query,path] of [['단위변환','/en/unit-converter'],['이미지자르기','/en/image-cropper'],['펫 번역기','/ai-pet-translator'],['프리미엄 이름','/name-premium'],['헤어 스타일','/ai-image-generator/hairstyle'],['AI 인테리어','/ai-image-generator/interior'],['aI프로필사진','/ai-photoshop'],['의상변경','/ai-image-generator/outfit-change']]){
 await search.fill(query);
 await expect(page.locator(`[data-search-result]:not([hidden]) a[href="${path}"]`)).toBeVisible();
}
await page.locator('[data-tab="games"]').click();
await search.fill('펫 번역기');
await expect(page.locator('[data-search-result]:not([hidden]) a[href="/ai-pet-translator"]')).toBeVisible();
await search.fill('없는도구abcdef');await expect(page.locator('#search-empty')).toBeVisible();
await search.fill('');await expect(page.locator('#home-card-rows')).toBeVisible();
await page.locator('[data-tab="all"]').click();
const row=page.locator('[data-slider]').first(),track=row.locator('[data-track]');
await row.scrollIntoViewIfNeeded();await page.mouse.move(1,1);
await expect(row).toHaveAttribute('data-looping','true');
const before=await track.evaluate(el=>el.scrollLeft);
await expect.poll(()=>track.evaluate(el=>el.scrollLeft),{timeout:5000}).toBeGreaterThan(before+15);
// Cross the seam during automatic movement, checking the same modulo position advances.
const width=await track.evaluate(el=>el.querySelector('[data-dup="1"]').offsetLeft-el.querySelector('[data-dup="0"]').offsetLeft);
await track.evaluate((el,w)=>{el.scrollLeft=2*w-8;},width);
await expect.poll(()=>track.evaluate(el=>el.scrollLeft),{timeout:4000}).toBeLessThan(width+100);
await expect.poll(()=>track.evaluate(el=>el.scrollLeft),{timeout:4000}).toBeGreaterThan(width+5);
await page.locator('#home-motion-toggle').click();
await expect(page.locator('#home-motion-toggle')).toHaveAttribute('aria-pressed','false');
const stopped=await track.evaluate(el=>el.scrollLeft);await page.waitForTimeout(250);
expect(await track.evaluate(el=>el.scrollLeft)).toBe(stopped);
// Reverse wrapping uses the same measured width and never smooth-scrolls back.
await track.evaluate((el,w)=>{el.scrollLeft=w-50;},width);
await expect.poll(()=>track.evaluate(el=>el.scrollLeft)).toBeGreaterThan(2*width-60);
await expect(track).toHaveCSS('scroll-behavior','auto');
// A category's short rows are not forced to jump by an obsolete loop width.
await page.locator('[data-tab="art"]').click();
for(const short of await page.locator('[data-slider][data-looping="false"]:not(.hidden)').all()){
 expect(await short.locator('[data-track]').evaluate(el=>el.scrollLeft)).toBe(0);
}
await page.locator('[data-tab="all"]').click();
const favorite=page.locator('[data-card][aria-hidden="false"] [data-favorite-toggle]').first();
await favorite.click(); await page.locator('#favorite-filter-button').click();
await expect(page.locator('[data-card][data-dup="0"]:not(.hidden)')).toHaveCount(1);
await search.fill('펫번역기');await expect(page.locator('[data-search-result]:not([hidden]) a[href="/ai-pet-translator"]')).toBeVisible();
await search.fill('');await page.locator('#favorite-filter-button').click();
await page.emulateMedia({reducedMotion:'reduce'});
await expect(page.locator('#home-motion-toggle')).toHaveAttribute('aria-pressed','false');
await page.screenshot({path:'tmp/home-cards-desktop.png',fullPage:false});
await page.setViewportSize({width:390,height:844});
await expect(page.locator('#manytool-shell')).toHaveCSS('padding-left','0px');
await row.scrollIntoViewIfNeeded();
await expect(track).toHaveCSS('scroll-behavior','auto');
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
await page.locator('#home-motion-toggle').click();await page.mouse.move(1,1);
const mobile=await track.evaluate(el=>el.scrollLeft);
await expect.poll(()=>track.evaluate(el=>el.scrollLeft),{timeout:5000}).toBeGreaterThan(mobile+12);
await page.screenshot({path:'tmp/home-cards-mobile.png',fullPage:false});
await page.locator('#home-motion-toggle').click();
await search.fill('AI');
expect(await page.locator('[data-search-result]:not([hidden])').count()).toBeGreaterThan(20);
const searchTrack = page.locator('#home-search-track');
const nextResult = page.getByRole('button',{name:'다음 검색 결과',exact:true});
const prevResult = page.getByRole('button',{name:'이전 검색 결과',exact:true});
await expect(nextResult).toBeVisible(); await expect(nextResult).toBeEnabled();
await expect(prevResult).toBeVisible(); await expect(prevResult).toBeDisabled();
await nextResult.click();
await expect.poll(()=>searchTrack.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
await expect(prevResult).toBeEnabled(); await prevResult.click();
await expect.poll(()=>searchTrack.evaluate(el=>el.scrollLeft)).toBeLessThan(2);
await search.fill('헤어 스타일');
await expect(nextResult).toBeDisabled(); await expect(prevResult).toBeDisabled();
await search.fill('AI');
await expect(nextResult).toBeEnabled();
for (const width of [320,390,430]) {
  await page.setViewportSize({width,height:844});
  await expect(nextResult).toBeInViewport();
  await expect(prevResult).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
await page.screenshot({path:'tmp/home-search-mobile.png',fullPage:false});
expect(errors).toEqual([]);
console.log('PASS desktop/mobile automatic motion, forward/reverse seam, pause, reduced motion, category/favorites, global search, missing AI tools, whitespace and no-result recovery.');
await browser.close();
