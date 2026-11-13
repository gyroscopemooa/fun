import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {createAccountHandler} from '../src/lib/account-auth.js';
const setup=()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/account-0001.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const s=sqlite.prepare(sql);return {bind(...args){return {first:async()=>s.get(...args),run:async()=>s.run(...args)}}}},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 let identity={sub:'google-one',email:'user@example.com',email_verified:true};
 const handler=createAccountHandler({verifyGoogle:async()=>identity});
 const call=(path,body,cookies='',origin='https://manytool.net')=>handler({request:new Request('https://manytool.net/api/auth/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookies},...(body===undefined?{}:{body:JSON.stringify(body)})}),env:{ACCOUNT_DB:db}});
 const challenge=async()=>{const r=await call('challenge',{});const c=await r.json();identity.nonce=c.nonce;return r.headers.getSetCookie()[0].split(';')[0];};
 return {sqlite,call,challenge,identity};
};
test('Google identity, nonce replay, origin, persisted session, revocation and deletion',async()=>{
 const {sqlite,call,challenge,identity}=setup();
 assert.equal((await call('me')).status,401);
 assert.equal((await call('challenge',{},'','https://evil.test')).status,403);
 const cookie=await challenge();const nonce=identity.nonce;
 identity.nonce='wrong';assert.equal((await call('session',{credential:'verified'},cookie)).status,401);
 identity.nonce=nonce;identity.email_verified=false;assert.equal((await call('session',{credential:'verified'},cookie)).status,401);
 identity.email_verified=true;const ok=await call('session',{credential:'verified'},cookie);assert.equal(ok.status,200);
 const session=ok.headers.getSetCookie().find(c=>c.startsWith('__Host-manytool_account=')).split(';')[0];
 assert.match(ok.headers.get('set-cookie'),/HttpOnly/);assert.match(ok.headers.get('set-cookie'),/Secure/);
 assert.equal((await call('session',{credential:'verified'},cookie)).status,401);
 assert.deepEqual(await (await call('me',undefined,session)).json(),{email:'user@example.com'});
 assert.equal((await call('logout',{},session)).status,200);assert.equal((await call('me',undefined,session)).status,401);
 const c2=await challenge();const ok2=await call('session',{credential:'verified'},c2);const s2=ok2.headers.getSetCookie().find(c=>c.startsWith('__Host-manytool_account=')).split(';')[0];
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM account_users').get().n,1);
 assert.equal((await call('delete',{},s2)).status,200);assert.equal((await call('me',undefined,s2)).status,401);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM account_users').get().n,0);sqlite.close();
});
test('Expired challenges and session cookies cannot authenticate',async()=>{
 const {sqlite,call,challenge}=setup();const cookie=await challenge();sqlite.exec('UPDATE account_challenges SET expires=0');
 assert.equal((await call('session',{credential:'verified'},cookie)).status,401);
 assert.equal((await call('me',undefined,'__Host-manytool_account=bad')).status,401);sqlite.close();
});
test('Login request rate limiting and unsupported routes',async()=>{
 const {sqlite,call}=setup();for(let i=0;i<60;i++)assert.equal((await call('challenge',{})).status,200);
 assert.equal((await call('challenge',{})).status,429);assert.equal((await call('unknown',{})).status,404);sqlite.close();
});
test('Rejects malformed and oversized bodies without issuing a session',async()=>{
 const {sqlite,call}=setup();assert.equal((await call('session',{credential:'x'.repeat(20000)})).status,413);
 assert.equal((await call('challenge',[])).status,400);sqlite.close();
});
