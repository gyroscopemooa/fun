import { useRef, useState } from 'react';
import { Download } from 'lucide-react';

import { saveNodeAsPng } from '@/lib/save-node-as-png';
import { ANIMAL_LABEL, PetAvatar, SpeechBubble, type MOODS, type PetAnimal } from './PetResultCard';

type Props = {
  animal: PetAnimal;
  mood: (typeof MOODS)[number];
  text: string;
  emotion?: string;
  description?: string;
  sample?: boolean;
};

// 9:16 story-sized card rendered at 360px wide and exported at 3x (1080x1920).
export function PetShareCard({ animal, mood, text, emotion, description, sample }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [petName, setPetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    setError('');
    try {
      await saveNodeAsPng(cardRef.current, `manytool-pet-${animal}.png`);
    } catch {
      setError('이미지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
      <h4 className="text-lg font-black text-slate-900">결과 카드 저장</h4>
      <p className="text-xs text-slate-500">인스타 스토리 크기(1080×1920) PNG로 저장돼요.</p>

      <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-start">
        <div className="max-w-full overflow-auto rounded-[20px] shadow-xl max-[419px]:[zoom:0.8]">
          <div
            ref={cardRef}
            className="relative flex h-[640px] w-[360px] flex-col overflow-hidden p-6"
            style={{ background: `radial-gradient(circle at 80% 10%, ${mood.color}33, transparent 45%), linear-gradient(180deg, ${mood.soft} 0%, #ffffff 70%)` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-[0.25em]" style={{ color: mood.color }}>PET TRANSLATOR</span>
              <span className="text-[11px] font-bold text-slate-500">ManyTool</span>
            </div>
            <p className="mt-6 text-[15px] font-black text-slate-700">
              {petName.trim() ? `${petName.trim()}의 속마음` : `우리 ${ANIMAL_LABEL[animal].name}의 속마음`}
            </p>
            <div className="mt-4">
              <SpeechBubble text={text} color={mood.color} large />
            </div>
            <div className="mt-8 flex justify-center">
              <PetAvatar animal={animal} mood={mood} size={150} />
            </div>
            {emotion ? (
              <p className="mt-6 text-center">
                <span className="inline-block rounded-full px-4 py-1.5 text-sm font-black text-white" style={{ background: mood.color }}>{mood.emoji} {emotion}</span>
              </p>
            ) : null}
            {description ? <p className="mt-4 line-clamp-4 text-center text-[13px] leading-6 text-slate-600">{description}</p> : null}
            <div className="mt-auto flex items-center justify-between border-t border-slate-200/70 pt-3">
              <span className="text-[10px] font-semibold text-slate-500">{sample ? '샘플 · ' : ''}AI 펫 번역기 · 재미로 보는 해석</span>
              <span className="text-[10px] font-bold text-slate-700">manytool.net/ai-pet-translator</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-800">반려동물 이름 (선택)</span>
            <input
              value={petName}
              onChange={(event) => setPetName(event.target.value.slice(0, 12))}
              placeholder={animal === 'cat' ? '예: 나비' : '예: 초코'}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
            />
          </label>
          <p className="text-xs leading-5 text-slate-500">카드는 내 기기에서만 만들어지고 서버로 전송되지 않아요.</p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {saving ? '이미지 만드는 중…' : 'PNG로 저장'}
          </button>
          {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
