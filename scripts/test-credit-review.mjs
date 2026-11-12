import test from 'node:test';import assert from 'node:assert/strict';import {createCreditReviewHandler} from '../src/lib/credit-review.js';
const origin='https://manytool.net',env={CREDIT_REVIEW_SESSION_SECRET:'test-secret-not-production-'.repeat(3)};
const req=(action,{method='POST',cookie='',body={},from=origin}={})=>new Request(origin+'/api/credit-review/'+action,{method,headers:{Origin:from,Cookie:cookie,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const cookies=r=>r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
test('public review requires real verified identity binding, origin and signed isolated session',async()=>{
 let identity={sub:'google-sub',email:'reviewer@gmail.com',email_verified:true};const handler=createCreditReviewHandler({verifyGoogle:async()=>identity});
 assert.equal((await handler({env,request:req('challenge',{from:'https://evil.invalid'})})).status,403);
 assert.equal((await handler({env:{},request:req('challenge')})).status,503);
 assert.equal((await handler({env,request:req('topup')})).status,401);
 const c=await handler({env,request:req('challenge')});const challenge=await c.json(),cookie=cookies(c);
 assert.equal((await handler({env,request:req('session',{cookie,body:{credential:'signed'}})})).status,401);
 identity.nonce=challenge.nonce;identity.email_verified=false;
 assert.equal((await handler({env,request:req('session',{cookie,body:{credential:'signed'}})})).status,401);identity.email_verified=true;
 const login=await handler({env,request:req('session',{cookie,body:{credential:'signed',email:'attacker@example.com'}})});assert.equal(login.status,200);assert.equal((await login.json()).email,'reviewer@gmail.com');
 let session=cookies(login).split('; ').filter(v=>!v.startsWith('__Host-manytool_credit_challenge=')).join('; ');
 const before=await handler({env,request:req('use',{cookie:session})});assert.equal(before.status,402);
 const fund=await handler({env,request:req('topup',{cookie:session,body:{amount:999999,credits:99999}})});assert.equal((await fund.json()).balance,10);session=cookies(fund);
 const repeat=await handler({env,request:req('topup',{cookie:session})});assert.equal((await repeat.json()).balance,10);
 const used=await handler({env,request:req('use',{cookie:session})});const d=await used.json();assert.equal(d.balance,8);assert.equal(d.history.length,2);session=cookies(used);
 const again=await handler({env,request:req('use',{cookie:session})});assert.equal((await again.json()).balance,8);
 const tampered=session.replace(/.$/,'!');assert.equal((await handler({env,request:req('me',{method:'GET',cookie:tampered})})).status,401);
 assert.equal((await handler({env,request:req('approve',{cookie:session})})).status,404);
 const logout=await handler({env,request:req('logout',{cookie:session})});assert.ok(logout.headers.getSetCookie().every(v=>v.includes('Max-Age=0')));
});
test('default Google verifier rejects unsigned token and never accepts caller identity',async()=>{
 const handler=createCreditReviewHandler();const c=await handler({env,request:req('challenge')});const response=await handler({env,request:req('session',{cookie:cookies(c),body:{credential:'unsigned',sub:'forged',email_verified:true}})});assert.equal(response.status,401);
});
