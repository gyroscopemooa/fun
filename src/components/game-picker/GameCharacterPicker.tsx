import { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Eye, EyeOff, RotateCcw, Users, User } from 'lucide-react';

import { GAMES, type GameId } from '@/lib/game-picker/games';
import type { GameCharacter, RoleDef } from '@/lib/game-picker/types';

const ROLL_MS = 1300;
const HISTORY_LIMIT = 6;
const ANY_ROLE: RoleDef = { id: 'any', label: '자유', emoji: '🎲', color: '#64748B', tip: '팀에 부족한 역할을 보고 유연하게 골라 주세요.' };

type Pick = { slot: RoleDef; character: GameCharacter };

const storageKey = (game: GameId) => `manytool.gamePicker.${game}.excluded`;
const readExcluded = (game: GameId) => {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(storageKey(game)) || '[]'));
  } catch {
    return new Set<string>();
  }
};

const shuffle = <T,>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACES: { n: number; transform: string }[] = [
  { n: 1, transform: 'rotateY(0deg)' },
  { n: 6, transform: 'rotateY(180deg)' },
  { n: 2, transform: 'rotateY(90deg)' },
  { n: 5, transform: 'rotateY(-90deg)' },
  { n: 3, transform: 'rotateX(90deg)' },
  { n: 4, transform: 'rotateX(-90deg)' }
];

