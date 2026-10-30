import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

import { PersonalColorReport, type PersonalColorAnalysis } from './PersonalColorReport';
import { personalColorText, type PersonalColorLocale } from '@/lib/personal-color-i18n';

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

export function PersonalColorResultPanel({ locale = 'en' }: { locale?: PersonalColorLocale }) {
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
    const t = personalColorText(locale);
    return (
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
          <Palette className="h-6 w-6" />
        </span>
        <p className="mt-3 text-base font-bold text-slate-900">{t.reportReady}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{t.reportReadyDesc}</p>
      </div>
    );
  }

  return <PersonalColorReport analysis={analysis} photoUrl={photoUrl || undefined} locale={locale} />;
}

export default PersonalColorResultPanel;
