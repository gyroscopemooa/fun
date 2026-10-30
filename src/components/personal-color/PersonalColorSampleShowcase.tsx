import { useState } from 'react';

import { TONE_MAP, type ToneId } from '@/lib/personal-color-tones';
import { PersonalColorReport, type PersonalColorAnalysis } from './PersonalColorReport';
import type { PersonalColorLocale } from '@/lib/personal-color-i18n';

const fromTone = (id: ToneId, extra: PersonalColorAnalysis): PersonalColorAnalysis => {
  const tone = TONE_MAP[id];
  return {
    version: 2,
    toneId: id,
    season: tone.season,
    secondaryTone: tone.sub,
    bestPalette: tone.best.map((item) => ({ name: item.name, hex: item.hex })),
    avoidPalette: tone.avoid.map((item) => ({ name: item.name, hex: item.hex })),
    ...extra
  };
};

// Illustrated sample results (no real faces) that render through the same report as paid results.
const SAMPLES: { id: string; label: string; analysis: PersonalColorAnalysis }[] = [
  {
    id: 'summer-mute',
    label: '여름 쿨 뮤트',
    analysis: fromTone('summer-mute', {
      summary: '핑크 베이스의 밝은 피부에 눈동자와 머리색이 부드러운 갈색이라 전체 대비가 낮습니다. 회색 기가 섞인 쿨 컬러에서 피부결이 가장 매끈해 보이는 타입입니다.',
      confidence: 'high',
      runnerUpToneId: 'summer-light',
      matchPercent: 86,
      undertone: '핑크 베이스',
      chroma: '저채도',
      contrast: '낮은 대비',
      warmthScore: 28,
      brightnessScore: 64,
      saturationScore: 30,
      contrastScore: 34,
      featureColors: { skin: '#EBC9BD', hair: '#5A4840', eye: '#4A3A33' },
      photoCheck: { score: 88, lighting: '자연광에 가까운 균일한 조명', issues: [] },
      signatureKeywords: ['차분함', '그레이시', '로즈 무드', '저채도 쿨'],
      makeup: { base: '핑크 베이스 21호, 세미매트 마무리', lip: 'MLBB 로즈, 말린 장미 계열 글로우', blush: '더스티 핑크를 넓게 펴 바르기', eye: '그레이시 브라운 섀도로 음영만' },
      hair: { best: '붉은기 뺀 애쉬 브라운', avoid: '오렌지·골드 브라운' },
      stylingTips: ['상의는 그레이시 블루·라벤더 그레이처럼 탁한 쿨 컬러로', '블랙 대신 소프트 네이비·차콜로 무게감 주기', '액세서리는 무광 실버·로즈골드'],
      cautions: ['비비드한 원색은 얼굴보다 옷이 먼저 보일 수 있어요']
    })
  },
  {
    id: 'spring-bright',
    label: '봄 웜 브라이트',
    analysis: fromTone('spring-bright', {
      summary: '노란 기 도는 맑은 피부에 눈동자가 또렷하고 흰자가 깨끗해 선명한 대비가 살아 있습니다. 채도를 누르기보다 쨍한 웜 컬러에서 생기가 확 살아나는 타입입니다.',
      confidence: 'medium',
      runnerUpToneId: 'spring-true',
      matchPercent: 78,
      undertone: '옐로 베이스',
      chroma: '고채도',
      contrast: '중간~높은 대비',
      warmthScore: 74,
      brightnessScore: 70,
      saturationScore: 82,
      contrastScore: 62,
      featureColors: { skin: '#F2CDAE', hair: '#4A2E1E', eye: '#3D2618' },
      photoCheck: { score: 74, lighting: '실내 형광등, 약간 푸른 기', issues: ['살짝 푸른 조명'] },
      signatureKeywords: ['생기', '비비드', '맑은 웜', '또렷함'],
      makeup: { base: '옐로 베이스 21호, 촉촉한 광 마무리', lip: '비비드 코랄 틴트', blush: '클리어 피치를 광대 위로', eye: '브라운 라이너로 눈매만 선명하게' },
      hair: { best: '밝은 골드 브라운', avoid: '애쉬·블루 블랙' },
      stylingTips: ['포인트 컬러 하나는 꼭 비비드하게', '화이트는 웜 화이트·아이보리로', '골드 액세서리가 훨씬 잘 받아요'],
      cautions: ['푸른 조명이라 실제보다 쿨하게 보였을 수 있어요']
    })
  },
  {
    id: 'winter-deep',
    label: '겨울 쿨 딥',
    analysis: fromTone('winter-deep', {
      summary: '쿨한 피부에 짙은 흑갈색 눈동자와 검은 머리가 강한 대비를 만듭니다. 깊고 차가운 다크 컬러에서 이목구비가 가장 또렷하게 정리되는 타입입니다.',
      confidence: 'high',
      runnerUpToneId: 'winter-true',
      matchPercent: 83,
      undertone: '뉴트럴 쿨',
      chroma: '중고채도',
      contrast: '높은 대비',
      warmthScore: 30,
      brightnessScore: 36,
      saturationScore: 60,
      contrastScore: 84,
      featureColors: { skin: '#DDB5A2', hair: '#17141A', eye: '#1E1614' },
      photoCheck: { score: 82, lighting: '밝은 창가 자연광', issues: [] },
      signatureKeywords: ['시크', '딥 쿨', '고대비', '무게감'],
      makeup: { base: '뉴트럴 23호, 세미매트', lip: '딥 플럼 레드·버건디', blush: '쿨 로즈를 얇게', eye: '블랙 플럼 라이너로 또렷하게' },
      hair: { best: '블랙·다크 쿨 브라운', avoid: '밝은 골드·오렌지 계열' },
      stylingTips: ['올블랙이나 딥 네이비 코디가 가장 세련돼요', '밝은 색은 아이시 블루처럼 차갑게', '실버·화이트골드 액세서리'],
      cautions: ['파스텔 웜 컬러는 안색이 탁해 보일 수 있어요']
    })
  }
];

