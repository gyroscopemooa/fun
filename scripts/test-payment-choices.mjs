import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('original blocked tool request opens payment choices without approval or execution', async () => {
  const nodes = [];
  const make = tag => {
    const node = {tag, children: [], isConnected: true, style: {}, events: {},
      setAttribute(k,v) {this[k]=v;}, append(...items) {this.children.push(...items);}, prepend(...items) {this.children.unshift(...items);},
      addEventListener(k, fn) {this.events[k]=fn;}, focus() {this.focused=true;}, animate() {this.animated=true;},
      showModal() {this.open=true;}, close() {this.events.close?.();}, remove() {this.isConnected=false;this.children.forEach(child=>child.remove());}};
    nodes.push(node); return node;
  };
  const document = {activeElement: make('button'), documentElement: {lang:'ko'},
    createElement: make, getElementById: id => nodes.find(n=>n.id===id&&n.isConnected), body:make('body')};
  let networkCalls = 0,opens=0;const diagnostics=[];
  const context = {document, location:{pathname:'/ai-image-generator/',origin:'https://manytool.net'}, DOMException,URLSearchParams,
    window:{goPay:()=>opens++,fetch:async(url,init)=>{networkCalls++;if(url==='/api/nicepay-review/window'){const params=new URLSearchParams(init.body);diagnostics.push(params);return {ok:true,json:async()=>({testOnly:true,method:params.get('method'),fields:{MID:'000000002m',Amt:'9900',ReturnURL:'https://manytool.net/api/nicepay-review/return',PayMethod:'CARD'}})};}return 'read-only';}}};
  runInNewContext(readFileSync(new URL('../public/payment-choices.js', import.meta.url),'utf8'),context);
  const layout=readFileSync(new URL('../src/layouts/Layout.astro',import.meta.url),'utf8');
  const gate=[...layout.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var AI_PAGE'))?.[1];
  assert.ok(gate); runInNewContext(gate,context);
  await assert.rejects(context.window.fetch('https://api.manytool.net/checkout',{method:'POST'}),{name:'AbortError'});
  assert.equal(networkCalls,0);
  const dialog=nodes.find(n=>n.id==='manytool-payment-choices'); assert.equal(dialog.open,true);
  assert.ok(nodes.some(n=>n.textContent==='9,900원'));
  const form=nodes.find(n=>n.tag==='form'); assert.equal(form.action,'/api/nicepay-review/window');
  assert.equal(form.children[0].value,'image');
  assert.ok(nodes.some(n=>n.disabled&&n.textContent==='보유 크레딧으로 결제'));
  let prevented=false;await form.events.submit({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(networkCalls,0);assert.equal(opens,0);
  const all=nodes.find(n=>n.id==='manytool-payment-agree-all');assert.equal(all.focused,true);assert.ok(nodes.some(n=>n.animated));assert.ok(nodes.find(n=>n.id==='manytool-consent-message').textContent.includes('동의'));
  all.checked=true;all.events.change();
  assert.equal(nodes.find(n=>n.id==='manytool-consent-message').textContent,'');
  const individual=nodes.find(n=>n.tag==='input'&&n.name==='terms');individual.checked=false;individual.events.change();assert.equal(all.indeterminate,true);
  all.checked=true;all.events.change();
  for(const label of ['네이버페이','토스페이','카카오페이'])assert.ok(nodes.some(n=>!n.disabled&&n.textContent===label));
  for(const method of ['CARD','NAVER','TOSS','KAKAO','SAMSUNG','APPLE','PAYCO'])assert.ok(nodes.some(n=>n.tag==='input'&&n.name==='method'&&n.value===method));
  assert.equal(nodes.filter(n=>n.tag==='img'&&n.src.startsWith('/payment-brands/')).length,7);
  assert.ok(nodes.some(n=>n['aria-label']==='추가 간편결제'&&n.children.length===3));
  context.window.manytoolShowPaymentChoices(); assert.equal(nodes.filter(n=>n.tag==='dialog').length,1);
  assert.equal(await context.window.fetch('https://api.manytool.net/config'),'read-only');
  assert.equal(networkCalls,1);prevented=false;await form.events.submit({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(opens,1);assert.equal(dialog.isConnected,false);assert.equal(networkCalls,2);
  assert.equal(diagnostics[0].get('consentVersion'),'2026-11-13-review');for(const key of ['terms','collection','sharing'])assert.equal(diagnostics[0].get(key),'1');
  context.window.nicepaySubmit();assert.equal(networkCalls,2);assert.equal(opens,1);assert.ok(nodes.some(n=>n.isConnected&&n.id==='manytool-consent-message'&&n.textContent.includes('실제 결제 승인은 처리하지 않았습니다')));
  assert.equal(nodes.find(n=>n.id==='manytool-nicepay-form').isConnected,false);
  context.window.matchMedia=()=>({matches:true});nodes.forEach(n=>n.animated=false);
  const reopened=nodes.find(n=>n.isConnected&&n.id==='manytool-payment-choices'),again=nodes.find(n=>n.isConnected&&n.tag==='form');
  await again.events.submit({preventDefault(){}});assert.equal(nodes.some(n=>n.animated),false);
  const nextAll=nodes.find(n=>n.isConnected&&n.id==='manytool-payment-agree-all');nextAll.checked=true;nextAll.events.change();
  let release;context.window.fetch=()=>new Promise(resolve=>release=resolve);
  const pending=again.events.submit({preventDefault(){}});reopened.close();release({ok:true,json:async()=>({testOnly:true,method:'CARD',fields:{MID:'000000002m',Amt:'9900',ReturnURL:'https://manytool.net/api/nicepay-review/return'}})});await pending;assert.equal(opens,1);
});
