import { useState } from 'react';

import { CalorieReport, type CalorieAnalysis } from './CalorieReport';

// Illustrated sample reports (no photos) rendered through the same report as paid results.
const SAMPLES: { id: string; label: string; emoji: string; analysis: CalorieAnalysis }[] = [
  {
    id: 'kimchi-stew',
    label: '김치찌개 백반',
    emoji: '🍲',
    analysis: {
      version: 2,
      goal: 'maintain',
      mealName: '김치찌개 백반',
      summary: '돼지고기 김치찌개에 흰쌀밥 한 공기와 반찬 3종이 곁들여진 한 끼입니다. 단백질과 채소는 무난하지만 국물과 김치 때문에 나트륨이 높은 편이에요.',
      confidence: 'high',
      totalCalories: 735,
      calorieRange: { min: 640, max: 830 },
      macros: { carbsG: 98, proteinG: 32, fatG: 23, fiberG: 7, sugarG: 9, sodiumMg: 2350 },
      foodItems: [
        { name: '돼지고기 김치찌개', emoji: '🍲', estimatedPortion: '1인분 뚝배기', grams: 400, estimatedCalories: 330, carbsG: 14, proteinG: 22, fatG: 19, confidence: 'high' },
        { name: '흰쌀밥', emoji: '🍚', estimatedPortion: '1공기', grams: 210, estimatedCalories: 310, carbsG: 68, proteinG: 6, fatG: 1, confidence: 'high' },
        { name: '계란말이', emoji: '🍳', estimatedPortion: '3조각', grams: 60, estimatedCalories: 55, carbsG: 1, proteinG: 4, fatG: 3, confidence: 'medium' },
        { name: '시금치나물·콩나물', emoji: '🥬', estimatedPortion: '반찬 2종', grams: 90, estimatedCalories: 40, carbsG: 4, proteinG: 2, fatG: 1, confidence: 'medium' }
      ],
      mealScore: 72,
      scoreBreakdown: {
        balance: { score: 78, comment: '밥·단백질·채소가 고르게 들어 있어요.' },
        protein: { score: 74, comment: '찌개 고기와 계란으로 한 끼 단백질은 충분해요.' },
        fiber: { score: 66, comment: '나물 반찬이 있지만 양이 조금 적어요.' },
        sodiumSugar: { score: 38, comment: '국물까지 다 먹으면 하루 나트륨을 넘길 수 있어요.' }
      },
      highlights: ['단백질·탄수화물·채소가 고루 들어간 균형 잡힌 구성', '튀김 없이 조리법이 비교적 가벼움'],
      improvements: ['찌개 국물은 반 이상 남기기', '나물 반찬을 한 접시 더 추가하기'],
      swaps: [
        { from: '흰쌀밥 1공기', to: '잡곡밥 2/3공기', caloriesSaved: 100, reason: '식이섬유는 늘리고 혈당 상승은 완만하게' },
        { from: '찌개 국물 전부', to: '건더기 위주로', caloriesSaved: 60, reason: '나트륨을 약 800mg 줄일 수 있어요' },
        { from: '계란말이', to: '계란찜', caloriesSaved: 20, reason: '기름 사용량이 적어요' }
      ],
      notes: ['찌개 속 돼지고기 부위(앞다리/삼겹)에 따라 ±80kcal 차이가 날 수 있어요.']
    }
  },
  {
    id: 'fried-chicken',
    label: '치킨 & 콜라',
    emoji: '🍗',
    analysis: {
      version: 2,
      goal: 'lose',
      mealName: '후라이드 치킨 반 마리 & 콜라',
      summary: '후라이드 치킨 반 마리와 콜라 한 캔, 치킨무 구성이에요. 단백질은 많지만 튀김옷 지방과 콜라 당류 때문에 감량 목표에는 부담이 큰 한 끼입니다.',
      confidence: 'medium',
      totalCalories: 1180,
      calorieRange: { min: 1020, max: 1350 },
      macros: { carbsG: 88, proteinG: 62, fatG: 64, fiberG: 2, sugarG: 44, sodiumMg: 1900 },
      foodItems: [
        { name: '후라이드 치킨', emoji: '🍗', estimatedPortion: '반 마리 (6조각)', grams: 380, estimatedCalories: 980, carbsG: 38, proteinG: 61, fatG: 64, confidence: 'medium' },
        { name: '콜라', emoji: '🥤', estimatedPortion: '1캔 355ml', grams: 355, estimatedCalories: 150, carbsG: 39, proteinG: 0, fatG: 0, confidence: 'high' },
        { name: '치킨무', emoji: '🥒', estimatedPortion: '1팩', grams: 80, estimatedCalories: 50, carbsG: 11, proteinG: 1, fatG: 0, confidence: 'high' }
      ],
      mealScore: 41,
      scoreBreakdown: {
        balance: { score: 35, comment: '지방 비율이 절반 가까이 돼요.' },
        protein: { score: 88, comment: '닭고기 덕분에 단백질은 넉넉해요.' },
        fiber: { score: 12, comment: '채소가 거의 없어요.' },
        sodiumSugar: { score: 30, comment: '콜라 한 캔에 하루 당류 권장량의 80%가 들어 있어요.' }
      },
      highlights: ['단백질 섭취량은 충분해요'],
      improvements: ['콜라는 제로 음료나 탄산수로', '양배추 샐러드를 곁들이면 포만감이 올라가요', '다음 끼니는 채소 위주로 가볍게'],
      swaps: [
        { from: '후라이드 반 마리', to: '오븐구이 반 마리', caloriesSaved: 330, reason: '튀김옷이 없어 지방이 크게 줄어요' },
        { from: '콜라 1캔', to: '제로 콜라', caloriesSaved: 150, reason: '당류 39g을 그대로 덜어내요' },
        { from: '치킨무', to: '양배추 샐러드', caloriesSaved: 10, reason: '식이섬유를 채울 수 있어요' }
      ],
      notes: ['브랜드별 튀김옷 두께에 따라 칼로리 차이가 커요.', '양념 소스를 찍어 먹으면 1회당 약 40kcal가 더해져요.']
    }
  },
  {
    id: 'salmon-poke',
    label: '연어 포케',
    emoji: '🥗',
    analysis: {
      version: 2,
      goal: 'gain',
      mealName: '연어 아보카도 포케',
      summary: '현미밥 위에 생연어, 아보카도, 에다마메, 채소를 올린 포케예요. 건강한 지방과 단백질이 풍부해 근력 증가 목표에 잘 맞는 한 끼입니다.',
      confidence: 'high',
      totalCalories: 690,
      calorieRange: { min: 610, max: 760 },
      macros: { carbsG: 72, proteinG: 38, fatG: 26, fiberG: 11, sugarG: 8, sodiumMg: 980 },
      foodItems: [
        { name: '생연어', emoji: '🐟', estimatedPortion: '큐브 8~10조각', grams: 120, estimatedCalories: 250, carbsG: 0, proteinG: 25, fatG: 16, confidence: 'high' },
        { name: '현미밥', emoji: '🍚', estimatedPortion: '2/3공기', grams: 150, estimatedCalories: 230, carbsG: 50, proteinG: 5, fatG: 2, confidence: 'high' },
        { name: '아보카도', emoji: '🥑', estimatedPortion: '1/4개', grams: 50, estimatedCalories: 80, carbsG: 4, proteinG: 1, fatG: 7, confidence: 'high' },
        { name: '에다마메', emoji: '🫛', estimatedPortion: '한 줌', grams: 50, estimatedCalories: 60, carbsG: 5, proteinG: 6, fatG: 1, confidence: 'medium' },
        { name: '양배추·오이·소스', emoji: '🥗', estimatedPortion: '채소 한 줌 + 간장 소스', grams: 100, estimatedCalories: 70, carbsG: 13, proteinG: 1, fatG: 0, confidence: 'medium' }
      ],
      mealScore: 88,
      scoreBreakdown: {
        balance: { score: 90, comment: '탄단지 비율이 목표 구간 안에 들어와요.' },
        protein: { score: 84, comment: '연어와 에다마메로 단백질 38g을 채웠어요.' },
        fiber: { score: 86, comment: '현미와 채소 덕에 식이섬유가 넉넉해요.' },
        sodiumSugar: { score: 74, comment: '소스를 절반만 쓰면 더 좋아요.' }
      },
      highlights: ['오메가3가 풍부한 연어로 건강한 지방 섭취', '현미·채소로 식이섬유 하루 권장량의 44%'],
      improvements: ['운동 후라면 연어나 두부를 한 스쿱 추가', '소스는 따로 받아 절반만'],
      swaps: [
        { from: '연어 120g', to: '연어 180g', caloriesSaved: 0, reason: '근력 증가 목표라면 단백질을 13g 더 채워요' },
        { from: '간장 소스 전부', to: '소스 절반', caloriesSaved: 25, reason: '나트륨을 약 300mg 줄여요' }
      ],
      notes: ['드레싱 종류(마요 베이스 등)에 따라 100kcal 이상 늘 수 있어요.']
    }
  }
];

export function CalorieSampleShowcase() {
  const [active, setActive] = useState(SAMPLES[0].id);
  const sample = SAMPLES.find((item) => item.id === active) ?? SAMPLES[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={`flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-4 text-sm font-bold transition ${item.id === active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
          >
            <span className="text-lg leading-none">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <CalorieReport key={sample.id} analysis={sample.analysis} sample />
      </div>
    </div>
  );
}

export default CalorieSampleShowcase;
