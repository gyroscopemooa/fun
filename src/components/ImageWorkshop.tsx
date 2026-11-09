import { useEffect, useRef, useState } from 'react';
type Picture = { id: string; name: string; image: HTMLImageElement };
const field = 'mt-2 w-full rounded-xl border border-slate-300 p-3';
export default function ImageWorkshop({ mode }: { mode: 'crop' | 'merge' }) {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [direction, setDirection] = useState('vertical');
  const [gap, setGap] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const first = pictures[0]?.image;
  useEffect(() => {
    setValid(false);
    if (!canvas.current || !pictures.length) return;
    try {
      let width: number, height: number;
      if (mode === 'crop') {
        const { x, y, w, h } = rect;
        if (![x,y,w,h].every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x+w > first.naturalWidth || y+h > first.naturalHeight) throw Error('자르기 영역이 원본 이미지 안에 들어오도록 위치와 크기를 입력해주세요.');
        width = w; height = h;
      } else {
        if (!Number.isInteger(gap) || gap < 0 || gap > 200) throw Error('간격은 0~200px로 입력해주세요.');
        const widths = pictures.map(p => p.image.naturalWidth), heights = pictures.map(p => p.image.naturalHeight);
        width = direction === 'vertical' ? Math.max(...widths) : widths.reduce((a,b)=>a+b,0) + gap*(pictures.length-1);
        height = direction === 'vertical' ? heights.reduce((a,b)=>a+b,0) + gap*(pictures.length-1) : Math.max(...heights);
      }
      if (width > 16384 || height > 16384 || width*height > 24000000) throw Error('결과가 너무 큽니다. 이미지 크기나 사진 수를 줄여주세요. (최대 2,400만 픽셀, 한 변 16,384px)');
      const c = canvas.current; c.width = width; c.height = height;
      const ctx = c.getContext('2d'); if (!ctx) throw Error('이 브라우저에서 이미지를 처리할 수 없습니다.');
      if (mode === 'crop') ctx.drawImage(first, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);
      else {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,width,height);
        let offset = 0;
        pictures.forEach(({image}) => { ctx.drawImage(image, direction === 'vertical' ? (width-image.naturalWidth)/2 : offset, direction === 'vertical' ? offset : (height-image.naturalHeight)/2); offset += (direction === 'vertical' ? image.naturalHeight : image.naturalWidth)+gap; });
      }
      setError(''); setValid(true);
    } catch (e) { setError((e as Error).message); }
  }, [pictures, rect, direction, gap, mode]);
  async function load(files: File[]) {
    setBusy(true); setError('');
    try {
      const selected = mode === 'crop' ? files.slice(0,1) : files;
      if (!selected.length) return;
      if (selected.length + (mode === 'merge' ? pictures.length : 0) > 12) throw Error('사진은 최대 12장까지 합칠 수 있습니다.');
      const next: Picture[] = [];
      for (const file of selected) {
        if (file.size > 20*1024*1024) throw Error('사진 한 장은 20MB 이하로 선택해주세요.');
        const url = URL.createObjectURL(file), image = new Image();
        try { image.src = url; await image.decode(); } catch { throw Error('읽을 수 없는 이미지입니다. JPG, PNG, WebP 파일을 선택해주세요.'); } finally { URL.revokeObjectURL(url); }
        if (image.naturalWidth*image.naturalHeight > 24000000) throw Error('사진 한 장은 2,400만 픽셀 이하로 선택해주세요.');
        next.push({id: crypto.randomUUID(), name: file.name, image});
      }
      setPictures(mode === 'crop' ? next : [...pictures, ...next]);
      if (mode === 'crop') setRect({x:0,y:0,w:next[0].image.naturalWidth,h:next[0].image.naturalHeight});
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function download() {
    if (!valid || !canvas.current) return;
    canvas.current.toBlob(blob => {
      if (!blob) { setError('이미지 저장에 실패했습니다. 크기를 줄여 다시 시도해주세요.'); return; }
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=`manytool-${mode}.png`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
    }, 'image/png');
  }
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
    <label className="block rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 p-6 font-bold">{mode === 'crop' ? '자를 사진 선택' : '합칠 사진 추가 (최대 12장)'}<input className="mt-3 block w-full text-sm" type="file" accept="image/png,image/jpeg,image/webp" multiple={mode === 'merge'} disabled={busy} onChange={e => { void load(Array.from(e.target.files || [])); e.target.value=''; }}/><span className="mt-3 block text-xs font-normal text-slate-500">JPG · PNG · WebP / 한 장 최대 20MB · 2,400만 픽셀</span></label>
    {busy && <p role="status" className="mt-4">사진을 읽는 중입니다…</p>}
    {!!pictures.length && <>
      {mode === 'crop' ? <><p className="mt-5 text-sm text-slate-500">원본 {first.naturalWidth} × {first.naturalHeight}px · 왼쪽 위가 시작점(0, 0)입니다.</p><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{(['x','y','w','h'] as const).map((key,i) => <label key={key} className="text-sm font-bold">{['시작 X','시작 Y','너비','높이'][i]}<input className={field} type="number" min={i<2 ? 0 : 1} aria-label={['시작 X','시작 Y','너비','높이'][i]} value={rect[key]} onChange={e=>setRect({...rect,[key]:Number(e.target.value)})}/></label>)}</div><button className="mt-3 text-sm font-bold text-violet-700" onClick={()=>setRect({x:0,y:0,w:first.naturalWidth,h:first.naturalHeight})}>원본 영역으로 초기화</button><details className="mt-4"><summary className="cursor-pointer text-sm">원본 이미지 보기</summary><canvas ref={node => {if(node){node.width=first.naturalWidth;node.height=first.naturalHeight;node.getContext('2d')?.drawImage(first,0,0);}}} className="mt-3 max-h-80 max-w-full object-contain" aria-label="원본 이미지"/></details></> : <><div className="mt-5 grid grid-cols-2 gap-4"><label className="text-sm font-bold">합치기 방향<select className={field} value={direction} onChange={e=>setDirection(e.target.value)}><option value="vertical">세로로 합치기</option><option value="horizontal">가로로 합치기</option></select></label><label className="text-sm font-bold">사진 사이 간격 (px)<input className={field} type="number" min="0" max="200" value={gap} onChange={e=>setGap(Number(e.target.value))}/></label></div><p className="mt-3 text-sm text-slate-500">원본 크기를 유지하며 중앙 정렬합니다. 여백은 흰색입니다.</p><ol className="mt-4 space-y-2">{pictures.map((p,i)=><li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"><span className="min-w-0 flex-1 truncate">{i+1}. {p.name}</span><button aria-label={`${i+1}번 사진 앞으로`} disabled={!i || busy} className="rounded border p-2 disabled:opacity-30" onClick={()=>setPictures(prev=>{const next=[...prev];[next[i-1],next[i]]=[next[i],next[i-1]];return next;})}>↑</button><button aria-label={`${i+1}번 사진 뒤로`} disabled={i===pictures.length-1 || busy} className="rounded border p-2 disabled:opacity-30" onClick={()=>setPictures(prev=>{const next=[...prev];[next[i],next[i+1]]=[next[i+1],next[i]];return next;})}>↓</button><button disabled={busy} className="rounded border p-2" onClick={()=>setPictures(pictures.filter(x=>x.id!==p.id))}>삭제</button></li>)}</ol></>}
    </>}
    <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>
    <div className={valid ? 'mt-6 rounded-2xl bg-slate-100 p-4' : 'hidden'}><p className="mb-3 text-sm font-bold">결과 미리보기 · {canvas.current?.width} × {canvas.current?.height}px</p><canvas ref={canvas} className="mx-auto max-h-[520px] max-w-full object-contain" aria-label="편집 결과 미리보기"/></div>
    <button disabled={!valid || busy} onClick={download} className="mt-5 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white disabled:opacity-40">PNG 다운로드</button>
  </section>;
}
