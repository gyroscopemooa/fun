export const AI_STYLIST_PRICING: Readonly<{
  maxItems: number; baseKrw: number; extraItemKrw: number; creditValueKrw: number; outputImages: number;
}>;
export function quoteAiStylist(itemCount: number): {
  itemCount: number; extraItems: number; baseKrw: number; extraKrw: number; amountKrw: number; credits: number; productKey: string;
};
