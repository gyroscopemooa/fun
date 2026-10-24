import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Dices, Plus, RefreshCw, Scale, Trash2, Users } from 'lucide-react';

import { RANK_GAMES, ladderOf, ratingOf, stepOfRating, type RankGame } from '@/lib/game-ranks';
import { GAMES } from '@/lib/game-picker/games';
import { assignTeamComp, restoreCompPick, uniqueAcrossTeams, type CompPick } from '@/lib/game-picker/team-comp';
import type { GameCharacter } from '@/lib/game-picker/types';
import { ShareLinkButton } from '@/components/share/ShareLinkButton';
import { decodeSharePayload, encodeSharePayload } from '@/lib/share-result';

type Player = { id: number; name: string; step: string; points: number; wins: number; losses: number; position: string };
type Split = { a: Player[]; b: Player[]; score: number; diff: number; duplicates: number };

const MAX_PLAYERS = 12;
const STORAGE_KEY = 'manytool.teamBalancer.v1';
// Recent form can move a player by up to ±60 rating (about 2/3 of a division) once 10+ games are entered.
const FORM_WEIGHT = 60;
// Positions are a soft preference: one duplicate costs about as much as 12 rating of imbalance.
const POSITION_PENALTY = 12;

const formBonus = (p: Player) => {
  const games = p.wins + p.losses;
  if (!games) return 0;
  const confidence = Math.min(1, games / 10);
  return ((p.wins - p.losses) / games) * FORM_WEIGHT * confidence;
};

export const effectiveRating = (game: RankGame, p: Player) => ratingOf(game, p.step, p.points) + formBonus(p);

const sampleNames = ['민수', '지훈', '서연', '하늘', '도윤', '수아', '예준', '지민', '태양', '유나'];

const newPlayer = (game: RankGame, id: number, name = ''): Player => {
  const ladder = ladderOf(game);
  return { id, name, step: ladder[Math.floor(ladder.length * 0.4)].id, points: 50, wins: 0, losses: 0, position: '' };
};

const combinations = (n: number, k: number) => {
  const out: number[][] = [];
  const rec = (start: number, combo: number[]) => {
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i < n; i += 1) {
      combo.push(i);
      rec(i + 1, combo);
      combo.pop();
    }
  };
  rec(0, []);
  return out;
};

