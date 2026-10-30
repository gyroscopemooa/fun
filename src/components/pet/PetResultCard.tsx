import { useMemo, useState } from 'react';
import { Download, Ear, Timer } from 'lucide-react';

import { PetShareCard } from './PetShareCard';
import { petText, type PetLocale } from '@/lib/pet-i18n';

export type PetAnimal = 'dog' | 'cat';

export type PetResult = {
  animal?: PetAnimal | string;
  text?: string;
  emotion?: string;
  description?: string;
  transcript?: string;
  durationSeconds?: number;
};

type Mood = { key: string; label: string; emoji: string; color: string; soft: string; words: string[] };

// Ordered by priority: the first mood whose keyword appears in the emotion text wins.
export const MOODS: Mood[] = [
  { key: 'hungry', label: '배고픔', emoji: '🍖', color: '#F97316', soft: '#FFF7ED', words: ['배고', '간식', '밥', '먹'] },
  { key: 'anxious', label: '불안', emoji: '😟', color: '#8B5CF6', soft: '#F5F3FF', words: ['불안', '무서', '두려', '긴장', '겁', '걱정'] },
  { key: 'angry', label: '불만', emoji: '😾', color: '#EF4444', soft: '#FEF2F2', words: ['화', '짜증', '불만', '경계', '싫'] },
  { key: 'love', label: '애정', emoji: '🥰', color: '#EC4899', soft: '#FDF2F8', words: ['애정', '사랑', '좋아', '반가', '애교'] },
  { key: 'happy', label: '기쁨', emoji: '😆', color: '#F59E0B', soft: '#FFFBEB', words: ['기쁨', '기뻐', '행복', '신나', '즐거', '흥분'] },
  { key: 'curious', label: '호기심', emoji: '🧐', color: '#0EA5E9', soft: '#F0F9FF', words: ['호기심', '궁금', '관심'] },
  { key: 'bored', label: '심심함', emoji: '🥱', color: '#64748B', soft: '#F8FAFC', words: ['심심', '지루', '놀아', '관심 요구'] },
  { key: 'sleepy', label: '졸림', emoji: '😴', color: '#6366F1', soft: '#EEF2FF', words: ['졸', '피곤', '나른', '편안'] }
];

const EN_MOOD_LABELS: Record<string, string> = { hungry: 'Hungry', anxious: 'Anxious', angry: 'Annoyed', love: 'Affectionate', happy: 'Happy', curious: 'Curious', bored: 'Bored', sleepy: 'Sleepy', talk: 'Message' };

const FALLBACK_MOOD: Mood = { key: 'talk', label: '대화', emoji: '💬', color: '#E11D48', soft: '#FFF1F2', words: [] };

export const moodOf = (emotion = '') => MOODS.find((mood) => mood.words.some((word) => emotion.includes(word))) ?? FALLBACK_MOOD;

export const animalOf = (animal?: string): PetAnimal => (animal === 'cat' ? 'cat' : 'dog');

export const ANIMAL_LABEL: Record<PetAnimal, { emoji: string; name: string }> = {
  dog: { emoji: '🐶', name: '강아지' },
  cat: { emoji: '🐱', name: '고양이' }
};

export function SpeechBubble({ text, color, large = false }: { text: string; color: string; large?: boolean }) {
  return (
    <div className="relative">
      <div
        className={`relative rounded-[28px] border-2 bg-white px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)] ${large ? 'text-2xl' : 'text-xl sm:text-2xl'} font-black leading-snug text-slate-950`}
        style={{ borderColor: color }}
      >
        “{text}”
      </div>
      {/* Bubble tail pointing down-left at the pet avatar. */}
      <svg viewBox="0 0 40 24" className="absolute -bottom-[18px] left-8 h-6 w-10" aria-hidden="true">
        <path d="M2 0 L18 22 L30 0 Z" fill="#fff" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="0" y="0" width="34" height="3" fill="#fff" />
      </svg>
    </div>
  );
}

export function PetAvatar({ animal, mood, size = 88 }: { animal: PetAnimal; mood: Mood; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full shadow-inner"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff 0%, ${mood.soft} 55%, ${mood.color}33 100%)`, fontSize: size * 0.55 }}
      >
        {ANIMAL_LABEL[animal].emoji}
      </div>
      <span
        className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-white bg-white shadow"
        style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.24 }}
      >
        {mood.emoji}
      </span>
    </div>
  );
}

