import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Heart } from 'lucide-react';

import { MBTI_INFO, MBTI_TYPES, isMbti, mbtiPairScore, type MbtiType } from '@/lib/mbti';
import { saveNodeAsPng } from '@/lib/save-node-as-png';
import { MBTI_STORAGE_KEY } from './MbtiTest';

type Person = { name: string; birthday: string; mbti: MbtiType | '' };

type Zodiac = { name: string; emoji: string; element: 'fire' | 'earth' | 'air' | 'water' };

// [month, day the sign starts]
const ZODIAC: (Zodiac & { from: [number, number] })[] = [
  { name: '물병자리', emoji: '♒', element: 'air', from: [1, 20] },
  { name: '물고기자리', emoji: '♓', element: 'water', from: [2, 19] },
  { name: '양자리', emoji: '♈', element: 'fire', from: [3, 21] },
  { name: '황소자리', emoji: '♉', element: 'earth', from: [4, 20] },
  { name: '쌍둥이자리', emoji: '♊', element: 'air', from: [5, 21] },
  { name: '게자리', emoji: '♋', element: 'water', from: [6, 22] },
  { name: '사자자리', emoji: '♌', element: 'fire', from: [7, 23] },
  { name: '처녀자리', emoji: '♍', element: 'earth', from: [8, 23] },
  { name: '천칭자리', emoji: '♎', element: 'air', from: [9, 23] },
  { name: '전갈자리', emoji: '♏', element: 'water', from: [10, 23] },
  { name: '사수자리', emoji: '♐', element: 'fire', from: [11, 22] },
  { name: '염소자리', emoji: '♑', element: 'earth', from: [12, 22] }
];

const zodiacOf = (birthday: string): Zodiac | null => {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(birthday);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  // Walk backwards to the last sign that started on or before this date (Capricorn wraps the year).
  const found = [...ZODIAC].reverse().find((z) => month > z.from[0] || (month === z.from[0] && day >= z.from[1]));
  return found ?? ZODIAC[11];
};

const ELEMENT_PAIRS: Record<string, number> = { 'fire-air': 88, 'earth-water': 88, 'fire-fire': 84, 'air-air': 82, 'earth-earth': 86, 'water-water': 87 };
const zodiacScore = (a: Zodiac, b: Zodiac) => ELEMENT_PAIRS[[a.element, b.element].sort().join('-')] ?? (a.element === b.element ? 85 : 68);

const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const COUPLE_TYPES = [
  { min: 90, title: '운명 커플', emoji: '💘', text: '눈빛만 봐도 통하는 사이예요. 함께 있으면 시간이 순식간에 지나가요.' },
  { min: 80, title: '찰떡 커플', emoji: '💞', text: '서로의 빈자리를 자연스럽게 채워 주는 균형 잡힌 조합이에요.' },
  { min: 70, title: '알콩달콩 커플', emoji: '💗', text: '작은 차이가 오히려 설렘이 되는 사이예요. 대화가 많을수록 더 가까워져요.' },
  { min: 60, title: '밀당 커플', emoji: '💓', text: '다른 점이 꽤 있지만 그만큼 서로에게 배울 게 많은 조합이에요.' },
  { min: 0, title: '노력형 커플', emoji: '🌱', text: '천천히 알아갈수록 빛나는 관계예요. 서로의 속도를 존중해 주세요.' }
];

const DATES = ['한강 피크닉과 노을 보기', '방탈출 카페 도전', '보드게임 카페에서 승부', '동네 맛집 지도 만들기', '전시회 보고 카페 수다', '야경 드라이브', '같이 요리하는 홈데이트', '놀이공원 하루 코스', '레트로 오락실 데이트', '별 보러 교외 나들이'];
const TIPS = ['서운한 건 그날 바로 부드럽게 말해 주세요.', '서로의 혼자 있는 시간을 존중하면 더 오래가요.', '작은 칭찬을 자주 건네 보세요.', '기념일보다 평범한 날의 깜짝 연락이 효과가 커요.', '다투면 이기는 것보다 이해하는 걸 목표로 해 보세요.', '같이 새로운 취미를 시작해 보세요.'];

const readQuery = (key: string) => {
  try {
    const value = new URLSearchParams(window.location.search).get(key)?.toUpperCase() ?? '';
    return isMbti(value) ? value : '';
  } catch {
    return '';
  }
};

