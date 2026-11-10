import test from 'node:test';
import assert from 'node:assert/strict';
function event(){return {listeners:[],addListener(fn){this.listeners.push(fn);}};}
async function harness(){
  const data={},created=[];
  const api={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onInstalled:event(),onStartup:event(),onMessage:event()},tabs:{onUpdated:event(),onActivated:event(),onRemoved:event(),query:async()=>[{id:1,url:'https://example.org',windowId:1,active:true}],get:async()=>({id:1,url:'https://example.org',windowId:1,active:true}),create:async arg=>{created.push(arg);return {id:created.length+10};}},windows:{onFocusChanged:event(),get:async()=>({focused:true})},alarms:{onAlarm:event(),create:async()=>{}},contextMenus:{onClicked:event(),removeAll:fn=>fn(),create:()=>{}},commands:{onCommand:event()},scripting:{executeScript:async()=>[{documentId:'doc-1'}]},storage:{session:{get:async key=>key===null?{...data}:typeof key==='string'?{[key]:data[key]}:Object.fromEntries(key.map(k=>[k,data[k]])),set:async value=>Object.assign(data,value),remove:async keys=>{for(const key of [keys].flat())delete data[key];}}}};
  globalThis.chrome=api;
  await import('../background.js?test='+Math.random());
  const message=(value,sender={id:'test',url:'chrome-extension://test/popup.html'})=>new Promise(resolve=>api.runtime.onMessage.listeners[0](value,sender,resolve));
  return {api,data,created,message};
}
test('web content cannot start privileged actions without an active capture nonce',async()=>{
  const h=await harness();
  assert.equal((await h.message({type:'video'},{id:'test',url:'https://example.org',tab:{id:1}})).ok,false);
  assert.equal(h.created.length,0);
});
test('capture start records document and tab switch invalidates even if switched back',async()=>{
  const h=await harness();assert.equal((await h.message({type:'capture-start'})).ok,true);
  assert.equal(h.data['capture:1'].documentId,'doc-1');
  h.api.tabs.onActivated.listeners[0]({tabId:2,windowId:1});
  h.api.tabs.onActivated.listeners[0]({tabId:1,windowId:1});
  assert.equal(h.data['capture:1'],undefined);
});
test('same URL navigation invalidates a pending capture',async()=>{
  const h=await harness();await h.message({type:'capture-start'});
  h.api.tabs.onUpdated.listeners[0](1,{status:'loading'});
  assert.equal(h.data['capture:1'],undefined);
});
test('old completion nonce must not delete newer capture',async()=>{
  const h=await harness();await h.message({type:'capture-start'});const old=h.data['capture:1'].nonce;
  await h.message({type:'capture-start'});const fresh=h.data['capture:1'].nonce;
  const result=await h.message({type:'capture-finish',nonce:old},{id:'test',url:'https://example.org',tab:{id:1},frameId:0,documentId:'doc-1'});
  assert.equal(result.ok,false);assert.equal(h.data['capture:1'].nonce,fresh);
});
test('mid-capture switch-away and back discards screenshot before decoding',async()=>{
  const h=await harness();await h.message({type:'capture-start'});const nonce=h.data['capture:1'].nonce;
  h.api.tabs.captureVisibleTab=async()=>{h.api.tabs.onActivated.listeners[0]({tabId:2,windowId:1});h.api.tabs.onActivated.listeners[0]({tabId:1,windowId:1});return 'data:image/png;base64,AAA=';};
  const result=await h.message({type:'capture-finish',nonce},{id:'test',url:'https://example.org',tab:{id:1},frameId:0,documentId:'doc-1'});
  assert.equal(result.ok,false);assert.match(result.error,/변경/);assert.equal(Object.keys(h.data).some(k=>k.startsWith('review:')),false);
});
test('selection review requires an explicitly enabled matching document and nonce',async()=>{
  const h=await harness();let nonce;
  h.api.scripting.executeScript=async args=>{nonce=args.args[0];return [{documentId:'doc-menu'}];};
  const sender={id:'test',url:'https://example.org',tab:{id:1},frameId:0,documentId:'doc-menu'};
  assert.equal((await h.message({type:'selection-review',nonce:'fake',text:'hello'},sender)).ok,false);
  assert.equal((await h.message({type:'selection-menu'})).ok,true);
  assert.equal((await h.message({type:'selection-review',nonce,text:'hello'}, {...sender,frameId:1})).ok,false);
  assert.equal((await h.message({type:'selection-review',nonce,text:'hello'}, {...sender,documentId:'other'})).ok,false);
  assert.equal((await h.message({type:'selection-review',nonce,text:'hello'},sender)).ok,true);
  assert.equal(h.created.length,1);
  h.api.tabs.onUpdated.listeners[0](1,{status:'loading'});
  assert.equal((await h.message({type:'selection-review',nonce,text:'hello'},sender)).ok,false);
});
