import test from 'node:test';
import assert from 'node:assert/strict';
import { readNicepayPolicy, prepareNicepayIntent } from './nicepay-policy.js';
const category = { approved: true, methods: ['card'], recurring: false, overseas: false, maxAmountKrw: 10000 };
const config = { enabled: true, apiConfirmed: true, variant: 'rest-server', categories: { credit_topup: category, direct: category } };
const catalog = { credits: { category: 'credit_topup', amount: 10000, credits: 10, currency: 'KRW', recurring: false, goodsName: 'Manytool credits' },
  tool: { category: 'direct', amount: 4900, currency: 'KRW', recurring: false, goodsName: 'Manytool tool' } };
const request = { productId: 'credits', ownerId: 'verified-user' };
const policy = input => readNicepayPolicy(JSON.stringify(input));
test('default disabled, explicit contract and category required', () => {
  assert.equal(readNicepayPolicy().enabled, false);
  for (const input of [{}, {...config,enabled:false}, {...config,apiConfirmed:false}, {...config,variant:null}, {...config,categories:{}}]) {
    assert.throws(() => prepareNicepayIntent(request,catalog,policy(input)));
  }
});
test('category policy cannot enable unimplemented payment methods', () => {
  for (const methods of [['billing'], ['easy'], ['card','overseas'], ['mobile']]) assert.throws(() => policy({...config,categories:{direct:{...category,methods}}}));
  for (const extra of [{recurring:true},{overseas:true},{maxAmountKrw:0}]) assert.throws(() => policy({...config,categories:{credit_topup:{...category,...extra}}}));
});
test('direct approval does not authorize credit topups', () => {
  const p=policy({...config,categories:{direct:category}});
  assert.throws(() => prepareNicepayIntent(request,catalog,p));
  assert.equal(prepareNicepayIntent({...request,productId:'tool'},catalog,p).category,'direct');
});
test('credit approval does not authorize direct purchases', () => {
  assert.throws(() => prepareNicepayIntent({...request,productId:'tool'},catalog,policy({...config,categories:{credit_topup:category}})));
});
test('server catalog defeats customer price/category/credit spoofing', () => {
  const intent=prepareNicepayIntent({...request,amount:1,category:'direct',credits:999999},catalog,policy(config));
  assert.equal(intent.amount,10000); assert.equal(intent.credits,10); assert.equal(intent.category,'credit_topup');
  assert.equal(intent.liveAvailable,false); assert.ok(Object.isFrozen(intent));
});
test('USD, excessive amount, recurring and invalid credits fail closed', () => {
  for (const change of [{currency:'USD'},{amount:10001},{amount:-1},{amount:1.1},{recurring:true},{credits:0},{goodsName:'<script>'}]) {
    assert.throws(() => prepareNicepayIntent(request,{credits:{...catalog.credits,...change}},policy(config)));
  }
});
test('no unknown product, inherited key or anonymous owner', () => {
  for (const productId of ['missing','toString','__proto__']) assert.throws(() => prepareNicepayIntent({...request,productId},catalog,policy(config)));
  assert.throws(() => prepareNicepayIntent({...request,ownerId:''},catalog,policy(config)));
});
test('policy rejects unknown variant or category; mutations cannot expand approval', () => {
  assert.throws(() => policy({...config,variant:'rest-client'}));
  assert.throws(() => policy({...config,categories:{unknown:category}}));
  const p=policy(config); assert.throws(() => {p.categories.direct.approved=false;});
  assert.throws(() => {p.categories.direct.methods.push('billing');});
});
test('topup fixed 1000 KRW unit invariant enforced before checkout',()=>{
 for(const amount of [9000,9999])assert.throws(()=>prepareNicepayIntent(request,{credits:{...catalog.credits,amount}},policy(config)));
});
