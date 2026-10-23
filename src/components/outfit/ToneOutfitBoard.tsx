import { useMemo, useRef, useState } from 'react';
import { Download, Shuffle, X } from 'lucide-react';

import { SEASONS, TONES, TONE_MAP, readableText, type Swatch, type ToneId, type ToneInfo } from '@/lib/personal-color-tones';
import { saveNodeAsPng } from '@/lib/save-node-as-png';
import { METAL_BY_SEASON, buildLooks, type Look } from '@/lib/tone-outfits';
import { Bag, Metal, Outer, Pants, Shoes, Skirt, Top } from './Garments';

const SLOT_LABELS = { outer: '아우터', top: '상의', bottom: '하의', shoes: '신발', bag: '가방' } as const;

// Mood-board style arrangement of one look's garments.
function LookIllustration({ look, compact = false }: { look: Look; compact?: boolean }) {
  const Bottom = look.bottomType === 'skirt' ? Skirt : Pants;
  const h = compact ? 'h-[112px]' : 'h-[190px]';
  return (
    <div className={`relative ${h} w-full`}>
      <Outer color={look.items.outer.hex} className="absolute left-[4%] top-[2%] h-[62%] drop-shadow-sm" />
      <Top color={look.items.top.hex} className="absolute left-[34%] top-[6%] h-[48%] drop-shadow-sm" />
      <Bottom color={look.items.bottom.hex} className="absolute left-[62%] top-[4%] h-[58%] drop-shadow-sm" />
      <Bag color={look.items.bag.hex} className="absolute bottom-[4%] left-[10%] h-[30%] drop-shadow-sm" />
      <Shoes color={look.items.shoes.hex} className="absolute bottom-[4%] right-[6%] h-[18%] drop-shadow-sm" />
    </div>
  );
}

function ChipRow({ swatch, label }: { swatch: Swatch; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-6 w-6 shrink-0 rounded-lg border border-black/10" style={{ background: swatch.hex }} />
      <span className="w-10 shrink-0 text-[11px] font-bold text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-xs font-bold text-slate-800">{swatch.name}</span>
      <span className="ml-auto font-mono text-[10px] text-slate-400">{swatch.hex}</span>
    </div>
  );
}

