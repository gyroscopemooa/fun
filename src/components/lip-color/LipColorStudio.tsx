import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Wand2 } from 'lucide-react';

import { SEASONS, TONES, readableText, type ToneInfo } from '@/lib/personal-color-tones';
import { detectLips, renderLips, shade, type Finish, type LipShape } from './lipRenderer';

type LipShade = { id: string; name: string; hex: string; tone: ToneInfo };

// Three shades per tone (light / base / deep) built from each tone's reference lip colour.
const SHADES: LipShade[] = TONES.flatMap((tone) => [
  { id: `${tone.id}-light`, name: `라이트 ${tone.lip.name}`, hex: shade(tone.lip.hex, 0.22), tone },
  { id: `${tone.id}-base`, name: tone.lip.name, hex: tone.lip.hex, tone },
  { id: `${tone.id}-deep`, name: `딥 ${tone.lip.name}`, hex: shade(tone.lip.hex, -0.22), tone }
]);

const SEASON_PICKS: Record<(typeof SEASONS)[number], string> = {
  '봄 웜': 'spring-true-base',
  '여름 쿨': 'summer-true-base',
  '가을 웜': 'autumn-true-base',
  '겨울 쿨': 'winter-true-base'
};

type Status = 'idle' | 'loading' | 'ready' | 'noface' | 'error';

