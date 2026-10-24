import { withLocalePath, type Locale } from './i18n';

// Which pages exist per locale, read from the page files at build time:
// - src/pages/en/x.astro, src/pages/ja/x.astro: static pages for that locale only
// - src/pages/[locale]/x.astro: rendered for every non-Korean locale
// - src/pages/[locale]/[tool].astro: rendered for the rollout locales except en/ja
const pageFiles = Object.keys(import.meta.glob('../pages/**/*.astro')).map((file) =>
  file.replace(/^\.\.\/pages/, '').replace(/\.astro$/, '').replace(/\/index$/, '') || '/'
);

const sharedLocalePaths = new Set(
  pageFiles.filter((file) => file.startsWith('/[locale]/') && !file.slice('/[locale]'.length).includes('[')).map((file) => file.slice('/[locale]'.length))
);
const staticLocalePaths = new Set(pageFiles.filter((file) => !file.includes('[')));
// Keep in sync with toolSlugs in src/pages/[locale]/[tool].astro.
const toolRouteSlugs = new Set(['ai-personal-color', 'ai-calorie-calculator', 'ai-manseryeok', 'ai-id-photo', 'ai-headshot', 'ai-pet-translator', 'valorant-agent-picker', 'crosshair-generator', 'fps-aim-sensitivity', 'fps-aim-trainer', 'fps-sensitivity-converter', 'dpi-edpi-calculator', 'fov-calculator', 'name-compatibility', 'nickname-generator', 'name-meaning', 'random-picker', 'chat-random-picker', 'lol-champion-recommender', 'game-character-picker']);

export const hasLocalePage = (locale: Locale, path: string) => {
  if (locale === 'ko' || path === '/') return true;
  if (staticLocalePaths.has(`/${locale}${path}`)) return true;
  if (sharedLocalePaths.has(path)) return true;
  return locale !== 'en' && locale !== 'ja' && toolRouteSlugs.has(path.slice(1));
};

/** Locale URL when that page exists, otherwise the Korean original instead of a page that falls back to the home screen. */
export const localizedHrefOrOriginal = (locale: Locale, path: string) => (hasLocalePage(locale, path) ? withLocalePath(locale, path) : path);
