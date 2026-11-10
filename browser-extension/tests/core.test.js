import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webUrl,selectionText,videoTarget,validatePayload,cropBounds,isFresh,TTL,payloadPath} from '../core.js';

test('public web URL only, no credentials',()=>{
  assert.equal(webUrl('https://example.org/page').hostname,'example.org');
  for(const input of ['chrome://extensions','file:///secret','javascript:alert(1)','https://a:b@example.com','x'.repeat(2050)])assert.throws(()=>webUrl(input));
});
test('selection bounds, no silent truncation',()=>{
  assert.equal(selectionText('  안녕하세요  '),'안녕하세요');assert.throws(()=>selectionText(''));assert.throws(()=>selectionText('x'.repeat(3001)));
});
test('known media route selection and exact host matching',()=>{
  const cases=[['https://youtu.be/id','youtube-downloader'],['https://youtube.com/shorts/id','youtube-shorts-downloader'],['https://instagram.com/reel/ABC/','instagram-reels-downloader'],['https://instagram.com/p/ABC/','instagram-video-downloader'],['https://x.com/user/status/123','twitter-video-downloader'],['https://vt.tiktok.com/test','tiktok-downloader'],['https://chzzk.naver.com/clips/id','chzzk-clips-downloader'],['https://example.org/file.mp4?token=abc','video-link-downloader']];
  for(const [url,slug] of cases){assert.equal(videoTarget(url),`/${slug}/`);assert.ok(fs.existsSync(new URL(`../../src/pages/${slug}.astro`,import.meta.url)));}
  for(const url of ['https://instagram.com.evil.com/p/ABC/','https://instagram.com/stories/me/123/','https://instagram.com/me','http://x.com/status/123','https://example.org/'])assert.throws(()=>videoTarget(url));
});
test('payload normalization removes unrelated data',()=>{
  assert.deepEqual(validatePayload({kind:'text',text:'hello',cookie:'secret'}),{kind:'text',text:'hello'});
  assert.throws(()=>validatePayload({kind:'image',dataUrl:'data:image/svg+xml,<svg/>'}));
  assert.throws(()=>validatePayload({kind:'image',dataUrl:'https://tracker.test/image'}));
  assert.throws(()=>validatePayload({kind:'other'}));
  assert.equal(payloadPath({kind:'text'}),'/text-translator/');
});
test('crop maps CSS pixels to device pixels, reverse drag pre-normalized',()=>{
  assert.deepEqual(cropBounds({x:10,y:20,width:30,height:40},{width:100,height:100},{width:200,height:200}),{x:20,y:40,width:60,height:80});
  for(const rect of [{x:-1,y:0,width:20,height:20},{x:0,y:0,width:1,height:20},{x:90,y:90,width:30,height:30},{x:NaN,y:0,width:10,height:10}])assert.throws(()=>cropBounds(rect,{width:100,height:100},{width:200,height:200}));
});
test('expiry and future records fail closed',()=>{
  assert.ok(isFresh({createdAt:100},200));assert.ok(!isFresh({createdAt:100},100+TTL));assert.ok(!isFresh({createdAt:300},200));assert.ok(!isFresh({}));
});
test('manifest uses MV3, no global scripts, cookies, history or persistent broad hosts',()=>{
  const m=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url)));
  assert.equal(m.manifest_version,3);assert.ok(!m.content_scripts);assert.ok(!m.host_permissions);
  assert.deepEqual(m.optional_host_permissions,['https://manytool.net/*']);
  for(const p of ['cookies','history','webRequest','tabs','debugger','downloads'])assert.ok(!m.permissions.includes(p));
  assert.ok(!m.web_accessible_resources);assert.ok(!m.externally_connectable);
});
test('optional workbench destination is a fixed text-only allowlist',()=>{
  assert.equal(payloadPath({kind:'text'},'workbench'),'/selection-workbench/');
  assert.throws(()=>payloadPath({kind:'image'},'workbench'));
  assert.throws(()=>payloadPath({kind:'text'},'https://evil.test/'));
});
