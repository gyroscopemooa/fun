import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

import { saveNodeAsPng } from '@/lib/save-node-as-png';

type Pillar = 'year' | 'month' | 'day' | 'hour';
type ScoreBlock = { score?: number };

type SajuAnalysis = {
  profile?: {
    name?: string | null;
    solarDate?: { year: number; month: number; day: number };
    birthTime?: string;
    dayMaster?: string;
    pillars?: { korean?: Record<Pillar, string>; hanja?: Record<Pillar, { hanja?: string }> };
    elementSummary?: { items?: { label: string; count: number }[]; balanceScore?: number };
  };
  report?: {
    headline?: string;
    keywords?: string[];
    yearlyFlow?: ScoreBlock;
    baseCategories?: Record<string, ScoreBlock>;
  };
};

type ResultDetail = { analysis: SajuAnalysis; sample?: boolean } | null;

declare global {
  interface WindowEventMap {
    'manytool:ai-manseryeok-result': CustomEvent<ResultDetail>;
  }
}

const PILLAR_ORDER: { key: Pillar; label: string }[] = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' }
];

const ELEMENT_COLORS: Record<string, string> = { 목: '#59DE9B', 화: '#F87171', 토: '#E9C349', 금: '#D4D4D8', 수: '#60A5FA' };

const CATEGORY_LABELS: Record<string, string> = {
  love: '연애운', marriage: '결혼운', money: '재물운', business: '사업운', career: '직업운',
  study: '학업운', health: '건강운', social: '대인운', benefactor: '귀인운'
};