const duplicatePositions = (team: Player[]) => {
  const seen = new Map<string, number>();
  team.forEach((p) => p.position && seen.set(p.position, (seen.get(p.position) ?? 0) + 1));
  return [...seen.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
};

const avg = (game: RankGame, team: Player[]) => team.reduce((sum, p) => sum + effectiveRating(game, p), 0) / Math.max(1, team.length);

// Exhaustive search: at most C(12,6)=924 splits, so every option is scored exactly.
const bestSplits = (game: RankGame, players: Player[]): Split[] => {
  const size = Math.floor(players.length / 2);
  const splits = combinations(players.length, size)
    .filter((combo) => players.length % 2 === 1 || combo.includes(0))
    .map((combo) => {
      const a = combo.map((i) => players[i]);
      const b = players.filter((_, i) => !combo.includes(i));
      const diff = Math.abs(avg(game, a) - avg(game, b));
      const duplicates = duplicatePositions(a) + duplicatePositions(b);
      return { a, b, diff, duplicates, score: diff + duplicates * POSITION_PENALTY };
    });
  return splits.sort((x, y) => x.score - y.score);
};

// Elo-style estimate; 400 rating ≈ four divisions.
const winChance = (ratingA: number, ratingB: number) => 1 / (1 + 10 ** ((ratingB - ratingA) / 400));

// Shared link payload: players as [name, step, points, wins, losses, position], blue team ids, optional comp picks.
type SharedTeams = { g: RankGame; p: [string, string, number, number, number, string][]; a: number[]; c?: Record<number, [string, string]> };

const sameIds = (team: Player[], ids: number[]) => team.length === ids.length && team.every((p) => ids.includes(p.id));

function TeamCard({ title, color, team, game, chance, comp }: { title: string; color: string; team: Player[]; game: RankGame; chance: number; comp?: Map<number, CompPick> }) {
  const average = avg(game, team);
  const step = stepOfRating(game, average);
  return (
    <div className="rounded-[24px] border-2 bg-white p-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <p className="text-lg font-black" style={{ color }}>{title}</p>
        <p className="text-xs font-bold text-slate-500">승률 예측 {Math.round(chance * 100)}%</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">평균 <strong style={{ color: step.color }}>{step.label}</strong> · {Math.round(average)}점</p>
      <ul className="mt-3 space-y-1.5">
        {[...team].sort((x, y) => effectiveRating(game, y) - effectiveRating(game, x)).map((p) => {
          const s = ladderOf(game).find((item) => item.id === p.step);
          const pick = comp?.get(p.id);
          return (
            <li key={p.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-bold text-slate-900">{p.name || `플레이어 ${p.id}`}{p.position ? <span className="ml-1.5 text-xs font-semibold text-slate-400">{p.position}</span> : null}</span>
                <span className="shrink-0 text-xs font-bold" style={{ color: s?.color }}>{s?.label}</span>
              </div>
              {pick ? (
                <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-2">
                  <img src={pick.character.icon} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-slate-800 object-cover" />
                  <span className="min-w-0 truncate text-sm font-black text-slate-900">{pick.character.name}</span>
                  <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: pick.role.color }}>{pick.role.emoji} {pick.role.label}</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TeamBalancer() {
  const [game, setGame] = useState<RankGame>('lol');
  const [players, setPlayers] = useState<Player[]>(() => Array.from({ length: 10 }, (_, i) => newPlayer('lol', i + 1)));
  const [result, setResult] = useState<{ splits: Split[]; index: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [rosters, setRosters] = useState<Partial<Record<RankGame, GameCharacter[]>>>({});
  const [comps, setComps] = useState<{ a: Map<number, CompPick>; b: Map<number, CompPick> } | null>(null);
  const [rollingComp, setRollingComp] = useState(false);
  const [shared, setShared] = useState(false);
  // The first save would run with the default roster before a saved or shared one is loaded.
  const skipFirstSave = useRef(true);
  const meta = RANK_GAMES[game];
  const ladder = useMemo(() => ladderOf(game), [game]);

  useEffect(() => {
    // A shared link (?t=...) shows the friend's teams without touching this browser's saved roster.
    const packed = new URLSearchParams(window.location.search).get('t');
    const data = packed ? decodeSharePayload<SharedTeams>(packed) : null;
    if (data && RANK_GAMES[data.g] && Array.isArray(data.p) && data.p.length >= 2) {
      const list: Player[] = data.p.slice(0, MAX_PLAYERS).map(([name, step, points, wins, losses, position], i) => ({
        id: i + 1, name: String(name).slice(0, 12), step, points: Number(points) || 0, wins: Number(wins) || 0, losses: Number(losses) || 0, position
      }));
      const splits = bestSplits(data.g, list);
      const index = splits.findIndex((s) => sameIds(s.a, data.a) || sameIds(s.b, data.a));
      setShared(true);
      setGame(data.g);
      setPlayers(list);
      setResult({ splits, index: Math.max(0, index) });
      if (data.c && index >= 0) {
        const swapped = !sameIds(splits[index].a, data.a);
        const roster = GAMES[data.g].fallback;
        const picks = new Map<number, CompPick>();
        Object.entries(data.c).forEach(([id, [roleId, charId]]) => {
          const pick = restoreCompPick(data.g, roster, roleId, charId);
          if (pick) picks.set(Number(id), pick);
        });
        const blue = new Map([...picks].filter(([id]) => data.a.includes(id)));
        const red = new Map([...picks].filter(([id]) => !data.a.includes(id)));
        setComps(swapped ? { a: red, b: blue } : { a: blue, b: red });
      }
      return;
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.game && Array.isArray(saved.players) && saved.players.length) {
        setGame(saved.game);
        setPlayers(saved.players);
      }
    } catch {
      // Ignore unreadable saves and keep the default roster.
    }
  }, []);

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (shared) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, players }));
    } catch {
      // Saving the roster is only a convenience.
    }
  }, [game, players, shared]);

  const switchGame = (next: RankGame) => {
    setGame(next);
    setResult(null);
    setPlayers((prev) => prev.map((p) => ({ ...newPlayer(next, p.id, p.name), wins: p.wins, losses: p.losses })));
  };

  const update = (id: number, patch: Partial<Player>) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setResult(null);
  };

  const addPlayer = () => players.length < MAX_PLAYERS && setPlayers((prev) => [...prev, newPlayer(game, Math.max(0, ...prev.map((p) => p.id)) + 1)]);
  const removePlayer = (id: number) => players.length > 2 && setPlayers((prev) => prev.filter((p) => p.id !== id));

  const fillSample = () => {
    setPlayers(sampleNames.map((name, i) => ({
      ...newPlayer(game, i + 1, name),
      step: ladder[Math.min(ladder.length - 1, 3 + ((i * 7) % (ladder.length - 6)))].id,
      points: (i * 37) % 100,
      wins: (i * 3) % 8,
      losses: (i * 5) % 7,
      position: meta.positions[i % meta.positions.length]
    })));
    setResult(null);
  };

  const balance = () => {
    setComps(null);
    setResult({ splits: bestSplits(game, players), index: 0 });
  };

  // Latest character list for the comp roll; the bundled snapshot is used until (or if) it loads.
  useEffect(() => {
    if (!result || rosters[game]) return;
    GAMES[game].load().then((list) => list.length && setRosters((prev) => ({ ...prev, [game]: list }))).catch(() => undefined);
  }, [result, game, rosters]);

  // "다시 나누기" walks through other splits that are still within 2% of the best balance.
  const reroll = () => {
    setComps(null);
    rerollSplit();
  };
  const rerollSplit = () => setResult((prev) => {
    if (!prev) return prev;
    const best = prev.splits[0].score;
    const fair = prev.splits.filter((s) => s.score <= best + Math.max(8, best * 0.02)).length;
    return { ...prev, index: (prev.index + 1) % Math.max(1, Math.min(fair, prev.splits.length)) };
  });

  const split = result?.splits[result.index];
  const ratingA = split ? avg(game, split.a) : 0;
  const ratingB = split ? avg(game, split.b) : 0;
  // 100% means a 50:50 predicted match; every point of predicted edge costs two points of balance.
  const balanceScore = split ? Math.max(0, 100 - Math.abs(winChance(ratingA, ratingB) - 0.5) * 200) : 0;

  const rollComps = () => {
    if (!split) return;
    setRollingComp(true);
    window.setTimeout(() => {
      const roster = rosters[game] ?? GAMES[game].fallback;
      const a = assignTeamComp(game, roster, split.a);
      const taken = uniqueAcrossTeams(game) ? new Set([...a.values()].map((pick) => pick.character.id)) : new Set<string>();
      setComps({ a, b: assignTeamComp(game, roster, split.b, taken) });
      setRollingComp(false);
    }, 500);
  };

  const shareUrl = useMemo(() => {
    if (!split) return '';
    const payload: SharedTeams = {
      g: game,
      p: players.map((p) => [p.name, p.step, p.points, p.wins, p.losses, p.position]),
      a: split.a.map((p) => players.indexOf(p) + 1)
    };
    if (comps) {
      payload.c = {};
      [...comps.a, ...comps.b].forEach(([id, pick]) => {
        const index = players.findIndex((p) => p.id === id);
        if (index >= 0) payload.c![index + 1] = [pick.role.id, pick.character.id];
      });
    }
    return `/game-team-balancer?t=${encodeSharePayload(payload)}`;
  }, [split, comps, game, players]);

  const startOwn = () => {
    setShared(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const copyResult = async () => {
    if (!split) return;
    const line = (team: Player[], comp?: Map<number, CompPick>) => team.map((p) => {
      const name = p.name || `플레이어 ${p.id}`;
      const pick = comp?.get(p.id);
      return pick ? `${name}(${pick.character.name})` : name;
    }).join(', ');
    try {
      await navigator.clipboard.writeText(`[ManyTool 팀 나누기] ${meta.label}\n블루팀: ${line(split.a, comps?.a)}\n레드팀: ${line(split.b, comps?.b)}\n밸런스 ${balanceScore.toFixed(1)}%`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      {shared ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 sm:flex-row">
          <p className="text-sm font-bold text-amber-900">👋 친구가 공유한 팀 나누기 결과예요. 아래 결과를 확인하고, 참가자를 바꿔 다시 나눌 수도 있어요.</p>
          <button type="button" onClick={startOwn} className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-700">우리 팀 직접 나누기 →</button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANK_GAMES) as RankGame[]).map((id) => (
          <button key={id} type="button" onClick={() => switchGame(id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${game === id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
            {RANK_GAMES[id].emoji} {RANK_GAMES[id].label}
          </button>
        ))}
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Users className="h-5 w-5" /> 참가자 {players.length}명</h2>
          <div className="flex gap-2">
            <button type="button" onClick={fillSample} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">샘플 10명 채우기</button>
            <button type="button" onClick={addPlayer} disabled={players.length >= MAX_PLAYERS} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> 추가</button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">티어 + {meta.pointLabel} + 최근 승패(최대 ±0.6디비전)로 실력을 계산하고, 주 포지션이 겹치지 않게 모든 조합을 비교해요.</p>

        <div className="mt-4 hidden grid-cols-[1.2fr_1.2fr_0.6fr_0.9fr_0.9fr_auto] gap-2 px-1 text-[11px] font-bold text-slate-400 md:grid">
          <span>이름</span><span>티어</span><span>{meta.pointLabel}</span><span>최근 승 / 패</span><span>주 포지션</span><span />
        </div>
        <div className="mt-2 space-y-2">
          {players.map((p) => (
            <div key={p.id} className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 md:grid-cols-[1.2fr_1.2fr_0.6fr_0.9fr_0.9fr_auto] md:bg-transparent md:p-0">
              <input value={p.name} onChange={(e) => update(p.id, { name: e.target.value.slice(0, 12) })} placeholder={`플레이어 ${p.id}`} className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-1" />
              <p className="col-span-2 -mb-1 grid grid-cols-2 gap-2 px-1 text-[10px] font-bold text-slate-400 md:hidden">
                <span>티어 · {meta.pointLabel}</span>
                <span>최근 승 · 패 · 포지션</span>
              </p>
              <select value={p.step} onChange={(e) => update(p.id, { step: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm">
                {ladder.map((step) => <option key={step.id} value={step.id}>{step.label}</option>)}
              </select>
              <input type="number" min={0} max={1000} value={p.points} onChange={(e) => update(p.id, { points: Number(e.target.value) || 0 })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm" aria-label={meta.pointLabel} />
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={50} value={p.wins} onChange={(e) => update(p.id, { wins: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-xl border border-emerald-200 bg-white px-2 py-2 text-sm" aria-label="최근 승" />
                <input type="number" min={0} max={50} value={p.losses} onChange={(e) => update(p.id, { losses: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-xl border border-rose-200 bg-white px-2 py-2 text-sm" aria-label="최근 패" />
              </div>
              <select value={p.position} onChange={(e) => update(p.id, { position: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm">
                <option value="">상관없음</option>
                {meta.positions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <button type="button" onClick={() => removePlayer(p.id)} disabled={players.length <= 2} className="flex items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30" aria-label="삭제">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={balance} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#dc2626)] py-4 text-base font-black text-white shadow-lg transition hover:brightness-110">
          <Scale className="h-5 w-5" /> 공정하게 팀 나누기
        </button>
      </section>

      {split ? (
        <section className="space-y-4">
          <div className="rounded-[24px] bg-slate-950 p-5 text-white">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Balance</p>
                <p className="text-3xl font-black">{balanceScore.toFixed(1)}%</p>
                <p className="text-xs text-white/60">평균 실력 차이 {Math.round(split.diff)}점 · {result!.splits.length}가지 조합 중 {result!.index + 1}번째로 공정{split.duplicates ? ` · 포지션 겹침 ${split.duplicates}명` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={reroll} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"><RefreshCw className="h-4 w-4" /> 다시 나누기</button>
                <button type="button" onClick={rollComps} disabled={rollingComp} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-amber-300 disabled:opacity-60"><Dices className={`h-4 w-4 ${rollingComp ? 'animate-spin' : ''}`} /> {comps ? '조합 다시 굴리기' : '팀별 조합 굴리기'}</button>
                <button type="button" onClick={copyResult} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900"><Copy className="h-4 w-4" /> {copied ? '복사됨' : '결과 복사'}</button>
                <ShareLinkButton url={shareUrl} title={`[ManyTool 팀 나누기] ${meta.label} 밸런스 ${balanceScore.toFixed(1)}%`} text="우리 팀 나누기 결과" label="링크 공유" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900" />
              </div>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full">
              <div className="bg-blue-500" style={{ width: `${winChance(ratingA, ratingB) * 100}%` }} />
              <div className="flex-1 bg-red-500" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TeamCard title="블루팀" color="#2563EB" team={split.a} game={game} chance={winChance(ratingA, ratingB)} comp={comps?.a} />
            <TeamCard title="레드팀" color="#DC2626" team={split.b} game={game} chance={winChance(ratingB, ratingA)} comp={comps?.b} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default TeamBalancer;