function SeasonCompare({ image, lips, intensity, finish }: { image: HTMLImageElement; lips: LipShape; intensity: number; finish: Finish }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    SEASONS.forEach((season, i) => {
      const canvas = refs.current[i];
      const pick = SHADES.find((item) => item.id === SEASON_PICKS[season]);
      if (!canvas || !pick) return;
      // Zoom on the mouth so the four results are comparable at thumbnail size.
      const full = document.createElement('canvas');
      renderLips(full, image, lips, pick.hex, intensity, finish);
      const size = lips.width * 2.6;
      const sx = Math.max(0, lips.center.x - size / 2);
      const sy = Math.max(0, lips.center.y - size * 0.62);
      canvas.width = 320;
      canvas.height = 320;
      canvas.getContext('2d')?.drawImage(full, sx, sy, size, size, 0, 0, 320, 320);
    });
  }, [image, lips, intensity, finish]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SEASONS.map((season, i) => {
        const pick = SHADES.find((item) => item.id === SEASON_PICKS[season]);
        return (
          <figure key={season} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <canvas ref={(node) => { refs.current[i] = node; }} className="aspect-square w-full" />
            <figcaption className="flex items-center gap-2 px-3 py-2">
              <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ background: pick?.hex }} />
              <span className="truncate text-xs font-bold text-slate-800">{season} · {pick?.name}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function LipColorStudio({ sampleUrl }: { sampleUrl?: string }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [lips, setLips] = useState<LipShape | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [season, setSeason] = useState<(typeof SEASONS)[number]>('여름 쿨');
  const [selected, setSelected] = useState<LipShade>(SHADES.find((item) => item.id === 'summer-true-base') ?? SHADES[0]);
  const [intensity, setIntensity] = useState(70);
  const [finish, setFinish] = useState<Finish>('matte');
  const [split, setSplit] = useState(50);
  const resultRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (src: string) => {
    setStatus('loading');
    setLips(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    try {
      await img.decode();
      setImage(img);
      const found = await detectLips(img);
      setLips(found);
      setStatus(found ? 'ready' : 'noface');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (resultRef.current && image) renderLips(resultRef.current, image, lips, selected.hex, intensity / 100, finish);
  }, [image, lips, selected, intensity, finish]);

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && load(reader.result);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const canvas = resultRef.current;
    if (!canvas) return;
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);
    const pad = Math.round(canvas.width * 0.025);
    const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.fillText(`${selected.name} · manytool.net`, out.width - pad, out.height - pad);
    out.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `manytool-lip-${selected.id}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }, 'image/png');
  };

  const seasonShades = useMemo(() => SHADES.filter((item) => item.tone.season === season), [season]);
  const imageUrl = image?.src;

  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[28px] border border-rose-100 bg-white p-4 shadow-sm">
          {image ? (
            <div className="relative mx-auto max-h-[560px] w-full overflow-hidden rounded-[22px] bg-slate-100" style={{ aspectRatio: `${image.naturalWidth} / ${image.naturalHeight}`, maxWidth: `${(560 * image.naturalWidth) / image.naturalHeight}px` }}>
              <img src={imageUrl} alt="원본 사진" className="absolute inset-0 h-full w-full object-cover" />
              <canvas ref={resultRef} className="absolute inset-0 h-full w-full" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
              {status === 'ready' ? (
                <>
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
                  <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white">BEFORE</span>
                  <span className="pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: selected.hex, color: readableText(selected.hex) }}>AFTER</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={split}
                    onChange={(event) => setSplit(Number(event.target.value))}
                    className="absolute inset-x-0 bottom-0 h-full w-full cursor-ew-resize opacity-0"
                    aria-label="전후 비교 위치"
                  />
                </>
              ) : null}
              {status === 'loading' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-sm font-bold text-slate-700">
                  <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
                  입술 위치를 찾는 중…
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-rose-200 bg-[linear-gradient(160deg,#fff1f2,#fdf2f8,#f5f3ff)] text-center"
            >
              <span className="text-5xl">💄</span>
              <span className="text-base font-black text-slate-900">정면 얼굴 사진 올리기</span>
              <span className="max-w-xs text-sm text-slate-500">입술이 잘 보이는 밝은 사진일수록 자연스럽게 발색돼요</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700">
              <ImagePlus className="h-4 w-4" />
              {image ? '다른 사진' : '사진 올리기'}
            </button>
            {sampleUrl ? (
              <button type="button" onClick={() => load(sampleUrl)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100">
                <Wand2 className="h-4 w-4" />
                샘플 사진으로 해보기
              </button>
            ) : null}
            {status === 'ready' ? (
              <button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                <Download className="h-4 w-4" />
                이미지 저장
              </button>
            ) : null}
          </div>
          {status === 'noface' ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">얼굴을 찾지 못했어요. 정면이 잘 보이는 사진으로 다시 시도해 주세요.</p> : null}
          {status === 'error' ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">입술 인식 기능을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.</p> : null}
          <p className="mt-3 text-xs text-slate-400">사진은 내 기기 안에서만 처리되고 서버로 전송되지 않아요. 사진 위를 좌우로 밀면 전후를 비교할 수 있어요.</p>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold tracking-[0.16em] text-rose-500">LIP SHADES</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">톤별 립 컬러 36</h3>
            <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {SEASONS.map((item) => (
                <button key={item} type="button" onClick={() => setSeason(item)} className={`rounded-lg px-2 py-2 transition ${season === item ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {TONES.filter((tone) => tone.season === season).map((tone) => (
                <div key={tone.id}>
                  <p className="text-xs font-bold text-slate-500">{tone.label}</p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {seasonShades.filter((item) => item.tone.id === tone.id).map((item) => {
                      const active = item.id === selected.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelected(item)}
                          className={`flex items-center gap-2 rounded-xl border p-1.5 pr-2 text-left transition ${active ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-400'}`}
                        >
                          <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${shade(item.hex, 0.25)}, ${item.hex} 55%, ${shade(item.hex, -0.2)})` }} />
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-bold text-slate-800">{item.name}</span>
                            <span className="block font-mono text-[10px] text-slate-400">{item.hex}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <label className="block">
              <span className="flex justify-between text-sm font-bold text-slate-800">
                <span>발색 강도</span>
                <span className="text-slate-500">{intensity}%</span>
              </span>
              <input type="range" min={10} max={100} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="mt-2 w-full accent-rose-500" />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-bold">
              {([['matte', '매트'], ['gloss', '글로시']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFinish(value)} className={`rounded-lg py-2 transition ${finish === value ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl p-3" style={{ background: `${selected.hex}14` }}>
              <span className="h-10 w-10 shrink-0 rounded-full border-4 border-white shadow" style={{ background: selected.hex }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-500">{selected.tone.label}에게 추천 · {selected.hex}</p>
              </div>
            </div>
          </section>
        </div>
      </section>

      {status === 'ready' && image && lips ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.16em] text-violet-600">SEASON COMPARE</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">4계절 대표 립 한눈에 비교</h3>
          <p className="mt-1 text-xs text-slate-500">같은 강도·마감으로 계절별 대표 립을 나란히 보여드려요. 가장 혈색이 살아 보이는 칸이 내 톤일 가능성이 높아요.</p>
          <div className="mt-4">
            <SeasonCompare image={image} lips={lips} intensity={intensity / 100} finish={finish} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default LipColorStudio;
