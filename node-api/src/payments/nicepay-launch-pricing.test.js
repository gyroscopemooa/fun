import test from 'node:test';
import assert from 'node:assert/strict';
import {nicepayAiCatalog} from '../commerce/ai-products.js';
import {prepareNicepayIntent,readNicepayPolicy} from './nicepay-policy.js';
const policy=readNicepayPolicy(JSON.stringify({enabled:true,apiConfirmed:true,variant:'legacy',categories:{direct:{approved:true,methods:['card'],maxAmountKrw:200000}}}));
test('trusted launch prices snapshot new pet limits and ignore caller price or unlimited entitlement',()=>{
  const intent=prepareNicepayIntent({productId:'ai_pet_translator',ownerId:'owner',amount:1,entitlementPolicy:{dailyLimit:999}},nicepayAiCatalog(),policy);
  assert.equal(intent.amount,119000);assert.equal(intent.entitlementPolicy.dailyLimit,5);
  assert.equal(intent.entitlementPolicy.totalLimit,150);assert.ok(Object.isFrozen(intent.entitlementPolicy));
  assert.equal(intent.liveAvailable,false);
  assert.throws(()=>prepareNicepayIntent({productId:'ai_pet_translator',ownerId:'owner'},nicepayAiCatalog(),readNicepayPolicy()));
});
test('dedicated image and portrait catalog preserve their executor base key without mixing amounts',()=>{
  for(const [scope,amount]of [['image',9900],['modelcut',9900],['headshot',16900],['id_photo',16900],['passport',16900]]){
    const intent=prepareNicepayIntent({productId:'base',ownerId:'owner',amount:1},nicepayAiCatalog(scope),policy);
    assert.equal(intent.amount,amount);
  }
});
