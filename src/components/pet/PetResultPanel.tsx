import { useEffect, useState } from 'react';
import { PawPrint } from 'lucide-react';

import { PetResultCard, type PetResult } from './PetResultCard';
import { petText, type PetLocale } from '@/lib/pet-i18n';

declare global {
  interface WindowEventMap {
    'manytool:ai-pet-result': CustomEvent<PetResult | null>;
  }
}

// Results come from the inline script in ai-pet-translator.astro.
export function PetResultPanel({ locale = 'en' }: { locale?: PetLocale }) {
  const [result, setResult] = useState<PetResult | null>(null);

  useEffect(() => {
    const handle = (event: WindowEventMap['manytool:ai-pet-result']) => setResult(event.detail ?? null);
    window.addEventListener('manytool:ai-pet-result', handle);
    return () => window.removeEventListener('manytool:ai-pet-result', handle);
  }, []);

  if (!result) {
    const t = petText(locale);
    return (
      <div className="mt-6 flex flex-col items-center rounded-[28px] border border-dashed border-rose-200 bg-rose-50/40 px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
          <PawPrint className="h-7 w-7" />
        </span>
        <p className="mt-3 text-base font-black text-slate-900">{t.noResult}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{locale === 'ko' ? '말풍선 결과, 현재 기분, 보호자를 위한 해석과 저장용 카드가 여기에 표시됩니다.' : 'Your pet’s message, current mood, guidance, and a shareable card will appear here.'}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <PetResultCard result={result} locale={locale} />
    </div>
  );
}

export default PetResultPanel;
