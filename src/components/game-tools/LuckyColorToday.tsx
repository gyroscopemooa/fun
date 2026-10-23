import { useMemo, useRef, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';

import { TONES, readableText, type ToneId } from '@/lib/personal-color-tones';
import { saveNodeAsPng } from '@/lib/save-node-as-png';

type Element = { id: string; label: string; emoji: string; mood: string; items: string[] };

const ELEMENTS: Element[] = [
  { id: 'wood', label: '목(木)', emoji: '🌿', mood: '새로 시작하기 좋은 성장의 기운', items: ['초록 식물 소품', '린넨 셔츠', '우드 액세서리'] },
  { id: 'fire', label: '화(火)', emoji: '🔥', mood: '표현하고 나서기 좋은 열정의 기운', items: ['포인트 립', '레드 계열 소품', '향초'] },
  { id: 'earth', label: '토(土)', emoji: '🪨', mood: '차분히 정리하기 좋은 안정의 기운', items: ['베이지 니트', '도자기 머그', '가죽 지갑'] },
  { id: 'metal', label: '금(金)', emoji: '💍', mood: '결단하고 마무리하기 좋은 단단한 기운', items: ['실버 반지', '화이트 셔츠', '메탈 시계'] },
  { id: 'water', label: '수(水)', emoji: '💧', mood: '흐름을 타고 소통하기 좋은 유연한 기운', items: ['블루 계열 옷', '텀블러', '진주 귀걸이'] }
];

const MESSAGES = [
  '오늘은 먼저 연락하는 쪽이 이득이에요.', '작은 계획 하나를 끝까지 해내는 날이에요.', '평소 안 가던 길로 가 보면 좋은 일이 생겨요.',
  '칭찬 한마디가 돌아서 나에게 와요.', '미뤄둔 정리를 하면 마음이 가벼워져요.', '오늘의 직감은 꽤 믿을 만해요.',
  '맛있는 걸 먹으면 운이 올라가요.', '새로운 사람과의 대화에서 힌트를 얻어요.', '천천히 가도 괜찮은 하루예요.',
  '좋아하는 노래로 하루를 시작해 보세요.', '거절해도 괜찮아요. 내 시간을 지켜요.', '사진을 많이 찍어 두면 좋은 날이에요.'
];

const TIME_SLOTS = ['오전 7~9시', '오전 9~11시', '오전 11시~오후 1시', '오후 1~3시', '오후 3~5시', '오후 5~7시', '저녁 7~9시', '밤 9~11시'];

const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const kstToday = () => {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
};

const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const fortuneFor = (date: string, birthday: string, toneId: ToneId | '') => {
  const seed = hash(`${date}|${birthday}|${toneId}`);
  const tone = toneId ? TONES.find((t) => t.id === toneId)! : TONES[seed % TONES.length];
  const color = tone.best[(seed >>> 4) % tone.best.length];
  const avoid = tone.avoid[(seed >>> 8) % tone.avoid.length];
  const element = ELEMENTS[(seed >>> 12) % ELEMENTS.length];
  return {
    tone,
    color,
    avoid,
    element,
    number: ((seed >>> 16) % 9) + 1,
    time: TIME_SLOTS[(seed >>> 20) % TIME_SLOTS.length],
    message: MESSAGES[(seed >>> 24) % MESSAGES.length],
    item: element.items[(seed >>> 2) % element.items.length]
  };
};

export function LuckyColorToday() {
  const today = useMemo(kstToday, []);
  const [date, setDate] = useState(today);
  const [birthday, setBirthday] = useState('');
  const [toneId, setToneId] = useState<ToneId | ''>('');
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const f = useMemo(() => fortuneFor(date, birthday, toneId), [date, birthday, toneId]);
  const ink = readableText(f.color.hex);
  const label = date === today ? '오늘' : date === shiftDate(today, 1) ? '내일' : date.slice(5).replace('-', '/');

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      await saveNodeAsPng(cardRef.current, `manytool-lucky-color-${date}.png`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <label className="block text-sm font-bold text-slate-800">날짜
          <div className="mt-1.5 flex gap-1.5">
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" />
            <button type="button" onClick={() => setDate(date === today ? shiftDate(today, 1) : today)} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">{date === today ? '내일' : '오늘'}</button>
          </div>
        </label>
        <label className="block text-sm font-bold text-slate-800">생일 (선택)
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-sm font-bold text-slate-800">내 퍼스널컬러 (선택)
          <select value={toneId} onChange={(e) => setToneId(e.target.value as ToneId | '')} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal">
            <option value="">모르겠어요</option>
            {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto max-w-full overflow-auto rounded-[24px] shadow-xl max-[419px]:[zoom:0.8]">
          <div ref={cardRef} className="relative flex h-[480px] w-[360px] flex-col overflow-hidden p-6" style={{ background: `linear-gradient(160deg, ${f.color.hex} 0%, ${f.color.hex} 55%, #ffffff 55%)` }}>
            <div className="flex items-center justify-between text-[11px] font-black tracking-[0.22em]" style={{ color: ink }}>
              <span>LUCKY COLOR</span>
              <span className="opacity-70">{date.replaceAll('-', '.')}</span>
            </div>
            <p className="mt-10 text-sm font-bold" style={{ color: ink, opacity: 0.8 }}>{label}의 행운 컬러</p>
            <p className="mt-1 text-[40px] font-black leading-none" style={{ color: ink }}>{f.color.name}</p>
            <p className="mt-2 font-mono text-sm" style={{ color: ink, opacity: 0.7 }}>{f.color.hex} · {f.tone.label} 팔레트</p>
            <div className="mt-auto space-y-2 text-slate-800">
              <p className="text-sm font-bold">{f.element.emoji} {f.element.label} · {f.element.mood}</p>
              <p className="text-[13px] leading-5 text-slate-600">“{f.message}”</p>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="rounded-xl bg-slate-100 py-2"><p className="text-[10px] font-bold text-slate-500">행운 숫자</p><p className="text-lg font-black">{f.number}</p></div>
                <div className="col-span-2 rounded-xl bg-slate-100 py-2"><p className="text-[10px] font-bold text-slate-500">행운 시간</p><p className="text-sm font-black">{f.time}</p></div>
              </div>
              <p className="pt-1 text-right text-[10px] font-bold text-slate-400">manytool.net/today-lucky-color</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm font-black text-slate-900">이렇게 활용해 보세요</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-3"><span className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow" style={{ background: f.color.hex }} />옷이나 소품 중 하나를 <strong>{f.color.name}</strong>으로 골라 보세요.</li>
              <li className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">{f.element.emoji}</span>행운 아이템: <strong>{f.item}</strong></li>
              <li className="flex items-center gap-3"><span className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow" style={{ background: f.avoid.hex }} />오늘은 <strong>{f.avoid.name}</strong>은 살짝 피하면 좋아요.</li>
            </ul>
          </div>
          <button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow transition hover:brightness-95 disabled:opacity-60" style={{ background: f.color.hex, color: ink }}>
            <Download className="h-4 w-4" /> {saving ? '이미지 만드는 중…' : '행운 카드 저장'}
          </button>
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> 날짜·생일·톤이 같으면 같은 결과가 나와요. 재미로 보는 콘텐츠예요.</p>
        </div>
      </section>
    </div>
  );
}

export default LuckyColorToday;
