import { useState } from 'react';
import { diffLines, type DiffRow } from '../lib/free-text-tools/core.mjs';
export default function TextCompare() {
  const [before,setBefore]=useState(''),[after,setAfter]=useState(''),[rows,setRows]=useState<DiffRow[]|null>(null),[error,setError]=useState('');
  const change=(setter:(s:string)=>void)=>(e:React.ChangeEvent<HTMLTextAreaElement>)=>{setter(e.target.value);setRows(null);setError('');};
  return <section className="mt-6 space-y-5">
    <p className="text-sm text-slate-600">무료 · 브라우저 안에서 줄 단위로 비교합니다. 각 200,000자·1,000줄까지 가능합니다. 글자 단위 비교나 AI 분석은 아닙니다.</p>
    <div className="grid gap-4 md:grid-cols-2"><label className="font-bold">원본<textarea className="mt-2 block min-h-64 w-full rounded-xl border p-3 font-mono text-sm font-normal" value={before} maxLength={200000} onChange={change(setBefore)} /></label><label className="font-bold">수정본<textarea className="mt-2 block min-h-64 w-full rounded-xl border p-3 font-mono text-sm font-normal" value={after} maxLength={200000} onChange={change(setAfter)} /></label></div>
    <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-teal-800 px-5 py-3 font-bold text-white" onClick={()=>{try{setRows(diffLines(before,after));setError('');}catch(e){setError((e as Error).message);setRows(null);}}}>차이 비교</button><button className="rounded-xl border px-5 py-3" onClick={()=>{setBefore('');setAfter('');setRows(null);setError('');}}>모두 지우기</button></div>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {rows&&<div aria-live="polite"><p className="mb-3">추가 {rows.filter(r=>r.kind==='added').length}줄 · 삭제 {rows.filter(r=>r.kind==='removed').length}줄</p><div className="overflow-auto rounded-xl border">{rows.map((r,i)=><div key={i} className={`flex min-w-0 gap-3 border-b px-3 py-2 font-mono text-sm ${r.kind==='added'?'bg-green-50':r.kind==='removed'?'bg-red-50':'bg-white'}`}><span className="w-16 shrink-0 text-slate-500">{r.before??'–'} / {r.after??'–'}</span><span className="w-12 shrink-0">{r.kind==='added'?'+ 추가':r.kind==='removed'?'− 삭제':'동일'}</span><span className="whitespace-pre-wrap break-all">{r.text||'\u00a0'}</span></div>)}</div></div>}
  </section>;
}
