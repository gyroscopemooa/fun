import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSessionManager, ChromiumFixture, FIXTURE_ORIGIN } from './browser.mjs';
import { secret } from './core.mjs';
function fixture(options={}) {
  const browsers=[];
  const factory=async()=>{const b={loggedIn:false,closed:false,async authenticated(){return this.loggedIn;},async media(){return 'dGVzdA==';},async frame(){return {image:'fake',authenticated:this.loggedIn};},async click(){this.loggedIn=true;},async close(){this.closed=true;this.loggedIn=false;}};browsers.push(b);return b;};
  return {manager:new BrowserSessionManager({factory,...options}),browsers};
}
test('browser sessions use distinct factories and owner-bound frame/click/download',async()=>{
  const {manager:m,browsers}=fixture(),a=secret(),b=secret();
  const s=await m.create(a),other=await m.create(b); const args=[a,s.id,s.token];
  assert.equal(browsers.length,2);
  for(const method of ['frame','click','status','download','close'])await assert.rejects(m[method](b,s.id,s.token,1,1),{status:404});
  await assert.rejects(m.download(...args,'https://media.example.test/stories/demo'),{status:409});
  await m.click(...args,20,20);assert.equal((await m.status(...args)).authenticated,true);
  assert.equal((await m.status(b,other.id,other.token)).authenticated,false);
  assert.equal((await m.download(...args,'https://media.example.test/stories/demo')).contentBase64,'dGVzdA==');
  await m.close(...args);assert.equal(browsers[0].closed,true);assert.equal(browsers[1].closed,false);
  await m.shutdown();assert.equal(browsers[1].closed,true);
});
test('coordinate, click and frame limits',async()=>{
  const {manager:m}=fixture();const o=secret(),s=await m.create(o),args=[o,s.id,s.token];
  for(const [x,y]of [[-1,0],[390,1],[0,640],[NaN,0],['1',1]])await assert.rejects(m.click(...args,x,y),{status:400});
  await m.click(...args,1,1);await assert.rejects(m.click(...args,1,1),{status:429});
  await m.frame(...args);await assert.rejects(m.frame(...args),{status:429});
  assert.throws(()=>m.login(),{status:400});await m.shutdown();
});
test('expiry, replacement and shutdown destroy browser resources',async()=>{
  let now=0;const {manager:m,browsers}=fixture({now:()=>now,ttl:10,max:1});const o=secret();
  const first=await m.create(o),second=await m.create(o);assert.equal(browsers[0].closed,true);
  await assert.rejects(m.status(o,first.id,first.token),{status:404});
  now=10;await m.sweep();assert.equal(browsers[1].closed,true);
  await assert.rejects(m.status(o,second.id,second.token),{status:404});
  await m.create(o);await m.shutdown();assert.equal(browsers[2].closed,true);
});
test('browser launch errors sanitized, no slot leak; crash destroys context',async()=>{
  let fail=true;const {manager:m,browsers}=fixture({factory:async()=>{if(fail)throw new Error('PRIVATE DETAILS');return {async close(){},async authenticated(){throw new Error('PRIVATE');}};}});
  await assert.rejects(m.create(secret()),{status:503,message:'격리 브라우저를 시작할 수 없습니다. 실행 환경을 확인해 주세요.'});
  fail=false;const o=secret(),s=await m.create(o);
  await assert.rejects(m.status(o,s.id,s.token),{status:503});await assert.rejects(m.status(o,s.id,s.token),{status:404});
});
test('parallel creates respect capacity and leave no untracked browsers',async()=>{
  const {manager:m,browsers}=fixture({max:1});
  const results=await Promise.allSettled([m.create(secret()),m.create(secret())]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(browsers.length,1);await m.shutdown();
});
test('Chromium adapter enables sandbox, blocks service workers/downloads, fulfills only local fixture',async()=>{
  let launchOptions,contextOptions,routeHandler,closed=0;
  const page={on(){},setDefaultTimeout(){},async goto(url){assert.equal(url,`${FIXTURE_ORIGIN}/`);}};
  const context={async route(pattern,handler){routeHandler=handler;},async newPage(){return page;},on(){},async close(){closed++;}};
  const browser={async newContext(options){contextOptions=options;return context;},async close(){closed++;}};
  const adapter=await ChromiumFixture.open({async launch(options){launchOptions=options;return browser;}},'/usr/bin/chromium');
  assert.equal(launchOptions.chromiumSandbox,true);assert.equal(contextOptions.serviceWorkers,'block');assert.equal(contextOptions.acceptDownloads,false);
  for(const url of ['http://127.0.0.1','http://169.254.169.254',`${FIXTURE_ORIGIN}/?next=evil`,'https://instagram.com/']){
    let aborted=false;await routeHandler({request:()=>({url:()=>url,isNavigationRequest:()=>true,method:()=> 'GET'}),abort:async()=>{aborted=true;},fulfill:async()=>assert.fail('unexpected fulfillment')});assert.equal(aborted,true);
  }
  let fulfilled=false;await routeHandler({request:()=>({url:()=>`${FIXTURE_ORIGIN}/`,isNavigationRequest:()=>true,method:()=> 'GET'}),abort:()=>assert.fail('unexpected abort'),fulfill:async options=>{fulfilled=true;assert.match(options.body,/모의 계정/);}});assert.equal(fulfilled,true);
  let mediaFulfilled=false;
  await routeHandler({request:()=>({url:()=>`${FIXTURE_ORIGIN}/media/demo.webm`,isNavigationRequest:()=>false,method:()=> 'GET'}),abort:()=>assert.fail('unexpected media abort'),fulfill:async options=>{mediaFulfilled=true;assert.equal(options.contentType,'video/webm');assert.equal(options.body.subarray(0,4).toString('hex'),'1a45dfa3');assert.ok(options.body.length<131072);}});
  assert.equal(mediaFulfilled,true);
  for(const [path,navigation,method]of [['/',true,'POST'],['/',false,'GET'],['/media/demo.webm',true,'GET'],['/media/demo.webm',false,'POST'],['/media/demo.webm?next=external',false,'GET'],['/media/other.webm',false,'GET']]){
    let aborted=false;
    await routeHandler({request:()=>({url:()=>`${FIXTURE_ORIGIN}${path}`,isNavigationRequest:()=>navigation,method:()=>method}),abort:async()=>{aborted=true;},fulfill:()=>assert.fail('non-fixture request was fulfilled')});
    assert.equal(aborted,true,`${method} ${path} navigation=${navigation}`);
  }
  await adapter.close();assert.equal(closed,2);
});

test('failed browser teardown retains its capacity until a later sweep confirms close',async()=>{
  const {manager:m,browsers}=fixture({max:1}),owner=secret();
  const current=await m.create(owner);
  let failure=true,attempts=0;
  browsers[0].close=async()=>{attempts++;if(failure)throw new Error('Mock close failure');browsers[0].closed=true;};
  await assert.rejects(m.close(owner,current.id,current.token),/Mock close failure/);
  await assert.rejects(m.create(secret()),{status:429});
  assert.equal(browsers.length,1,'failed close must not free the process slot');
  assert.ok(attempts>=2,'sweep retries the retained browser');
  failure=false;
  await m.sweep();
  assert.equal(browsers[0].closed,true);
  await m.create(secret());assert.equal(browsers.length,2);
  await m.shutdown();assert.equal(browsers[1].closed,true);
});

test('shutdown attempts every browser, reports failed close, and rejects future creates',async()=>{
  const {manager:m,browsers}=fixture();
  await m.create(secret());await m.create(secret());
  let failure=true;
  browsers[0].close=async()=>{if(failure)throw new Error('Mock close failure');browsers[0].closed=true;};
  await assert.rejects(m.shutdown(),{status:503});
  assert.equal(browsers[1].closed,true,'the other browser must still be closed');
  await assert.rejects(m.create(secret()),{status:503});
  assert.equal(browsers.length,2);
  failure=false;await m.shutdown();assert.equal(browsers[0].closed,true);
});

test('request queue is bounded and shutdown prevents queued launches after the active one',async()=>{
  let release,started,launches=0,closed=0;
  const gate=new Promise(resolve=>{release=resolve;});
  const opening=new Promise(resolve=>{started=resolve;});
  const manager=new BrowserSessionManager({max:1,factory:async()=>{launches++;started();await gate;return {async close(){closed++;}};}});
  const owner=secret();
  const results=Promise.allSettled(Array.from({length:32},()=>manager.create(owner)));
  await opening;
  await assert.rejects(manager.create(owner),{status:429});
  const shutdown=manager.shutdown();release();
  const settled=await results;await shutdown;
  assert.equal(launches,1);assert.equal(closed,1);
  assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
  for(const result of settled.filter(r=>r.status==='rejected'))assert.equal(result.reason.status,503);
});

test('failed browser setup with failed teardown remains counted until cleanup succeeds',async()=>{
  let launches=0,failClose=true;
  const driver={async launch(){launches++;return {async newContext(){throw new Error('Mock setup failed');},async close(){if(failClose)throw new Error('Mock close failed');}};}};
  const manager=new BrowserSessionManager({max:1,factory:()=>ChromiumFixture.open(driver)});
  await assert.rejects(manager.create(secret()),{status:503});
  await assert.rejects(manager.create(secret()),{status:429});
  assert.equal(launches,1);
  failClose=false;await manager.shutdown();
});
