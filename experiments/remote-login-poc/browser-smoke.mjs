// Explicit real-browser check. Fails (does not skip/pass) if Chromium cannot start.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ChromiumFixture} from './browser.mjs';
const contexts=[];
try {
  const first=await ChromiumFixture.open(chromium,process.env.POC_CHROMIUM_EXECUTABLE);contexts.push(first);
  const second=await ChromiumFixture.open(chromium,process.env.POC_CHROMIUM_EXECUTABLE);contexts.push(second);
  assert.equal(await first.authenticated(),false);
  await first.page.locator('#login').click();assert.equal(await first.authenticated(),true);
  assert.equal(await second.authenticated(),false);
  const frame=await first.frame();assert.equal(frame.width,390);assert.ok(Buffer.from(frame.image,'base64').length>1000);
  const media=Buffer.from(await first.media(),'base64');assert.equal(media.subarray(0,4).toString('hex'),'1a45dfa3');
  await assert.rejects(first.page.goto('http://127.0.0.1:1/'));
  console.log('PASS: separate Chromium instances, fixture login, JPEG frame, blocked non-fixture navigation');
} finally {for(const context of contexts)await context.close();}
