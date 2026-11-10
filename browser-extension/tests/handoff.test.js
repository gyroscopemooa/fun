import test from 'node:test';
import assert from 'node:assert/strict';
import {sendToTool} from '../handoff.js';

test('handoff binds payload to probe document and correct origin/path',async()=>{
  const requests=[];
  globalThis.chrome={tabs:{create:async({url})=>{assert.equal(url,'https://manytool.net/text-translator/');return {id:1};},get:async()=>({status:'complete',url:'https://manytool.net/text-translator/'})},scripting:{executeScript:async request=>{requests.push(request);return requests.length===1?[{documentId:'intended-doc',result:true}]:[{result:true}];}}};
  await sendToTool({kind:'text',text:'private selection'});
  assert.deepEqual(requests[0].args,['https://manytool.net','/text-translator','text']);
  assert.deepEqual(requests[1].target,{tabId:1,documentIds:['intended-doc']});
  // Even a same-document SPA navigation fails its final location check.
  globalThis.location={origin:'https://manytool.net',pathname:'/unrelated/'};
  globalThis.document={dispatchEvent(){throw Error('must not expose data');}};
  assert.equal(requests[1].func(...requests[1].args),false);
});
test('redirect aborts before any payload injection',async()=>{
  let injections=0;
  globalThis.chrome={tabs:{create:async()=>({id:1}),get:async()=>({status:'complete',url:'https://manytool.net/other/'})},scripting:{executeScript:async()=>{injections++;}}};
  await assert.rejects(()=>sendToTool({kind:'text',text:'secret'}),/이동/);assert.equal(injections,0);
});
test('cancel during readiness probe prevents content transmission',async()=>{
  let injections=0;const controller=new AbortController();
  globalThis.chrome={tabs:{create:async()=>({id:1}),get:async()=>({status:'complete',url:'https://manytool.net/text-translator/'})},scripting:{executeScript:async()=>{injections++;controller.abort();return [{result:true,documentId:'doc'}];}}};
  await assert.rejects(()=>sendToTool({kind:'text',text:'secret'},controller.signal),/abort/i);assert.equal(injections,1);
});
test('already canceled operation opens no tab',async()=>{
  const controller=new AbortController();controller.abort();let opened=false;
  globalThis.chrome={tabs:{create:async()=>{opened=true;}}};
  await assert.rejects(()=>sendToTool({kind:'text',text:'secret'},controller.signal));assert.equal(opened,false);
});
