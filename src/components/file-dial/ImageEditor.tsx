import { useEffect, useMemo, useRef, useState } from 'react';
import { FlipHorizontal2, RotateCw, X } from 'lucide-react';

import { cropCanvas, decodeToCanvas, encodeCanvas, formatOfFile, scaleCanvas, transformCanvas, type RasterFormat } from '@/lib/file-dial/image-codec';
import type { DialOutput } from '@/lib/file-dial/actions';

type Rect = { x: number; y: number; width: number; height: number };

const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: '자유', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:4', label: '3:4 증명', ratio: 3 / 4 },
  { id: '9:16', label: '9:16 스토리', ratio: 9 / 16 }
];
const OUTPUT_FORMATS: RasterFormat[] = ['jpg', 'png', 'webp'];
const MAX_VIEW = { width: 560, height: 400 };

const fitRect = (ratio: number | null, w: number, h: number): Rect => {
  if (!ratio) return { x: 0, y: 0, width: w, height: h };
  const width = Math.min(w, h * ratio);
  const height = width / ratio;
  return { x: (w - width) / 2, y: (h - height) / 2, width, height };
};

type Props = { file: File; onDone: (outputs: DialOutput[]) => void; onClose: () => void };

export function ImageEditor({ file, onDone, onClose }: Props) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ kind: 'move' | 'draw'; startX: number; startY: number; rect: Rect } | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [flipX, setFlipX] = useState(false);
  const [aspect, setAspect] = useState(ASPECTS[0]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [outWidth, setOutWidth] = useState('');
  const [format, setFormat] = useState<RasterFormat>(() => {
    const f = formatOfFile(file);
    return OUTPUT_FORMATS.includes(f) ? f : 'jpg';
  });
  const [quality, setQuality] = useState(90);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    decodeToCanvas(file).then(setSource).catch((e: Error) => setError(e.message));
  }, [file]);

  const working = useMemo(() => (source ? transformCanvas(source, { rotate, flipX }) : null), [source, rotate, flipX]);
  const scale = working ? Math.min(MAX_VIEW.width / working.width, MAX_VIEW.height / working.height, 1) : 1;

  useEffect(() => {
    if (!working) return;
    setRect(fitRect(aspect.ratio, working.width, working.height));
  }, [working, aspect]);

  useEffect(() => {
    if (rect) setOutWidth(String(Math.round(rect.width)));
  }, [rect?.width]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !working || !rect) return;
    view.width = Math.round(working.width * scale);
    view.height = Math.round(working.height * scale);
    const ctx = view.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(working, 0, 0, view.width, view.height);
    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    const r = { x: rect.x * scale, y: rect.y * scale, w: rect.width * scale, h: rect.height * scale };
    ctx.fillRect(0, 0, view.width, r.y);
    ctx.fillRect(0, r.y + r.h, view.width, view.height - r.y - r.h);
    ctx.fillRect(0, r.y, r.x, r.h);
    ctx.fillRect(r.x + r.w, r.y, view.width - r.x - r.w, r.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath(); ctx.moveTo(r.x + (r.w * i) / 3, r.y); ctx.lineTo(r.x + (r.w * i) / 3, r.y + r.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r.x, r.y + (r.h * i) / 3); ctx.lineTo(r.x + r.w, r.y + (r.h * i) / 3); ctx.stroke();
    }
  }, [working, rect, scale]);

  const toImage = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * (working?.width ?? 0), y: ((e.clientY - box.top) / box.height) * (working?.height ?? 0) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImage(e);
    const inside = p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
    dragRef.current = { kind: inside ? 'move' : 'draw', startX: p.x, startY: p.y, rect };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || !working) return;
    const p = toImage(e);
    const W = working.width;
    const H = working.height;
    if (drag.kind === 'move') {
      const x = Math.min(Math.max(0, drag.rect.x + p.x - drag.startX), W - drag.rect.width);
      const y = Math.min(Math.max(0, drag.rect.y + p.y - drag.startY), H - drag.rect.height);
      setRect({ ...drag.rect, x, y });
      return;
    }
    let width = Math.abs(p.x - drag.startX);
    let height = Math.abs(p.y - drag.startY);
    if (aspect.ratio) {
      if (width / height > aspect.ratio) width = height * aspect.ratio;
      else height = width / aspect.ratio;
    }
    const x = Math.max(0, p.x < drag.startX ? drag.startX - width : drag.startX);
    const y = Math.max(0, p.y < drag.startY ? drag.startY - height : drag.startY);
    if (width > 8 && height > 8) setRect({ x, y, width: Math.min(width, W - x), height: Math.min(height, H - y) });
  };

  const save = async () => {
    if (!working || !rect) return;
    setSaving(true);
    try {
      const cropped = cropCanvas(working, { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
      const targetW = Math.max(1, Math.min(Number(outWidth) || cropped.width, 8000));
      const resized = targetW === cropped.width ? cropped : scaleCanvas(cropped, targetW, (cropped.height * targetW) / cropped.width);
      const blob = await encodeCanvas(resized, format, quality / 100);
      const name = `${file.name.replace(/\.[^.]+$/, '')}-edited.${format}`;
      onDone([{ name, blob, from: file.name }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const outHeight = rect && Number(outWidth) ? Math.round((rect.height * Number(outWidth)) / rect.width) : 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="이미지 편집">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-auto rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Edit</p>
            <h3 className="truncate text-lg font-black text-slate-950">{file.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기"><X className="h-5 w-5" /></button>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-4 flex min-h-48 items-center justify-center rounded-2xl bg-[repeating-conic-gradient(#f1f5f9_0_25%,#ffffff_0_50%)] bg-[length:20px_20px] p-2">
          {working ? (
            <canvas ref={viewRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { dragRef.current = null; }} className="max-w-full touch-none cursor-crosshair rounded-lg" style={{ height: 'auto' }} />
          ) : <p className="text-sm text-slate-500">이미지를 여는 중…</p>}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">사진 위를 드래그해 자를 영역을 그리고, 영역 안을 끌면 위치를 옮길 수 있어요.</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAspect(a)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${aspect.id === a.id ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 text-slate-700 hover:border-teal-300'}`}>{a.label}</button>
          ))}
          <span className="mx-1 w-px self-stretch bg-slate-200" />
          <button type="button" onClick={() => setRotate((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-300"><RotateCw className="h-3.5 w-3.5" /> 회전</button>
          <button type="button" onClick={() => setFlipX((f) => !f)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-300"><FlipHorizontal2 className="h-3.5 w-3.5" /> 좌우 반전</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-bold text-slate-600">저장할 가로 크기(px)
            <input type="number" min={1} max={8000} value={outWidth} onChange={(e) => setOutWidth(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" />
            <span className="mt-1 block font-normal text-slate-400">{outHeight ? `세로 ${outHeight}px (비율 유지)` : ''}</span>
          </label>
          <label className="block text-xs font-bold text-slate-600">형식
            <select value={format} onChange={(e) => setFormat(e.target.value as RasterFormat)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900">
              {OUTPUT_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-600">품질 {format === 'png' ? '(PNG는 무손실)' : `${quality}%`}
            <input type="range" min={40} max={100} value={quality} disabled={format === 'png'} onChange={(e) => setQuality(Number(e.target.value))} className="mt-3 w-full accent-teal-600" />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">취소</button>
          <button type="button" onClick={save} disabled={!working || saving} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? '저장 중…' : '이대로 저장'}</button>
        </div>
      </div>
    </div>
  );
}

export default ImageEditor;
