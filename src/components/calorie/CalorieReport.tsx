import { useMemo, useState } from 'react';
import { ArrowRight, Check, Download, Lightbulb } from 'lucide-react';

import { CalorieShareCard } from './CalorieShareCard';

export type CalorieGoal = 'lose' | 'maintain' | 'gain';

export type CalorieAnalysis = {
  version?: number;
  goal?: string;
  isFood?: boolean;
  mealName?: string;
  summary?: string;
  confidence?: string;
  totalCalories?: number;
  calorieRange?: { min?: number; max?: number };
  macros?: { carbsG?: number; proteinG?: number; fatG?: number; fiberG?: number; sugarG?: number; sodiumMg?: number };
  foodItems?: {
    name?: string;
    emoji?: string;
    estimatedPortion?: string;
    grams?: number;
    estimatedCalories?: number;
    carbsG?: number;
    proteinG?: number;
    fatG?: number;
    confidence?: string;
  }[];
  mealScore?: number;
  scoreBreakdown?: Record<'balance' | 'protein' | 'fiber' | 'sodiumSugar', { score?: number; comment?: string } | undefined>;
  highlights?: string[];
  improvements?: string[];
  swaps?: { from?: string; to?: string; caloriesSaved?: number; reason?: string }[];
  notes?: string[];
};

export const GOALS: Record<CalorieGoal, { label: string; daily: number; target: Record<'carbs' | 'protein' | 'fat', [number, number]> }> = {
  lose: { label: '체중 감량', daily: 1600, target: { carbs: [40, 55], protein: [25, 35], fat: [20, 30] } },
  maintain: { label: '체중 유지', daily: 2000, target: { carbs: [50, 60], protein: [15, 25], fat: [20, 30] } },
  gain: { label: '근력 증가', daily: 2600, target: { carbs: [45, 55], protein: [25, 35], fat: [20, 30] } }
};

// Daily reference values used for the per-meal badges.
const DAILY = { fiberG: 25, sugarG: 50, sodiumMg: 2000 };

const MACRO_META = {
  carbs: { label: '탄수화물', color: '#F59E0B', perGram: 4 },
  protein: { label: '단백질', color: '#10B981', perGram: 4 },
  fat: { label: '지방', color: '#F43F5E', perGram: 9 }
} as const;

const confidenceLabel: Record<string, string> = { low: '낮음', medium: '보통', high: '높음' };

const n = (value: number | undefined) => (Number.isFinite(value) ? Number(value) : 0);

