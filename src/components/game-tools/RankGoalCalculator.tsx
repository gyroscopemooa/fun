import { useMemo, useState } from 'react';
import { Flag, Target, TrendingUp } from 'lucide-react';

import { RANK_GAMES, ladderOf, ratingOf, type RankGame } from '@/lib/game-ranks';

const WIN_RATES = [45, 50, 52, 55, 58, 60, 65];

/** Expected net rating per game; ≤ 0 means the goal is unreachable on average. */
const netPerGame = (winRate: number, gain: number, loss: number) => (winRate / 100) * gain - (1 - winRate / 100) * loss;

const gamesNeeded = (distance: number, winRate: number, gain: number, loss: number) => {
  const net = netPerGame(winRate, gain, loss);
  return net > 0 ? Math.ceil(distance / net) : null;
};

/** Win rate needed to cover `distance` in `games` games. */
const requiredWinRate = (distance: number, games: number, gain: number, loss: number) => ((distance / games + loss) / (gain + loss)) * 100;

export function RankGoalCalculator() {
  const [game, setGame] = useState<RankGame>('lol');
  const meta = RANK_GAMES[game];
  const ladder = useMemo(() => ladderOf(game), [game]);
  const [current, setCurrent] = useState(ladder[10].id);
  const [points, setPoints] = useState(40);
  const [target, setTarget] = useState(ladder[14].id);
  const [winRate, setWinRate] = useState(55);
  const [gain, setGain] = useState(meta.gain);
  const [loss, setLoss] = useState(meta.loss);
  const [gamesPerDay, setGamesPerDay] = useState(5);
  const [budget, setBudget] = useState(50);

  const switchGame = (next: RankGame) => {
    const nextLadder = ladderOf(next);
    setGame(next);
    setCurrent(nextLadder[Math.min(10, nextLadder.length - 3)].id);
    setTarget(nextLadder[Math.min(14, nextLadder.length - 1)].id);
    setGain(RANK_GAMES[next].gain);
    setLoss(RANK_GAMES[next].loss);
  };

  const from = ratingOf(game, current, points);
  const to = ratingOf(game, target, 0);
  const distance = Math.max(0, to - from);
  const needed = gamesNeeded(distance, winRate, gain, loss);
  const wins = needed ? Math.round(needed * (winRate / 100)) : 0;
  const days = needed ? Math.ceil(needed / Math.max(1, gamesPerDay)) : null;
  const required = distance ? requiredWinRate(distance, Math.max(1, budget), gain, loss) : 0;
  const targetStep = ladder.find((s) => s.id === target);
  const currentStep = ladder.find((s) => s.id === current);
  const progress = to > 0 ? Math.min(100, (from / to) * 100) : 100;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANK_GAMES) as RankGame[]).map((id) => (
          <button key={id} type="button" onClick={() => switchGame(id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${game === id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
            {RANK_GAMES[id].emoji} {RANK_GAMES[id].label}
          </button>
        ))}
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-bold text-slate-800">현재 티어</span>
            <div className="mt-1.5 grid grid-cols-[1fr_96px] gap-2">
              <select value={current} onChange={(e) => setCurrent(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {ladder.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input type="number" min={0} max={1000} value={points} onChange={(e) => setPoints(Number(e.target.value) || 0)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" aria-label={meta.pointLabel} />
            </div>
            <span className="mt-1 block text-xs text-slate-400">오른쪽 칸은 현재 {meta.pointLabel}</span>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-800">목표 티어</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
              {ladder.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="flex justify-between text-sm font-bold text-slate-800"><span>예상 승률</span><span className="text-slate-500">{winRate}%</span></span>
            <input type="range" min={30} max={80} value={winRate} onChange={(e) => setWinRate(Number(e.target.value))} className="mt-2 w-full accent-slate-900" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-xs font-bold text-slate-600">승리 시 +{meta.pointLabel}
              <input type="number" min={1} max={60} value={gain} onChange={(e) => setGain(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-xl border border-emerald-200 px-2 py-2 text-sm font-normal" />
            </label>
            <label className="block text-xs font-bold text-slate-600">패배 시 −{meta.pointLabel}
              <input type="number" min={1} max={60} value={loss} onChange={(e) => setLoss(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-xl border border-rose-200 px-2 py-2 text-sm font-normal" />
            </label>
            <label className="block text-xs font-bold text-slate-600">하루 판수
              <input type="number" min={1} max={40} value={gamesPerDay} onChange={(e) => setGamesPerDay(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm font-normal" />
            </label>
          </div>
          <p className="text-[11px] leading-5 text-slate-400">승패 시 증감은 평균값이에요. 실제 게임은 숨은 MMR에 따라 달라지니 최근 판의 평균을 넣으면 더 정확해요.</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] bg-slate-950 p-6 text-white">
            <div className="flex items-center justify-between text-sm font-bold">
              <span style={{ color: currentStep?.color }}>{currentStep?.label} {points}{meta.pointLabel === '진행도 %' ? '%' : ` ${meta.pointLabel}`}</span>
              <span className="inline-flex items-center gap-1" style={{ color: targetStep?.color }}><Flag className="h-4 w-4" /> {targetStep?.label}</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#eab308)]" style={{ width: `${progress}%` }} />
            </div>
            {distance === 0 ? (
              <p className="mt-6 text-3xl font-black">이미 목표 티어예요! 🎉</p>
            ) : needed ? (
              <>
                <p className="mt-6 text-sm text-white/60">목표까지 남은 점수 {distance}</p>
                <p className="mt-1 text-5xl font-black tracking-tight">약 {needed.toLocaleString()}판</p>
                <p className="mt-2 text-sm text-white/70">승률 {winRate}% 기준 {wins}승 {needed - wins}패 · 하루 {gamesPerDay}판이면 약 <strong className="text-white">{days}일</strong></p>
              </>
            ) : (
              <>
                <p className="mt-6 text-3xl font-black">지금 승률로는 올라가기 어려워요</p>
                <p className="mt-2 text-sm text-white/70">판당 기대 점수가 {netPerGame(winRate, gain, loss).toFixed(1)}이에요. 승률을 {Math.ceil((loss / (gain + loss)) * 100)}% 넘게 올리면 조금씩 올라가요.</p>
              </>
            )}
          </div>

          {distance > 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-black text-slate-900"><Target className="h-4 w-4" /> 정해진 판수 안에 가려면</p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <input type="number" min={1} max={2000} value={budget} onChange={(e) => setBudget(Math.max(1, Number(e.target.value) || 1))} className="w-24 rounded-xl border border-slate-200 px-3 py-2" />
                <span className="text-slate-600">판 안에 →</span>
                <strong className={required > 100 ? 'text-rose-600' : required > 60 ? 'text-amber-600' : 'text-emerald-600'}>
                  {required > 100 ? '불가능에 가까워요' : `승률 ${Math.max(0, required).toFixed(1)}% 필요`}
                </strong>
              </div>
            </div>
          ) : null}

          {distance > 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-black text-slate-900"><TrendingUp className="h-4 w-4" /> 승률별 필요한 판수</p>
              <div className="mt-3 space-y-1.5">
                {WIN_RATES.map((rate) => {
                  const n = gamesNeeded(distance, rate, gain, loss);
                  const max = gamesNeeded(distance, WIN_RATES.find((r) => gamesNeeded(distance, r, gain, loss)) ?? 65, gain, loss) ?? 1;
                  return (
                    <div key={rate} className={`flex items-center gap-3 text-sm ${rate === winRate ? 'font-black' : ''}`}>
                      <span className="w-12 shrink-0 text-slate-600">{rate}%</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        {n ? <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(3, (n / max) * 100)}%` }} /> : null}
                      </div>
                      <span className="w-20 shrink-0 text-right text-slate-700">{n ? `${n.toLocaleString()}판` : '어려움'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default RankGoalCalculator;