function ShareCard({ tone, looks, onClose }: { tone: ToneInfo; looks: Look[]; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const metal = METAL_BY_SEASON[tone.season];

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setError('');
    try {
      await saveNodeAsPng(cardRef.current, `manytool-outfit-${tone.id}.png`);
    } catch {
      setError('이미지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">코디 보드 카드 저장</h3>
          <p className="text-xs text-slate-500">인스타 스토리 크기(1080×1920) PNG로 저장돼요.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-200" aria-label="닫기">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-start">
        <div className="max-w-full overflow-auto rounded-[20px] shadow-xl max-[419px]:[zoom:0.8]">
          <div
            ref={cardRef}
            className="relative flex h-[640px] w-[360px] flex-col overflow-hidden bg-white p-5"
            style={{ background: `linear-gradient(180deg, ${tone.best[0].hex}2e 0%, #ffffff 42%)` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-[0.25em] text-slate-700">MY OUTFIT BOARD</span>
              <span className="text-[11px] font-bold text-slate-500">ManyTool</span>
            </div>
            <p className="mt-3 text-[11px] font-bold tracking-[0.2em] text-slate-500">{tone.english.toUpperCase()}</p>
            <p className="text-[26px] font-black leading-tight text-slate-900">{tone.label} 코디</p>
            <div className="mt-2 flex h-5 overflow-hidden rounded-md">
              {tone.best.map((item) => <span key={item.hex + item.name} className="flex-1" style={{ background: item.hex }} />)}
            </div>
            <div className="mt-3 space-y-1.5">
              {looks.map((look) => (
                <div key={look.id} className="rounded-2xl border border-slate-100 bg-white/90 px-2 pb-1 pt-1.5">
                  <p className="text-[11px] font-black text-slate-800">{look.emoji} {look.title}</p>
                  <LookIllustration look={look} compact />
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                <Metal tone={metal.tone} className="h-4 w-7" /> {metal.label}
              </span>
              <span className="text-[10px] font-bold text-slate-700">manytool.net/tone-outfit-board</span>
            </div>
          </div>
        </div>
        <div className="w-full max-w-xs space-y-3">
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

export function ToneOutfitBoard() {
  const [toneId, setToneId] = useState<ToneId>('summer-mute');
  const [seed, setSeed] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const tone = TONE_MAP[toneId];
  const season = tone.season;
  const looks = useMemo(() => buildLooks(tone, seed), [tone, seed]);
  const metal = METAL_BY_SEASON[season];

  const chooseSeason = (next: (typeof SEASONS)[number]) => {
    const first = TONES.find((item) => item.season === next && item.sub === '트루') ?? TONES.find((item) => item.season === next);
    if (first) setToneId(first.id);
    setSeed(0);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold tracking-[0.16em] text-rose-500">MY TONE</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">내 퍼스널컬러 고르기</h2>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
          {SEASONS.map((item) => (
            <button key={item} type="button" onClick={() => chooseSeason(item)} className={`rounded-lg px-2 py-2 transition ${season === item ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {TONES.filter((item) => item.season === season).map((item) => {
            const active = item.id === toneId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setToneId(item.id); setSeed(0); }}
                className={`overflow-hidden rounded-2xl border text-left transition ${active ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-400'}`}
              >
                <span className="flex h-8">
                  {item.best.slice(0, 4).map((swatch) => <span key={swatch.hex} className="flex-1" style={{ background: swatch.hex }} />)}
                </span>
                <span className="block px-2.5 py-2 text-xs font-black text-slate-900">{item.sub}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">내 톤을 모르면 <a href="/ai-personal-color" className="font-bold text-rose-600 underline">AI 퍼스널컬러</a>나 <a href="/personal-color" className="font-bold text-rose-600 underline">무료 자가진단</a>으로 먼저 확인해 보세요.</p>
      </section>

      <section className="overflow-hidden rounded-[28px] p-5" style={{ background: `linear-gradient(135deg, ${tone.best[0].hex}33, #ffffff 55%, ${tone.best[2].hex}22)` }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-slate-500">{tone.english.toUpperCase()}</p>
            <h2 className="text-2xl font-black text-slate-900">{tone.label} 코디 보드</h2>
            <p className="mt-1 text-sm text-slate-600">{tone.tagline}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSeed((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">
              <Shuffle className="h-4 w-4" />
              다른 조합 보기
            </button>
            <button type="button" onClick={() => setShareOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700">
              <Download className="h-4 w-4" />
              카드 저장
            </button>
          </div>
        </div>
        <div className="mt-4 flex h-8 overflow-hidden rounded-xl shadow-sm">
          {tone.best.map((item) => <span key={item.hex + item.name} className="flex-1" style={{ background: item.hex }} title={item.name} />)}
        </div>
      </section>

      {shareOpen ? <ShareCard tone={tone} looks={looks} onClose={() => setShareOpen(false)} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {looks.map((look) => (
          <article key={`${look.id}-${seed}`} className="rounded-[26px] border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-slate-900">{look.emoji} {look.title}</p>
            <div className="mt-2 rounded-2xl bg-[linear-gradient(180deg,#f8fafc,#ffffff)] p-2">
              <LookIllustration look={look} />
            </div>
            <div className="mt-3 space-y-1.5">
              {(Object.keys(SLOT_LABELS) as (keyof typeof SLOT_LABELS)[]).map((slot) => (
                <ChipRow key={slot} swatch={look.items[slot]} label={slot === 'bottom' ? (look.bottomType === 'skirt' ? '스커트' : '팬츠') : SLOT_LABELS[slot]} />
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{look.tip}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex items-center gap-4 rounded-[26px] border border-slate-200 bg-white p-5">
          <Metal tone={metal.tone} className="h-14 w-24 shrink-0" />
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-amber-600">ACCESSORY</p>
            <h3 className="text-base font-black text-slate-900">액세서리 금속은 {metal.label}</h3>
            <p className="mt-1 text-xs text-slate-500">귀걸이·시계·벨트 버클처럼 얼굴과 가까운 금속일수록 효과가 커요.</p>
          </div>
        </section>
        <section className="rounded-[26px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-rose-600">AVOID</p>
          <h3 className="text-base font-black text-slate-900">얼굴 가까이엔 피하면 좋은 컬러</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tone.avoid.map((item) => (
              <span key={item.hex + item.name} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: item.hex, color: readableText(item.hex) }}>
                <X className="h-3 w-3" /> {item.name}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">하의나 신발처럼 얼굴에서 먼 곳에는 써도 괜찮아요.</p>
        </section>
      </div>
    </div>
  );
}

export default ToneOutfitBoard;