// Listens for results rendered by the inline script in ai-manseryeok.astro and offers a 1080x1920 card.
export function ManseryeokShareCard() {
  const [detail, setDetail] = useState<ResultDetail>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showName, setShowName] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (event: WindowEventMap['manytool:ai-manseryeok-result']) => {
      setDetail(event.detail ?? null);
      setOpen(false);
    };
    window.addEventListener('manytool:ai-manseryeok-result', handle);
    return () => window.removeEventListener('manytool:ai-manseryeok-result', handle);
  }, []);

  const profile = detail?.analysis.profile;
  const report = detail?.analysis.report;
  if (!profile || !report) return null;

  const topCategories = Object.entries(report.baseCategories ?? {})
    .filter(([key, value]) => CATEGORY_LABELS[key] && typeof value?.score === 'number')
    .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
    .slice(0, 3);
  const maxCount = Math.max(1, ...(profile.elementSummary?.items ?? []).map((item) => item.count));
  const birth = profile.solarDate ? `${profile.solarDate.year}.${String(profile.solarDate.month).padStart(2, '0')}.${String(profile.solarDate.day).padStart(2, '0')}` : '';

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setError('');
    try {
      await saveNodeAsPng(cardRef.current, 'manytool-saju-card.png');
    } catch {
      setError('이미지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ledger-panel px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#e9c349]">Share Card</p>
          <h3 className="mt-1 text-xl font-black text-white">결과 카드 저장</h3>
          <p className="mt-1 text-xs text-white/45">4주·오행·핵심 운세를 인스타 스토리 크기(1080×1920) 이미지로 저장해요.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 bg-[#e9c349] px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-[#3c2f00] transition hover:brightness-110"
        >
          {open ? <X className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {open ? '닫기' : '카드 만들기'}
        </button>
      </div>

      {open ? (
        <div className="mt-5 flex flex-col items-center gap-4 md:flex-row md:items-start">
          <div className="max-w-full overflow-auto shadow-2xl max-[419px]:[zoom:0.8]">
            <div
              ref={cardRef}
              className="relative flex h-[640px] w-[360px] flex-col overflow-hidden p-6 text-[#e5e2e1]"
              style={{ background: 'radial-gradient(circle at 20% 10%, rgba(233,195,73,0.22), transparent 40%), radial-gradient(circle at 85% 30%, rgba(89,222,155,0.12), transparent 35%), #141414' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-[0.25em] text-[#e9c349]">MY SAJU REPORT</span>
                <span className="text-[11px] font-bold text-white/45">ManyTool</span>
              </div>
              <p className="mt-5 text-[13px] font-bold text-white/60">{(showName && profile.name) || '나의 사주'} · {birth} {profile.birthTime && profile.birthTime !== '모름' ? profile.birthTime : ''}</p>
              <p className="mt-1 text-[21px] font-black leading-snug text-white" style={{ fontFamily: "'Noto Serif KR', serif" }}>{report.headline}</p>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {PILLAR_ORDER.map(({ key, label }) => {
                  const hanja = profile.pillars?.hanja?.[key]?.hanja ?? '';
                  return (
                    <div key={key} className="border border-[#e9c349]/30 bg-white/[0.03] py-2 text-center">
                      <p className="text-[9px] font-bold tracking-[0.16em] text-white/40">{label}</p>
                      <p className="mt-1 text-[26px] font-black leading-[1.1] text-[#e9c349]" style={{ fontFamily: "'Noto Serif KR', serif" }}>{hanja.slice(0, 1)}<br />{hanja.slice(1, 2)}</p>
                      <p className="mt-1 text-[10px] font-semibold text-white/60">{profile.pillars?.korean?.[key]}</p>
                    </div>
                  );
                })}
              </div>
              {profile.dayMaster ? <p className="mt-2 text-center text-[11px] font-bold text-white/50">일간 {profile.dayMaster}</p> : null}

              <p className="mt-4 text-[10px] font-black tracking-[0.2em] text-[#59de9b]">오행 분포 · 균형 {profile.elementSummary?.balanceScore ?? '-'}점</p>
              <div className="mt-2 space-y-1.5">
                {(profile.elementSummary?.items ?? []).map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="w-4 text-[11px] font-black" style={{ color: ELEMENT_COLORS[item.label] ?? '#fff' }}>{item.label}</span>
                    <div className="h-2 flex-1 bg-white/10">
                      <div className="h-full" style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%`, background: ELEMENT_COLORS[item.label] ?? '#fff' }} />
                    </div>
                    <span className="w-3 text-right text-[10px] font-bold text-white/50">{item.count}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {topCategories.map(([key, value]) => (
                  <div key={key} className="bg-white/[0.05] py-2 text-center">
                    <p className="text-[9px] font-bold text-white/45">{CATEGORY_LABELS[key]}</p>
                    <p className="text-[17px] font-black text-[#e9c349]">{value.score}</p>
                  </div>
                ))}
                <div className="bg-[#59de9b]/10 py-2 text-center">
                  <p className="text-[9px] font-bold text-[#59de9b]">올해 흐름</p>
                  <p className="text-[17px] font-black text-[#59de9b]">{report.yearlyFlow?.score ?? '-'}</p>
                </div>
              </div>

              {report.keywords?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {report.keywords.slice(0, 5).map((keyword) => (
                    <span key={keyword} className="bg-[#e9c349]/10 px-2 py-1 text-[10px] font-bold text-[#e9c349]">#{keyword}</span>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-[10px] font-semibold text-white/40">{detail?.sample ? '샘플 리포트 · ' : ''}AI 만세력 사주풀이</span>
                <span className="text-[10px] font-bold text-white/70">manytool.net/ai-manseryeok</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xs space-y-3">
            {profile.name ? (
              <label className="flex items-center gap-2 bg-white/5 p-3 text-sm font-semibold text-white/80">
                <input type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} className="h-4 w-4 accent-[#e9c349]" />
                카드에 이름 표시
              </label>
            ) : null}
            <p className="text-xs leading-5 text-white/50">카드는 내 기기에서만 만들어지고 서버로 전송되지 않아요.</p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 bg-[#e9c349] px-4 py-3 text-sm font-black text-[#3c2f00] transition hover:brightness-110 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {saving ? '이미지 만드는 중…' : 'PNG로 저장'}
            </button>
            {error ? <p className="text-xs font-semibold text-rose-400">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ManseryeokShareCard;
