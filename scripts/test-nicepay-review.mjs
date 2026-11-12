import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/api/nicepay-review/[[path]].js';
const origin='https://review.example.com';
const env={NICEPAY_REVIEW_ENABLED:'true',NICEPAY_REVIEW_ORIGIN:origin,NICEPAY_REVIEW_MERCHANT_KEY:'a'.repeat(86)+'=='};
const request=(path,options={})=>new Request(origin+'/api/nicepay-review/'+path,options);
test('review signing is fixed and matches NICE legacy signature without exposing key',async()=>{
 const response=await onRequest({env,request:request('window',{method:'POST',headers:{Origin:origin},body:'Amt=100000&MID=attacker'})});
 assert.equal(response.status,200);const body=await response.text();
 const field=name=>body.match(new RegExp('name="'+name+'" value="([^"]+)"'))?.[1];
 assert.equal(field('Amt'),'1000');assert.equal(field('MID'),'000000002m');
 assert.equal(field('SignData'),createHash('sha256').update(field('EdiDate')+'000000002m1000'+env.NICEPAY_REVIEW_MERCHANT_KEY).digest('hex'));
 assert.ok(!body.includes(env.NICEPAY_REVIEW_MERCHANT_KEY));assert.ok(!body.includes('document.payForm.submit()'));
 assert.equal(field('ReturnURL'),origin+'/api/nicepay-review/return');
});
test('callback and all approval paths fail closed without network or bindings',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('network forbidden');};
 try {for(const path of ['return','approve','cancel','fulfill'])for(const method of ['GET','POST']){
  const response=await onRequest({env,request:request(path,{method,...(method==='POST'?{body:'AuthResultCode=0000&ResultCode=3001'}:{})})});assert.equal(response.status,409);
 }assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('disabled, unexpected origin and GET requests cannot create a payment form',async()=>{
 assert.equal((await onRequest({env:{},request:request('window',{method:'POST'})})).status,503);
 assert.equal((await onRequest({env,request:request('window',{method:'POST',headers:{Origin:'https://evil.example'}})})).status,403);
 assert.equal((await onRequest({env,request:request('window')})).status,405);
 assert.equal((await onRequest({env:{...env,NICEPAY_REVIEW_ORIGIN:'https://different.example'},request:request('window',{method:'POST',headers:{Origin:origin}})})).status,503);
});

 test('real product orders keep server-owned name and period and reject unknown or oversized input',async()=>{
 for(const [id,name] of [['calorie','AI 칼로리 분석'],['image','AI 이미지 생성'],['pet','AI 펫 번역기 30일 이용권']]){
  const r=await onRequest({env,request:request('window',{method:'POST',headers:{Origin:origin},body:'product='+id+'&Amt=100000&GoodsName=forged'})});const text=await r.text();assert.equal(r.status,200);assert.ok(text.includes(name));assert.ok(text.includes('서비스 제공기간'));assert.ok(text.includes('name="Amt" value="1000"'));assert.ok(!text.includes('forged'));
 }
 assert.equal((await onRequest({env,request:request('window',{method:'POST',headers:{Origin:origin},body:'product=__proto__'})})).status,400);
 assert.equal((await onRequest({env,request:request('window',{method:'POST',headers:{Origin:origin},body:'x'.repeat(2049)})})).status,413);
});
