import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Slide = { src: string; alt: string };

const AUTOPLAY_MS = 4500;

// Scroll-snap carousel: swipe on touch, arrows/dots on desktop, autoplay that pauses on hover or touch.
export function PromoSlider({ slides }: { slides: Slide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = (index + slides.length) % slides.length;
    const slide = track.children[next] as HTMLElement | undefined;
    if (slide) track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: 'smooth' });
  }, [slides.length]);

  const next = useCallback(() => {
    const track = trackRef.current;
    // With 2-3 slides visible the track ends before the last index, so wrap once it can't scroll further.
    const atEnd = track ? track.scrollLeft + track.clientWidth >= track.scrollWidth - 4 : false;
    goTo(atEnd ? 0 : active + 1);
  }, [active, goTo]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const width = (track.children[0] as HTMLElement | undefined)?.offsetWidth || 1;
      setActive(Math.round(track.scrollLeft / width));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, next, slides.length]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className="w-full shrink-0 snap-start sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slides.length}`}
          >
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#fff1f2_0%,#fdf2f8_50%,#f5f3ff_100%)] shadow-sm">
              <img src={slide.src} alt={slide.alt} loading={i < 3 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain" />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => goTo(active - 1)}
        className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white sm:flex"
        aria-label="이전 슬라이드"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white sm:flex"
        aria-label="다음 슬라이드"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="mt-3 flex justify-center gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-rose-500' : 'w-2 bg-rose-200 hover:bg-rose-300'}`}
            aria-label={`${i + 1}번 슬라이드로 이동`}
          />
        ))}
      </div>
    </div>
  );
}

export default PromoSlider;
