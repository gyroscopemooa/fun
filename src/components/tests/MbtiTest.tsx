import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Heart, RotateCcw } from 'lucide-react';

import { MBTI_INFO, bestMatchesOf, type MbtiType } from '@/lib/mbti';
import { saveNodeAsPng } from '@/lib/save-node-as-png';

type Axis = 'EI' | 'SN' | 'TF' | 'JP';
// `pole` is the letter an "agree" answer points to.
type Question = { text: string; axis: Axis; pole: string };

const QUESTIONS: Question[] = [
  { text: '주말에 약속이 없으면 누구라도 불러서 만나고 싶다.', axis: 'EI', pole: 'E' },
  { text: '처음 보는 사람들과도 금방 이야기를 시작하는 편이다.', axis: 'EI', pole: 'E' },
  { text: '긴 모임이 끝나면 혼자만의 시간이 꼭 필요하다.', axis: 'EI', pole: 'I' },
  { text: '생각을 정리할 때 말로 하기보다 혼자 곰곰이 생각한다.', axis: 'EI', pole: 'I' },
  { text: '단체 대화방에서 먼저 말을 꺼내는 일이 많다.', axis: 'EI', pole: 'E' },
  { text: '설명서는 처음부터 순서대로 읽는 편이다.', axis: 'SN', pole: 'S' },
  { text: '"만약에 ~라면?" 같은 상상을 자주 한다.', axis: 'SN', pole: 'N' },
  { text: '경험해 본 확실한 방법이 새로운 방법보다 믿음직하다.', axis: 'SN', pole: 'S' },
  { text: '대화하다가 주제가 엉뚱한 곳으로 흘러가는 일이 잦다.', axis: 'SN', pole: 'N' },
  { text: '숨은 의미보다 있는 그대로의 사실이 더 중요하다.', axis: 'SN', pole: 'S' },
  { text: '친구가 고민을 말하면 해결책부터 떠오른다.', axis: 'TF', pole: 'T' },
  { text: '결정을 내릴 때 사람들의 기분이 가장 신경 쓰인다.', axis: 'TF', pole: 'F' },
  { text: '논리적으로 맞다면 조금 차갑게 들려도 말하는 편이다.', axis: 'TF', pole: 'T' },
  { text: '영화나 드라마를 보다가 쉽게 눈물이 난다.', axis: 'TF', pole: 'F' },
  { text: '칭찬보다 정확한 피드백이 더 고맙다.', axis: 'TF', pole: 'T' },
  { text: '여행 가기 전에 일정을 시간 단위로 짜 둔다.', axis: 'JP', pole: 'J' },
  { text: '마감 직전에 집중력이 가장 좋아진다.', axis: 'JP', pole: 'P' },
  { text: '할 일 목록을 지우는 게 은근히 즐겁다.', axis: 'JP', pole: 'J' },
  { text: '계획이 갑자기 바뀌어도 크게 신경 쓰이지 않는다.', axis: 'JP', pole: 'P' },
  { text: '물건은 늘 정해진 자리에 두는 편이다.', axis: 'JP', pole: 'J' }
];

const SCALE = [
  { value: 2, label: '매우 그렇다' },
  { value: 1, label: '그렇다' },
  { value: 0, label: '보통이다' },
  { value: -1, label: '아니다' },
  { value: -2, label: '전혀 아니다' }
];

const AXES: { id: Axis; left: string; right: string; leftLabel: string; rightLabel: string; color: string }[] = [
  { id: 'EI', left: 'E', right: 'I', leftLabel: '외향', rightLabel: '내향', color: '#F97316' },
  { id: 'SN', left: 'S', right: 'N', leftLabel: '감각', rightLabel: '직관', color: '#22C55E' },
  { id: 'TF', left: 'T', right: 'F', leftLabel: '사고', rightLabel: '감정', color: '#3B82F6' },
  { id: 'JP', left: 'J', right: 'P', leftLabel: '판단', rightLabel: '인식', color: '#A855F7' }
];

export const MBTI_STORAGE_KEY = 'manytool.mbtiTest.result';

const scoreAnswers = (answers: number[]) => {
  // Percent toward the left letter of each axis (50 = balanced; ties go to the left letter).
  const percent = Object.fromEntries(AXES.map((axis) => {
    const items = QUESTIONS.map((q, i) => ({ q, a: answers[i] ?? 0 })).filter(({ q }) => q.axis === axis.id);
    const toward = items.reduce((sum, { q, a }) => sum + (q.pole === axis.left ? a : -a), 0);
    return [axis.id, Math.round(50 + (toward / (items.length * 2)) * 50)];
  })) as Record<Axis, number>;
  const type = AXES.map((axis) => (percent[axis.id] >= 50 ? axis.left : axis.right)).join('') as MbtiType;
  return { type, percent };
};

