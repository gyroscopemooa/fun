import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Download, Play, RotateCcw, Trophy } from 'lucide-react';

import { saveNodeAsPng } from '@/lib/save-node-as-png';

// Browser aim trainer with three classic drills. Scores are comparable within a mode only.
type Mode = 'grid' | 'flick' | 'track';
type Size = 'S' | 'M' | 'L';
type Target = { x: number; y: number; r: number; born: number; vx?: number; vy?: number };
type Result = { mode: Mode; score: number; hits: number; misses: number; accuracy: number; avgMs: number; trackPct: number; size: Size };

const ROUND_MS = 30_000;
const RADIUS: Record<Size, number> = { S: 0.028, M: 0.04, L: 0.055 };
const STORE_KEY = 'manytool.aimChallenge.best';

const MODES: Record<Mode, { label: string; emoji: string; desc: string }> = {
  grid: { label: '그리드샷', emoji: '🟦', desc: '화면의 타겟 3개를 최대한 빨리 연속으로 맞혀요. 기본기와 클릭 속도 테스트.' },
  flick: { label: '플릭샷', emoji: '⚡', desc: '멀리 나타나는 작은 타겟 하나를 한 번에 휙 맞혀요. 순간 에임 테스트.' },
  track: { label: '트래킹', emoji: '🎯', desc: '움직이는 타겟 위에 조준점을 계속 올려 두세요. 따라가기 에임 테스트.' }
};

// Grade cut-offs per mode (score), tuned for a 30 s round on a medium target.
const GRADES = [
  { name: '아이언 사수', emoji: '🪨', color: '#78716c' },
  { name: '브론즈 사수', emoji: '🥉', color: '#b45309' },
  { name: '실버 사수', emoji: '🥈', color: '#64748b' },
  { name: '골드 사수', emoji: '🥇', color: '#ca8a04' },
  { name: '다이아 사수', emoji: '💎', color: '#0891b2' },
  { name: '마스터 에이머', emoji: '👑', color: '#7c3aed' },
  { name: '레전드 에이머', emoji: '🔥', color: '#dc2626' }
];
const CUTS: Record<Mode, number[]> = {
  grid: [0, 15000, 30000, 45000, 60000, 75000, 90000],
  flick: [0, 6000, 12000, 18000, 24000, 30000, 36000],
  track: [0, 25, 40, 55, 68, 80, 90]
};
const gradeOf = (mode: Mode, score: number) => {
  let g = 0;
  CUTS[mode].forEach((cut, i) => { if (score >= cut) g = i; });
  return GRADES[g];
};

const loadBest = (): Partial<Record<Mode, Result>> => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
};

