import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { SessionManager, secret, validateMediaUrl } from './core.mjs';
import { makeHandler } from './server.mjs';
const url = 'https://media.example.test/stories/test';
const fixture = options => { const manager = new SessionManager(options), owner = secret(), s = manager.create(owner); return { manager, owner, s, args: [owner, s.id, s.token] }; };
test('login required; direct mock login then story or video download', () => {
  const {manager:m,args} = fixture();
  assert.throws(() => m.download(...args,url), {status:409});
  m.login(...args);
  for (const path of ['stories/test','videos/test']) assert.match(m.download(...args,`https://media.example.test/${path}`).content,/MOCK ONLY/);
});
test('distinct owners cannot inspect, login, download or close another session', () => {
  const {manager:m,owner,s,args} = fixture(); m.login(...args);
  for (const method of ['status','login','download','close']) assert.throws(() => m[method](secret(), s.id, s.token, url), {status:404});
  assert.throws(() => m.status(owner,s.id,secret()), {status:404});
  const second = m.create(secret()); assert.equal(second.authenticated,false);
  assert.equal(m.status(...args).authenticated,true);
});
test('close erases authorization; repeated close and reuse rejected', () => {
  const {manager:m,args} = fixture(); m.login(...args); m.close(...args);
  for (const method of ['status','login','download','close']) assert.throws(() => m[method](...args,url), {status:404});
});
test('absolute TTL cannot be extended by activity; sweep frees capacity', () => {
  let now=0; const {manager:m,args} = fixture({now:()=>now,ttl:10,max:1});
  now=9; m.login(...args); now=10;
  assert.throws(() => m.status(...args), {status:404});
  assert.ok(m.create(secret()).id);
});
test('repeated create replaces old context; restart/shutdown invalidates sessions', () => {
  const {manager:m,owner,args} = fixture(); const next=m.create(owner);
  assert.throws(() => m.status(...args), {status:404});
  m.shutdown(); assert.throws(() => m.status(owner,next.id,next.token), {status:404});
});
test('same owner can replace at capacity', () => { const {manager:m,owner,args}=fixture({max:1}); assert.ok(m.create(owner).id); assert.throws(()=>m.status(...args),{status:404}); });
test('capacity bounded', () => { const {manager:m}=fixture({max:1}); assert.throws(()=>m.create(secret()),{status:429}); });
test('SSRF/redirect/arbitrary URLs denied before any network access', () => {
  for(const raw of ['http://127.0.0.1','https://169.254.169.254/latest/meta-data','file:///etc/passwd','https://media.example.test.evil.test/stories/a','https://evil@media.example.test/stories/a','https://media.example.test:444/stories/a','https://media.example.test/stories/a?redirect=https://evil.test','https://media.example.test/stories/a#token','https://media.example.test/stories/%2F','https://media.example.test/stories/a/../login',null]) assert.throws(()=>validateMediaUrl(raw),{status:400});
});
async function request(handler,{method='POST',path='/api',headers={},body={action:'create'}}={}) {
  const req=Readable.from([typeof body==='string'?body:JSON.stringify(body)]);
  Object.assign(req,{method,url:path,headers:{host:'127.0.0.1:8789',origin:'http://127.0.0.1:8789','content-type':'application/json',...headers}});
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,h){this.status=status;Object.assign(this.headers,h);},end(body){this.body=body;}};
  await handler(req,res); return res;
}
test('HTTP denies cross-site, rebinding, non-JSON, missing identity, huge payloads',async()=>{
  const handler=makeHandler();
  for(const headers of [{host:'evil.test'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'}]) assert.equal((await request(handler,{headers})).status,403);
  assert.equal((await request(handler)).status,401);
  assert.equal((await request(handler,{body:'x'.repeat(2049)})).status,413);
  assert.equal((await request(handler,{body:'{'})).status,400);
});
test('HTTP full flow + safe headers + session cookie + no real media',async()=>{
  const handler=makeHandler({html:'demo'});
  const home=await request(handler,{method:'GET',path:'/'});
  assert.equal(home.status,200); assert.match(home.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
  assert.equal(home.headers['Cache-Control'],'no-store');
  const headers={cookie:home.headers['Set-Cookie'].split(';')[0]};
  const created=JSON.parse((await request(handler,{headers})).body);
  const call=(action,extra={})=>request(handler,{headers,body:{action,id:created.id,token:created.token,...extra}});
  assert.equal((await call('download',{url})).status,409);
  assert.equal((await call('login')).status,200);
  assert.match((await call('download',{url})).body,/MOCK ONLY/);
  assert.equal((await call('close')).status,200);
  assert.equal((await call('status')).status,404);
});