export function MbtiTest() {
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const done = answers.length === QUESTIONS.length && step >= QUESTIONS.length;
  const result = useMemo(() => (done ? scoreAnswers(answers) : null), [done, answers]);

  const answer = (value: number) => {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    setStep(step + 1);
    if (next.length === QUESTIONS.length && step + 1 >= QUESTIONS.length) {
      try {
        window.localStorage.setItem(MBTI_STORAGE_KEY, scoreAnswers(next).type);
      } catch {
        // The love test just won't be pre-filled.
      }
    }
  };

  const restart = () => {
    setAnswers([]);
    setStep(0);
  };

  const save = async () => {
    if (!cardRef.current || !result) return;
    setSaving(true);
    try {
      await saveNodeAsPng(cardRef.current, `manytool-mbti-${result.type}.png`);
    } finally {
      setSaving(false);
    }
  };

  if (!result) {
    const q = QUESTIONS[step];
    return (
      <section className="mt-4 rounded-[28px] border border-violet-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>{step + 1} / {QUESTIONS.length}</span>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-slate-100">
              <ArrowLeft className="h-3.5 w-3.5" /> 이전
            </button>
          ) : <span>약 2분</span>}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#ec4899)] transition-all" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
        </div>
        <p className="mt-8 min-h-[4.5rem] text-center text-xl font-black leading-snug text-slate-900 sm:text-2xl">{q.text}</p>
        <div className="mx-auto mt-6 grid max-w-md gap-2">
          {SCALE.map((option) => {
            const picked = answers[step] === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => answer(option.value)}
                className={`rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${picked ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const info = MBTI_INFO[result.type];
  return (
    <div className="mt-4 space-y-4">
      <section className="flex flex-col items-center gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-start">
        <div className="max-w-full overflow-auto rounded-[22px] shadow-xl max-[419px]:[zoom:0.8]">
          <div ref={cardRef} className="flex h-[480px] w-[360px] flex-col p-6 text-white" style={{ background: `radial-gradient(circle at 80% 0%, ${info.color}, transparent 60%), #0f172a` }}>
            <div className="flex items-center justify-between text-[11px] font-black tracking-[0.25em]">
              <span>MY MBTI</span>
              <span className="text-white/50">ManyTool</span>
            </div>
            <p className="mt-8 text-5xl">{info.emoji}</p>
            <p className="mt-3 text-[52px] font-black leading-none tracking-tight">{result.type}</p>
            <p className="mt-2 text-lg font-bold text-white/90">{info.nickname}</p>
            <div className="mt-6 space-y-2.5">
              {AXES.map((axis) => {
                const left = result.percent[axis.id];
                return (
                  <div key={axis.id}>
                    <div className="flex justify-between text-[11px] font-bold text-white/70">
                      <span>{axis.left} {axis.leftLabel} {left}%</span>
                      <span>{100 - left}% {axis.rightLabel} {axis.right}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full rounded-full" style={{ width: `${left}%`, background: axis.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-auto text-right text-[10px] font-bold text-white/40">manytool.net/mbti-test</p>
          </div>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <p className="text-sm leading-6 text-slate-700">{info.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {info.strengths.map((s) => <span key={s} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">#{s}</span>)}
          </div>
          <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-900">
            <p className="flex items-center gap-1.5 font-black"><Heart className="h-4 w-4" /> 연애 스타일</p>
            <p className="mt-1">{info.love}</p>
            <p className="mt-2 text-xs font-bold text-rose-700">잘 맞는 유형</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {bestMatchesOf(result.type).map((t) => (
                <a key={t} href={`/love-compatibility?me=${result.type}&you=${t}`} className="rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700 hover:bg-rose-100">{MBTI_INFO[t].emoji} {t}</a>
              ))}
            </div>
          </div>
          <button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            <Download className="h-4 w-4" /> {saving ? '이미지 만드는 중…' : '결과 카드 저장'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <a href={`/love-compatibility?me=${result.type}`} className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-rose-700 hover:bg-rose-50">💞 연애 궁합 보기</a>
            <a href="/mbti-game-character" className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-violet-700 hover:bg-violet-50">🎮 게임 캐릭터 궁합</a>
          </div>
          <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">
            <RotateCcw className="h-3.5 w-3.5" /> 다시 테스트하기
          </button>
        </div>
      </section>
      <p className="text-center text-xs text-slate-400">간단한 재미용 성향 테스트예요. 공식 MBTI® 검사와는 관련이 없어요.</p>
    </div>
  );
}

export default MbtiTest;
