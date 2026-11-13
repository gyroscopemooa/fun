import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_PRODUCTS,AI_PRICE_ASSUMPTIONS,contributionMargin,aiProductForPath,nicepayAiCatalog,publicAiCatalog} from '../shared/ai-products.js';
test('all launch prices target 90 percent after VAT and assumed PG fee against their full budgets',()=>{
  for(const p of Object.values(AI_PRODUCTS)){
    assert.ok(contributionMargin(p.amount,p.costBudgetKrw)>=.90, p.id);
    assert.equal(p.liveAvailable,false);assert.equal(p.currency,'KRW');
  }
  assert.equal(AI_PRODUCTS.image.amount,9900);
  assert.equal(AI_PRODUCTS.pet.entitlementPolicy.dailyLimit,5);
  assert.equal(AI_PRODUCTS.pet.entitlementPolicy.days,30);
  assert.ok(AI_PRODUCTS.pet.costBudgetKrw>=150*40);
  assert.ok(contributionMargin(9900,900)<.90);
  assert.ok(contributionMargin(9900,500,{...AI_PRICE_ASSUMPTIONS,paymentFeeRate:.1})<.90);
});
test('routes include profile aliases, localized tools and exact detail tier; unknown tiers fail closed',()=>{
  assert.equal(aiProductForPath('/ai-headshot/').id,'headshot');
  assert.equal(aiProductForPath('/ai-photoshop/').id,'headshot');
  assert.equal(aiProductForPath('/en/ai-personal-color/').id,'personal_color');
  assert.equal(aiProductForPath('/tools/product-detail-studio/',20).amount,16900);
  assert.equal(aiProductForPath('/tools/product-detail-studio/',999),null);
  assert.equal(aiProductForPath('/missing'),null);
});
test('public catalog excludes cost budgets; trusted payment catalog pins amount, currency and entitlement snapshot',()=>{
  assert.equal(publicAiCatalog().pet.costBudgetKrw,undefined);
  const catalog=nicepayAiCatalog();assert.equal(catalog.ai_pet_translator.amount,119000);
  assert.equal(catalog.ai_pet_translator.entitlementPolicy.timeZone,'Asia/Seoul');
  assert.equal(nicepayAiCatalog('image').base.amount,9900);
  assert.equal(nicepayAiCatalog('headshot').base.amount,16900);
  assert.equal(catalog.calorie.recurring,false);
  assert.throws(()=>nicepayAiCatalog('missing'));
});