type ShowcaseProps = { leftPhotoUrl?: string; rightPhotoUrl?: string; locale?: PersonalColorLocale };

export function PersonalColorSampleShowcase({ leftPhotoUrl, rightPhotoUrl, locale = 'en' }: ShowcaseProps) {
  const localizedSamples = locale === 'ko' ? SAMPLES : SAMPLES.map((item) => {
    const tone = TONE_MAP[item.analysis.toneId as ToneId];
    return {
      ...item,
      label: tone.english,
      analysis: {
        ...item.analysis,
        season: tone.english.split(' ')[0],
        secondaryTone: tone.english,
        summary: `This sample has the clearest harmony with ${tone.english} colors. The report compares temperature, brightness, saturation and contrast to explain the result.`,
        undertone: item.id === 'spring-bright' ? 'Warm undertone' : 'Cool undertone',
        chroma: item.id === 'summer-mute' ? 'Muted chroma' : 'Clear chroma',
        contrast: item.id === 'summer-mute' ? 'Low contrast' : 'High contrast',
        signatureKeywords: [tone.english, 'balanced palette', 'personal color'],
        bestPalette: tone.best.map((color, index) => ({ name: `Best color ${index + 1}`, hex: color.hex })),
        avoidPalette: tone.avoid.map((color, index) => ({ name: `Avoid color ${index + 1}`, hex: color.hex })),
        photoCheck: { score: item.analysis.photoCheck?.score, lighting: 'Even natural-looking light', issues: [] },
        makeup: { base: 'A base matched to the undertone', lip: 'A lip color from the recommended palette', blush: 'A soft matching blush', eye: 'Balanced neutral eye color' },
        hair: { best: 'A hair color matched to the result', avoid: 'Strong opposing undertones' },
        stylingTips: ['Use the recommended palette near the face', 'Balance neutrals with one signature color'],
        cautions: ['Lighting and display settings can affect perceived color']
      }
    };
  });
  const [active, setActive] = useState(localizedSamples[0].id);
  const sample = localizedSamples.find((item) => item.id === active) ?? localizedSamples[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {localizedSamples.map((item) => {
          const tone = TONE_MAP[item.analysis.toneId as ToneId];
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-bold transition ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
            >
              <span className="flex h-7 w-7 overflow-hidden rounded-full">
                {tone.best.slice(0, 3).map((swatch) => <span key={swatch.hex} className="flex-1" style={{ background: swatch.hex }} />)}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <PersonalColorReport key={sample.id} analysis={sample.analysis} photoUrl={leftPhotoUrl} comparePhotoUrl={rightPhotoUrl} sample locale={locale} />
      </div>
    </div>
  );
}

export default PersonalColorSampleShowcase;
