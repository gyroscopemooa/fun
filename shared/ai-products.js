// Storefront catalog extends the existing API catalog without redeploying its wallet or storage.
import {AI_PRODUCTS as API_PRODUCTS, publicAiCatalog as apiPublicAiCatalog, nicepayAiCatalog as apiNicepayAiCatalog, aiProductForPath as apiProductForPath} from '../node-api/src/commerce/ai-products.js';
import {quoteAiStylist} from './ai-stylist-pricing.js';
export {AI_PRICE_VERSION,AI_PRICE_ASSUMPTIONS,contributionMargin} from '../node-api/src/commerce/ai-products.js';
const STYLIST_PRODUCTS=Object.freeze(Object.fromEntries([1,2,3,4,5].map(n=>{
 const q=quoteAiStylist(n),id=`stylist_${n}`;
 return [id,Object.freeze({id,name:`AI 코디 · 옷 ${n}장`,amount:q.amountKrw,costBudgetKrw:q.costBudgetKrw,paths:Object.freeze(n===1?['/ai-stylist']:[]),unit:'착장 이미지 1장 · 상세 코디 분석',currency:'KRW',category:'direct',recurring:false,priceVersion:'2026-11-15-stylist-v1',liveAvailable:false,productType:q.productKey,goodsName:`AI Stylist ${n}`,garmentCount:n})];
})));
export const AI_PRODUCTS=Object.freeze({...API_PRODUCTS,...STYLIST_PRODUCTS});
export function aiProductForPath(pathname,pageCount=7){
 const path=pathname.replace(/^\/(?!ai(?:-|\/))[a-z]{2,3}(?:-[A-Za-z]{2,4})?(?=\/)/,'').replace(/\/$/,'');
 return path==='/ai-stylist'?STYLIST_PRODUCTS.stylist_1:apiProductForPath(pathname,pageCount);
}
export function publicAiCatalog(){
 return {...apiPublicAiCatalog(),...Object.fromEntries(Object.values(STYLIST_PRODUCTS).map(({id,name,amount,unit,paths,garmentCount})=>[id,{id,name,amount,unit,paths,garmentCount}]))};
}
export function nicepayAiCatalog(scope='tools'){
 const base=apiNicepayAiCatalog(scope);
 return scope==='tools'?{...base,...Object.fromEntries(Object.values(STYLIST_PRODUCTS).map(p=>[p.productType,{category:p.category,amount:p.amount,currency:p.currency,goodsName:p.goodsName,recurring:false,productType:p.productType,priceVersion:p.priceVersion}]))}:base;
}
