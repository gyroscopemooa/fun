import { forwardRef } from 'react';

import type { TypeTestDef, TypeTestResult } from '@/lib/type-tests/types';

type Props = { test: TypeTestDef; result: TypeTestResult };

/** 360x480 share card, rendered statically on result pages and exported to PNG in the test. */
export const TypeResultCard = forwardRef<HTMLDivElement, Props>(function TypeResultCard({ test, result }, ref) {
  const best = test.results.find((r) => r.id === result.best);
  return (
    <div
      ref={ref}
      className="flex h-[480px] w-[360px] flex-col p-6 text-white"
      style={{ background: `radial-gradient(circle at 85% 0%, ${result.color}, transparent 62%), linear-gradient(160deg, ${test.gradient[0]}55, transparent 55%), #0f172a` }}
    >
      <div className="flex items-center justify-between text-[11px] font-black tracking-[0.25em]">
        <span>{test.kicker}</span>
        <span className="text-white/50">ManyTool</span>
      </div>
      <p className="mt-8 text-6xl">{result.emoji}</p>
      <p className="mt-4 text-[13px] font-bold text-white/70">나의 {test.title.replace(' 테스트', '')}은</p>
      <p className="mt-1 text-[40px] font-black leading-tight tracking-tight">{result.name}</p>
      <p className="mt-3 text-sm leading-6 text-white/85">{result.summary}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {result.traits.map((t) => (
          <span key={t} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">#{t}</span>
        ))}
      </div>
      {best ? (
        <p className="mt-auto rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold">
          {test.bestLabel} <span className="ml-1 text-white">{best.emoji} {best.name}</span>
        </p>
      ) : null}
      <p className="mt-3 text-right text-[10px] font-bold text-white/40">manytool.net/{test.slug}</p>
    </div>
  );
});

export default TypeResultCard;
