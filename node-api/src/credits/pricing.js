export const CREDIT_VALUE_KRW = 1000;
export const PACKS = Object.freeze([10, 50, 300].map(credits => Object.freeze({
  id: String(credits), credits, amount: credits * CREDIT_VALUE_KRW, currency: 'KRW', discountPercent: 0
})));

export const TOOL_LABELS = Object.freeze({
  base: 'AI 사진·이미지 생성', video_mkv_mp4: '동영상 MP4 변환',
  ai_name_premium: '이름 프리미엄', ai_pet_translator: 'AI 펫 번역기 30일 이용권',
  calorie: 'AI 칼로리 분석', ai_personal_color: 'AI 퍼스널컬러',
  ai_manseryeok: 'AI 만세력',
  ...Object.fromEntries([5, 7, 10, 15, 20].map(n => [`detail_page_${n}`, `상세페이지 ${n}장`]))
});

// All values are KRW. Costs must include provider retries and other variable costs.
// No currency conversion or user-supplied checkout amount is used for credit pricing.
export function quoteCredits({ retailKrw, costKrw, feeBps = 1000, marginBps = 2000 }) {
  for (const n of [retailKrw, costKrw, feeBps, marginBps]) {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('가격과 원가는 0 이상의 정수여야 합니다.');
  }
  if (retailKrw <= 0 || costKrw <= 0 || feeBps + marginBps >= 10000 || marginBps < 1000) {
    throw new Error('판매가·원가·수수료·최소 마진 설정을 확인해주세요.');
  }
  const minimumKrw = Math.ceil(costKrw * 10000 / (10000 - feeBps - marginBps));
  const credits = Math.ceil(Math.max(retailKrw, minimumKrw) / CREDIT_VALUE_KRW);
  if (!Number.isSafeInteger(credits) || credits > 100000) throw new Error('차감량 범위를 초과했습니다.');
  return { credits, amountKrw: credits * CREDIT_VALUE_KRW, retailKrw };
}

export function readPricing(raw = '{}') {
  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Invalid credit pricing');
  return Object.fromEntries(Object.entries(parsed).map(([key, row]) => {
    if (!Object.hasOwn(TOOL_LABELS, key)) throw new Error(`Unsupported credit product: ${key}`);
    return [key, { ...quoteCredits(row), label: TOOL_LABELS[key] }];
  }));
}

export function productKey(body) {
  if (body.productType !== 'detail_page') return body.productType;
  const count = body.detailPageRequest?.pageCount;
  if (![5, 7, 10, 15, 20].includes(count)) throw new Error('상세페이지 장수를 확인해주세요.');
  return `detail_page_${count}`;
}
