import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

import { PersonalColorReport, type PersonalColorAnalysis } from './PersonalColorReport';

declare global {
  interface WindowEventMap {
    'manytool:ai-personal-color-result': CustomEvent<PersonalColorAnalysis | null>;
  }
}

// Written by the page script in ai-personal-color.astro.
const STORAGE_IMAGE_KEY = 'manytool.aiPersonalColor.image';

const readStoredPhoto = () => {
  try {
    return window.sessionStorage.getItem(STORAGE_IMAGE_KEY) || '';
  } catch {
    return '';
  }
};

export function PersonalColorResultPanel() {
  const [analysis, setAnalysis] = useState<PersonalColorAnalysis | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    const handleResult = (event: WindowEventMap['manytool:ai-personal-color-result']) => {
      setAnalysis(event.detail ?? null);
      setPhotoUrl(event.detail ? readStoredPhoto() : '');
      if (event.detail) {
        window.requestAnimationFrame(() => document.getElementById('personal-color-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    };
    window.addEventListener('manytool:ai-personal-color-result', handleResult);
    return () => window.removeEventListener('manytool:ai-personal-color-result', handleResult);
  }, []);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
          <Palette className="h-6 w-6" />
        </span>
        <p className="mt-3 text-base font-bold text-slate-900">분석이 끝나면 여기에 내 리포트가 열려요</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">12톤 진단, 가상 드레이핑, 베스트·워스트 컬러칩, 메이크업·헤어 컬러, 저장용 결과 카드까지 한 번에 보여드려요. 아래 샘플에서 미리 확인해 보세요.</p>
      </div>
    );
  }

  return <PersonalColorReport analysis={analysis} photoUrl={photoUrl || undefined} />;
}

export default PersonalColorResultPanel;
