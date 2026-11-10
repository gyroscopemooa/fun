import test from 'node:test';import assert from 'node:assert/strict';
import {createNicepayToolAdapters} from './nicepay-tool-adapters.js';
test('actual saju adapter disabled by default and maps validated fields to implementation',async()=>{
 assert.deepEqual(createNicepayToolAdapters(),{});let input;
 const a=createNicepayToolAdapters({enabled:true,analyzeSaju:async value=>{input=value;return {analysis:'fixture'};}}).ai_manseryeok;
 const validated=await a.validate({birthDate:'2000-02-29',name:' Test ',ignored:'not forwarded'});
 assert.deepEqual(await a.execute(validated),{analysis:'fixture'});assert.equal(input.name,'Test');assert.equal(input.ignored,undefined);
 for(const change of [{birthDate:'2001-02-29'},{birthDate:'../../'},{birthTime:'25:00'},{locale:'bad'},{timeUnknown:'true'}])await assert.rejects(a.validate({birthDate:'2000-01-01',...change}));
});
test('image analysis adapters validate bytes and call existing function signatures',async()=>{
 const sharp=(await import('sharp')).default;const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
 const imageDataUrl=`data:image/png;base64,${png.toString('base64')}`;const seen=[];
 const adapters=createNicepayToolAdapters({enabled:true,analyzeMealCalories:async input=>{seen.push(input);return {ok:true};},analyzePersonalColor:async input=>{seen.push(input);return {ok:true};},generateCommerceDetailPage:async input=>{seen.push(input);return {ok:true};}});
 await adapters.calorie.execute(await adapters.calorie.validate({imageDataUrl,goal:'gain'}));assert.equal(seen[0].goal,'gain');
 await adapters.ai_personal_color.execute(await adapters.ai_personal_color.validate({imageDataUrl,notes:'neutral lighting'}));assert.equal(seen[1].notes,'neutral lighting');
 for(const n of [5,7,10,15,20]){const a=adapters[`detail_page_${n}`];await a.execute(await a.validate({productName:'Product',images:[imageDataUrl]}));assert.equal(seen.at(-1).pageCount,n);await assert.rejects(a.validate({productName:'Product',images:[imageDataUrl],pageCount:99}));}
 for(const image of ['https://example.com/image.png','data:image/png;base64,AAAA','data:image/svg+xml;base64,PHN2Zz4='])await assert.rejects(adapters.calorie.validate({imageDataUrl:image}));
 await assert.rejects(adapters.calorie.validate({imageDataUrl,goal:'invalid'}));
});
