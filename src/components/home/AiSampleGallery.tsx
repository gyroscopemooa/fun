import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Wand2, X } from 'lucide-react';

import type { AiImageMode } from './AiImageGenerator';
import { AI_SAMPLES, AI_SAMPLE_CATEGORIES, categoryOf, sampleFull, sampleThumb, type AiSampleCategory } from '@/lib/ai-image-samples';

const MOBILE_PREVIEW_COUNT = 8;

type SupportedLocale = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'pt' | 'vi' | 'id';
type Props = { onUseStyle: (mode: AiImageMode) => void; title: string; locale?: SupportedLocale };

const COPY = {
  ko: { intro: 'ManyTool AI로 실제 만든 결과예요. 마음에 드는 스타일을 눌러 바로 시작해 보세요.', all: '전체', view: '크게 보기', more: (n: number) => `${n}장 더 보기`, use: (label: string) => `${label} 스타일로 만들기`, close: '닫기', prev: '이전', next: '다음' },
  en: { intro: 'Real results made with ManyTool AI. Tap a style you like to start right away.', all: 'All', view: 'View', more: (n: number) => `Show ${n} more`, use: (label: string) => `Make it in ${label} style`, close: 'Close', prev: 'Previous', next: 'Next' }
};

const EN_CATEGORY_LABELS: Record<AiSampleCategory, string> = { figure: 'Figure', body: 'Body Profile', free: 'Free Style', animation: 'Animation' };

export function AiSampleGallery({ onUseStyle, title, locale = 'ko' }: Props) {
  const copy = COPY[locale] ?? COPY.en;
  const labelOf = (id: AiSampleCategory) => (locale === 'ko' ? categoryOf(id).label : EN_CATEGORY_LABELS[id]);
  const [filter, setFilter] = useState<AiSampleCategory | 'all'>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => (filter === 'all' ? AI_SAMPLES : AI_SAMPLES.filter((item) => item.category === filter)), [filter]);
  const counts = useMemo(() => Object.fromEntries(AI_SAMPLE_CATEGORIES.map((c) => [c.id, AI_SAMPLES.filter((s) => s.category === c.id).length])), []);
  const open = openIndex == null ? null : items[openIndex];

  useEffect(() => {
    if (openIndex == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null);
      if (event.key === 'ArrowRight') setOpenIndex((i) => (i == null ? i : (i + 1) % items.length));
      if (event.key === 'ArrowLeft') setOpenIndex((i) => (i == null ? i : (i - 1 + items.length) % items.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, items.length]);

  return (
    <section className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-500">Sample Gallery</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.intro}</p>
        </div>
        <span className="text-xs font-medium text-slate-400">{items.length} images</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([{ id: 'all', label: copy.all, emoji: '🖼️' } as const, ...AI_SAMPLE_CATEGORIES.map((c) => ({ ...c, label: labelOf(c.id) }))]).map((item) => {
          const active = filter === item.id;
          const count = item.id === 'all' ? AI_SAMPLES.length : counts[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setFilter(item.id); setExpanded(false); }}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
            >
              {item.emoji} {item.label} <span className={active ? 'text-white/60' : 'text-slate-400'}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
        {items.map((item, index) => {
          const category = categoryOf(item.category);
          const hiddenOnMobile = !expanded && index >= MOBILE_PREVIEW_COUNT;
          return (
            <button
              key={item.file}
              type="button"
              onClick={() => setOpenIndex(index)}
              className={`group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 text-left ${hiddenOnMobile ? 'hidden sm:block' : ''}`}
            >
              <img src={sampleThumb(item)} alt={`${labelOf(item.category)} ${index + 1}`} loading="lazy" decoding="async" className="w-full transition duration-300 group-hover:scale-[1.03]" />
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
                {category.emoji} {labelOf(item.category)}
              </span>
              <span className="absolute inset-x-2 bottom-2 translate-y-2 rounded-xl bg-slate-950/80 px-3 py-2 text-center text-xs font-bold text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                {copy.view}
              </span>
            </button>
          );
        })}
      </div>
      {!expanded && items.length > MOBILE_PREVIEW_COUNT ? (
        <button type="button" onClick={() => setExpanded(true)} className="mt-1 w-full rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700 sm:hidden">
          {copy.more(items.length - MOBILE_PREVIEW_COUNT)}
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4" onClick={() => setOpenIndex(null)} role="dialog" aria-modal="true">
          <div className="relative flex max-h-full w-full max-w-3xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setOpenIndex(null)} className="absolute -top-2 right-0 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25" aria-label={copy.close}>
              <X className="h-5 w-5" />
            </button>
            <img src={sampleFull(open)} alt={labelOf(open.category)} className="max-h-[72vh] w-auto rounded-[22px] object-contain shadow-2xl" />
            <div className="mt-4 flex w-full max-w-md items-center justify-between gap-2">
              <button type="button" onClick={() => setOpenIndex((i) => (i == null ? i : (i - 1 + items.length) % items.length))} className="rounded-full bg-white/15 p-3 text-white hover:bg-white/25" aria-label={copy.prev}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => { onUseStyle(categoryOf(open.category).mode); setOpenIndex(null); }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-rose-50"
              >
                <Wand2 className="h-4 w-4" />
                {copy.use(labelOf(open.category))}
              </button>
              <button type="button" onClick={() => setOpenIndex((i) => (i == null ? i : (i + 1) % items.length))} className="rounded-full bg-white/15 p-3 text-white hover:bg-white/25" aria-label={copy.next}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-white/60">{(openIndex ?? 0) + 1} / {items.length}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AiSampleGallery;
