import { initHomeCarousels } from './home-carousel';
const rows = [...document.querySelectorAll<HTMLElement>('[data-slider]')];
const search = document.querySelector<HTMLInputElement>('#tool-search');
const searchPanel = document.querySelector<HTMLElement>('#home-search-results');
const searchCards = [...document.querySelectorAll<HTMLElement>('[data-search-result]')];
const rowSection = document.querySelector<HTMLElement>('#home-card-rows');
const empty = document.querySelector<HTMLElement>('#search-empty');
const favoriteEmpty = document.querySelector<HTMLElement>('#favorite-empty');
const favoriteFilter = document.querySelector<HTMLButtonElement>('#favorite-filter-button');
const storageKey = 'manytool.home.favorites';
const readFavorites = (): string[] => {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.filter(v => typeof v === 'string') : []; } catch { return []; }
};
let activeTab = 'all', favoriteOnly = false;
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const day = new Date().toISOString().slice(0,10);
// Keep the daily order, then repeat the exact same group on either side.
rows.forEach((row, index) => {
  const track = row.querySelector<HTMLElement>('[data-track]')!;
  const cards = [...track.querySelectorAll<HTMLElement>('[data-card]')];
  const hash = (text: string) => [...text].reduce((h,c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  cards.sort((a,b) => hash(day + index + a.dataset.favKey) - hash(day + index + b.dataset.favKey));
  track.replaceChildren(...[0,1,2].flatMap(dup => cards.map(card => { const clone = card.cloneNode(true) as HTMLElement; clone.dataset.dup = String(dup); return clone; })));
});
const updateFavorites = () => {
  const favorites = new Set(readFavorites());
  document.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
    const button = card.querySelector<HTMLButtonElement>('[data-favorite-toggle]');
    if (!button) return;
    const active = favorites.has(card.dataset.favKey ?? '');
    button.textContent = active ? '★' : '☆'; button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('text-amber-500',active); button.classList.toggle('bg-amber-50',active);
  });
  const count = document.querySelector('#favorite-filter-count'); if (count) count.textContent = String(favorites.size);
  favoriteFilter?.setAttribute('aria-pressed', String(favoriteOnly));
  favoriteFilter?.classList.toggle('bg-amber-100',favoriteOnly);
};
const searchTrack = document.querySelector<HTMLElement>('#home-search-track');
const searchLayout = document.querySelector<HTMLElement>('#home-search-layout');
const searchPrev = document.querySelector<HTMLButtonElement>('[data-search-nav="prev"]');
const searchNext = document.querySelector<HTMLButtonElement>('[data-search-nav="next"]');
const updateSearchNav = () => {
  if (!searchTrack) return;
  const end = Math.max(0, searchTrack.scrollWidth - searchTrack.clientWidth);
  if (searchPrev) searchPrev.disabled = searchTrack.scrollLeft <= 2;
  if (searchNext) searchNext.disabled = searchTrack.scrollLeft >= end - 2;
};
const moveSearch = (direction: number) => {
  if (!searchTrack) return;
  const card = searchCards.find(item => !item.hidden);
  if (!card) return;
  searchTrack.scrollBy({ left: direction * (card.getBoundingClientRect().width + 12), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
};
searchPrev?.addEventListener('click', () => moveSearch(-1));
searchNext?.addEventListener('click', () => moveSearch(1));
searchTrack?.addEventListener('scroll', updateSearchNav, { passive:true });
if (searchTrack) new ResizeObserver(updateSearchNav).observe(searchTrack);
const apply = () => {
  const text = search?.value.trim() ?? '';
  const query = normalize(text);
  const tokens = text.split(/\s+/).map(normalize).filter(Boolean);
  const searching = text.length > 0;
  const favorites = new Set(readFavorites());
  rowSection?.classList.toggle('hidden', searching);
  searchPanel?.classList.toggle('hidden', !searching);
  let found = 0;
  searchCards.forEach(card => {
    const haystack = normalize(card.dataset.search ?? '');
    const match = searching && (haystack.includes(query) || tokens.every(token => haystack.includes(token)));
    card.hidden = !match;
    if (match) found++;
  });
  if (searchLayout) searchLayout.hidden = found === 0;
  searchTrack?.scrollTo({ left:0, behavior:'instant' });
  updateSearchNav();
  const count = document.querySelector('#home-search-count'); if (count) count.textContent = String(found);
  let visible = 0;
  rows.forEach(row => {
    let matches = 0;
    row.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
      const matchesTab = activeTab === 'all' || (activeTab === 'new' ? card.dataset.new === 'true' : card.dataset.category === activeTab);
      const match = matchesTab && (!favoriteOnly || favorites.has(card.dataset.favKey ?? ''));
      card.classList.toggle('hidden', !match);
      if (match && card.dataset.dup === '0') matches++;
    });
    visible += matches;
    row.classList.toggle('hidden', searching || !matches);
    row.dispatchEvent(new Event('home:filter'));
  });
  empty?.classList.toggle('hidden', searching ? found > 0 : visible > 0 || favoriteOnly);
  favoriteEmpty?.classList.toggle('hidden', searching || !favoriteOnly || visible > 0);
};
document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('[data-favorite-toggle]');
  const card = button?.closest<HTMLElement>('[data-card]');
  const key = card?.dataset.favKey;
  if (!button || !key) return;
  event.preventDefault();
  const favorites = readFavorites();
  try { localStorage.setItem(storageKey, JSON.stringify(favorites.includes(key) ? favorites.filter(v => v !== key) : [...favorites,key])); } catch { return; }
  updateFavorites(); if (favoriteOnly) apply();
});
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.addEventListener('click', () => {
  activeTab = button.dataset.tab ?? 'all';
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(tab => {
    const active = tab === button;
    tab.setAttribute('aria-pressed',String(active));
    ['bg-sky-500','text-white'].forEach(c => tab.classList.toggle(c,active));
    ['border','border-sky-100','bg-white','text-slate-600'].forEach(c => tab.classList.toggle(c,!active));
  });
  apply();
}));
favoriteFilter?.addEventListener('click', () => { favoriteOnly = !favoriteOnly; updateFavorites(); apply(); });
search?.addEventListener('input', apply);
window.addEventListener('storage', event => { if (event.key === storageKey) { updateFavorites(); apply(); } });
initHomeCarousels(rows);
updateFavorites(); apply();