function PersonForm({ label, person, onChange, accent }: { label: string; person: Person; onChange: (p: Person) => void; accent: string }) {
  return (
    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
      <p className="text-sm font-black" style={{ color: accent }}>{label}</p>
      <input value={person.name} onChange={(e) => onChange({ ...person, name: e.target.value.slice(0, 12) })} placeholder="이름 또는 닉네임" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-bold text-slate-500">생일 (선택)
          <input type="date" value={person.birthday} onChange={(e) => onChange({ ...person, birthday: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm font-normal text-slate-800" />
        </label>
        <label className="block text-[11px] font-bold text-slate-500">MBTI (선택)
          <select value={person.mbti} onChange={(e) => onChange({ ...person, mbti: e.target.value as MbtiType | '' })} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm font-normal text-slate-800">
            <option value="">모름</option>
            {MBTI_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export function LoveCompatibility() {
  const [me, setMe] = useState<Person>({ name: '', birthday: '', mbti: '' });
  const [you, setYou] = useState<Person>({ name: '', birthday: '', mbti: '' });
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Pre-fill from the MBTI test result or a shared link (?me=ENFP&you=INFJ).
    let stored = '';
    try {
      stored = window.localStorage.getItem(MBTI_STORAGE_KEY) ?? '';
    } catch {
      stored = '';
    }
    const mine = readQuery('me') || (isMbti(stored) ? stored : '');
    const theirs = readQuery('you');
    if (mine) setMe((p) => ({ ...p, mbti: mine }));
    if (theirs) setYou((p) => ({ ...p, mbti: theirs }));
  }, []);

  const result = useMemo(() => {
    if (!me.name.trim() || !you.name.trim()) return null;
    const pairKey = [me.name.trim(), you.name.trim()].sort().join('♥');
    const seed = hash(pairKey);
    const parts: { label: string; score: number; detail: string; weight: number }[] = [
      { label: '이름 케미', score: 55 + (seed % 45), detail: `${me.name.trim()} ♥ ${you.name.trim()}`, weight: 0.4 }
    ];
    const za = zodiacOf(me.birthday);
    const zb = zodiacOf(you.birthday);
    if (za && zb) parts.push({ label: '별자리 궁합', score: zodiacScore(za, zb), detail: `${za.emoji} ${za.name} × ${zb.emoji} ${zb.name}`, weight: 0.3 });
    if (me.mbti && you.mbti) parts.push({ label: 'MBTI 궁합', score: mbtiPairScore(me.mbti, you.mbti), detail: `${me.mbti} × ${you.mbti}`, weight: 0.3 });
    const weight = parts.reduce((sum, p) => sum + p.weight, 0);
    const total = Math.round(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / weight);
    const type = COUPLE_TYPES.find((t) => total >= t.min)!;
    return { parts, total, type, date: DATES[(seed >>> 5) % DATES.length], tip: TIPS[(seed >>> 9) % TIPS.length] };
  }, [me, you]);

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      await saveNodeAsPng(cardRef.current, 'manytool-love-compatibility.png');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <PersonForm label="나" person={me} onChange={(p) => { setMe(p); setShown(false); }} accent="#2563EB" />
        <PersonForm label="상대" person={you} onChange={(p) => { setYou(p); setShown(false); }} accent="#E11D48" />
      </section>
      <button
        type="button"
        onClick={() => setShown(true)}
        disabled={!result}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ec4899,#f43f5e)] py-4 text-base font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
      >
        <Heart className="h-5 w-5" /> 궁합 보기
      </button>
      {!result ? <p className="text-center text-xs text-slate-400">두 사람의 이름을 넣으면 시작할 수 있어요. 생일과 MBTI를 넣을수록 결과가 풍부해져요.</p> : null}

      {shown && result ? (
        <section className="flex flex-col items-center gap-4 rounded-[28px] border border-rose-100 bg-rose-50/60 p-5 md:flex-row md:items-start">
          <div className="max-w-full overflow-auto rounded-[22px] shadow-xl max-[419px]:[zoom:0.8]">
            <div ref={cardRef} className="flex h-[480px] w-[360px] flex-col p-6 text-white" style={{ background: 'radial-gradient(circle at 50% 0%, #fb7185, transparent 60%), linear-gradient(180deg,#be185d,#4c0519)' }}>
              <div className="flex items-center justify-between text-[11px] font-black tracking-[0.25em]">
                <span>LOVE MATCH</span>
                <span className="text-white/60">ManyTool</span>
              </div>
              <p className="mt-6 text-center text-lg font-black">{me.name.trim()} <span className="text-pink-200">♥</span> {you.name.trim()}</p>
              <p className="mt-3 text-center text-[72px] font-black leading-none">{result.total}<span className="text-3xl">%</span></p>
              <p className="mt-2 text-center text-xl font-black">{result.type.emoji} {result.type.title}</p>
              <div className="mt-5 space-y-2.5">
                {result.parts.map((part) => (
                  <div key={part.label}>
                    <div className="flex justify-between text-[11px] font-bold text-white/80">
                      <span>{part.label}</span><span>{part.score}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-pink-200" style={{ width: `${part.score}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/60">{part.detail}</p>
                  </div>
                ))}
              </div>
              <p className="mt-auto text-right text-[10px] font-bold text-white/50">manytool.net/love-compatibility</p>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-3 text-sm text-slate-700">
            <p className="leading-6">{result.type.text}</p>
            <div className="rounded-2xl bg-white p-3">
              <p className="font-black text-slate-900">💡 관계 팁</p>
              <p className="mt-1">{result.tip}</p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="font-black text-slate-900">📍 추천 데이트</p>
              <p className="mt-1">{result.date}</p>
            </div>
            {me.mbti && you.mbti ? (
              <div className="rounded-2xl bg-white p-3">
                <p className="font-black text-slate-900">🧠 MBTI로 본 두 사람</p>
                <p className="mt-1"><strong>{me.mbti}</strong> {MBTI_INFO[me.mbti].love}</p>
                <p className="mt-1"><strong>{you.mbti}</strong> {MBTI_INFO[you.mbti].love}</p>
              </div>
            ) : (
              <a href="/mbti-test" className="block rounded-2xl border border-violet-200 bg-white p-3 text-center text-xs font-bold text-violet-700 hover:bg-violet-50">MBTI를 모르면 테스트하고 오기 →</a>
            )}
            <button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-60">
              <Download className="h-4 w-4" /> {saving ? '이미지 만드는 중…' : '궁합 카드 저장'}
            </button>
          </div>
        </section>
      ) : null}
      <p className="text-center text-xs text-slate-400">재미로 보는 궁합이에요. 같은 이름과 정보면 언제나 같은 결과가 나와요.</p>
    </div>
  );
}

export default LoveCompatibility;
