import { useRef, useState } from 'react';
import { ArrowLeft, Download, RotateCcw } from 'lucide-react';

import { ShareLinkButton } from '@/components/share/ShareLinkButton';
import { TYPE_TESTS, scoreTypeTest } from '@/lib/type-tests';
import { saveNodeAsPng } from '@/lib/save-node-as-png';
import { TypeResultCard } from './TypeResultCard';

type Props = { slug: string };

export function TypeTest({ slug }: Props) {
  const test = TYPE_TESTS[slug];
  const [picks, setPicks] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const total = test.questions.length;
  const result = step >= total ? scoreTypeTest(test, picks) : null;

  const pick = (index: number) => {
    const next = [...picks];
    next[step] = index;
    setPicks(next);
    setStep(step + 1);
  };

  const save = async () => {
    if (!cardRef.current || !result) return;
    setSaving(true);
    try {
      await saveNodeAsPng(cardRef.current, `manytool-${test.slug}-${result.id}.png`);
    } finally {
      setSaving(false);
    }
  };

  if (!result) {
    const q = test.questions[step];
    return (
      <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Q{step + 1} / {total}</span>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-slate-100">
              <ArrowLeft className="h-3.5 w-3.5" /> 이전
            </button>
          ) : <span>약 1분</span>}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${(step / total) * 100}%`, background: `linear-gradient(90deg, ${test.gradient[0]}, ${test.gradient[1]})` }} />
        </div>
        <p className="mt-8 min-h-[4.5rem] text-center text-xl font-black leading-snug text-slate-900 sm:text-2xl">{q.text}</p>
        <div className="mx-auto mt-6 grid max-w-md gap-2">
          {q.options.map((option, i) => {
            const picked = picks[step] === i;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => pick(i)}
                className={`rounded-2xl border px-4 py-3.5 text-left text-sm font-bold transition ${picked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}
              >
                <span className="mr-2 text-slate-400">{String.fromCharCode(65 + i)}</span>{option.label}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const best = test.results.find((r) => r.id === result.best);
  return (
    <div className="mt-4 space-y-4">
      <section className="flex flex-col items-center gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-start">
        <div className="max-w-full overflow-auto rounded-[22px] shadow-xl max-[419px]:[zoom:0.8]">
          <TypeResultCard ref={cardRef} test={test} result={result} />
        </div>
        <div className="w-full max-w-sm space-y-3 text-sm text-slate-700">
          <div className="rounded-2xl bg-white p-3">
            <p className="font-black text-slate-900">💡 한 줄 조언</p>
            <p className="mt-1 leading-6">{result.tip}</p>
          </div>
          {best ? (
            <a href={`/${test.slug}/result/${best.id}`} className="block rounded-2xl bg-white p-3 hover:bg-slate-100">
              <p className="font-black text-slate-900">🤝 {test.bestLabel}</p>
              <p className="mt-1">{best.emoji} <strong>{best.name}</strong> · {best.traits.join(', ')}</p>
            </a>
          ) : null}
          <button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-60">
            <Download className="h-4 w-4" /> {saving ? '이미지 만드는 중…' : '결과 카드 저장'}
          </button>
          <ShareLinkButton url={`/${test.slug}/result/${result.id}`} title={`나의 ${test.title.replace(' 테스트', '')}: ${result.emoji} ${result.name}`} text={`나도 ${test.title} 해보기`} />
          <div>
            <p className="text-xs font-bold text-slate-500">다른 결과도 구경하기</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {test.results.filter((r) => r.id !== result.id).map((r) => (
                <a key={r.id} href={`/${test.slug}/result/${r.id}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100">{r.emoji} {r.name}</a>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => { setPicks([]); setStep(0); }} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">
            <RotateCcw className="h-3.5 w-3.5" /> 다시 테스트하기
          </button>
        </div>
      </section>
      <p className="text-center text-xs text-slate-400">재미로 보는 성향 테스트예요. 결과는 상황과 기분에 따라 달라질 수 있어요.</p>
    </div>
  );
}

export default TypeTest;
