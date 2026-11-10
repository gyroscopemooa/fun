import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExtensionImport,listenForExtensionImport,captureFile} from '../../src/lib/extension/import.ts';
const nonce='12345678-1234-1234-1234-123456789abc';
const detail=payload=>JSON.stringify({nonce,payload});

test('bridge parses bounded text but never arbitrary URLs/scripts',()=>{
  assert.deepEqual(parseExtensionImport(detail({kind:'text',text:'hello'})),{nonce,payload:{kind:'text',text:'hello'}});
  for(const value of [null,'{}','{bad',detail({kind:'text',text:'x'.repeat(3001)}),detail({kind:'video',url:'javascript:alert(1)'}),detail({kind:'video',url:'https://x:y@example.com'})])assert.equal(parseExtensionImport(value),null);
});
test('image decode checks PNG signature',()=>{
  assert.throws(()=>captureFile('data:image/png;base64,aGVsbG8='));
  const image=captureFile('data:image/png;base64,iVBORw0KGgo=');assert.equal(image.type,'image/png');
});
test('bridge consumes once and cleans readiness markers',()=>{
  const doc=new EventTarget();doc.documentElement={dataset:{}};globalThis.document=doc;
  let calls=0;const stop=listenForExtensionImport('text',()=>{calls++;return true;});
  assert.equal(doc.documentElement.dataset.manytoolImportReady,'text');
  doc.dispatchEvent(new CustomEvent('manytool:import-v1',{detail:detail({kind:'video',url:'https://x.com/a/status/1'})}));assert.equal(calls,0);
  doc.dispatchEvent(new CustomEvent('manytool:import-v1',{detail:detail({kind:'text',text:'hello'})}));
  doc.dispatchEvent(new CustomEvent('manytool:import-v1',{detail:detail({kind:'text',text:'second'})}));
  assert.equal(calls,1);assert.equal(doc.documentElement.dataset.manytoolImportAck,nonce);assert.equal(doc.documentElement.dataset.manytoolImportReady,undefined);
  stop();assert.equal(doc.documentElement.dataset.manytoolImportAck,undefined);
});
test('busy/edited page can reject import without acknowledgment',()=>{
  const doc=new EventTarget();doc.documentElement={dataset:{}};globalThis.document=doc;
  const stop=listenForExtensionImport('text',()=>false);
  doc.dispatchEvent(new CustomEvent('manytool:import-v1',{detail:detail({kind:'text',text:'hello'})}));
  assert.equal(doc.documentElement.dataset.manytoolImportAck,undefined);stop();
});
