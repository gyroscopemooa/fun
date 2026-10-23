import { useEffect, useState } from 'react';
import { PawPrint } from 'lucide-react';

import { PetResultCard, type PetResult } from './PetResultCard';

declare global {
  interface WindowEventMap {
    'manytool:ai-pet-result': CustomEvent<PetResult | null>;
  }
}

// Results come from the inline script in ai-pet-translator.astro.
export function PetResultPanel() {
  const [result, setResult] = useState<PetResult | null>(null);

  useEffect(() => {
    const handle = (event: WindowEventMap['manytool:ai-pet-result']) => setResult(event.detail ?? null);
    window.addEventListener('manytool:ai-pet-result', handle);
    return () => window.removeEventListener('manytool:ai-pet-result', handle);
  }, []);

  if (!result) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-[28px] border border-dashed border-rose-200 bg-rose-50/40 px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
          <PawPrint className="h-7 w-7" />
        </span>
        <p className="mt-3 text-base font-black text-slate-900">녹음하면 여기에 속마음 말풍선이 떠요</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">하고 싶은 말, 지금 기분, 집사를 위한 해석까지 보여드리고 저장용 카드도 만들 수 있어요. 아래 샘플에서 미리 확인해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <PetResultCard result={result} />
    </div>
  );
}

export default PetResultPanel;
