import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { mountHwpPreview } from '@/lib/file-dial/hwp-ops';

type Props = { file: File; onClose: () => void };

export function HwpPreview({ file, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref.current) return;
    let cleanup: (() => void) | undefined;
    mountHwpPreview(ref.current, file)
      .then((fn) => { cleanup = fn; })
      .catch((e: Error) => setError(`문서를 열지 못했어요: ${e.message}`))
      .finally(() => setLoading(false));
    return () => cleanup?.();
  }, [file]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="한글 문서 미리보기">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Preview</p>
            <h3 className="truncate text-base font-black text-slate-950">{file.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기"><X className="h-5 w-5" /></button>
        </div>
        {error ? <p className="m-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {loading ? <p className="p-6 text-center text-sm text-slate-500">문서를 여는 중…</p> : null}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          <div ref={ref} className="hwp-preview-host [&_.hwpjs-header-control]:hidden" />
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">브라우저에서 바로 그린 미리보기예요. 글꼴, 그림, 복잡한 표는 한글 프로그램과 다르게 보일 수 있어요.</p>
      </div>
    </div>
  );
}

export default HwpPreview;
