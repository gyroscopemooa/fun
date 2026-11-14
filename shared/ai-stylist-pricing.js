// Planning budgets, not measured invoices. No paid API calls were used to set these prices.
export const AI_STYLIST_ASSUMPTIONS = Object.freeze({targetMargin:.90,vatRate:.10,paymentFeeRate:.035,planningKrwPerUsd:1500,baseCostBudgetKrw:500,extraItemCostBudgetKrw:75});
export const AI_STYLIST_PRICING = Object.freeze({maxItems:5,baseKrw:9900,extraItemKrw:1500,creditValueKrw:1000,outputImages:1});
export function quoteAiStylist(itemCount) {
  if(!Number.isSafeInteger(itemCount)||itemCount<1||itemCount>5)throw Error('옷 사진은 1~5장으로 선택해주세요.');
  const extraItems=itemCount-1,extraKrw=extraItems*AI_STYLIST_PRICING.extraItemKrw;
  const amountKrw=AI_STYLIST_PRICING.baseKrw+extraKrw;
  const costBudgetKrw=AI_STYLIST_ASSUMPTIONS.baseCostBudgetKrw+extraItems*AI_STYLIST_ASSUMPTIONS.extraItemCostBudgetKrw;
  const net=amountKrw/(1+AI_STYLIST_ASSUMPTIONS.vatRate);
  const estimatedMargin=(net-amountKrw*AI_STYLIST_ASSUMPTIONS.paymentFeeRate-costBudgetKrw)/net;
  if(estimatedMargin<AI_STYLIST_ASSUMPTIONS.targetMargin)throw Error('코디 가격이 목표 마진에 미달합니다.');
  return {itemCount,extraItems,baseKrw:AI_STYLIST_PRICING.baseKrw,extraKrw,amountKrw,credits:Math.ceil(amountKrw/1000),productKey:`ai_stylist_${itemCount}`,costBudgetKrw,estimatedMargin};
}
