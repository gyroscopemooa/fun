import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { runFfmpeg, trimArgs } from '@/lib/file-dial/media-ops';
import type { DialOutput } from '@/lib/file-dial/actions';

type Props = { file: File; onDone: (outputs: DialOutput[]) => void; onClose: () => void };

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
};

export function MediaTrim({ file, onDone, onClose }: Props) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma)$/i.test(file.name);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const onLoaded = () => {
    const d = ref.current?.duration ?? 0;
    setDuration(Number.isFinite(d) ? d : 0);
    setEnd(Number.isFinite(d) ? d : 0);
  };
  const here = () => ref.current?.currentTime ?? 0;
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? (isAudio ? 'mp3' : 'mp4');

  const save = async () => {
    if (end - start < 0.2) { setError('끝 지점이 시작 지점보다 뒤에 있어야 해요.'); return; }
    setError('');
    try {
      const blob = await runFfmpeg(file, ext, trimArgs(start, end), setStatus, file.type || (isAudio ? 'audio/mpeg' : 'video/mp4'));
      onDone([{ name: `${file.name.replace(/\.[^.]+$/, '')}-${Math.round(start)}s-${Math.round(end)}s.${ext}`, blob, from: file.name }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus('');
    }
  };

  const Media = isAudio ? 'audio' : 'video';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="구간 자르기">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Trim</p>
            <h3 className="truncate text-lg font-black text-slate-950">{file.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기"><X className="h-5 w-5" /></button>
        </div>

        <Media ref={ref} src={url} controls onLoadedMetadata={onLoaded} className={isAudio ? 'mt-4 w-full' : 'mt-4 max-h-[46vh] w-full rounded-2xl bg-black'} />

        {duration ? (
          <div className="mt-4 space-y-3">
            <div className="relative h-2 rounded-full bg-slate-100">
              <div className="absolute h-2 rounded-full bg-teal-500" style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%` }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">시작 {fmt(start)}</p>
                <input type="range" min={0} max={duration} step={0.1} value={start} onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.2))} className="mt-2 w-full accent-teal-600" />
                <button type="button" onClick={() => setStart(Math.min(here(), end - 0.2))} className="mt-1 text-xs font-bold text-teal-700">지금 재생 위치를 시작으로</button>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">끝 {fmt(end)}</p>
                <input type="range" min={0} max={duration} step={0.1} value={end} onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.2))} className="mt-2 w-full accent-teal-600" />
                <button type="button" onClick={() => setEnd(Math.max(here(), start + 0.2))} className="mt-1 text-xs font-bold text-teal-700">지금 재생 위치를 끝으로</button>
              </div>
            </div>
            <p className="text-center text-sm font-bold text-slate-700">남길 길이 {fmt(end - start)} / 전체 {fmt(duration)}</p>
          </div>
        ) : <p className="mt-4 text-center text-sm text-slate-500">파일 길이를 읽는 중… (재생할 수 없는 형식이면 먼저 MP4·MP3로 변환해 주세요)</p>}

        {!isAudio ? <p className="mt-3 text-xs text-slate-500">빠르게 자르기 위해 다시 압축하지 않아요. 그래서 영상은 시작 지점이 가까운 키프레임으로 맞춰져 0~2초 정도 차이 날 수 있어요.</p> : null}
        {status ? <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-800">{status}</p> : null}
        {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">취소</button>
          <button type="button" onClick={save} disabled={!duration || Boolean(status)} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{status ? '자르는 중…' : '이 구간만 저장'}</button>
        </div>
      </div>
    </div>
  );
}

export default MediaTrim;
