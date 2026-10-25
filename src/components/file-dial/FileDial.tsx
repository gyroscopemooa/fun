import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Loader2, Package, Trash2, X } from 'lucide-react';

import { ACTIONS, kindOfDragTypes, kindOfFiles, matchAction, type DialAction, type DialKind, type DialMode, type DialOutput } from '@/lib/file-dial/actions';
import { zipBlobs } from '@/lib/file-dial/pdf-ops';
import { DIAL_COLORS, RadialDial, petalAt } from './RadialDial';
import { ImageEditor } from './ImageEditor';
import { HwpPreview } from './HwpPreview';
import { PdfOrganizer } from './PdfOrganizer';
import { MediaTrim } from './MediaTrim';

type Overlay = { x: number; y: number; kind: DialKind; mode: DialMode; hi: number | null };
type Result = DialOutput & { id: number; url: string };

const KIND_LABEL: Record<DialKind, string> = { image: '이미지', pdf: 'PDF', hwp: '한글 문서', video: '동영상', audio: '오디오', mixed: '이미지+PDF' };

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

const download = (url: string, name: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
};

const overlaySize = () => Math.min(340, window.innerWidth - 32);

export function FileDial() {
  const [tray, setTray] = useState<File[]>([]);
  const [mode, setMode] = useState<DialMode>('convert');
  const [hover, setHover] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState<File | null>(null);
  const [organizing, setOrganizing] = useState<File | null>(null);
  const [trimming, setTrimming] = useState<File | null>(null);
  const depth = useRef(0);
  const overlayRef = useRef<Overlay | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);

  overlayRef.current = overlay;
  const trayKind = useMemo(() => kindOfFiles(tray), [tray]);
  const trayActions = trayKind ? ACTIONS[trayKind][mode] : [];

  const addResults = (outputs: DialOutput[]) => {
    setResults((prev) => [...outputs.map((o) => ({ ...o, id: nextId.current++, url: URL.createObjectURL(o.blob) })), ...prev]);
  };

  const run = useCallback(async (action: DialAction, files: File[]) => {
    setMessage('');
    if (action.opensEditor) {
      setEditing(files[0]);
      if (files.length > 1) setMessage('편집은 한 번에 한 장씩 할 수 있어요. 첫 번째 사진을 열었어요.');
      return;
    }
    if (action.opensTrim) {
      setTrimming(files[0]);
      if (files.length > 1) setMessage('구간 자르기는 한 번에 한 파일씩 할 수 있어요. 첫 번째 파일을 열었어요.');
      return;
    }
    if (action.opensPages) {
      setOrganizing(files[0]);
      if (files.length > 1) setMessage('페이지 정리는 한 번에 한 PDF씩 할 수 있어요. 첫 번째 PDF를 열었어요. 여러 PDF는 "합치기"로 먼저 합쳐 보세요.');
      return;
    }
    if (action.opensPreview) {
      setPreviewing(files[0]);
      if (files.length > 1) setMessage('미리보기는 한 번에 한 문서씩 열 수 있어요. 첫 번째 문서를 열었어요.');
      return;
    }
    if (!action.run) return;
    setBusy('준비 중…');
    try {
      const outputs = await action.run(files, { progress: setBusy });
      addResults(outputs);
      if (outputs.length === 1) download(URL.createObjectURL(outputs[0].blob), outputs[0].name);
      else setMessage(`${outputs.length}개 파일을 만들었어요. 아래에서 하나씩 받거나 ZIP으로 한 번에 받을 수 있어요.`);
    } catch (e) {
      console.error(e);
      setMessage(`변환하지 못했어요: ${(e as Error).message || '알 수 없는 오류'}. 파일이 손상됐거나 암호가 걸려 있지 않은지 확인해 주세요.`);
    } finally {
      setBusy('');
    }
  }, []);

  const accept = (files: File[]) => {
    const usable = files.filter((f) => kindOfFiles([f]));
    if (usable.length && !kindOfFiles(usable)) {
      setMessage('한글 문서, 동영상, 오디오는 다른 종류와 섞지 말고 따로 담아 주세요. (이미지와 PDF는 함께 담을 수 있어요)');
      return [];
    }
    if (usable.length < files.length) setMessage('지원하지 않는 파일은 빼고 담았어요. 이미지, PDF, 한글(HWP·HWPX), 동영상, 오디오를 지원해요.');
    if (usable.length) setTray(usable);
    return usable;
  };

  // Drag a file anywhere on the page: the wheel opens where the drag enters; Ctrl/Alt switches to the tools wheel.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const modeOf = (e: DragEvent): DialMode => (e.ctrlKey || e.altKey || e.metaKey ? 'tools' : 'convert');

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      if (overlayRef.current) return;
      const size = overlaySize();
      const kind = kindOfDragTypes(Array.from(e.dataTransfer?.items ?? []).map((i) => i.type));
      setOverlay({
        x: Math.min(Math.max(e.clientX, size / 2 + 16), window.innerWidth - size / 2 - 16),
        y: Math.min(Math.max(e.clientY, size / 2 + 16), window.innerHeight - size / 2 - 60),
        kind,
        mode: modeOf(e),
        hi: null
      });
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const current = overlayRef.current;
      if (!current) return;
      const nextMode = modeOf(e);
      const actions = ACTIONS[current.kind][nextMode];
      const hi = petalAt(actions.length, e.clientX - current.x, e.clientY - current.y, overlaySize() / 2);
      if (hi !== current.hi || nextMode !== current.mode) setOverlay({ ...current, mode: nextMode, hi });
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOverlay(null);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      const current = overlayRef.current;
      setOverlay(null);
      const files = accept(Array.from(e.dataTransfer?.files ?? []));
      if (!files.length || !current || current.hi === null) return;
      const kind = kindOfFiles(files);
      if (!kind) return;
      const mode = e.ctrlKey || e.altKey || e.metaKey ? 'tools' : current.mode;
      // The real file kind is only known after the drop; fall back to the tray if the guess was wrong.
      const match = matchAction(kind, mode, ACTIONS[current.kind][mode][current.hi]);
      if (match) run(match, files);
      else setMessage('이 파일에는 그 기능을 쓸 수 없어요. 아래 다이얼에서 다시 골라 주세요.');
      setMode(mode);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [run]);

  const clearResults = () => {
    results.forEach((r) => URL.revokeObjectURL(r.url));
    setResults([]);
  };

  const downloadAll = async () => {
    setBusy('ZIP으로 묶는 중…');
    try {
      const blob = await zipBlobs(results.map((r) => ({ name: r.name, blob: r.blob })));
      download(URL.createObjectURL(blob), `manytool-converted-${results.length}files.zip`);
    } finally {
      setBusy('');
    }
  };

  const overlayActions = overlay ? ACTIONS[overlay.kind][overlay.mode] : [];
  const hoverAction = hover !== null ? trayActions[hover] : null;

  return (
    <div className="mt-6 space-y-5">
      {/* Main card: pick files, then use the wheel. */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50"
          >
            <FileUp className="h-9 w-9 text-indigo-500" />
            <span className="text-base font-black text-slate-900">파일을 이 페이지 아무 곳에나 끌어다 놓으세요</span>
            <span className="text-sm text-slate-500">끄는 순간 다이얼이 열려요 · 또는 눌러서 파일 선택</span>
            <span className="mt-1 text-xs text-slate-400">이미지 · PDF · HWP · MP4 · MOV · MP3 · WAV 등</span>
          </button>
          <input ref={inputRef} type="file" multiple accept="image/*,.heic,.heif,.tif,.tiff,.pdf,application/pdf,.hwp,.hwpx,video/*,audio/*,.mkv,.m4a,.flac" className="hidden" onChange={(e) => { accept(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

          <div className="mt-4 hidden gap-2 text-sm text-slate-600 sm:grid sm:grid-cols-2">
            <p className="rounded-2xl bg-slate-50 px-4 py-3"><b className="text-indigo-700">그냥 놓기</b> → 포맷 변환 다이얼</p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3"><kbd className="rounded border border-slate-300 bg-white px-1.5 text-xs font-bold">Ctrl</kbd> 또는 <kbd className="rounded border border-slate-300 bg-white px-1.5 text-xs font-bold">Alt</kbd> 누른 채 → 도구 다이얼</p>
          </div>

          {tray.length ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>담은 파일 {tray.length}개 · {trayKind ? KIND_LABEL[trayKind] : ''}</span>
                <button type="button" onClick={() => setTray([])} className="inline-flex items-center gap-1 hover:text-slate-900"><X className="h-3.5 w-3.5" /> 비우기</button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {tray.map((f) => <li key={`${f.name}-${f.size}`} className="max-w-[14rem] truncate rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{f.name} · {formatBytes(f.size)}</li>)}
              </ul>
            </div>
          ) : null}

          {busy ? <p className="mt-4 flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</p> : null}
          {message ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
        </div>

        <div className="flex flex-col items-center">
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm font-bold">
            {(['convert', 'tools'] as DialMode[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setHover(null); }} className={`rounded-full px-4 py-1.5 transition ${mode === m ? 'bg-white shadow-sm' : 'text-slate-500'}`} style={mode === m ? { color: DIAL_COLORS[m].text } : undefined}>
                {m === 'convert' ? '포맷 변환' : '파일 도구'}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <RadialDial
              actions={trayKind ? trayActions : ACTIONS.image[mode]}
              mode={mode}
              size={300}
              highlighted={hover}
              centerTitle={tray.length ? `${tray.length}개 파일` : '파일 선택'}
              centerSub={hoverAction ? hoverAction.label : trayKind ? KIND_LABEL[trayKind] : '먼저 파일을 담아요'}
              interactive
              onHover={setHover}
              onSelect={(i) => {
                if (!tray.length || !trayKind) { inputRef.current?.click(); return; }
                if (!busy) run(trayActions[i], tray);
              }}
            />
          </div>
          <p className="mt-2 min-h-10 max-w-xs text-center text-sm text-slate-600">{hoverAction ? hoverAction.hint : tray.length ? '조각을 누르면 바로 변환돼요.' : '파일을 담으면 형식에 맞는 조각이 나타나요.'}</p>
        </div>
      </section>

      {results.length ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-slate-950">만든 파일 {results.length}개</h2>
            <div className="flex gap-2">
              {results.length > 1 ? <button type="button" onClick={downloadAll} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"><Package className="h-4 w-4" /> ZIP으로 모두 받기</button> : null}
              <button type="button" onClick={clearResults} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><Trash2 className="h-4 w-4" /> 지우기</button>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {results.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[11px] font-black text-slate-400">
                  {(r.blob.type.startsWith('image/') && r.blob.type !== 'image/tiff') ? <img src={r.url} alt="" className="h-full w-full object-cover" /> : r.name.split('.').pop()?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{r.name}</p>
                  <p className="truncate text-xs text-slate-500">{formatBytes(r.blob.size)} · {r.from}</p>
                </div>
                <button type="button" onClick={() => download(r.url, r.name)} className="rounded-xl bg-white p-2.5 text-slate-700 shadow-sm hover:bg-indigo-50" aria-label={`${r.name} 받기`}><Download className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">파일은 이 브라우저 안에서만 만들어졌고 서버로 전송되지 않았어요. 페이지를 닫으면 사라져요.</p>
        </section>
      ) : null}

      {overlay ? (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-slate-950/25 backdrop-blur-[1px]">
          <div className="absolute flex flex-col items-center" style={{ left: overlay.x, top: overlay.y, transform: 'translate(-50%, -50%)' }}>
            <RadialDial
              actions={overlayActions}
              mode={overlay.mode}
              size={overlaySize()}
              highlighted={overlay.hi}
              centerTitle={overlay.hi !== null ? overlayActions[overlay.hi]?.label ?? '' : KIND_LABEL[overlay.kind]}
              centerSub={overlay.hi !== null ? '여기에 놓기' : '가운데 = 담기만'}
            />
            <p className="mt-3 max-w-xs rounded-2xl bg-white/95 px-4 py-2 text-center text-xs font-semibold text-slate-700 shadow">
              {overlay.hi !== null ? overlayActions[overlay.hi]?.hint : overlay.mode === 'convert' ? '조각 위에서 놓으면 변환 · Ctrl/Alt를 누르면 도구 다이얼' : '조각 위에서 놓으면 실행 · 키를 떼면 변환 다이얼'}
            </p>
          </div>
        </div>
      ) : null}

      {trimming ? <MediaTrim file={trimming} onClose={() => setTrimming(null)} onDone={(outputs) => { setTrimming(null); addResults(outputs); download(URL.createObjectURL(outputs[0].blob), outputs[0].name); }} /> : null}
      {organizing ? <PdfOrganizer file={organizing} onClose={() => setOrganizing(null)} onDone={(outputs) => { setOrganizing(null); addResults(outputs); download(URL.createObjectURL(outputs[0].blob), outputs[0].name); }} /> : null}
      {previewing ? <HwpPreview file={previewing} onClose={() => setPreviewing(null)} /> : null}
      {editing ? <ImageEditor file={editing} onClose={() => setEditing(null)} onDone={(outputs) => { setEditing(null); addResults(outputs); download(URL.createObjectURL(outputs[0].blob), outputs[0].name); }} /> : null}
    </div>
  );
}

export default FileDial;
