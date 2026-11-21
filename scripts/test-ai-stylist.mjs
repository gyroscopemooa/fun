import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {quoteAiStylist} from '../shared/ai-stylist-pricing.js';
import {AI_PRODUCTS,publicAiCatalog,contributionMargin} from '../shared/ai-products.js';
import {onRequest} from '../functions/api/nicepay-review/[[path]].js';
const origin='https://review.example.com';
const env={NICEPAY_REVIEW_ENABLED:'true',NICEPAY_REVIEW_ORIGIN:origin,NICEPAY_REVIEW_MERCHANT_KEY:'a'.repeat(86)+'=='};
test('all garment tiers share one price and exceed the 90% planning margin after VAT and assumed PG fee',()=>{
 const prices=[9900,11400,12900,14400,15900];
 for(let n=1;n<=5;n++){
  const quote=quoteAiStylist(n),product=AI_PRODUCTS[`stylist_${n}`];
  assert.equal(quote.amountKrw,prices[n-1]);assert.equal(product.amount,quote.amountKrw);
  assert.ok(quote.estimatedMargin>=.90);assert.ok(contributionMargin(product.amount,product.costBudgetKrw)>=.90);
  assert.equal(publicAiCatalog()[product.id].costBudgetKrw,undefined);
  assert.equal(publicAiCatalog()[product.id].garmentCount,n);
 }
 for(const n of [0,6,-1,1.5,'2',null,undefined,NaN])assert.throws(()=>quoteAiStylist(n));
});
test('NICE signer ignores forged amount and signs only one of five server-owned stylist prices',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('No network allowed');};
 try{
  for(let n=1;n<=5;n++)for(const method of ['CARD','NAVER','TOSS','KAKAO','SAMSUNG','APPLE','PAYCO']){
   const request=new Request(origin+'/api/nicepay-review/window',{method:'POST',headers:{Origin:origin,Accept:'application/json'},body:new URLSearchParams({product:`stylist_${n}`,method,Amt:'1',MID:'forged',ReturnURL:'https://evil.example/',consentVersion:'2026-11-13-review',terms:'1',collection:'1',sharing:'1'})});
   const response=await onRequest({request,env});assert.equal(response.status,200);const data=await response.json();
   assert.equal(data.testOnly,true);assert.equal(data.fields.Amt,String(quoteAiStylist(n).amountKrw));assert.equal(data.fields.MID,'000000001m');assert.equal(data.fields.ReturnURL,origin+'/api/nicepay-review/return');
  }
  const request=new Request(origin+'/api/nicepay-review/window',{method:'POST',headers:{Origin:origin},body:'product=stylist_6'});
  assert.equal((await onRequest({request,env})).status,400);
  assert.equal((await onRequest({request:new Request(origin+'/api/nicepay-review/approve',{method:'POST'}),env})).status,409);
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
test('stylist payment dialog picks current uploaded garment count rather than default one-item price',()=>{
 const nodes=[];const make=tag=>{const node={tag,children:[],style:{},events:{},isConnected:true,setAttribute(k,v){this[k]=v;},append(...v){this.children.push(...v);},prepend(...v){this.children.unshift(...v);},addEventListener(k,v){this.events[k]=v;},showModal(){this.open=true;},focus(){}};nodes.push(node);return node;};
 const document={activeElement:null,createElement:make,getElementById:()=>null,querySelector:()=>null,body:make('body')};
 const window={manytoolAiCatalog:publicAiCatalog()};
 runInNewContext(readFileSync(new URL('../public/choices-dialog.js',import.meta.url),'utf8'),{document,window,location:{pathname:'/ai-stylist/',origin},URLSearchParams});
 window.manytoolShowPaymentChoices({stylistCount:5});
 assert.ok(nodes.some(n=>n.textContent==='15,900원'));
 assert.ok(nodes.some(n=>n.tag==='input'&&n.name==='product'&&n.value==='stylist_5'));
 assert.ok(nodes.some(n=>n.textContent==='결제창 연결 테스트 · 실제 결제 없음'));
 const before=nodes.length;window.manytoolShowPaymentChoices({stylistCount:6});assert.equal(nodes.length,before);
});
