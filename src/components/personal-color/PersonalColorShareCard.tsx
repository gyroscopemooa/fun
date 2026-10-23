import { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

import { saveNodeAsPng } from '@/lib/save-node-as-png';
import { DrapeStage } from './DrapeStudio';
import type { ReportData } from './PersonalColorReport';

type Props = { report: ReportData; photoUrl?: string; onClose: () => void };

// 9:16 story-sized card rendered at 360px wide and exported at 3x (1080x1920).
export function PersonalColorShareCard({ report, photoUrl, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [includePhoto, setIncludePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { tone } = report;

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setError('');
    try {
      await saveNodeAsPng(cardRef.current, `manytool-personal-color-${tone.id}.png`);
    } catch {
      setError('이미지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-black text-slate-900">결과 카드 저장</h4>
          <p className="text-xs text-slate-500">인스타 스토리 크기(1080×1920) PNG로 저장돼요.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-200" aria-label="닫기">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-start">
        <div className="max-w-full overflow-auto rounded-[20px] shadow-xl max-[419px]:[zoom:0.8]">
          <div ref={cardRef} className="relative flex h-[640px] w-[360px] flex-col overflow-hidden bg-white p-6" style={{ fontFamily: 'inherit' }}>
            <div className="absolute inset-x-0 top-0 h-[260px]" style={{ background: `linear-gradient(160deg, ${report.best[0].hex}, ${report.best[2]?.hex ?? report.best[1].hex})`, opacity: 0.35 }} />
            <div className="relative flex items-center justify-between">
              <span className="text-[11px] font-black tracking-[0.25em] text-slate-700">MY PERSONAL COLOR</span>
              <span className="text-[11px] font-bold text-slate-500">ManyTool</span>
            </div>

            <div className="relative mt-5 flex items-center gap-4">
              {includePhoto && photoUrl ? (
                <div className="w-[104px] shrink-0">
                  <DrapeStage drape={report.best[0]} features={report.features} photoUrl={photoUrl} lipHex={report.lip.hex} blushHex={report.blush.hex} />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.2em] text-slate-600">{tone.english.toUpperCase()}</p>
                <p className="mt-1 text-[34px] font-black leading-[1.05] text-slate-900">{tone.label}</p>
                {report.matchPercent ? <p className="mt-1 text-xs font-bold text-slate-600">일치도 {Math.round(report.matchPercent)}%{report.runnerUp ? ` · 2순위 ${report.runnerUp.label}` : ''}</p> : null}
              </div>
            </div>
            <p className="relative mt-3 text-[12px] leading-5 text-slate-700">{tone.tagline}</p>

            <p className="relative mt-5 text-[10px] font-black tracking-[0.2em] text-emerald-700">BEST COLORS</p>
            <div className="relative mt-2 grid grid-cols-4 gap-2">
              {report.best.slice(0, 8).map((item) => (
                <div key={item.hex + item.name}>
                  <div className="h-12 rounded-xl border border-black/5" style={{ background: item.hex }} />
                  <p className="mt-1 truncate text-[9.5px] font-bold text-slate-700">{item.name}</p>
                </div>
              ))}
            </div>

            <p className="relative mt-4 text-[10px] font-black tracking-[0.2em] text-rose-700">AVOID</p>
            <div className="relative mt-2 flex gap-2">
              {report.avoid.slice(0, 4).map((item) => (
                <div key={item.hex + item.name} className="flex-1">
                  <div className="relative h-7 rounded-lg border border-black/5" style={{ background: item.hex }}>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white/80 [text-shadow:0_0_3px_rgba(0,0,0,0.5)]">×</span>
                  </div>
                  <p className="mt-1 truncate text-[9.5px] font-bold text-slate-600">{item.name}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-4 grid grid-cols-4 gap-2">
              {([['립', report.lip], ['블러셔', report.blush], ['아이', report.eye], ['헤어', report.hairBest]] as const).map(([label, swatch]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-2 text-center">
                  <span className="mx-auto block h-7 w-7 rounded-full border-2 border-white shadow" style={{ background: swatch.hex }} />
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">{label}</p>
                  <p className="truncate text-[9.5px] font-bold text-slate-800">{swatch.name}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[10px] font-semibold text-slate-500">AI 퍼스널컬러 자가진단</span>
              <span className="text-[10px] font-bold text-slate-700">manytool.net/ai-personal-color</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3">
          {photoUrl ? (
            <label className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={includePhoto} onChange={(event) => setIncludePhoto(event.target.checked)} className="h-4 w-4 accent-slate-900" />
              내 사진 포함하기
            </label>
          ) : null}
          <p className="text-xs leading-5 text-slate-500">기본값은 사진 없이 컬러 결과만 담겨요. 사진은 내 기기에서만 합성되고 서버로 전송되지 않아요.</p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {saving ? '이미지 만드는 중…' : 'PNG로 저장'}
          </button>
          {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
