import { useCallback, useMemo, useState } from 'react';
import { parseInput } from '../utils/parseInput.js';
import { usePhysics } from '../hooks/usePhysics.js';

const COPY = {
  ko: {
    badge: 'ManyTool Marble Roulette',
    title: '핀볼 추첨기',
    description: '이름이나 항목을 입력하면 구슬이 핀에 튕기며 떨어지고, 마지막 슬롯 위치로 결과를 정합니다.',
    inputTitle: '항목 입력',
    inputHint: '쉼표나 줄바꿈으로 구분하고, 가중치는 `사과*2`처럼 적습니다.',
    inputPlaceholder: '사과*2, 바나나*1, 포도*3',
    marbleCount: '구슬 개수',
    probability: '확률 모드',
    probabilityHint: '가중치가 큰 항목일수록 아래 슬롯 폭이 넓어집니다.',
    start: 'Start',
    reset: 'Reset',
    running: '진행 중',
    idle: '대기 중',
    boardTitle: 'Marble Board',
    boardHint: '공이 슬롯에 들어가면 결과가 누적됩니다.',
    latestResult: '최근 결과',
    noResult: '아직 결과 없음',
    totalEntries: '총 항목 수',
    totalWeight: '총 가중치',
    activeMarbles: '남은 구슬',
    resultSummary: '결과 집계',
    emptyResults: '아직 떨어진 구슬이 없습니다.',
    weightLabel: '가중치',
    countLabel: '당첨',
    slotGuide: '슬롯 미리보기',
    mobileTip: '모바일에서도 바로 터치해서 시작할 수 있습니다.'
  },
  en: {
    badge: 'ManyTool Marble Roulette',
    title: 'Marble Roulette',
    description: 'Drop marbles through a triangular peg board and use the final slot position as the result.',
    inputTitle: 'Items',
    inputHint: 'Split by commas or new lines. Add weights like `apple*2`.',
    inputPlaceholder: 'apple*2, banana*1, grape*3',
    marbleCount: 'Marbles',
    probability: 'Weighted mode',
    probabilityHint: 'Higher weights create wider slots at the bottom.',
    start: 'Start',
    reset: 'Reset',
    running: 'Running',
    idle: 'Idle',
    boardTitle: 'Marble Board',
    boardHint: 'Results are recorded when marbles reach a slot.',
    latestResult: 'Latest result',
    noResult: 'No result yet',
    totalEntries: 'Entries',
    totalWeight: 'Total weight',
    activeMarbles: 'Active marbles',
    resultSummary: 'Result summary',
    emptyResults: 'No marbles have landed yet.',
    weightLabel: 'Weight',
    countLabel: 'Hits',
    slotGuide: 'Slot preview',
    mobileTip: 'Optimized for touch devices too.'
  },
  ja: {
    badge: 'ManyTool Marble Roulette',
    title: 'マーブルルーレット',
    description: '項目を入力すると、ビー玉が三角ピンに当たりながら落ちて最後のスロットで結果が決まります。',
    inputTitle: '項目入力',
    inputHint: 'カンマか改行で区切り、重みは `apple*2` のように入力します。',
    inputPlaceholder: 'りんご*2, バナナ*1, ぶどう*3',
    marbleCount: 'ビー玉数',
    probability: '重み付きモード',
    probabilityHint: '重みが大きいほど下のスロット幅が広くなります。',
    start: 'Start',
    reset: 'Reset',
    running: '実行中',
    idle: '待機中',
    boardTitle: 'Marble Board',
    boardHint: 'スロットに入るたびに結果が集計されます。',
    latestResult: '最新結果',
    noResult: 'まだ結果なし',
    totalEntries: '項目数',
    totalWeight: '合計重み',
    activeMarbles: '残りビー玉',
    resultSummary: '結果集計',
    emptyResults: 'まだ落ちたビー玉がありません。',
    weightLabel: '重み',
    countLabel: '回数',
    slotGuide: 'スロット一覧',
    mobileTip: 'モバイルでもそのまま使えます。'
  }
};

const DEFAULT_INPUT = {
  ko: '사과*2\n바나나*1\n포도*3\n멜론*1',
  en: 'Apple*2\nBanana*1\nGrape*3\nMelon*1',
  ja: 'りんご*2\nバナナ*1\nぶどう*3\nメロン*1'
};

