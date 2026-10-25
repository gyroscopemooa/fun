// Turns plain <input type="file"> controls ("파일 선택 / 선택된 파일 없음") into a clickable upload box with
// drag-and-drop, file names and an image preview. The original input stays in the DOM (same id, same
// listeners), so page scripts that read `input.files` or listen for `change` keep working.
// React islands and inputs that are already hidden manage their own UI and are skipped.

const COPY = {
  ko: { pick: '클릭해서 파일 선택', pickMany: '클릭해서 파일 선택 (여러 개 가능)', drop: '또는 여기로 끌어다 놓기', change: '다른 파일로 바꾸기', image: '이미지', pdf: 'PDF', video: '동영상', audio: '오디오', any: '파일', count: (n: number) => `${n}개 선택됨`, more: (name: string, n: number) => `${name} 외 ${n}개` },
  ja: { pick: 'クリックしてファイルを選択', pickMany: 'クリックしてファイルを選択（複数可）', drop: 'またはここにドラッグ＆ドロップ', change: '別のファイルに変更', image: '画像', pdf: 'PDF', video: '動画', audio: '音声', any: 'ファイル', count: (n: number) => `${n}件選択`, more: (name: string, n: number) => `${name} ほか${n}件` },
  en: { pick: 'Click to choose a file', pickMany: 'Click to choose files', drop: 'or drag and drop here', change: 'Choose a different file', image: 'Images', pdf: 'PDF', video: 'Video', audio: 'Audio', any: 'Files', count: (n: number) => `${n} selected`, more: (name: string, n: number) => `${name} +${n} more` }
};

const copyFor = () => {
  const lang = document.documentElement.lang.slice(0, 2);
  return lang === 'ko' ? COPY.ko : lang === 'ja' ? COPY.ja : COPY.en;
};

const acceptLabel = (accept: string, t: (typeof COPY)['ko']) => {
  if (!accept) return t.any;
  const parts = new Set<string>();
  for (const token of accept.split(',').map((s) => s.trim().toLowerCase())) {
    if (token.startsWith('image/')) parts.add(token === 'image/*' ? t.image : token.slice(6).toUpperCase().replace('JPEG', 'JPG'));
    else if (token === 'application/pdf' || token === '.pdf') parts.add(t.pdf);
    else if (token.startsWith('video/')) parts.add(t.video);
    else if (token.startsWith('audio/')) parts.add(t.audio);
    else if (token.startsWith('.')) parts.add(token.slice(1).toUpperCase());
  }
  return [...parts].join(' · ') || t.any;
};

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>';

const enhance = (input: HTMLInputElement) => {
  if (input.dataset.enhanced || input.closest('astro-island') || input.dataset.noEnhance !== undefined) return;
  const style = getComputedStyle(input);
  if (input.classList.contains('hidden') || input.classList.contains('sr-only') || style.display === 'none') return;
  input.dataset.enhanced = 'true';
  const t = copyFor();

  const zone = document.createElement('div');
  zone.setAttribute('role', 'button');
  zone.tabIndex = 0;
  // Keep the input's vertical spacing so the page layout doesn't shift.
  const spacing = Array.from(input.classList).filter((c) => /^(mt|mb|my)-/.test(c));
  zone.className = ['file-drop-zone group flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500', ...spacing].join(' ');
  zone.innerHTML = `
    <span class="text-indigo-500 transition group-hover:scale-110">${ICON}</span>
    <span data-title class="text-sm font-black text-slate-900">${input.multiple ? t.pickMany : t.pick}</span>
    <span class="text-xs text-slate-500">${t.drop} · ${acceptLabel(input.accept, t)}</span>
    <span data-picked class="mt-2 hidden w-full max-w-md items-center gap-3 rounded-xl bg-white px-3 py-2 text-left shadow-sm">
      <img data-thumb alt="" class="hidden h-12 w-12 shrink-0 rounded-lg object-cover" />
      <span class="min-w-0 flex-1">
        <span data-names class="block truncate text-sm font-bold text-slate-800"></span>
        <span data-sizes class="block text-xs text-slate-500"></span>
      </span>
    </span>`;

  input.classList.add('sr-only');
  spacing.forEach((c) => input.classList.remove(c));
  input.insertAdjacentElement('afterend', zone);

  const picked = zone.querySelector<HTMLElement>('[data-picked]')!;
  const thumb = zone.querySelector<HTMLImageElement>('[data-thumb]')!;
  const title = zone.querySelector<HTMLElement>('[data-title]')!;
  let thumbUrl = '';

  const render = () => {
    const files = Array.from(input.files ?? []);
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = '';
    if (!files.length) {
      picked.classList.add('hidden');
      picked.classList.remove('flex');
      title.textContent = input.multiple ? t.pickMany : t.pick;
      return;
    }
    const total = files.reduce((sum, f) => sum + f.size, 0);
    zone.querySelector<HTMLElement>('[data-names]')!.textContent = files.length === 1 ? files[0].name : t.more(files[0].name, files.length - 1);
    zone.querySelector<HTMLElement>('[data-sizes]')!.textContent = `${files.length > 1 ? `${t.count(files.length)} · ` : ''}${total < 1024 ** 2 ? `${(total / 1024).toFixed(1)} KB` : `${(total / 1024 ** 2).toFixed(1)} MB`}`;
    if (files[0].type.startsWith('image/')) {
      thumbUrl = URL.createObjectURL(files[0]);
      thumb.src = thumbUrl;
      thumb.classList.remove('hidden');
    } else {
      thumb.classList.add('hidden');
    }
    picked.classList.remove('hidden');
    picked.classList.add('flex');
    title.textContent = t.change;
    zone.classList.replace('border-slate-300', 'border-indigo-300');
  };

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('border-indigo-500', 'bg-indigo-50'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('border-indigo-500', 'bg-indigo-50'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('border-indigo-500', 'bg-indigo-50');
    const dropped = e.dataTransfer?.files;
    if (!dropped?.length) return;
    const dt = new DataTransfer();
    Array.from(dropped).slice(0, input.multiple ? undefined : 1).forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  input.addEventListener('change', render);
};

const run = () => document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(enhance);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
else run();

export {};
