import { useState } from 'react';

function game() {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = 44; i > 0; i--) {
    const range = i + 1, limit = Math.floor(4294967296 / range) * range;
    let value: number;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
    const j = value % range;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 6).sort((a, b) => a - b);
}
const colors = ['bg-amber-400 text-slate-950', 'bg-sky-500 text-white', 'bg-rose-500 text-white', 'bg-slate-600 text-white', 'bg-emerald-600 text-white'];
export default function LottoGenerator() {
  const [count, setCount] = useState(5);
  const [rows, setRows] = useState<number[][]>([]);
  const [message, setMessage] = useState('');
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
    <div className="flex flex-wrap items-end gap-4"><label className="text-sm font-bold">게임 수<select aria-label="게임 수" value={count} onChange={e => setCount(Number(e.target.value))} className="ml-3 rounded-xl border p-3">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}게임</option>)}</select></label><button className="rounded-xl bg-violet-600 px-6 py-3 font-bold text-white" onClick={() => { setRows(Array.from({length: count}, game)); setMessage(''); }}>번호 생성하기</button></div>
    <div aria-live="polite" className="mt-6 space-y-3">{rows.length ? rows.map((row, i) => <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3 sm:gap-4 sm:p-5"><span className="mr-1 text-sm font-bold text-slate-500">{String.fromCharCode(65+i)}</span>{row.map(n => <span key={n} className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black shadow-sm sm:h-12 sm:w-12 ${colors[Math.floor((n-1)/10)]}`}>{n}</span>)}</div>) : <p className="rounded-2xl bg-slate-50 px-5 py-12 text-center text-slate-500">오늘의 번호를 뽑아보세요.</p>}</div>
    {!!rows.length && <button className="mt-5 rounded-xl border px-5 py-3 font-bold" onClick={async () => { try { await navigator.clipboard.writeText(rows.map((r,i) => `${String.fromCharCode(65+i)}: ${r.join(', ')}`).join('\n')); setMessage('번호를 복사했습니다.'); } catch { setMessage('복사할 수 없습니다. 번호를 직접 선택해 복사해주세요.'); } }}>전체 번호 복사</button>}
    <p role="status" className="mt-3 text-sm text-violet-700">{message}</p><p className="mt-6 border-t pt-5 text-sm leading-6 text-slate-500">재미로 사용하는 무작위 번호 생성기입니다. 당첨을 예측하거나 당첨 확률을 높이지 않습니다.</p>
  </section>;
}
