import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('original blocked tool request opens payment choices without approval or execution', async () => {
  const nodes = [];
  const make = tag => {
    const node = {tag, children: [], isConnected: true, style: {}, events: {},
      setAttribute(k,v) {this[k]=v;}, append(...items) {this.children.push(...items);},
      addEventListener(k, fn) {this.events[k]=fn;}, focus() {},
      showModal() {this.open=true;}, close() {this.events.close?.();}, remove() {this.isConnected=false;}};
    nodes.push(node); return node;
  };
  const document = {activeElement: make('button'), documentElement: {lang:'ko'},
    createElement: make, getElementById: id => nodes.find(n=>n.id===id&&n.isConnected), body:make('body')};
  let networkCalls = 0;
  const context = {document, location:{pathname:'/ai-image-generator/'}, DOMException,
    window:{fetch:async()=>{networkCalls++;return 'read-only';}}};
  runInNewContext(readFileSync(new URL('../public/payment-choices.js', import.meta.url),'utf8'),context);
  const layout=readFileSync(new URL('../src/layouts/Layout.astro',import.meta.url),'utf8');
  const gate=[...layout.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('var AI_PAGE'))?.[1];
  assert.ok(gate); runInNewContext(gate,context);
  await assert.rejects(context.window.fetch('https://api.manytool.net/checkout',{method:'POST'}),{name:'AbortError'});
  assert.equal(networkCalls,0);
  const dialog=nodes.find(n=>n.id==='manytool-payment-choices'); assert.equal(dialog.open,true);
  assert.ok(nodes.some(n=>n.textContent==='임시 검토 가격 100,000원'));
  const form=nodes.find(n=>n.tag==='form'); assert.equal(form.action,'/api/nicepay-review/window');
  assert.equal(form.children[0].value,'image');
  assert.ok(nodes.some(n=>n.disabled&&n.textContent.includes('크레딧')));
  context.window.manytoolShowPaymentChoices(); assert.equal(nodes.filter(n=>n.tag==='dialog').length,1);
  assert.equal(await context.window.fetch('https://api.manytool.net/config'),'read-only');
  assert.equal(networkCalls,1); dialog.close(); assert.equal(dialog.isConnected,false);
});
