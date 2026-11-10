import test from 'node:test';
import assert from 'node:assert/strict';
import {readPageImage} from '../image-source.js';
function setup({pixels=100,taint=false}={}){
  globalThis.document={images:[{currentSrc:'https://example.com/a.png',src:'https://example.com/a.png',complete:true,naturalWidth:pixels,naturalHeight:pixels}],createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=>{if(taint)throw Error('SecurityError');return 'data:image/png;base64,AAA=';}})};
}
test('image read uses existing decoded image without network',()=>{setup();assert.equal(readPageImage('https://example.com/a.png'),'data:image/png;base64,AAA=');});
test('image missing, huge or cross origin fail without bypass',()=>{
  setup();assert.throws(()=>readPageImage('https://other/a.png'));
  setup({pixels:5000});assert.throws(()=>readPageImage('https://example.com/a.png'));
  setup({taint:true});assert.throws(()=>readPageImage('https://example.com/a.png'),/캡처/);
});