export default function MarbleRoulette({ locale = 'ko' }) {
  const t = COPY[locale] ?? COPY.ko;
  const [rawInput, setRawInput] = useState(DEFAULT_INPUT[locale] ?? DEFAULT_INPUT.ko);
  const [marbleCount, setMarbleCount] = useState(6);
  const [results, setResults] = useState([]);

  const parsed = useMemo(() => parseInput(rawInput), [rawInput]);
  const resultMap = useMemo(() => {
    return results.reduce((acc, result) => {
      acc[result.label] = (acc[result.label] ?? 0) + 1;
      return acc;
    }, {});
  }, [results]);

  const handleSettle = useCallback((entry) => {
    setResults((prev) => [...prev, entry]);
  }, []);

  const { canvasRef, containerRef, slots, isRunning, activeMarbles, lastResult, startWeightedRound, resetRound } =
    usePhysics({
      items: parsed.items.length > 0 ? parsed.items : parseInput(DEFAULT_INPUT[locale] ?? DEFAULT_INPUT.ko).items,
      onSettle: handleSettle
    });

  const handleStart = () => {
    setResults([]);
    startWeightedRound(marbleCount);
  };

  const handleReset = () => {
    setResults([]);
    resetRound();
  };

  const stats = [
    { label: t.totalEntries, value: slots.length },
    { label: t.totalWeight, value: parsed.totalWeight || slots.reduce((sum, slot) => sum + slot.weight, 0) },
    { label: t.activeMarbles, value: activeMarbles }
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] p-5 text-white shadow-[0_30px_80px_rgba(2,6,23,0.55)] sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">{t.badge}</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t.title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">{t.description}</p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{t.inputTitle}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{t.inputHint}</p>
                </div>
                <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {isRunning ? t.running : t.idle}
                </div>
              </div>

              <textarea
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder={t.inputPlaceholder}
                className="mt-4 h-40 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.probability}
                  </span>
                  <p className="text-sm leading-6 text-slate-300">{t.probabilityHint}</p>
                </label>

                <label className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.marbleCount}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={marbleCount}
                    onChange={(event) => setMarbleCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-cyan-400/50"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={slots.length === 0}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.start}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  {t.reset}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-lg font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-sm font-bold text-white">{t.boardTitle}</p>
                  <p className="mt-1 text-xs text-slate-400">{t.boardHint}</p>
                </div>
                <p className="rounded-full border border-pink-400/25 bg-pink-400/10 px-3 py-1 text-xs font-semibold text-pink-200">
                  {t.mobileTip}
                </p>
              </div>
              <div ref={containerRef} className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950">
                <canvas ref={canvasRef} className="block w-full" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t.resultSummary}</p>
                    <h2 className="mt-2 text-lg font-black text-white">{t.latestResult}</h2>
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                      lastResult
                        ? 'border border-pink-400/40 bg-pink-400/15 text-pink-100 shadow-[0_0_24px_rgba(244,114,182,0.25)]'
                        : 'border border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    {lastResult?.label ?? t.noResult}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {slots.map((slot) => {
                    const count = resultMap[slot.label] ?? 0;
                    const highlighted = lastResult?.label === slot.label;
                    return (
                      <div
                        key={slot.id}
                        className={`rounded-2xl border px-4 py-3 transition ${
                          highlighted
                            ? 'border-pink-400/50 bg-pink-400/12 shadow-[0_0_20px_rgba(244,114,182,0.22)]'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slot.color }} />
                            <p className="font-bold text-white">{slot.label}</p>
                          </div>
                          <p className="text-sm font-black text-cyan-200">{count}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          <span>
                            {t.weightLabel} x{slot.weight}
                          </span>
                          <span>
                            {t.countLabel} {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {results.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">{t.emptyResults}</p>
                ) : null}
              </div>

              <aside className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t.slotGuide}</p>
                <div className="mt-4 space-y-3">
                  {slots.map((slot) => (
                    <div key={`${slot.id}-preview`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{slot.label}</span>
                        <span className="text-xs font-bold text-cyan-200">x{slot.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
