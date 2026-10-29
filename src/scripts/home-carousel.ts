// Measure corresponding cards, not scrollWidth / 3: the trailing gap is different.
export function initHomeCarousels(rows: HTMLElement[]) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector<HTMLButtonElement>('#home-motion-toggle');
  let paused = motion.matches;
  const states = rows.map(row => {
    const track = row.querySelector<HTMLElement>('[data-track]')!;
    let width = 0, fraction = 0, hover = false, touching = false, focused = false, visible = false, resumeAt = 0;
    const normalize = () => {
      if (!width) return;
      const x = track.scrollLeft;
      if (x < width || x >= width * 2) track.scrollLeft = width + ((x - width) % width + width) % width;
    };
    const refresh = () => {
      const first = track.querySelector<HTMLElement>('[data-dup="0"]:not(.hidden)');
      const second = track.querySelector<HTMLElement>('[data-dup="1"]:not(.hidden)');
      const distance = first && second ? second.offsetLeft - first.offsetLeft : 0;
      width = !row.classList.contains('hidden') && distance > track.clientWidth ? distance : 0;
      row.dataset.looping = String(Boolean(width));
      // Short result sets are displayed once, with no artificial repeated cards.
      track.querySelectorAll<HTMLElement>('[data-dup]:not([data-dup="0"])').forEach(card => { card.style.display = width ? '' : 'none'; });
      track.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
        const accessible = card.dataset.dup === (width ? '1' : '0');
        card.setAttribute('aria-hidden', String(!accessible));
        card.querySelectorAll<HTMLElement>('a, button').forEach(control => {
          if (accessible) control.removeAttribute('tabindex'); else control.tabIndex = -1;
        });
      });
      track.scrollLeft = width;
      fraction = 0;
      row.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button => { button.disabled = !width && track.scrollWidth <= track.clientWidth; });
    };
    const rebuild = () => {
      track.querySelectorAll<HTMLElement>('[data-dup]').forEach(card => { card.style.display = ''; });
      refresh();
    };
    const move = (direction: number) => {
      track.scrollLeft += direction * Math.max(200, track.clientWidth * .8);
      normalize(); resumeAt = performance.now() + 1500;
    };
    row.querySelector('[data-nav="prev"]')?.addEventListener('click', () => move(-1));
    row.querySelector('[data-nav="next"]')?.addEventListener('click', () => move(1));
    track.addEventListener('scroll', normalize, { passive: true });
    row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    row.addEventListener('pointerleave', () => { hover = false; });
    track.addEventListener('pointerdown', () => { touching = true; });
    const release = () => { if (touching) { touching = false; resumeAt = performance.now() + 1500; } };
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    row.addEventListener('focusin', () => { focused = true; });
    row.addEventListener('focusout', e => { focused = e.relatedTarget instanceof Node && row.contains(e.relatedTarget); });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(row);
    new ResizeObserver(rebuild).observe(track);
    row.addEventListener('home:filter', rebuild);
    rebuild();
    return { tick(elapsed: number, now: number) {
      if (!width || !visible || hover || touching || focused || now < resumeAt || row.classList.contains('hidden')) return;
      fraction += elapsed * .028;
      const delta = Math.floor(fraction);
      if (delta) { fraction -= delta; track.scrollLeft += delta; normalize(); }
    }};
  });
  const updateToggle = () => {
    if (!toggle) return;
    toggle.textContent = paused ? toggle.dataset.play ?? '자동 이동 시작' : toggle.dataset.pause ?? '자동 이동 일시정지';
    toggle.setAttribute('aria-pressed', String(!paused));
  };
  toggle?.addEventListener('click', () => { paused = !paused; updateToggle(); });
  motion.addEventListener('change', e => { paused = e.matches; updateToggle(); });
  updateToggle();
  let previous = 0;
  function frame(now: number) {
    const elapsed = Math.min(now - previous, 50); previous = now;
    if (!paused && !document.hidden) states.forEach(state => state.tick(elapsed, now));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
