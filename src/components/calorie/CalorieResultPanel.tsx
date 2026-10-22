import { useEffect, useState } from 'react';
import { Salad } from 'lucide-react';

import { CalorieReport, type CalorieAnalysis } from './CalorieReport';

type ResultDetail = { analysis: CalorieAnalysis; photoUrl?: string } | null;

declare global {
  interface WindowEventMap {
    'manytool:ai-calorie-result': CustomEvent<ResultDetail>;
  }
}

export function CalorieResultPanel() {
  const [result, setResult] = useState<ResultDetail>(null);

  useEffect(() => {
    const handleResult = (event: WindowEventMap['manytool:ai-calorie-result']) => {
      setResult(event.detail ?? null);
      if (event.detail) {
        window.requestAnimationFrame(() => document.getElementById('calorie-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    };
    window.addEventListener('manytool:ai-calorie-result', handleResult);
    return () => window.removeEventListener('manytool:ai-calorie-result', handleResult);
  }, []);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
          <Salad className="h-6 w-6" />
        </span>
        <p className="mt-3 text-base font-bold text-slate-900">분석이 끝나면 여기에 식단 리포트가 열려요</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">총 칼로리와 범위, 탄단지 비율, 식단 점수, 음식별 칼로리, 대체 메뉴, 저장용 결과 카드까지 보여드려요. 아래 샘플에서 미리 확인해 보세요.</p>
      </div>
    );
  }

  return <CalorieReport analysis={result.analysis} photoUrl={result.photoUrl} />;
}

export default CalorieResultPanel;
