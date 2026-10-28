import { useId } from 'react';
import { themes, type ThemeKey } from '@/lib/product-detail-studio';
import { DETAIL_PAGE_PALETTES } from './DetailPageCanvas';

export default function DetailPageThemeSelect({ value, onChange, locale = 'ko', dark = false }: {
  value: ThemeKey;
  onChange: (theme: ThemeKey) => void;
  locale?: 'ko' | 'en' | 'ja';
  dark?: boolean;
}) {
  const id = useId();
  const selected = themes.find(theme => theme.key === value) ?? themes[0];
  const palette = DETAIL_PAGE_PALETTES[selected.key];
  const label = locale === 'ko' ? '디자인 톤' : locale === 'ja' ? 'デザイントーン' : 'Design tone';
  return (
    <div className="mt-4 min-w-0">
      <label htmlFor={id} className={`mb-2 block text-sm font-semibold ${dark ? 'text-white/80' : 'text-slate-700'}`}>{label} · {themes.length}</label>
      <select id={id} value={selected.key} onChange={event => onChange(event.target.value as ThemeKey)}
        aria-describedby={`${id}-preview`}
        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500">
        {themes.map(theme => <option key={theme.key} value={theme.key}>{locale === 'ko' ? `${theme.labelKo} · ${theme.name}` : theme.name}</option>)}
      </select>
      <div id={`${id}-preview`} aria-live="polite" className="mt-3 overflow-hidden rounded-xl border" style={{ background: palette.bg, color: palette.ink, borderColor: palette.line }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: palette.surface }}>
          <span className="text-sm font-bold">{locale === 'ko' ? selected.labelKo : selected.name}</span>
          <div className="flex gap-1.5" aria-hidden="true">{[palette.bg, palette.accent, palette.dark].map((color, i) => <span key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ background: color }} />)}</div>
        </div>
        <div className="px-4 py-4">
          <span className="inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: palette.accent, color: palette.accentInk }}>{locale === 'ko' ? '선택한 색감 미리보기' : locale === 'ja' ? '選択した配色' : 'Selected palette'}</span>
          <p className="mt-3 text-sm leading-6" style={{ color: palette.sub }}>{locale === 'ko' ? selected.description : locale === 'ja' ? '背景・文字・アクセントカラーが商品ページに反映されます。' : 'Background, text and accent colors apply to your product page.'}</p>
        </div>
      </div>
    </div>
  );
}
