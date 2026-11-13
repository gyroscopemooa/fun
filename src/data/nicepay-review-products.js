import {AI_PRODUCTS} from '../../shared/ai-products.js';
export const NICE_REVIEW_PRODUCTS = Object.freeze({
 calorie: {name:'AI 칼로리 분석', proposedPriceKrw:AI_PRODUCTS.calorie.amount, unit:AI_PRODUCTS.calorie.unit, path:'/ai-calorie-calculator/', period:'결제 확인 후 분석을 시작하고, 완료 시 분석 결과 1회를 제공합니다. 자동갱신되지 않습니다.'},
 image: {name:'AI 이미지 생성', path:'/ai-image-generator/', reviewAmountKrw:9900, proposedPriceKrw:9900, period:'결제 확인 후 생성을 시작하고, 완료 시 구매 화면에 표시된 생성 결과 1회를 제공합니다. 자동갱신되지 않습니다.'},
 pet: {name:'AI 펫 번역기 30일 이용권', proposedPriceKrw:AI_PRODUCTS.pet.amount, unit:AI_PRODUCTS.pet.unit, path:'/ai-pet-translator/', period:'신규 이용권은 결제일로부터 30일간 하루 5회, 총 150회까지 이용합니다. 기준 시간대는 한국시간이며 음성 입력은 회당 30초, 텍스트 입력은 500자까지입니다. 자동갱신되지 않습니다. 기존 구매 조건은 보존합니다.'}
});