function Dice({ rolling, accent }: { rolling: boolean; accent: string }) {
  return (
    <div className="gp-scene h-24 w-24" aria-hidden="true">
      <div className={`gp-cube ${rolling ? 'gp-rolling' : ''}`}>
        {FACES.map((face) => (
          <div key={face.n} className="gp-face" style={{ transform: `${face.transform} translateZ(48px)` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="flex items-center justify-center">
                {PIPS[face.n].includes(i) ? <span className="h-3.5 w-3.5 rounded-full" style={{ background: face.n === 1 ? accent : '#0f172a' }} /> : null}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Portrait({ character, size = 112, ring }: { character: GameCharacter; size?: number; ring: string }) {
  return (
    <div className="overflow-hidden rounded-[28px] border-4 bg-slate-800 shadow-lg" style={{ width: size, height: size, borderColor: ring, background: character.color ? `radial-gradient(circle at 50% 30%, ${character.color}, #0f172a)` : undefined }}>
      <img src={character.icon} alt={character.name} className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

export function GameCharacterPicker({ game }: { game: GameId }) {
  const config = GAMES[game];
  const [roster, setRoster] = useState<GameCharacter[]>(config.fallback);
  const [rosterNote, setRosterNote] = useState('최신 목록을 불러오는 중…');
  const [role, setRole] = useState<string>('all');
  const [style, setStyle] = useState<string>('all');
  const [mode, setMode] = useState<'single' | 'team'>('single');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showPool, setShowPool] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [ticker, setTicker] = useState<GameCharacter | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [history, setHistory] = useState<GameCharacter[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setExcluded(readExcluded(game));
    config.load()
      .then((list) => {
        if (list.length) setRoster(list);
        setRosterNote(`${list.length}명 ${config.unit} 최신 목록`);
      })
      .catch(() => setRosterNote(`${config.fallback.length}명 ${config.unit} (기본 목록)`));
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, [game]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(game), JSON.stringify([...excluded]));
    } catch {
      // Exclusions are a convenience; without storage they just reset on reload.
    }
  }, [excluded, game]);

  const roleById = (id: string) => config.roles.find((r) => r.id === id) ?? ANY_ROLE;
  const styleTags = config.styles?.find((s) => s.id === style)?.tags;
  const available = useMemo(() => roster.filter((c) => !excluded.has(c.id)), [roster, excluded]);
  const pool = useMemo(
    () => available.filter((c) => (role === 'all' || config.inRole(c, role)) && (!styleTags || styleTags.some((t) => c.tags?.includes(t)))),
    [available, role, styleTags]
  );

  const drawTeam = (): Pick[] => {
    const used = new Set<string>();
    return config.team.map((slotId) => {
      const slot = roleById(slotId);
      const candidates = shuffle(available.filter((c) => !used.has(c.id) && (slotId === 'any' || config.inRole(c, slotId))));
      const character = candidates[0] ?? shuffle(available.filter((c) => !used.has(c.id)))[0] ?? available[0];
      if (character) used.add(character.id);
      return { slot, character };
    }).filter((p) => p.character);
  };

  const roll = () => {
    const source = mode === 'single' ? pool : available;
    if (!source.length || rolling) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setRolling(true);
    setPicks([]);
    // Slot-machine ticker that slows down toward the end of the roll.
    let elapsed = 0;
    let step = 55;
    while (elapsed < ROLL_MS - 120) {
      elapsed += step;
      step = Math.round(step * 1.12);
      timers.current.push(window.setTimeout(() => setTicker(source[Math.floor(Math.random() * source.length)]), elapsed));
    }
    timers.current.push(window.setTimeout(() => {
      let result: Pick[];
      if (mode === 'single') {
        const character = shuffle(source)[0];
        // With no role filter, label the pick with the first role it fits (LoL places champions by tags).
        const slot = role !== 'all' ? roleById(role) : config.roles.find((r) => config.inRole(character, r.id)) ?? ANY_ROLE;
        result = [{ slot, character }];
      } else {
        result = drawTeam();
      }
      setPicks(result);
      setTicker(null);
      setRolling(false);
      setHistory((prev) => [...result.map((p) => p.character), ...prev].slice(0, HISTORY_LIMIT));
    }, ROLL_MS));
  };

  const toggleExcluded = (id: string) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const single = mode === 'single' ? picks[0] : undefined;

  return (
    <div className="space-y-5">
      <style>{`
        .gp-scene { perspective: 600px; }
        .gp-cube { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transform: rotateX(-24deg) rotateY(32deg); transition: transform .4s ease; }
        .gp-rolling { animation: gp-roll ${ROLL_MS}ms cubic-bezier(.2,.7,.3,1); }
        .gp-face { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); padding: 14px; border-radius: 20px; background: linear-gradient(145deg, #ffffff, #e2e8f0); box-shadow: inset 0 0 0 2px rgba(15,23,42,.08); backface-visibility: hidden; }
        @keyframes gp-roll {
          0% { transform: rotateX(-24deg) rotateY(32deg); }
          100% { transform: rotateX(${720 - 24}deg) rotateY(${1080 + 32}deg) rotateZ(360deg); }
        }
        @media (prefers-reduced-motion: reduce) { .gp-rolling { animation-duration: 1ms; } }
      `}</style>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 text-sm font-bold">
            {([['single', '1명 뽑기', User], ['team', '5인 팀 조합', Users]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" onClick={() => { setMode(value); setPicks([]); }} className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition ${mode === value ? 'bg-white text-slate-950 shadow' : 'text-slate-500'}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {mode === 'single' ? (
            <>
              <div>
                <p className="text-sm font-bold text-slate-800">{game === 'lol' ? '포지션' : '역할'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[{ id: 'all', label: '전체', emoji: '🎲', color: '#0f172a' }, ...config.roles].map((r) => (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)} className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${role === r.id ? 'text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`} style={role === r.id ? { background: r.color, borderColor: r.color } : undefined}>
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {config.styles ? (
                <div>
                  <p className="text-sm font-bold text-slate-800">플레이 스타일</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ id: 'all', label: '상관없음' }, ...config.styles].map((s) => (
                      <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${style === s.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-bold text-slate-800">팀 구성</p>
              <p className="mt-1">{config.team.map((id) => `${roleById(id).emoji} ${roleById(id).label}`).join(' · ')}</p>
              <p className="mt-1 text-xs text-slate-400">겹치지 않게 역할별로 한 명씩 뽑아요.</p>
            </div>
          )}

          <button
            type="button"
            onClick={roll}
            disabled={rolling || !(mode === 'single' ? pool.length : available.length)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${config.accent}, #0f172a)` }}
          >
            <Dices className="h-5 w-5" />
            {rolling ? '굴리는 중…' : picks.length ? '다시 굴리기' : '주사위 굴리기'}
          </button>
          <p className="text-center text-xs text-slate-400">
            {mode === 'single' ? `조건에 맞는 ${pool.length}명 중 추천` : `${available.length}명 중 팀 구성`} · {rosterNote}
          </p>

          <div className="rounded-2xl border border-slate-200 p-3">
            <button type="button" onClick={() => setShowPool((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold text-slate-800">
              <span>{config.unit} 풀 관리 {excluded.size ? <span className="text-rose-500">({excluded.size}명 제외)</span> : null}</span>
              {showPool ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
            </button>
            {showPool ? (
              <>
                <p className="mt-1 text-xs text-slate-500">눌러서 없는 {config.unit}을 빼면 추천에서 제외돼요. 이 기기에 저장돼요.</p>
                <div className="mt-3 grid max-h-64 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
                  {roster.map((c) => {
                    const off = excluded.has(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleExcluded(c.id)} title={c.name} className={`overflow-hidden rounded-xl border-2 transition ${off ? 'border-transparent opacity-30 grayscale' : 'border-emerald-400'}`}>
                        <img src={c.icon} alt={c.name} loading="lazy" className="aspect-square w-full bg-slate-800 object-cover" />
                      </button>
                    );
                  })}
                </div>
                {excluded.size ? (
                  <button type="button" onClick={() => setExcluded(new Set())} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
                    <RotateCcw className="h-3.5 w-3.5" /> 모두 다시 포함
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden rounded-[28px] p-6 text-center text-white shadow-sm" style={{ background: `radial-gradient(circle at 50% 0%, ${config.accent}55, transparent 55%), #0f172a` }}>
          {rolling || !picks.length ? (
            <>
              <Dice rolling={rolling} accent={config.accent} />
              <p className="mt-6 min-h-[2.5rem] text-3xl font-black tracking-tight">{rolling ? ticker?.name ?? '…' : `오늘의 ${config.unit}은?`}</p>
              <p className="mt-2 text-sm text-white/60">{rolling ? '두구두구…' : '주사위를 굴려 랜덤으로 추천받아 보세요'}</p>
            </>
          ) : single ? (
            <div className="flex flex-col items-center">
              <Portrait character={single.character} size={144} ring={single.slot.color} />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: single.slot.color }}>{single.slot.emoji} {single.slot.label}</p>
              <h2 className="mt-1 text-4xl font-black">{single.character.name}</h2>
              {single.character.en && single.character.en !== single.character.name ? <p className="text-sm text-white/50">{single.character.en}</p> : null}
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">{single.slot.tip}</p>
            </div>
          ) : (
            <div className="w-full">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">오늘의 5인 조합</p>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {picks.map((p, i) => (
                  <div key={`${p.character.id}-${i}`} className="flex flex-col items-center">
                    <Portrait character={p.character} size={76} ring={p.slot.color} />
                    <p className="mt-2 text-[11px] font-bold" style={{ color: p.slot.color }}>{p.slot.emoji} {p.slot.label}</p>
                    <p className="text-sm font-black">{p.character.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {history.length ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-800">최근 뽑은 {config.unit}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {history.map((c, i) => (
              <span key={`${c.id}-${i}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-sm font-semibold text-slate-700">
                <img src={c.icon} alt="" className="h-7 w-7 rounded-full bg-slate-800 object-cover" />
                {c.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default GameCharacterPicker;
