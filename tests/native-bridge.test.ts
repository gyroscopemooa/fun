import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeCapabilities, saveTextWithNative, shareTextWithNative } from '../src/lib/manytool-native.ts';

function port(reply: (req: any) => any) {
  const received: any[]=[];
  const p={onmessage:null as any,postMessage(raw:string){
    const req=JSON.parse(raw); received.push(req);
    queueMicrotask(()=>p.onmessage?.({data:JSON.stringify(reply(req))}));
  }};
  (globalThis as any).window={ManytoolNative:p}; return received;
}
test('web without native shell remains optional', async()=>{
  delete (globalThis as any).window;
  assert.equal(await nativeCapabilities(),null);
  await assert.rejects(saveTextWithNative('hello'),/native_unavailable/);
});
test('capabilities are explicitly versioned and do not imply payment',async()=>{
  const sent=port(req=>({id:req.id,ok:true,capabilities:{version:1,saveText:true,shareText:true,playCredits:false}}));
  const capabilities=await nativeCapabilities();
  assert.equal(capabilities?.playCredits,false); assert.equal(sent[0].command,'capabilities');
  assert.equal('text' in sent[0],false);
});
test('saving and sharing require explicit function call, use separate bounded commands',async()=>{
  const sent=port(req=>({id:req.id,ok:true,message:'launched'}));
  assert.equal(sent.length,0);
  await saveTextWithNative('선택한 텍스트'); await shareTextWithNative('share this');
  assert.deepEqual(sent.map(x=>x.command),['saveText','shareText']);
  assert.notEqual(sent[0].id,sent[1].id);
});
test('empty and oversized content does not leave the page',async()=>{
  const sent=port(req=>({id:req.id,ok:true}));
  await assert.rejects(saveTextWithNative(''),/invalid_text/);
  await assert.rejects(shareTextWithNative('a'.repeat(64001)),/invalid_text/);
  assert.equal(sent.length,0);
});
test('native cancellation is not reported as saved/shared',async()=>{
  port(req=>({id:req.id,ok:false,message:'cancelled'}));
  await assert.rejects(saveTextWithNative('text'),/cancelled/);
});
test('unsupported native protocol gracefully declines',async()=>{
  port(req=>({id:req.id,ok:true,capabilities:{version:2}}));
  assert.equal(await nativeCapabilities(),null);
});

test('escaped content is rejected before the native message limit',async()=>{
  const sent=port(req=>({id:req.id,ok:true}));
  await assert.rejects(saveTextWithNative('\n'.repeat(40000)),/invalid_text/);
  assert.equal(sent.length,0);
});