export const gradeOf = (score: number) => (score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D');
const gradeColor = (score: number) => (score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#E11D48');

export const toCalorieReport = (analysis: CalorieAnalysis) => {
  const goal: CalorieGoal = analysis.goal === 'lose' || analysis.goal === 'gain' ? analysis.goal : 'maintain';
  const items = (analysis.foodItems ?? []).map((item) => ({
    name: item.name || '음식',
    emoji: item.emoji || '🍽️',
    portion: item.estimatedPortion || '',
    grams: n(item.grams),
    kcal: n(item.estimatedCalories),
    carbs: n(item.carbsG),
    protein: n(item.proteinG),
    fat: n(item.fatG),
    confidence: item.confidence
  }));
  const total = n(analysis.totalCalories) || items.reduce((sum, item) => sum + item.kcal, 0);
  // v1 results had no macros, so fall back to the item sums (zero when those are missing too).
  const grams = {
    carbs: n(analysis.macros?.carbsG) || items.reduce((sum, item) => sum + item.carbs, 0),
    protein: n(analysis.macros?.proteinG) || items.reduce((sum, item) => sum + item.protein, 0),
    fat: n(analysis.macros?.fatG) || items.reduce((sum, item) => sum + item.fat, 0)
  };
  const macroKcal = grams.carbs * 4 + grams.protein * 4 + grams.fat * 9;
  const percent = (key: keyof typeof grams) => (macroKcal ? Math.round((grams[key] * MACRO_META[key].perGram * 100) / macroKcal) : 0);
  const score = analysis.mealScore != null ? Math.round(n(analysis.mealScore)) : null;

  return {
    goal,
    goalInfo: GOALS[goal],
    mealName: analysis.mealName || '분석한 식사',
    summary: analysis.summary || '',
    confidence: analysis.confidence,
    total: Math.round(total),
    range: { min: Math.round(n(analysis.calorieRange?.min) || total * 0.85), max: Math.round(n(analysis.calorieRange?.max) || total * 1.15) },
    dailyPercent: Math.round((total / GOALS[goal].daily) * 100),
    grams,
    hasMacros: macroKcal > 0,
    percents: { carbs: percent('carbs'), protein: percent('protein'), fat: percent('fat') },
    fiber: n(analysis.macros?.fiberG),
    sugar: n(analysis.macros?.sugarG),
    sodium: n(analysis.macros?.sodiumMg),
    items,
    score,
    breakdown: analysis.scoreBreakdown
      ? ([
        ['영양 균형', analysis.scoreBreakdown.balance],
        ['단백질', analysis.scoreBreakdown.protein],
        ['채소·식이섬유', analysis.scoreBreakdown.fiber],
        ['나트륨·당 관리', analysis.scoreBreakdown.sodiumSugar]
      ] as const).map(([label, value]) => ({ label, score: Math.round(n(value?.score)), comment: value?.comment || '' }))
      : [],
    highlights: analysis.highlights ?? [],
    improvements: analysis.improvements ?? [],
    swaps: (analysis.swaps ?? []).filter((item) => item.from && item.to).map((item) => ({
      from: item.from as string,
      to: item.to as string,
      saved: Math.round(n(item.caloriesSaved)),
      reason: item.reason || ''
    })),
    burn: [
      { label: '빠르게 걷기', emoji: '🚶', minutes: Math.round(total / 4.5) },
      { label: '자전거', emoji: '🚴', minutes: Math.round(total / 7) },
      { label: '달리기', emoji: '🏃', minutes: Math.round(total / 10) }
    ],
    notes: analysis.notes ?? []
  };
};

export type CalorieReportData = ReturnType<typeof toCalorieReport>;

export function ScoreRing({ score, size = 104 }: { score: number; size?: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = gradeColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none" style={{ color }}>{gradeOf(score)}</span>
        <span className="mt-1 text-[11px] font-bold text-slate-500">{score}점</span>
      </div>
    </div>
  );
}

export function MacroDonut({ report, size = 150 }: { report: CalorieReportData; size?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F1F5F9" strokeWidth="12" />
        {(['carbs', 'protein', 'fat'] as const).map((key) => {
          const length = (report.percents[key] / 100) * c;
          const dash = <circle key={key} cx="40" cy="40" r={r} fill="none" stroke={MACRO_META[key].color} strokeWidth="12" strokeDasharray={`${length} ${c}`} strokeDashoffset={-offset} />;
          offset += length;
          return dash;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-900">{report.total}</span>
        <span className="text-[11px] font-bold text-slate-500">kcal</span>
      </div>
    </div>
  );
}

// Illustrated plate built from the item emojis, used for samples and when no photo is kept.
export function EmojiPlate({ items, className = '' }: { items: CalorieReportData['items']; className?: string }) {
  const shown = items.slice(0, 5);
  const positions = [[50, 50], [28, 34], [72, 34], [30, 70], [70, 70]];
  return (
    <div className={`relative aspect-square rounded-full bg-[radial-gradient(circle,#ffffff_0%,#ffffff_58%,#e2e8f0_60%,#f8fafc_72%)] shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${className}`}>
      {shown.map((item, i) => (
        <span
          key={item.name + i}
          className="absolute -translate-x-1/2 -translate-y-1/2 leading-none"
          style={{ left: `${positions[i][0]}%`, top: `${positions[i][1]}%`, fontSize: i === 0 ? '2.6em' : '1.9em' }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

function Meter({ label, value, unit, daily, invert = false }: { label: string; value: number; unit: string; daily: number; invert?: boolean }) {
  const pct = Math.round((value / daily) * 100);
  // For sodium/sugar a high share of the daily value is bad; for fiber it is good.
  const tone = invert ? (pct >= 50 ? 'text-rose-600' : pct >= 33 ? 'text-amber-600' : 'text-emerald-600') : (pct >= 33 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-rose-600');
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{Math.round(value).toLocaleString()}<span className="ml-0.5 text-xs font-bold text-slate-500">{unit}</span></p>
      <p className={`text-[11px] font-bold ${tone}`}>하루 권장의 {pct}%</p>
    </div>
  );
}

type Props = { analysis: CalorieAnalysis; photoUrl?: string; sample?: boolean };

export function CalorieReport({ analysis, photoUrl, sample = false }: Props) {
  const report = useMemo(() => toCalorieReport(analysis), [analysis]);
  const [shareOpen, setShareOpen] = useState(false);
  const maxItemKcal = Math.max(1, ...report.items.map((item) => item.kcal));

  if (analysis.isFood === false || (!report.items.length && !report.total)) {
    return (
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-6">
        <p className="text-3xl">🔍</p>
        <h3 className="mt-2 text-xl font-black text-amber-950">사진에서 음식을 찾지 못했어요</h3>
        {report.summary ? <p className="mt-2 text-sm leading-6 text-amber-900">{report.summary}</p> : null}
        {report.improvements.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {report.improvements.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
        <p className="mt-3 text-xs text-amber-800">음식이 잘 보이는 사진으로 다시 올려 주세요.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#fff7ed_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-44">
            {photoUrl ? (
              <img src={photoUrl} alt="분석한 식사 사진" className="aspect-square w-full rounded-[28px] bg-white object-contain shadow-lg" />
            ) : (
              <EmojiPlate items={report.items} className="text-[18px] sm:text-[20px]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{sample ? '샘플 리포트' : 'MY MEAL REPORT'}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">목표 · {report.goalInfo.label}</span>
              {report.confidence ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">신뢰도 {confidenceLabel[report.confidence] ?? report.confidence}</span> : null}
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{report.mealName}</h3>
            <p className="mt-1 text-4xl font-black tracking-tight text-emerald-700">
              {report.total.toLocaleString()}<span className="ml-1 text-lg">kcal</span>
            </p>
            <p className="text-xs font-semibold text-slate-500">추정 범위 {report.range.min.toLocaleString()} ~ {report.range.max.toLocaleString()} kcal</p>
            <div className="mt-3 max-w-md">
              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                <span>하루 목표 {report.goalInfo.daily.toLocaleString()} kcal 중</span>
                <span className={report.dailyPercent > 45 ? 'text-rose-600' : 'text-emerald-700'}>{report.dailyPercent}%</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, report.dailyPercent)}%` }} />
              </div>
            </div>
          </div>
          {report.score != null ? (
            <div className="flex flex-col items-center gap-1 self-center">
              <ScoreRing score={report.score} />
              <span className="text-xs font-bold text-slate-500">식단 점수</span>
            </div>
          ) : null}
        </div>
        {report.summary ? <p className="mt-4 text-sm leading-6 text-slate-700">{report.summary}</p> : null}
        <button
          type="button"
          onClick={() => setShareOpen((prev) => !prev)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
        >
          <Download className="h-4 w-4" />
          결과 카드 저장
        </button>
      </section>

      {shareOpen ? <CalorieShareCard report={report} photoUrl={photoUrl} onClose={() => setShareOpen(false)} /> : null}

      {report.hasMacros ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-amber-600">MACROS</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">탄단지 비율</h4>
          <div className="mt-4 flex flex-col items-center gap-6 md:flex-row md:items-start">
            <MacroDonut report={report} />
            <div className="w-full flex-1 space-y-4">
              {(['carbs', 'protein', 'fat'] as const).map((key) => {
                const [lo, hi] = report.goalInfo.target[key];
                const pct = report.percents[key];
                const status = pct < lo ? '부족' : pct > hi ? '많음' : '적정';
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-bold text-slate-900">
                        <span className="h-3 w-3 rounded-full" style={{ background: MACRO_META[key].color }} />
                        {MACRO_META[key].label} {Math.round(report.grams[key])}g
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {pct}% <span className={status === '적정' ? 'text-emerald-600' : 'text-rose-600'}>· {status}</span>
                      </span>
                    </div>
                    <div className="relative mt-1.5 h-3 rounded-full bg-slate-100">
                      <div className="absolute inset-y-0 rounded-full bg-emerald-100" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full opacity-90" style={{ width: `${Math.min(100, pct)}%`, background: MACRO_META[key].color }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-slate-400">연두색 구간은 '{report.goalInfo.label}' 목표 기준 권장 비율이에요.</p>
            </div>
          </div>
          {report.fiber || report.sugar || report.sodium ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Meter label="식이섬유" value={report.fiber} unit="g" daily={DAILY.fiberG} />
              <Meter label="당류" value={report.sugar} unit="g" daily={DAILY.sugarG} invert />
              <Meter label="나트륨" value={report.sodium} unit="mg" daily={DAILY.sodiumMg} invert />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold tracking-[0.16em] text-sky-600">FOODS</p>
        <h4 className="mt-1 text-lg font-black text-slate-900">음식별 분석</h4>
        <div className="mt-4 space-y-2">
          {report.items.map((item, i) => (
            <div key={item.name + i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                  <p className="shrink-0 text-sm font-black text-slate-900">{Math.round(item.kcal)} kcal</p>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {item.portion}{item.grams ? ` · 약 ${Math.round(item.grams)}g` : ''}
                  {item.carbs || item.protein || item.fat ? ` · 탄 ${Math.round(item.carbs)} / 단 ${Math.round(item.protein)} / 지 ${Math.round(item.fat)}g` : ''}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(item.kcal / maxItemKcal) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {report.breakdown.length ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold tracking-[0.16em] text-emerald-600">SCORE</p>
            <h4 className="mt-1 text-lg font-black text-slate-900">식단 점수 상세</h4>
            <div className="mt-4 space-y-4">
              {report.breakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm font-bold text-slate-900">
                    <span>{item.label}</span>
                    <span style={{ color: gradeColor(item.score) }}>{item.score}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: gradeColor(item.score) }} />
                  </div>
                  {item.comment ? <p className="mt-1 text-xs leading-5 text-slate-500">{item.comment}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-violet-600">BURN IT</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">이만큼 움직이면 소모돼요</h4>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {report.burn.map((item) => (
              <div key={item.label} className="rounded-2xl bg-violet-50 p-3 text-center">
                <p className="text-2xl">{item.emoji}</p>
                <p className="mt-1 text-lg font-black text-violet-900">{item.minutes}<span className="text-xs">분</span></p>
                <p className="text-[11px] font-semibold text-violet-700">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">체중 60kg 성인 기준 대략적인 시간이에요.</p>
        </section>
      </div>

      {report.swaps.length ? (
        <section className="rounded-[24px] border border-emerald-100 bg-emerald-50/50 p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-emerald-700">SMART SWAP</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">이렇게 바꿔 보세요</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {report.swaps.map((swap) => (
              <div key={swap.from + swap.to} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                  <span className="text-slate-400 line-through decoration-rose-400">{swap.from}</span>
                  <ArrowRight className="h-4 w-4 text-emerald-600" />
                  <span className="text-slate-900">{swap.to}</span>
                </div>
                {swap.saved > 0 ? <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">-{swap.saved} kcal</p> : null}
                {swap.reason ? <p className="mt-2 text-xs leading-5 text-slate-600">{swap.reason}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.highlights.length || report.improvements.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h4 className="text-sm font-black text-slate-900">잘한 점</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {report.highlights.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}
            </ul>
          </section>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h4 className="text-sm font-black text-slate-900">다음 끼니 팁</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {report.improvements.map((item) => <li key={item} className="flex gap-2"><Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber-500" />{item}</li>)}
            </ul>
          </section>
        </div>
      ) : null}

      {report.notes.length ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <h4 className="text-sm font-black text-amber-900">추정 시 참고</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {report.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default CalorieReport;
