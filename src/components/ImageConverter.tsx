import { useEffect, useRef, useState } from 'react';
export default function ImageConverter() {
  const [format, setFormat] = useState('png');
  const [quality, setQuality] = useState(90);
  const [picture, setPicture] = useState<{ image: HTMLImageElement; name: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!picture || !canvas.current) return;
    const c=canvas.current, image=picture.image;
    c.width=image.naturalWidth; c.height=image.naturalHeight;
    const ctx=c.getContext('2d'); if (!ctx) return;
    if (format==='jpeg') {ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);}
    ctx.drawImage(image,0,0);
  },[picture,format]);
  async function load(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setPicture(null);
    const url=URL.createObjectURL(file);
    try {
      if(file.size>20*1024*1024) throw Error('20MB 이하의 이미지를 선택해주세요.');
      const image=new Image();image.src=url;await image.decode();
      if(image.naturalWidth*image.naturalHeight>24000000) throw Error('2,400만 픽셀 이하의 이미지를 선택해주세요.');
      setPicture({image,name:file.name.replace(/\.[^.]+$/,'')});
    } catch(e) {setError(e instanceof Error && e.message.includes('이하') ? e.message : '이미지를 읽을 수 없습니다. JPG, PNG, WebP 파일을 선택해주세요.');}
    finally {URL.revokeObjectURL(url);setBusy(false);}
  }
  function download() {
    if(!canvas.current || !picture) return;
    canvas.current.toBlob(blob=>{
      if(!blob || blob.type!==`image/${format}`){setError('이 브라우저에서 선택한 형식으로 변환할 수 없습니다. 다른 형식을 선택해주세요.');return;}
      const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`${picture.name}.${format==='jpeg'?'jpg':format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    },`image/${format}`,quality/100);
  }
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
    <label className="block rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 p-6 font-bold">변환할 이미지 선택<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="mt-3 block w-full text-sm" onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/><span className="mt-3 block text-xs font-normal text-slate-500">JPG · PNG · WebP / 최대 20MB · 2,400만 픽셀</span></label>
    <label className="mt-5 block text-sm font-bold">변환할 확장자<select aria-label="변환할 확장자" className="mt-2 w-full rounded-xl border p-3" value={format} onChange={e=>{setFormat(e.target.value);setError('');}}><option value="png">PNG — 투명 배경 지원</option><option value="jpeg">JPG — 흰색 배경</option><option value="webp">WebP — 투명 배경 지원</option></select></label>
    {format!=='png' && <label className="mt-5 block text-sm font-bold">저장 품질 {quality}%<input aria-label="저장 품질" type="range" min="10" max="100" value={quality} onChange={e=>setQuality(Number(e.target.value))} className="mt-3 w-full"/></label>}
    <p className="mt-4 text-sm leading-6 text-slate-500">파일 이름만 바꾸는 것이 아니라 실제 이미지 형식을 변환합니다. JPG는 투명한 부분을 흰색으로 채웁니다. 애니메이션 이미지는 정지 이미지로 저장됩니다.</p>
    {busy && <p role="status">이미지를 읽는 중입니다…</p>}<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>
    <div className={picture ? 'mt-5 rounded-2xl bg-slate-100 p-4' : 'hidden'}><canvas ref={canvas} aria-label="변환 미리보기" className="mx-auto max-h-96 max-w-full object-contain"/></div>
    <button onClick={download} disabled={!picture || busy} className="mt-5 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white disabled:opacity-40">변환하고 다운로드</button>
  </section>;
}
