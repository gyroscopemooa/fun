import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FilePlus2, RotateCw, Scissors, Trash2, Undo2, X } from 'lucide-react';

import { decodeToCanvas, scaleCanvas } from '@/lib/file-dial/image-codec';
import { buildPdfFromPages, parsePageRange, renderPdfPages, type BoardPage } from '@/lib/file-dial/pdf-ops';
import { kindOfFile, type DialOutput } from '@/lib/file-dial/actions';

// One board for many PDFs and images: see every page, mix them, insert files anywhere and split where you like.
type Rotation = 0 | 90 | 180 | 270;
type Source = { id: number; file: File; color: string };
type Card = { key: number; source: number; index: number; rotate: Rotation; thumb: string; image?: HTMLCanvasElement; splitAfter?: boolean };

const COLORS = ['#4f46e5', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#0284c7', '#65a30d', '#db2777'];
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'document';

type Props = { files: File[]; onDone: (outputs: DialOutput[]) => void; onClose: () => void };

export function PdfBoard({ files, onDone, onClose }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [initial, setInitial] = useState<Card[]>([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState('');
  const [dragKey, setDragKey] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<number | null>(null);
  const nextKey = useRef(1);
  const nextSource = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Turns files into cards (PDF pages or one card per image), inserted after position `at` (-1 = end). */
  const addFiles = async (incoming: File[], at = -1) => {
    const usable = incoming.filter((f) => ['pdf', 'image'].includes(kindOfFile(f)));
    if (usable.length < incoming.length) setError('PDF와 사진만 보드에 넣을 수 있어요.');
    const newSources: Source[] = [];
    const newCards: Card[] = [];
    for (const [n, file] of usable.entries()) {
      const source = { id: nextSource.current++, file, color: COLORS[(nextSource.current - 2) % COLORS.length] };
      newSources.push(source);
      setLoading(`${n + 1} / ${usable.length} ${file.name} 여는 중…`);
      try {
        if (kindOfFile(file) === 'pdf') {
          const pages = await renderPdfPages(file, 0.35, (done, total) => setLoading(`${file.name}: 썸네일 ${done} / ${total}`));
          pages.forEach((canvas, index) => newCards.push({ key: nextKey.current++, source: source.id, index, rotate: 0, thumb: canvas.toDataURL('image/jpeg', 0.7) }));
        } else {
          const canvas = await decodeToCanvas(file);
          const scale = Math.min(1, 300 / Math.max(canvas.width, canvas.height));
          newCards.push({ key: nextKey.current++, source: source.id, index: 0, rotate: 0, thumb: scaleCanvas(canvas, canvas.width * scale, canvas.height * scale).toDataURL('image/jpeg', 0.75), image: canvas });
        }
      } catch (e) {
        setError(`${file.name}을(를) 열지 못했어요: ${(e as Error).message}`);
      }
    }
    setSources((list) => [...list, ...newSources]);
    setCards((list) => {
      const pos = at < 0 ? list.length : at + 1;
      return [...list.slice(0, pos), ...newCards, ...list.slice(pos)];
    });
    setLoading('');
    return newCards;
  };

  // Load the starting files once, even if the effect re-runs (dev remounts, hot reload).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    addFiles(files).then((made) => setInitial(made));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceOf = (id: number) => sources.find((s) => s.id === id);
  const update = (key: number, patch: Partial<Card>) => setCards((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const moveBy = (i: number, by: number) => setCards((list) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const moveTo = (key: number, before: number) => setCards((list) => {
    const from = list.findIndex((c) => c.key === key);
    if (from < 0) return list;
    const next = [...list];
    const [card] = next.splice(from, 1);
    const to = before > from ? before - 1 : before;
    next.splice(Math.max(0, Math.min(next.length, to)), 0, card);
    return next;
  });

  const applyRange = () => {
    const picked = parsePageRange(range, cards.length);
    if (!picked.length) { setError('예: 1-3, 5, 8- 처럼 지금 보드의 순서 번호를 적어 주세요.'); return; }
    setError('');
    setCards((list) => picked.map((i) => ({ ...list[i], key: nextKey.current++, splitAfter: false })));
  };

  // Splits mark the end of a part; the last card never needs one.
  const parts = cards.reduce<Card[][]>((acc, card, i) => {
    acc[acc.length - 1].push(card);
    if (card.splitAfter && i < cards.length - 1) acc.push([]);
    return acc;
  }, [[]]).filter((part) => part.length);

  const save = async () => {
    if (!cards.length) return;
    setSaving(true);
    setError('');
    try {
      const cache = new Map();
      const name = sources.length === 1 ? baseName(sources[0].file.name) : 'merged';
      const outputs: DialOutput[] = [];
      for (const [n, part] of parts.entries()) {
        setLoading(parts.length > 1 ? `${n + 1} / ${parts.length}번째 PDF 만드는 중…` : 'PDF 만드는 중…');
        const pages: BoardPage[] = part.map((c) => {
          const src = sourceOf(c.source)!;
          return c.image ? { kind: 'image', canvas: c.image, rotate: c.rotate } : { kind: 'pdf', file: src.file, index: c.index, rotate: c.rotate };
        });
        outputs.push({ name: parts.length > 1 ? `${name}-part${n + 1}.pdf` : `${name}-${part.length}pages.pdf`, blob: await buildPdfFromPages(pages, cache), from: [...new Set(part.map((c) => sourceOf(c.source)?.file.name))].join(', ') });
      }
      onDone(outputs);
    } catch (e) {
      setError(`PDF를 만들지 못했어요: ${(e as Error).message}`);
    } finally {
      setSaving(false);
      setLoading('');
    }
  };

  // Files dropped on the board are inserted after the card under the pointer (or at the end).
  const onBoardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-pos]');
    const pos = target ? Number(target.dataset.pos) : -1;
    setDropHint(null);
    if (e.dataTransfer.files.length) { addFiles(Array.from(e.dataTransfer.files), pos); return; }
    if (dragKey !== null) moveTo(dragKey, pos < 0 ? cards.length : pos);
    setDragKey(null);
  };
  const stop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label="PDF 페이지 편집 보드"
      onDragEnter={stop}
      onDragLeave={stop}
      onDragOver={(e) => { stop(e); const t = (e.target as HTMLElement).closest<HTMLElement>('[data-pos]'); setDropHint(t ? Number(t.dataset.pos) : -1); }}
      onDrop={onBoardDrop}
    >
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">PDF Board</p>
            <h3 className="text-base font-black text-slate-950">파일 {sources.length}개 · {cards.length}쪽{parts.length > 1 ? ` · PDF ${parts.length}개로 나눠 저장` : ''}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><FilePlus2 className="h-4 w-4" /> 파일 추가</button>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기"><X className="h-5 w-5" /></button>
          </div>
          <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf,image/*,.heic,.heif" className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        </div>

        {sources.length ? (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2 sm:px-5">
            {sources.map((s) => (
              <span key={s.id} className="inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />{s.file.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <label className="block min-w-0 flex-1 text-xs font-bold text-slate-600"><span className="hidden sm:inline">순서 번호로 남길 페이지 고르기</span>
            <input value={range} onChange={(e) => setRange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyRange(); }} placeholder="예: 1-3, 5, 8-" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 sm:mt-1" aria-label="남길 페이지 번호" />
          </label>
          <button type="button" onClick={applyRange} disabled={!cards.length} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-40">적용</button>
          <button type="button" onClick={() => setCards((list) => list.map((c) => ({ ...c, splitAfter: false })))} disabled={parts.length < 2} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-40"><Scissors className="h-4 w-4" /><span className="hidden sm:inline">나누기 모두 해제</span></button>
          <button type="button" onClick={() => { setCards(initial); setRange(''); setError(''); }} disabled={!initial.length} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-40"><Undo2 className="h-4 w-4" /><span className="hidden sm:inline">처음대로</span></button>
        </div>

        {error ? <p className="mx-4 mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:mx-5">{error}</p> : null}
        {loading ? <p className="mx-4 mt-3 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-800 sm:mx-5">{loading}</p> : null}

        <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 ${dropHint === -1 ? 'bg-teal-50' : 'bg-slate-50'}`}>
          {!cards.length && !loading ? <p className="py-16 text-center text-sm text-slate-500">PDF나 사진을 여기에 끌어다 놓거나 "파일 추가"를 눌러 주세요.</p> : null}
          <ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
            {cards.map((card, i) => {
              const src = sourceOf(card.source);
              return (
                <li key={card.key} data-pos={i} className="relative">
                  <div
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); setDragKey(card.key); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragKey(null); setDropHint(null); }}
                    className={`rounded-2xl border-2 bg-white p-1.5 shadow-sm transition ${dragKey === card.key ? 'opacity-40' : ''} ${dropHint === i ? 'border-teal-400' : 'border-transparent'}`}
                  >
                    <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      <img src={card.thumb} alt={`${i + 1}번째 페이지`} className="max-h-full max-w-full transition-transform" style={{ transform: `rotate(${card.rotate}deg)` }} draggable={false} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: src?.color }} />
                      <span className="truncate">{i + 1} · {card.image ? '사진' : `${card.index + 1}쪽`}</span>
                    </div>
                    <div className="mt-0.5 flex justify-between">
                      <button type="button" onClick={() => moveBy(i, -1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="앞으로"><ArrowLeft className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => update(card.key, { rotate: (((card.rotate + 90) % 360) as Rotation) })} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="회전"><RotateCw className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setCards((list) => list.filter((c) => c.key !== card.key))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" aria-label="빼기"><Trash2 className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveBy(i, 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="뒤로"><ArrowRight className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {i < cards.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => update(card.key, { splitAfter: !card.splitAfter })}
                      title={card.splitAfter ? '나누기 해제' : '여기서 나누기'}
                      aria-label={card.splitAfter ? '나누기 해제' : `${i + 1}번째 뒤에서 나누기`}
                      className={`absolute -right-[13px] top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border text-xs shadow-sm transition ${card.splitAfter ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500'}`}
                    >
                      <Scissors className="h-3 w-3" />
                    </button>
                  ) : null}
                  {card.splitAfter && i < cards.length - 1 ? <span className="absolute -right-[2px] top-2 bottom-2 w-0.5 rounded bg-rose-400" aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
          <p className="hidden text-xs text-slate-500 sm:block">카드를 끌어 순서를 바꾸고, 파일을 카드 위에 놓으면 그 뒤에 끼워 넣어요. 카드 사이 ✂를 누르면 그 지점에서 나눠 저장해요.</p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">취소</button>
            <button type="button" onClick={save} disabled={!cards.length || saving || Boolean(loading)} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {saving ? '저장 중…' : parts.length > 1 ? `PDF ${parts.length}개로 저장` : `${cards.length}쪽 PDF로 저장`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PdfBoard;
