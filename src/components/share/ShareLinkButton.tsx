import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

import { shareResult } from '@/lib/share-result';

type Props = { url: string; title: string; text?: string; label?: string; className?: string };

export function ShareLinkButton({ url, title, text, label = '결과 링크 공유', className }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const outcome = await shareResult({ url, title, text });
    if (outcome === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50'}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
      {copied ? '링크를 복사했어요' : label}
    </button>
  );
}

export default ShareLinkButton;
