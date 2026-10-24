import { useMemo, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';

import {
  SEASONS,
  TONES,
  TONE_MAP,
  isToneId,
  readableText,
  resolveToneId,
  type Swatch,
  type ToneInfo
} from '@/lib/personal-color-tones';
import { DrapeStudio } from './DrapeStudio';
import { PersonalColorShareCard } from './PersonalColorShareCard';
import { ShareLinkButton } from '@/components/share/ShareLinkButton';

type RawSwatch = { name?: string; hex?: string; use?: string; reason?: string };

export type PersonalColorAnalysis = {
  version?: number;
  summary?: string;
  confidence?: string;
  toneId?: string;
  runnerUpToneId?: string;
  matchPercent?: number;
  season?: string;
  secondaryTone?: string;
  undertone?: string;
  chroma?: string;
  contrast?: string;
  warmthScore?: number;
  brightnessScore?: number;
  saturationScore?: number;
  contrastScore?: number;
  featureColors?: { skin?: string; hair?: string; eye?: string };
  photoCheck?: { score?: number; lighting?: string; issues?: string[] };
  signatureKeywords?: string[];
  bestPalette?: RawSwatch[];
  avoidPalette?: RawSwatch[];
  bestColors?: string[];
  avoidColors?: string[];
  makeup?: { base?: string; lip?: string; lipHex?: string; blush?: string; blushHex?: string; eye?: string; eyeHex?: string };
  hair?: { best?: string; bestHex?: string; avoid?: string };
  stylingTips?: string[];
  cautions?: string[];
};

export type ReportData = ReturnType<typeof toReport>;

const HEX = /^#[0-9A-F]{6}$/i;
const hexOr = (value: string | undefined, fallback: string) => (value && HEX.test(value) ? value.toUpperCase() : fallback);

const defaultSkin: Record<string, string> = { '봄 웜': '#F1CDB0', '여름 쿨': '#EBC8BC', '가을 웜': '#D9AD8C', '겨울 쿨': '#E3BFB0' };

const toSwatches = (raw: RawSwatch[] | undefined, fallback: Swatch[], noteKey: 'use' | 'reason') => {
  const list = (raw ?? [])
    .filter((item) => item?.name && item.hex && HEX.test(item.hex))
    .map((item) => ({ name: item.name as string, hex: (item.hex as string).toUpperCase(), note: item[noteKey] || undefined }));
  return list.length >= 3 ? list : fallback;
};

const clamp = (value: number | undefined, fallback = 50) => (Number.isFinite(value) ? Math.max(0, Math.min(100, Number(value))) : fallback);

// Normalizes both v2 (12-tone, hex) and older v1 results into one render-ready shape.
export const toReport = (analysis: PersonalColorAnalysis) => {
  const tone = TONE_MAP[resolveToneId(analysis.toneId, analysis.season, analysis.secondaryTone)];
  const runnerUp = isToneId(analysis.runnerUpToneId) && analysis.runnerUpToneId !== tone.id ? TONE_MAP[analysis.runnerUpToneId] : null;
  return {
    tone,
    runnerUp,
    matchPercent: analysis.matchPercent ? clamp(analysis.matchPercent) : null,
    summary: analysis.summary || tone.tagline,
    confidence: analysis.confidence,
    undertone: analysis.undertone,
    chroma: analysis.chroma,
    contrast: analysis.contrast,
    axes: {
      warmth: clamp(analysis.warmthScore),
      brightness: clamp(analysis.brightnessScore),
      saturation: clamp(analysis.saturationScore),
      contrast: clamp(analysis.contrastScore)
    },
    features: {
      skin: hexOr(analysis.featureColors?.skin, defaultSkin[tone.season]),
      hair: hexOr(analysis.featureColors?.hair, '#3B2A22'),
      eye: hexOr(analysis.featureColors?.eye, '#3A2A20')
    },
    photoCheck: analysis.photoCheck?.score != null ? analysis.photoCheck : null,
    keywords: analysis.signatureKeywords ?? [],
    best: toSwatches(analysis.bestPalette, tone.best, 'use'),
    avoid: toSwatches(analysis.avoidPalette, tone.avoid, 'reason'),
    lip: { ...tone.lip, hex: hexOr(analysis.makeup?.lipHex, tone.lip.hex), note: analysis.makeup?.lip },
    blush: { ...tone.blush, hex: hexOr(analysis.makeup?.blushHex, tone.blush.hex), note: analysis.makeup?.blush },
    eye: { ...tone.eye, hex: hexOr(analysis.makeup?.eyeHex, tone.eye.hex), note: analysis.makeup?.eye },
    base: analysis.makeup?.base,
    hairBest: { ...tone.hair[0], hex: hexOr(analysis.hair?.bestHex, tone.hair[0].hex), note: analysis.hair?.best },
    hairAvoid: analysis.hair?.avoid,
    tips: analysis.stylingTips ?? [],
    cautions: analysis.cautions ?? []
  };
};

const confidenceLabel: Record<string, string> = { low: '낮음', medium: '보통', high: '높음' };

const gradientOf = (swatches: Swatch[]) => `linear-gradient(135deg, ${swatches.slice(0, 3).map((item) => item.hex).join(', ')})`;

function MatchRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0 self-end sm:h-24 sm:w-24 sm:self-auto">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-900">{Math.round(value)}%</span>
        <span className="text-[10px] font-semibold text-slate-600">일치도</span>
      </div>
    </div>
  );
}