function MoodMeter({ active, locale }: { active: Mood; locale?: PetLocale }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
      {MOODS.map((mood) => {
        const on = mood.key === active.key;
        return (
          <div
            key={mood.key}
            className={`flex flex-col items-center rounded-2xl px-1 py-2 text-center transition ${on ? 'scale-105 shadow-md' : 'opacity-45'}`}
            style={{ background: on ? mood.soft : '#F8FAFC', outline: on ? `2px solid ${mood.color}` : 'none' }}
          >
            <span className="text-xl leading-none">{mood.emoji}</span>
            <span className="mt-1 text-[10px] font-bold" style={{ color: on ? mood.color : '#64748B' }}>{locale === 'ko' ? mood.label : EN_MOOD_LABELS[mood.key]}</span>
          </div>
        );
      })}
    </div>
  );
}

type Props = { result: PetResult; sample?: boolean; locale?: PetLocale };

export function PetResultCard({ result, sample = false, locale = 'en' }: Props) {
  const t = petText(locale);
  const animal = animalOf(result.animal);
  const mood = useMemo(() => moodOf(result.emotion), [result.emotion]);
  const [shareOpen, setShareOpen] = useState(false);
  const text = result.text?.trim() || '...';

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[30px] p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${mood.soft} 0%, #ffffff 60%)` }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{sample ? (locale === 'ko' ? '샘플 결과' : 'Sample result') : `${animal === 'dog' ? t.dog : t.cat} · ${t.result}`}</span>
          {result.emotion ? (
            <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: mood.color }}>
              {mood.emoji} {result.emotion}
            </span>
          ) : null}
        </div>

        <div className="mt-5">
          <SpeechBubble text={text} color={mood.color} />
          <div className="mt-6 flex items-end gap-4">
            <PetAvatar animal={animal} mood={mood} />
            <p className="pb-2 text-sm font-semibold text-slate-500">— {locale === 'ko' ? `우리 ${ANIMAL_LABEL[animal].name}의 속마음` : `${animal === 'dog' ? t.dog : t.cat}'s message`}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mood</p>
        <h4 className="mt-1 text-lg font-black text-slate-900">{locale === 'ko' ? '지금 기분은 ' : 'Current mood: '}<span style={{ color: mood.color }}>{result.emotion || (locale === 'ko' ? mood.label : EN_MOOD_LABELS[mood.key])}</span></h4>
        <div className="mt-4">
          <MoodMeter active={mood} locale={locale} />
        </div>
      </section>

      {result.description ? (
        <section className="rounded-[26px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">For You</p>
          <h4 className="mt-1 text-lg font-black text-slate-900">{locale === 'ko' ? '집사를 위한 한 줄 해석' : 'A note for you'}</h4>
          <p className="mt-3 text-sm leading-7 text-slate-700">{result.description}</p>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-[22px] bg-slate-50 p-4">
          <Ear className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-500">{locale === 'ko' ? '들린 소리' : 'What we heard'}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{result.transcript?.trim() || (locale === 'ko' ? '말소리 대신 울음소리 위주로 들렸어요' : 'Mostly pet sounds were heard rather than spoken words.')}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-[22px] bg-slate-50 p-4">
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-500">{locale === 'ko' ? '녹음 길이' : 'Recording length'}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{result.durationSeconds && result.durationSeconds > 0 ? `${result.durationSeconds}${locale === 'ko' ? '초' : ' sec'}` : (locale === 'ko' ? '길이 정보 없음' : 'Length unavailable')}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShareOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 sm:w-auto"
      >
        <Download className="h-4 w-4" />
        {shareOpen ? (locale === 'ko' ? '카드 닫기' : 'Close card') : (locale === 'ko' ? '결과 카드 저장' : 'Save result card')}
      </button>
      {shareOpen ? <PetShareCard animal={animal} mood={mood} text={text} emotion={result.emotion} description={result.description} sample={sample} /> : null}
    </div>
  );
}

export default PetResultCard;
