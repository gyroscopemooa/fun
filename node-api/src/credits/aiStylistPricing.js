// Retail policy only. Provider costs must be verified before enabling purchases.
export const AI_STYLIST_PRICING = Object.freeze({
  maxItems: 5,
  baseKrw: 3000,
  extraItemKrw: 1000,
  creditValueKrw: 1000,
  outputImages: 1
});

export function quoteAiStylist(itemCount) {
  if (!Number.isSafeInteger(itemCount) || itemCount < 1 || itemCount > AI_STYLIST_PRICING.maxItems) {
    throw new Error('옷 사진은 1~5장으로 선택해주세요.');
  }
  const extraItems = itemCount - 1;
  const extraKrw = extraItems * AI_STYLIST_PRICING.extraItemKrw;
  const amountKrw = AI_STYLIST_PRICING.baseKrw + extraKrw;
  return { itemCount, extraItems, baseKrw: AI_STYLIST_PRICING.baseKrw, extraKrw, amountKrw,
    credits: amountKrw / AI_STYLIST_PRICING.creditValueKrw, productKey: `ai_stylist_${itemCount}` };
}
