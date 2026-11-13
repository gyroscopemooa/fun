// Server-owned launch prices. Estimates are budgets, not measured provider invoices.
// Consumer prices include VAT. Existing Polar orders and entitlements are untouched.
// Sources: https://developers.openai.com/api/docs/pricing and
// https://developers.openai.com/api/docs/guides/image-generation (checked 2026-11-13).
// Budgets include capped output/retries plus a reserve. PG fee and FX below are
// planning assumptions; reconcile actual invoices/contract fees before selling.
export const AI_PRICE_VERSION = '2026-11-13-v1';
export const AI_PRICE_ASSUMPTIONS = Object.freeze({targetMargin: .90, vatRate: .10, paymentFeeRate: .035, planningKrwPerUsd: 1500});
export function contributionMargin(priceKrw, costBudgetKrw, assumptions = AI_PRICE_ASSUMPTIONS) {
  const {vatRate, paymentFeeRate} = assumptions;
  if (![priceKrw,costBudgetKrw,vatRate,paymentFeeRate].every(Number.isFinite) || priceKrw <= 0 || costBudgetKrw < 0 || vatRate < 0 || paymentFeeRate < 0) throw Error('Invalid pricing inputs');
  const net = priceKrw / (1 + vatRate);
  return (net - priceKrw * paymentFeeRate - costBudgetKrw) / net;
}
const row = (id, name, amount, costBudgetKrw, paths, unit, extra = {}) => Object.freeze({id,name,amount,costBudgetKrw,paths:Object.freeze(paths),unit,currency:'KRW',category:'direct',recurring:false,priceVersion:AI_PRICE_VERSION,liveAvailable:false,...extra});
export const AI_PRODUCTS = Object.freeze({
  image: row('image','AI 이미지 생성',9900,500,['/ai-image-generator'],'완성 이미지 1장',{productType:'base',goodsName:'AI Image'}),
  headshot: row('headshot','AI 프로필사진',16900,900,['/ai-headshot','/ai-photoshop'],'후보 3장 · 최종 1장 다운로드',{productType:'headshot',goodsName:'AI Headshot'}),
  id_photo: row('id_photo','AI 증명사진',16900,900,['/ai-id-photo'],'후보 3장 · 최종 1장 다운로드',{productType:'base',goodsName:'AI ID Photo'}),
  passport: row('passport','AI 여권사진',16900,900,['/ai-passport-photo'],'후보 3장 · 최종 1장 다운로드',{productType:'passport',goodsName:'AI Passport Photo'}),
  modelcut: row('modelcut','AI 모델컷',9900,500,['/ai-model-cut'],'모델컷 이미지 1장',{productType:'base',goodsName:'AI Model Cut'}),
  calorie: row('calorie','AI 칼로리 분석',4900,250,['/ai-calorie-calculator'],'사진 1장 · 분석 결과 1회',{productType:'calorie',goodsName:'AI Calorie'}),
  personal_color: row('personal_color','AI 퍼스널컬러',9900,500,['/ai-personal-color'],'사진 1장 · 컬러 리포트 1회',{productType:'ai_personal_color',goodsName:'AI Personal Color'}),
  saju: row('saju','AI 만세력',9900,500,['/ai-manseryeok'],'입력 1건 · 상세 리포트 1회',{productType:'ai_manseryeok',goodsName:'AI Saju'}),
  name: row('name','이름 프리미엄',4900,250,['/name-premium'],'동일 이름의 분석·추천 이용권',{productType:'ai_name_premium',goodsName:'Name Premium'}),
  pet: row('pet','AI 펫 번역기 30일 이용권',119000,6500,['/ai-pet-translator'],'30일 · 하루 5회 · 음성 회당 30초',{productType:'ai_pet_translator',goodsName:'AI Pet 30 Day',entitlementPolicy:Object.freeze({version:AI_PRICE_VERSION,days:30,dailyLimit:5,totalLimit:150,timeZone:'Asia/Seoul',textMaxChars:500,audioMaxSeconds:30})}),
  ...Object.fromEntries([[5,5900,300],[7,6900,350],[10,8900,450],[15,12900,700],[20,16900,900]].map(([n,amount,cost]) => [`detail_page_${n}`,row(`detail_page_${n}`,`AI 상세페이지 ${n}장`,amount,cost,[],`구성·카피 ${n}장 · 업로드 사진 활용`,{productType:`detail_page_${n}`,goodsName:`AI Detail ${n}`,pageCount:n})]))
});
export function aiProductForPath(pathname, pageCount = 7) {
  const path = pathname.replace(/^\/[a-z]{2,3}(?:-[A-Za-z]+)?(?=\/)/,'').replace(/\/$/,'');
  if (['/tools/product-detail-studio','/product-detail-studio'].includes(path)) return AI_PRODUCTS[`detail_page_${pageCount}`] ?? null;
  return Object.values(AI_PRODUCTS).find(p => p.paths.includes(path)) ?? null;
}
export function publicAiCatalog() {
  return Object.fromEntries(Object.entries(AI_PRODUCTS).map(([id,{name,amount,unit,paths,pageCount}])=>[id,{id,name,amount,unit,paths,...(pageCount?{pageCount}:{})}]));
}
export function nicepayAiCatalog(scope='tools') {
  // Existing private image/photo executors use a dedicated `base` catalog.
  // Never merge differently priced photo and image base products into one namespace.
  const scoped=AI_PRODUCTS[scope];
  const rows=scope==='tools'
    ?Object.values(AI_PRODUCTS).filter(p=>!['image','modelcut','headshot','id_photo','passport'].includes(p.id)).map(p=>[p.productType,p])
    :scoped&&['image','modelcut','headshot','id_photo','passport'].includes(scope)?[['base',scoped]]:null;
  if(!rows)throw Error('Explicit AI checkout scope required');
  return Object.fromEntries(rows.map(([id,p])=>[id,{category:p.category,amount:p.amount,currency:p.currency,goodsName:p.goodsName,recurring:false,productType:p.productType,priceVersion:p.priceVersion,...(p.entitlementPolicy?{entitlementPolicy:p.entitlementPolicy}:{})}]));
}