function SwatchTile({ swatch, onCopy, copied, avoid = false }: { swatch: Swatch; onCopy: (hex: string) => void; copied: boolean; avoid?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(swatch.hex)}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      title={`${swatch.hex} 복사`}
    >
      <div className="relative flex h-20 items-end justify-end p-2" style={{ background: swatch.hex }}>
        {avoid ? (
          <span className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-rose-600">
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold opacity-0 transition group-hover:opacity-100"
          style={{ color: readableText(swatch.hex), background: 'rgba(0,0,0,0.12)' }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? '복사됨' : 'HEX'}
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-bold text-slate-900">{swatch.name}</p>
        <p className="font-mono text-[11px] text-slate-500">{swatch.hex}</p>
        {swatch.note ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600">{swatch.note}</p> : null}
      </div>
    </button>
  );
}

function ToneMap({ current, runnerUp }: { current: ToneInfo; runnerUp: ToneInfo | null }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SEASONS.map((season) => (
        <div key={season} className="space-y-2">
          <p className="text-center text-xs font-bold text-slate-500">{season}</p>
          {TONES.filter((item) => item.season === season).map((item) => {
            const isCurrent = item.id === current.id;
            const isRunner = item.id === runnerUp?.id;
            return (
              <div
                key={item.id}
                className={`relative flex h-16 flex-col justify-end rounded-xl p-2 transition sm:h-20 ${isCurrent ? 'ring-4 ring-slate-900 ring-offset-2' : isRunner ? 'outline-2 outline-offset-2 outline-dashed outline-slate-500' : 'opacity-60'}`}
                style={{ background: gradientOf(item.best) }}
              >
                {isCurrent || isRunner ? (
                  <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isCurrent ? 'bg-slate-900 text-white' : 'bg-white/90 text-slate-700'}`}>
                    {isCurrent ? 'MY' : '2순위'}
                  </span>
                ) : null}
                <span className="rounded-md bg-white/85 px-1.5 py-0.5 text-center text-[11px] font-bold text-slate-800">{item.sub}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const axisDefs = [
  { key: 'warmth', label: '웜감', left: '쿨', right: '웜', gradient: 'linear-gradient(90deg,#7FA7E8,#E9E4DC,#F2A04E)' },
  { key: 'brightness', label: '명도', left: '어두움', right: '밝음', gradient: 'linear-gradient(90deg,#2B2B33,#9C958C,#F7F2EA)' },
  { key: 'saturation', label: '채도', left: '탁함', right: '선명함', gradient: 'linear-gradient(90deg,#A8A29E,#C98B95,#F43F5E)' },
  { key: 'contrast', label: '대비감', left: '부드러움', right: '강함', gradient: 'linear-gradient(90deg,#E7E5E4,#8B8580,#111827)' }
] as const;

function AxisBars({ axes }: { axes: ReportData['axes'] }) {
  return (
    <div className="space-y-4">
      {axisDefs.map((axis) => (
        <div key={axis.key}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{axis.left}</span>
            <span className="text-sm font-bold text-slate-900">{axis.label} {Math.round(axes[axis.key])}</span>
            <span>{axis.right}</span>
          </div>
          <div className="relative mt-1.5 h-3 rounded-full" style={{ background: axis.gradient }}>
            <span
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-md"
              style={{ left: `${axes[axis.key]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Dot({ swatch, label }: { swatch: Swatch; label: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 h-11 w-11 shrink-0 rounded-full border-4 border-white shadow-md" style={{ background: swatch.hex }} />
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-900">
          {swatch.name} <span className="font-mono text-[11px] font-medium text-slate-400">{swatch.hex}</span>
        </p>
        {swatch.note ? <p className="mt-0.5 text-xs leading-5 text-slate-600">{swatch.note}</p> : null}
      </div>
    </div>
  );
}

type Props = { analysis: PersonalColorAnalysis; photoUrl?: string; comparePhotoUrl?: string; sample?: boolean };

export function PersonalColorReport({ analysis, photoUrl, comparePhotoUrl, sample = false }: Props) {
  const report = useMemo(() => toReport(analysis), [analysis]);
  const [copiedHex, setCopiedHex] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const { tone } = report;

  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      window.setTimeout(() => setCopiedHex(''), 1400);
    } catch {
      setCopiedHex('');
    }
  };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] p-5 sm:p-6" style={{ background: gradientOf(report.best) }}>
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />
        <div className="relative flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                {sample ? '샘플 리포트' : 'MY PERSONAL COLOR'}
              </span>
              {report.confidence ? (
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">신뢰도 {confidenceLabel[report.confidence] ?? report.confidence}</span>
              ) : null}
            </div>
            <p className="mt-4 text-sm font-bold tracking-[0.2em] text-slate-600">{tone.english.toUpperCase()}</p>
            <h3 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{tone.label}</h3>
            {report.runnerUp ? (
              <p className="mt-1 text-sm font-semibold text-slate-600">2순위 · {report.runnerUp.label}</p>
            ) : null}
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-800">{report.summary}</p>
            {report.keywords.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {report.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700">#{keyword}</span>
                ))}
              </div>
            ) : null}
          </div>
          {report.matchPercent ? <MatchRing value={report.matchPercent} /> : null}
        </div>
        <div className="relative mt-5 flex h-10 overflow-hidden rounded-2xl shadow-sm">
          {report.best.map((item) => <span key={item.hex + item.name} className="flex-1" style={{ background: item.hex }} title={item.name} />)}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShareOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            결과 카드 저장
          </button>
          <ShareLinkButton
            url={`/personal-color/result/${tone.id}`}
            title={`내 퍼스널컬러는 ${tone.label}`}
            text="나도 퍼스널컬러 진단해 보기"
            label="결과 링크 공유"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
          />
          {[report.undertone, report.chroma, report.contrast].filter(Boolean).map((term) => (
            <span key={term} className="inline-flex items-center rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-slate-700">{term}</span>
          ))}
        </div>
      </section>

      {shareOpen ? <PersonalColorShareCard report={report} photoUrl={photoUrl} onClose={() => setShareOpen(false)} /> : null}

      <DrapeStudio report={report} photoUrl={photoUrl} comparePhotoUrl={comparePhotoUrl} />

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-emerald-600">BEST PALETTE</p>
            <h4 className="mt-1 text-lg font-black text-slate-900">나에게 어울리는 컬러 8</h4>
          </div>
          <p className="text-xs text-slate-500">칩을 누르면 HEX 코드가 복사돼요</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {report.best.map((item) => (
            <SwatchTile key={item.hex + item.name} swatch={item} onCopy={copyHex} copied={copiedHex === item.hex} />
          ))}
        </div>
        <p className="mt-6 text-xs font-bold tracking-[0.16em] text-rose-600">AVOID</p>
        <h4 className="mt-1 text-lg font-black text-slate-900">피하면 좋은 컬러</h4>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {report.avoid.map((item) => (
            <SwatchTile key={item.hex + item.name} swatch={item} onCopy={copyHex} copied={copiedHex === item.hex} avoid />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-violet-600">12 TONE MAP</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">12톤 중 내 위치</h4>
          <div className="mt-4">
            <ToneMap current={tone} runnerUp={report.runnerUp} />
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-amber-600">DIAGNOSIS</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">진단 축 분석</h4>
          <div className="mt-4">
            <AxisBars axes={report.axes} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {([['피부', report.features.skin], ['헤어', report.features.hair], ['눈동자', report.features.eye]] as const).map(([label, hex]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-2 text-center">
                <span className="mx-auto block h-9 w-9 rounded-full border-2 border-white shadow" style={{ background: hex }} />
                <p className="mt-1 text-xs font-bold text-slate-800">{label}</p>
                <p className="font-mono text-[10px] text-slate-500">{hex}</p>
              </div>
            ))}
          </div>
          {report.photoCheck ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              <strong className="text-slate-800">사진 신뢰도 {Math.round(report.photoCheck.score ?? 0)}점</strong>
              {report.photoCheck.lighting ? ` · ${report.photoCheck.lighting}` : ''}
              {report.photoCheck.issues?.length ? ` · ${report.photoCheck.issues.join(', ')}` : ''}
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[24px] border border-rose-100 bg-rose-50/60 p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-rose-600">MAKEUP</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">메이크업 컬러</h4>
          <div className="mt-4 space-y-4">
            <Dot swatch={report.lip} label="립" />
            <Dot swatch={report.blush} label="블러셔" />
            <Dot swatch={report.eye} label="아이" />
          </div>
          {report.base ? <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600"><strong className="text-slate-800">베이스</strong> · {report.base}</p> : null}
        </section>
        <section className="rounded-[24px] border border-violet-100 bg-violet-50/60 p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-violet-600">HAIR</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">헤어 컬러</h4>
          <div className="mt-4 space-y-4">
            <Dot swatch={report.hairBest} label="추천" />
            <Dot swatch={tone.hair[1]} label="대안" />
          </div>
          {report.hairAvoid ? <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600"><strong className="text-slate-800">피할 컬러</strong> · {report.hairAvoid}</p> : null}
        </section>
      </div>

      {report.tips.length || report.cautions.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h4 className="text-sm font-black text-slate-900">스타일링 팁</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {report.tips.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}
            </ul>
          </section>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h4 className="text-sm font-black text-slate-900">주의 포인트</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {report.cautions.map((item) => <li key={item} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>)}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default PersonalColorReport;