export function AimChallenge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('grid');
  const [size, setSize] = useState<Size>('M');
  const [phase, setPhase] = useState<'idle' | 'count' | 'play' | 'done'>('idle');
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(ROUND_MS);
  const [live, setLive] = useState({ hits: 0, misses: 0, score: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<Partial<Record<Mode, Result>>>({});
  const [newBest, setNewBest] = useState(false);
  const [saving, setSaving] = useState(false);

  const state = useRef({ targets: [] as Target[], hits: 0, misses: 0, score: 0, times: [] as number[], onTarget: 0, frames: 0, start: 0, mouse: { x: -1, y: -1 }, raf: 0 });

  useEffect(() => setBest(loadBest()), []);

  const dims = () => {
    const c = canvasRef.current!;
    return { w: c.width, h: c.height, r: Math.min(c.width, c.height) * RADIUS[size] * (mode === 'flick' ? 0.8 : 1) };
  };

  const spawn = (avoid: Target[] = []): Target => {
    const { w, h, r } = dims();
    for (let tries = 0; tries < 30; tries += 1) {
      const t = { x: r + Math.random() * (w - 2 * r), y: r + Math.random() * (h - 2 * r), r, born: performance.now() };
      const far = mode === 'flick' ? Math.hypot(t.x - state.current.mouse.x, t.y - state.current.mouse.y) > Math.min(w, h) * 0.3 : true;
      if (far && avoid.every((a) => Math.hypot(a.x - t.x, a.y - t.y) > a.r + t.r + 8)) return t;
    }
    return { x: w / 2, y: h / 2, r, born: performance.now() };
  };

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const s = state.current;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    for (let x = 0; x < c.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
    for (let y = 0; y < c.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
    for (const t of s.targets) {
      const over = Math.hypot(s.mouse.x - t.x, s.mouse.y - t.y) <= t.r;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'track' && over ? '#22c55e' : '#f43f5e'; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.55, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.22, 0, Math.PI * 2); ctx.fillStyle = mode === 'track' && over ? '#22c55e' : '#f43f5e'; ctx.fill();
    }
    // Crosshair
    if (s.mouse.x >= 0) {
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2;
      const { x, y } = s.mouse;
      [[-12, 0, -4, 0], [4, 0, 12, 0], [0, -12, 0, -4], [0, 4, 0, 12]].forEach(([a, b, c2, d]) => { ctx.beginPath(); ctx.moveTo(x + a, y + b); ctx.lineTo(x + c2, y + d); ctx.stroke(); });
    }
  }, [mode]);

  const finish = useCallback(() => {
    const s = state.current;
    cancelAnimationFrame(s.raf);
    const shots = s.hits + s.misses;
    const trackPct = s.frames ? Math.round((s.onTarget / s.frames) * 100) : 0;
    const r: Result = {
      mode, size, hits: s.hits, misses: s.misses,
      accuracy: shots ? Math.round((s.hits / shots) * 100) : 0,
      avgMs: s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length) : 0,
      trackPct,
      score: mode === 'track' ? trackPct : Math.round(s.score)
    };
    setResult(r);
    setPhase('done');
    const prev = loadBest();
    const better = !prev[mode] || r.score > (prev[mode]?.score ?? 0);
    setNewBest(better);
    if (better) {
      const next = { ...prev, [mode]: r };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      setBest(next);
    }
  }, [mode, size]);

  const loop = useCallback(() => {
    const s = state.current;
    const now = performance.now();
    const remaining = Math.max(0, ROUND_MS - (now - s.start));
    if (mode === 'track') {
      const c = canvasRef.current!;
      for (const t of s.targets) {
        // Smoothly wandering target that bounces off the edges and changes direction now and then.
        if (Math.random() < 0.015) { const a = Math.random() * Math.PI * 2; const sp = Math.min(c.width, c.height) * 0.006; t.vx = Math.cos(a) * sp; t.vy = Math.sin(a) * sp; }
        t.x += t.vx ?? 0; t.y += t.vy ?? 0;
        if (t.x < t.r || t.x > c.width - t.r) t.vx = -(t.vx ?? 0);
        if (t.y < t.r || t.y > c.height - t.r) t.vy = -(t.vy ?? 0);
        t.x = Math.min(Math.max(t.r, t.x), c.width - t.r); t.y = Math.min(Math.max(t.r, t.y), c.height - t.r);
        s.frames += 1;
        if (Math.hypot(s.mouse.x - t.x, s.mouse.y - t.y) <= t.r) s.onTarget += 1;
      }
      setLive((l) => ({ ...l, score: s.frames ? Math.round((s.onTarget / s.frames) * 100) : 0 }));
    }
    draw();
    setLeft(remaining);
    if (remaining <= 0) { finish(); return; }
    s.raf = requestAnimationFrame(loop);
  }, [draw, finish, mode]);

  const start = () => {
    const c = canvasRef.current!;
    const box = c.getBoundingClientRect();
    c.width = Math.round(box.width * (window.devicePixelRatio > 1 ? 1.5 : 1));
    c.height = Math.round(box.height * (window.devicePixelRatio > 1 ? 1.5 : 1));
    Object.assign(state.current, { targets: [], hits: 0, misses: 0, score: 0, times: [], onTarget: 0, frames: 0 });
    setLive({ hits: 0, misses: 0, score: 0 });
    setResult(null);
    setPhase('count');
    setCount(3);
    draw();
    let n = 3;
    const tick = window.setInterval(() => {
      n -= 1;
      if (n > 0) { setCount(n); return; }
      window.clearInterval(tick);
      const s = state.current;
      if (mode === 'grid') { const a = spawn(); const b = spawn([a]); s.targets = [a, b, spawn([a, b])]; }
      else if (mode === 'flick') s.targets = [spawn()];
      else { const t = spawn(); const sp = Math.min(c.width, c.height) * 0.006; t.vx = sp; t.vy = sp * 0.6; s.targets = [t]; }
      s.start = performance.now();
      setPhase('play');
      s.raf = requestAnimationFrame(loop);
    }, 700);
  };

  useEffect(() => () => cancelAnimationFrame(state.current.raf), []);
  useEffect(() => { if (phase !== 'play') draw(); }, [mode, size, phase, draw]);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget; const box = c.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * c.width, y: ((e.clientY - box.top) / box.height) * c.height };
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    state.current.mouse = toCanvas(e);
    if (phase !== 'play') draw();
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'play' || mode === 'track') return;
    const p = toCanvas(e);
    state.current.mouse = p;
    const s = state.current;
    const i = s.targets.findIndex((t) => Math.hypot(p.x - t.x, p.y - t.y) <= t.r);
    if (i < 0) { s.misses += 1; setLive((l) => ({ ...l, misses: s.misses })); return; }
    const t = s.targets[i];
    const ms = performance.now() - t.born;
    s.hits += 1;
    s.times.push(ms);
    // Faster hits and centre hits score more; misses don't subtract, they lower accuracy.
    const centre = 1 - Math.hypot(p.x - t.x, p.y - t.y) / t.r;
    s.score += (mode === 'flick' ? 1200 : 700) * Math.max(0.25, 1 - ms / (mode === 'flick' ? 1500 : 1200)) * (0.75 + centre * 0.25);
    s.targets[i] = spawn(s.targets.filter((_, j) => j !== i));
    setLive({ hits: s.hits, misses: s.misses, score: Math.round(s.score) });
  };

  const save = async () => {
    if (!cardRef.current || !result) return;
    setSaving(true);
    try { await saveNodeAsPng(cardRef.current, `manytool-aim-${result.mode}-${result.score}.png`); } finally { setSaving(false); }
  };

  const grade = result ? gradeOf(result.mode, result.score) : null;
  const scoreLabel = (r: Result) => (r.mode === 'track' ? `${r.trackPct}%` : r.score.toLocaleString());

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button key={m} type="button" disabled={phase === 'play' || phase === 'count'} onClick={() => { setMode(m); setResult(null); setPhase('idle'); }}
              className={`rounded-2xl border p-3 text-left transition disabled:opacity-60 ${mode === m ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-rose-300'}`}>
              <p className="text-sm font-black text-slate-900">{MODES[m].emoji} {MODES[m].label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{MODES[m].desc}</p>
              <p className="mt-1.5 text-[11px] font-bold text-slate-400">최고 기록 {best[m] ? scoreLabel(best[m]!) : '-'}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
          <span>타겟 크기</span>
          {(['S', 'M', 'L'] as Size[]).map((s) => (
            <button key={s} type="button" disabled={phase === 'play' || phase === 'count'} onClick={() => setSize(s)} className={`rounded-full border px-3 py-1 ${size === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-400'}`}>{s === 'S' ? '작게' : s === 'M' ? '보통' : '크게'}</button>
          ))}
          <span className="ml-auto text-slate-400">등급은 "보통" 크기 기준이에요</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold text-white">
          <span className="inline-flex items-center gap-1.5"><Crosshair className="h-4 w-4 text-emerald-400" /> {MODES[mode].label}</span>
          <span className="tabular-nums">{(left / 1000).toFixed(1)}초</span>
          <span className="tabular-nums text-slate-300">{mode === 'track' ? `조준 유지 ${live.score}%` : `명중 ${live.hits} · 실패 ${live.misses} · ${live.score.toLocaleString()}점`}</span>
        </div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerLeave={() => { state.current.mouse = { x: -1, y: -1 }; }}
            className="block aspect-[16/9] w-full touch-none"
            style={{ cursor: phase === 'play' ? 'none' : 'crosshair' }}
          />
          {phase !== 'play' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 p-4 text-center text-white">
              {phase === 'count' ? <p className="text-6xl font-black tabular-nums">{count}</p> : (
                <>
                  <p className="text-lg font-black">{phase === 'done' ? '한 번 더?' : `${MODES[mode].emoji} ${MODES[mode].label} 30초 챌린지`}</p>
                  <p className="max-w-sm text-xs text-slate-300">{MODES[mode].desc}{mode === 'track' ? ' 클릭할 필요 없이 마우스만 움직이면 돼요.' : ''}</p>
                  <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 text-sm font-black text-white shadow-lg hover:bg-rose-600">
                    {phase === 'done' ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />} {phase === 'done' ? '다시 도전' : '시작하기'}
                  </button>
                  <p className="text-[11px] text-slate-400">마우스가 있는 PC에서 가장 정확해요</p>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {result && grade ? (
        <section className="flex flex-col items-center gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-start">
          <div className="max-w-full overflow-auto rounded-[22px] shadow-xl max-[419px]:[zoom:0.8]">
            <div ref={cardRef} className="flex h-[480px] w-[360px] flex-col p-6 text-white" style={{ background: `radial-gradient(circle at 80% 0%, ${grade.color}, transparent 60%), #0b1220` }}>
              <div className="flex items-center justify-between text-[11px] font-black tracking-[0.25em]">
                <span>AIM CHALLENGE</span><span className="text-white/50">ManyTool</span>
              </div>
              <p className="mt-6 text-sm font-bold text-white/70">{MODES[result.mode].emoji} {MODES[result.mode].label} · 30초 · 타겟 {result.size === 'S' ? '작게' : result.size === 'M' ? '보통' : '크게'}</p>
              <p className="mt-2 text-[56px] font-black leading-none tabular-nums">{scoreLabel(result)}</p>
              <p className="mt-3 text-2xl font-black">{grade.emoji} {grade.name}</p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                {result.mode === 'track' ? (
                  <div className="col-span-3 rounded-2xl bg-white/10 p-3"><p className="text-[11px] text-white/60">타겟 위 조준 시간</p><p className="text-xl font-black">{result.trackPct}%</p></div>
                ) : (
                  <>
                    <div className="rounded-2xl bg-white/10 p-3"><p className="text-[11px] text-white/60">명중</p><p className="text-xl font-black">{result.hits}</p></div>
                    <div className="rounded-2xl bg-white/10 p-3"><p className="text-[11px] text-white/60">정확도</p><p className="text-xl font-black">{result.accuracy}%</p></div>
                    <div className="rounded-2xl bg-white/10 p-3"><p className="text-[11px] text-white/60">평균</p><p className="text-xl font-black">{result.avgMs}ms</p></div>
                  </>
                )}
              </div>
              <p className="mt-auto text-right text-[10px] font-bold text-white/40">manytool.net/aim-challenge</p>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-3 text-sm text-slate-700">
            {newBest ? <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"><Trophy className="h-3.5 w-3.5" /> 새 최고 기록!</p> : null}
            <p className="leading-6">
              {result.mode === 'track'
                ? '트래킹은 타겟을 따라가는 손의 안정감이 중요해요. 손목보다 팔 전체로 부드럽게 움직여 보세요.'
                : result.accuracy < 70
                  ? '정확도가 70% 아래예요. 속도를 조금 늦추고 타겟 중앙을 노리면 점수가 더 올라가요.'
                  : result.avgMs > 700
                    ? '정확도는 좋아요! 이제 다음 타겟으로 시선을 먼저 옮기는 연습으로 속도를 올려 보세요.'
                    : '빠르고 정확해요. 타겟 크기를 "작게"로 바꿔 더 높은 난이도에 도전해 보세요.'}
            </p>
            <button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-60">
              <Download className="h-4 w-4" /> {saving ? '이미지 만드는 중…' : '결과 카드 저장'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <a href="/fps-sensitivity-converter" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">🖱️ 감도 맞추기</a>
              <a href="/crosshair-generator" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">➕ 크로스헤어 만들기</a>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AimChallenge;
