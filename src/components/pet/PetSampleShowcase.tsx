import { useState } from 'react';

import { PetResultCard, type PetResult } from './PetResultCard';

// Hand-written sample results in the same shape the API returns.
const SAMPLES: { id: string; label: string; result: PetResult }[] = [
  {
    id: 'dog-walk',
    label: '🐶 산책 가자 멍!',
    result: {
      animal: 'dog',
      text: '지금 나가자! 목줄 어디 있어? 빨리빨리!',
      emotion: '기쁨과 흥분',
      description: '짧고 높은 톤으로 연달아 짖는 건 신나서 보채는 신호예요. 산책 시간이 다가오면 자주 들리는 소리랍니다.',
      transcript: '왕! 왕왕! (높은 톤의 짧은 짖음)',
      durationSeconds: 3
    }
  },
  {
    id: 'cat-food',
    label: '🐱 밥 내놔 냥',
    result: {
      animal: 'cat',
      text: '그릇이 비어 있잖아. 집사, 일 안 해?',
      emotion: '배고픔과 약간의 불만',
      description: '길게 끄는 "냐아앙"은 사람에게 무언가를 요구할 때 내는 소리예요. 밥그릇이나 물그릇을 먼저 확인해 보세요.',
      transcript: '냐아아앙~ (길게 끄는 울음)',
      durationSeconds: 2
    }
  },
  {
    id: 'dog-alone',
    label: '🐶 혼자 두지 마',
    result: {
      animal: 'dog',
      text: '어디 가? 금방 오는 거 맞지…?',
      emotion: '불안',
      description: '낮게 끙끙거리는 소리는 보호자와 떨어질 때 자주 나와요. 외출 전 짧은 놀이와 간식 장난감이 도움이 돼요.',
      transcript: '끼잉… 끙… (낮은 톤의 낑낑거림)',
      durationSeconds: 4
    }
  },
  {
    id: 'cat-love',
    label: '🐱 골골송',
    result: {
      animal: 'cat',
      text: '여기 계속 쓰다듬어. 딱 좋아.',
      emotion: '애정과 편안함',
      description: '골골거리는 소리와 짧은 "냥"은 기분이 좋고 안심된다는 표현이에요. 지금처럼 천천히 쓰다듬어 주세요.',
      transcript: '그르릉… 냥 (골골송)',
      durationSeconds: 3
    }
  }
];

const EN_SAMPLES: typeof SAMPLES = [
  { id: 'dog-walk', label: '🐶 Let’s go for a walk!', result: { animal: 'dog', text: 'Let’s go now! Where is my leash?', emotion: 'Happy and excited', description: 'Short, high-pitched barks often show eager excitement, especially near walk time.', transcript: 'Woof! Woof woof! (short, high-pitched barks)', durationSeconds: 3 } },
  { id: 'cat-food', label: '🐱 Feed me', result: { animal: 'cat', text: 'My bowl is empty. Please fill it.', emotion: 'Hungry and mildly annoyed', description: 'A long meow is commonly used to ask a person for something. Check the food and water bowls first.', transcript: 'Meeooow (long meow)', durationSeconds: 2 } },
  { id: 'dog-alone', label: '🐶 Don’t leave me', result: { animal: 'dog', text: 'Where are you going? You will be back soon, right?', emotion: 'Anxious', description: 'Low whining is common when a dog expects separation. A short play session or treat toy can help.', transcript: 'Whine… whimper… (low whining)', durationSeconds: 4 } },
  { id: 'cat-love', label: '🐱 Purring', result: { animal: 'cat', text: 'Keep petting me right there. That feels perfect.', emotion: 'Affectionate and relaxed', description: 'Purring with a short meow often means the cat feels safe and content.', transcript: 'Purr… meow (purring)', durationSeconds: 3 } }
];

export function PetSampleShowcase({ locale = 'en' }: { locale?: string }) {
  const samples = locale === 'ko' ? SAMPLES : EN_SAMPLES;
  const [active, setActive] = useState(SAMPLES[0].id);
  const sample = samples.find((item) => item.id === active) ?? samples[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {samples.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${item.id === active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <PetResultCard key={sample.id} result={sample.result} sample locale={locale} />
      </div>
    </div>
  );
}

export default PetSampleShowcase;
