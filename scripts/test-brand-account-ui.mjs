import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const base=process.env.BRAND_TEST_URL||'http://127.0.0.1:4450';const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let signedIn=false;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/auth/')){
   const action=url.pathname.split('/').at(-1);
   if(action==='me')return route.fulfill({status:signedIn?200:401,json:signedIn?{email:'test@example.com'}:{error:'로그인 필요'}});
   if(action==='config')return route.fulfill({json:{googleClientId:'test-client'}});
   if(action==='challenge')return route.fulfill({json:{clientId:'test-client',nonce:'test-nonce'}});
   if(action==='session')signedIn=true;else if(['logout','delete'].includes(action))signedIn=false;
   return route.fulfill({json:{ok:true}});
  }
  if(url.hostname==='accounts.google.com'&&url.pathname==='/gsi/client')return route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(c){window.testGoogleCallback=c.callback},renderButton(el){const b=document.createElement('button');b.textContent='Google test sign-in';b.onclick=()=>window.testGoogleCallback({credential:'mock'});el.append(b)},disableAutoSelect(){}}}};`});
  if(url.origin===base)return route.continue();return route.abort();
 });
 await page.goto(base+'/account/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Google test sign-in'}).click();await page.locator('#account-profile').waitFor({state:'visible'});assert.equal(await page.locator('#account-email').textContent(),'test@example.com');
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('button',{name:'Google test sign-in'}).waitFor();
 await page.getByRole('button',{name:'Google test sign-in'}).click();await page.locator('#account-profile').waitFor({state:'visible'});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'계정 삭제',exact:true}).click();await page.getByRole('button',{name:'Google test sign-in'}).waitFor();
 assert.equal(await page.locator('[data-partner="mooaresume"]').getAttribute('href'),'https://mooaresume.com/');assert.equal(await page.locator('[data-partner="transtream"]').getAttribute('href'),'https://transtream.app/');
 const colors=await page.locator('[data-partner]').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).backgroundColor));assert.deepEqual(colors,['rgb(234, 245, 239)','rgb(9, 12, 18)']);
 assert.equal(await page.locator('link[rel="icon"][type="image/png"]').getAttribute('href'),'/favicon.png?v=palm1');
 mkdirSync('tmp/brand-login-evidence',{recursive:true});await page.screenshot({path:'tmp/brand-login-evidence/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/brand-login-evidence/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: account UI mock Google login/logout/delete, partner URLs and exact brand colors, favicon, desktop/mobile screenshots.');
}finally{await browser.close();}
