import { useState } from 'react';

import { readableText, type Swatch } from '@/lib/personal-color-tones';
import type { ReportData } from './PersonalColorReport';

type Features = ReportData['features'];

// Flat illustrated face used when no photo is available (samples, or a result reopened from the email link).
export function DrapeAvatar({ features, lipHex, blushHex }: { features: Features; lipHex: string; blushHex: string }) {
  return (
    <svg viewBox="0 0 200 250" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <path d="M48 120 C40 60 70 30 100 30 C130 30 160 60 152 120 L150 175 L50 175 Z" fill={features.hair} />
      <rect x="86" y="150" width="28" height="48" rx="10" fill={features.skin} />
      <rect x="86" y="150" width="28" height="22" fill="#000" opacity="0.08" />
      <ellipse cx="100" cy="112" rx="40" ry="50" fill={features.skin} />
      <path d="M58 100 C60 58 82 44 104 44 C128 44 146 62 142 96 C128 78 104 70 84 72 C72 76 64 86 58 100 Z" fill={features.hair} />
      <path d="M76 101 Q84 97 92 101" stroke={features.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M108 101 Q116 97 124 101" stroke={features.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="84" cy="112" rx="5" ry="5.5" fill={features.eye} />
      <ellipse cx="116" cy="112" rx="5" ry="5.5" fill={features.eye} />
      <circle cx="85.5" cy="110.5" r="1.4" fill="#fff" />
      <circle cx="117.5" cy="110.5" r="1.4" fill="#fff" />
      <ellipse cx="76" cy="130" rx="9" ry="5" fill={blushHex} opacity="0.35" />
      <ellipse cx="124" cy="130" rx="9" ry="5" fill={blushHex} opacity="0.35" />
      <path d="M98 118 Q100 126 103 128" stroke="#000" strokeOpacity="0.12" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M89 141 Q100 148 111 141 Q100 145 89 141 Z" fill={lipHex} stroke={lipHex} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

type StageProps = {
  drape: Swatch;
  features: Features;
  photoUrl?: string;
  capeTop: number;
  lipHex: string;
  blushHex: string;
  caption?: string;
  tone?: 'best' | 'avoid';
};

export function DrapeStage({ drape, features, photoUrl, capeTop, lipHex, blushHex, caption, tone }: StageProps) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-[#E9E6E1] shadow-inner">
      {photoUrl ? (
        <img src={photoUrl} alt="드레이핑 미리보기" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <DrapeAvatar features={features} lipHex={lipHex} blushHex={blushHex} />
      )}
      {/* Light bounced from the drape onto the face is what makes a drape test readable. */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-colors duration-500"
        style={{ background: `radial-gradient(ellipse 55% 45% at 50% 45%, ${drape.hex}66 0%, transparent 70%)` }}
      />
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 w-full transition-all duration-300"
        style={{ height: `${100 - capeTop}%` }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`fold-${drape.hex.slice(1)}`} x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.18" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="#000" stopOpacity="0.05" />
            <stop offset="0.72" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#000" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path d="M0 60 L0 22 C12 10 28 6 38 4 Q50 18 62 4 C72 6 88 10 100 22 L100 60 Z" fill={drape.hex} className="transition-colors duration-500" />
        <path d="M0 60 L0 22 C12 10 28 6 38 4 Q50 18 62 4 C72 6 88 10 100 22 L100 60 Z" fill={`url(#fold-${drape.hex.slice(1)})`} />
      </svg>
      {caption ? (
        <span
          className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow"
          style={{ background: 'rgba(255,255,255,0.92)', color: tone === 'avoid' ? '#be123c' : '#047857' }}
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
}

type Mode = 'best' | 'avoid' | 'compare';

// comparePhotoUrl lets the sample show a second person on the right-hand (worst) stage.
export function DrapeStudio({ report, photoUrl, comparePhotoUrl }: { report: ReportData; photoUrl?: string; comparePhotoUrl?: string }) {
  const [mode, setMode] = useState<Mode>('compare');
  const [index, setIndex] = useState(0);
  const [capeTop, setCapeTop] = useState(photoUrl ? 70 : 72);

  const list = mode === 'avoid' ? report.avoid : report.best;
  const safeIndex = Math.min(index, list.length - 1);
  const pairIndex = Math.min(index, Math.min(report.best.length, report.avoid.length) - 1);
  const stageBase = { features: report.features, photoUrl, capeTop, lipHex: report.lip.hex, blushHex: report.blush.hex };
  const swatches = mode === 'compare' ? report.best.slice(0, report.avoid.length) : list;

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-sky-600">VIRTUAL DRAPING</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">가상 드레이핑 테스트</h4>
          <p className="mt-1 text-xs text-slate-500">진단샵처럼 얼굴 아래에 컬러 천을 대보는 시뮬레이션이에요. 실제 조명에 따라 체감은 달라질 수 있어요.</p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          {([['compare', '베스트 vs 워스트'], ['best', '베스트'], ['avoid', '워스트']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setMode(value); setIndex(0); }}
              className={`rounded-lg px-3 py-1.5 transition ${mode === value ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start">
        {mode === 'compare' ? (
          <div className="grid grid-cols-2 gap-3">
            <DrapeStage {...stageBase} drape={report.best[pairIndex]} caption={`BEST · ${report.best[pairIndex].name}`} tone="best" />
            <DrapeStage {...stageBase} photoUrl={comparePhotoUrl ?? photoUrl} drape={report.avoid[pairIndex]} caption={`WORST · ${report.avoid[pairIndex].name}`} tone="avoid" />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[320px]">
            <DrapeStage {...stageBase} drape={list[safeIndex]} caption={`${mode === 'best' ? 'BEST' : 'WORST'} · ${list[safeIndex].name}`} tone={mode} />
          </div>
        )}

        <div>
          <p className="text-sm font-bold text-slate-900">{mode === 'compare' ? '비교할 컬러 쌍' : '드레이프 컬러'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {swatches.map((item, i) => {
              const active = (mode === 'compare' ? pairIndex : safeIndex) === i;
              return (
                <button
                  key={item.hex + item.name}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-bold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: item.hex }} />
                  {mode === 'compare' ? (
                    <>
                      {item.name}
                      <span className="opacity-50">vs</span>
                      <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: report.avoid[i].hex }} />
                    </>
                  ) : item.name}
                </button>
              );
            })}
          </div>

          <label className="mt-5 block">
            <span className="flex justify-between text-xs font-semibold text-slate-600">
              <span>천 높이</span>
              <span>{photoUrl ? '턱 바로 아래에 맞추면 가장 정확해요' : '일러스트 미리보기'}</span>
            </span>
            <input
              type="range"
              min={45}
              max={85}
              value={capeTop}
              onChange={(event) => setCapeTop(Number(event.target.value))}
              className="mt-2 w-full accent-slate-900"
            />
          </label>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs leading-5">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-900">
              <p className="font-black">베스트 컬러를 대면</p>
              <p className="mt-1">피부가 맑아 보이고 다크서클·잡티가 덜 보이며 윤곽이 또렷해져요.</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-900">
              <p className="font-black">워스트 컬러를 대면</p>
              <p className="mt-1">안색이 칙칙하거나 붉어 보이고, 얼굴보다 옷이 먼저 눈에 들어와요.</p>
            </div>
          </div>
          {mode !== 'compare' ? (
            <p className="mt-3 text-[11px] text-slate-400">
              현재 컬러 <span className="rounded px-1.5 py-0.5 font-mono" style={{ background: list[safeIndex].hex, color: readableText(list[safeIndex].hex) }}>{list[safeIndex].hex}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
