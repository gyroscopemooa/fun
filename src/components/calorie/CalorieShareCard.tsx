import { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

import { saveNodeAsPng } from '@/lib/save-node-as-png';
import { EmojiPlate, MacroDonut, ScoreRing, type CalorieReportData } from './CalorieReport';

type Props = { report: CalorieReportData; photoUrl?: string; onClose: () => void };

// 9:16 story-sized card rendered at 360px wide and exported at 3x (1080x1920).
export function CalorieShareCard({ report, photoUrl, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [includePhoto, setIncludePhoto] = useState(Boolean(photoUrl));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setError('');
    try {
      await saveNodeAsPng(cardRef.current, 'manytool-meal-report.png');
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
        <div className="max-w-full overflow-auto rounded-[20px] shadow-xl">
          <div ref={cardRef} className="relative flex h-[640px] w-[360px] flex-col overflow-hidden bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_45%)] p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-[0.25em] text-emerald-800">MY MEAL REPORT</span>
              <span className="text-[11px] font-bold text-slate-500">ManyTool</span>
            </div>

            <div className="mx-auto mt-5 w-[168px]">
              {includePhoto && photoUrl ? (
                <img src={photoUrl} alt="" className="aspect-square w-full rounded-[28px] object-cover shadow-lg" />
              ) : (
                <EmojiPlate items={report.items} className="text-[19px]" />
              )}
            </div>

            <p className="mt-4 text-center text-[22px] font-black leading-tight text-slate-900">{report.mealName}</p>
            <p className="text-center text-[11px] font-bold text-slate-500">목표 · {report.goalInfo.label}</p>

            <div className="mt-4 flex items-center justify-center gap-5">
              <MacroDonut report={report} size={108} />
              {report.score != null ? <ScoreRing score={report.score} size={96} /> : null}
            </div>

            {report.hasMacros ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([['탄수화물', report.grams.carbs, report.percents.carbs, '#F59E0B'], ['단백질', report.grams.protein, report.percents.protein, '#10B981'], ['지방', report.grams.fat, report.percents.fat, '#F43F5E']] as const).map(([label, g, pct, color]) => (
                  <div key={label} className="rounded-xl bg-white p-2 shadow-sm">
                    <p className="text-[10px] font-bold" style={{ color }}>{label}</p>
                    <p className="text-[15px] font-black text-slate-900">{Math.round(g)}g</p>
                    <p className="text-[10px] font-semibold text-slate-400">{pct}%</p>
                  </div>
                ))}
              </div>
            ) : null}

            {report.swaps[0] ? (
              <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-[11px] leading-4 text-emerald-900">
                <span className="font-black">SWAP</span> {report.swaps[0].from} → {report.swaps[0].to}
                {report.swaps[0].saved > 0 ? <span className="font-black"> (-{report.swaps[0].saved} kcal)</span> : null}
              </div>
            ) : null}

            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[10px] font-semibold text-slate-500">AI 칼로리 계산기</span>
              <span className="text-[10px] font-bold text-slate-700">manytool.net/ai-calorie-calculator</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3">
          {photoUrl ? (
            <label className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={includePhoto} onChange={(event) => setIncludePhoto(event.target.checked)} className="h-4 w-4 accent-slate-900" />
              음식 사진 포함하기
            </label>
          ) : null}
          <p className="text-xs leading-5 text-slate-500">카드는 내 기기에서만 만들어지고 서버로 전송되지 않아요.</p>
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
