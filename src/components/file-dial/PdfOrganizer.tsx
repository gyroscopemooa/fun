import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2, X } from 'lucide-react';

import { parsePageRange, rebuildPdf, renderPdfPages, type PageSpec } from '@/lib/file-dial/pdf-ops';
import type { DialOutput } from '@/lib/file-dial/actions';

type Props = { file: File; onDone: (outputs: DialOutput[]) => void; onClose: () => void };
type Item = PageSpec & { thumb: string };

export function PdfOrganizer({ file, onDone, onClose }: Props) {
  const [source, setSource] = useState<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState('PDF를 여는 중…');
  const [range, setRange] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    renderPdfPages(file, 0.4, (done, all) => setLoading(`썸네일 만드는 중… ${done} / ${all}`))
      .then((pages) => {
        const list = pages.map((canvas, index) => ({ index, rotate: 0 as const, thumb: canvas.toDataURL('image/jpeg', 0.7) }));
        setSource(list);
        setItems(list);
        setLoading('');
      })
      .catch((e: Error) => { setError(`PDF를 열지 못했어요: ${e.message}`); setLoading(''); });
  }, [file]);

  const total = source.length;

  const applyRange = () => {
    const picked = parsePageRange(range, total);
    if (!picked.length) { setError('예: 1-3, 5, 8- 처럼 페이지 번호를 적어 주세요.'); return; }
    setError('');
    setItems(picked.map((index) => ({ ...source[index], rotate: 0 })));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };

  const rotate = (i: number) => setItems((list) => list.map((it, j) => (j === i ? { ...it, rotate: (((it.rotate + 90) % 360) as PageSpec['rotate']) } : it)));
  const remove = (i: number) => setItems((list) => list.filter((_, j) => j !== i));

  const save = async () => {
    if (!items.length) return;
    setSaving(true);
    try {
      const blob = await rebuildPdf(file, items);
      onDone([{ name: `${file.name.replace(/\.[^.]+$/, '')}-${items.length}pages.pdf`, blob, from: file.name }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="PDF 페이지 정리">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Pages</p>
            <h3 className="truncate text-base font-black text-slate-950">{file.name} · {items.length} / {total}쪽</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-3">
          <label className="block min-w-0 flex-1 text-xs font-bold text-slate-600">페이지 범위로 고르기
            <input value={range} onChange={(e) => setRange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyRange(); }} placeholder="예: 1-3, 5, 8-" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" />
          </label>
          <button type="button" onClick={applyRange} disabled={!total} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">적용</button>
          <button type="button" onClick={() => { setItems(source); setRange(''); setError(''); }} disabled={!total} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"><Undo2 className="h-4 w-4" /> 처음대로</button>
        </div>

        {error ? <p className="mx-5 mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
          {loading ? <p className="py-10 text-center text-sm text-slate-500">{loading}</p> : null}
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {items.map((it, i) => (
              <li
                key={`${it.index}-${i}`}
                draggable
                onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
                className={`rounded-2xl border bg-white p-2 shadow-sm ${dragIndex === i ? 'border-teal-400 opacity-60' : 'border-slate-200'}`}
              >
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  <img src={it.thumb} alt={`${it.index + 1}쪽`} className="max-h-full max-w-full transition-transform" style={{ transform: `rotate(${it.rotate}deg)` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>{i + 1}번째 · 원래 {it.index + 1}쪽</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <button type="button" onClick={() => move(i, i - 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="앞으로"><ArrowLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => rotate(i)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="회전"><RotateCw className="h-4 w-4" /></button>
                  <button type="button" onClick={() => remove(i)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" aria-label="빼기"><Trash2 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, i + 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="뒤로"><ArrowRight className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">카드를 끌어서 순서를 바꾸거나 화살표로 옮길 수 있어요.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">취소</button>
            <button type="button" onClick={save} disabled={!items.length || saving} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? '저장 중…' : `${items.length}쪽 PDF로 저장`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PdfOrganizer;
