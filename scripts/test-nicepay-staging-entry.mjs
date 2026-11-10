import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {nicepayStagingEntry,nicepayStagingPagePaths} from '../src/lib/nicepay-staging-entry.mjs';
test('staging entry stays absent by default and for invalid or external paths',()=>{
 for(const enabled of [undefined,false,true,'false','TRUE'])assert.equal(nicepayStagingEntry({enabled,basePath:'/nice',pathname:'/ai-manseryeok'}),null);
 for(const basePath of [undefined,'https://evil.invalid','//evil.invalid','/nice/../pay','/nice?token=x','/nice#x','/nice%2felse','/nice\\evil'])assert.equal(nicepayStagingEntry({enabled:'true',basePath,pathname:'/ai-manseryeok'}),null);
 assert.equal(nicepayStagingEntry({enabled:'true',basePath:'/nice',pathname:'/unknown'}),null);
});
test('all supported existing pages link only to the appropriate local customer flow',()=>{
 for(const pathname of nicepayStagingPagePaths){
  const entry=nicepayStagingEntry({enabled:'true',basePath:'/staging/nice',pathname:pathname+'/'});
  assert.ok(entry.href.startsWith('/staging/nice/customer'));assert.equal(new URL(entry.href,'https://manytool.net').searchParams.get('source'),pathname);assert.equal(entry.loginHref,'/credits/');
  assert.ok(readFileSync(new URL('../src/pages'+pathname+'.astro',import.meta.url),'utf8').length);
 }
 const layout=readFileSync(new URL('../src/layouts/Layout.astro',import.meta.url),'utf8');
 assert.match(layout,/NicepayStagingEntry pathname=\{stripLocale\(Astro.url.pathname\)\}/);
 assert.match(layout,/src="\/credit-checkout.js"/);
});
