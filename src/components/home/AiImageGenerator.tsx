import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, LoaderCircle, Sparkles, UploadCloud, X } from 'lucide-react';

type Mode = 'figure' | 'body';
type GenerationPhase = 'idle' | 'payment' | 'generating' | 'done';

type ModeContent = {
  tabLabel: string;
  title: string;
  buttonLabel: string;
  exampleTitle: string;
  exampleDescription: string;
  accentClass: string;
  exampleGradient: string;
};

const MODE_CONTENT: Record<Mode, ModeContent> = {
  figure: {
    tabLabel: '피규어',
    title: 'AI 피규어 생성기',
    buttonLabel: '피규어 생성하기  6,900',
    exampleTitle: '피규어 예시',
    exampleDescription: '업로드한 사진을 바탕으로 디테일한 컬렉터블 피규어 스타일 이미지를 생성합니다.',
    accentClass: 'from-orange-500 via-amber-400 to-yellow-300',
    exampleGradient: 'from-orange-100 via-amber-50 to-white'
  },
  body: {
    tabLabel: '바디프로필',
    title: 'AI 바디프로필 생성기',
    buttonLabel: '바디프로필 생성하기  9,900',
    exampleTitle: '바디프로필 예시',
    exampleDescription: '스튜디오 촬영 느낌의 바디프로필 무드와 라이팅을 적용한 결과를 미리 보여줍니다.',
    accentClass: 'from-sky-600 via-cyan-500 to-teal-400',
    exampleGradient: 'from-cyan-100 via-white to-slate-50'
  }
};

const RESULT_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="50%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)" rx="48"/>
  <circle cx="400" cy="300" r="120" fill="#94a3b8" opacity="0.45"/>
  <rect x="250" y="430" width="300" height="290" rx="150" fill="#cbd5e1" opacity="0.32"/>
  <rect x="175" y="790" width="450" height="32" rx="16" fill="#f8fafc" opacity="0.65"/>
  <rect x="240" y="845" width="320" height="20" rx="10" fill="#f8fafc" opacity="0.3"/>
</svg>
`)}`;

const buildExamplePlaceholder = (mode: Mode) => {
  const palette = mode === 'figure'
    ? { start: '#fb923c', end: '#facc15', label: 'FIGURE', badge: 'Collectible Style' }
    : { start: '#0ea5e9', end: '#2dd4bf', label: 'BODY PROFILE', badge: 'Studio Mood' };

  return `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
    <defs>
      <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.start}"/>
        <stop offset="100%" stop-color="${palette.end}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="1000" fill="#fffaf5" rx="40"/>
    <rect x="44" y="44" width="712" height="912" rx="36" fill="url(#card)"/>
    <circle cx="400" cy="360" r="130" fill="rgba(255,255,255,0.35)"/>
    <rect x="250" y="500" width="300" height="220" rx="120" fill="rgba(255,255,255,0.28)"/>
    <rect x="96" y="104" width="220" height="46" rx="23" fill="rgba(15,23,42,0.16)"/>
    <text x="126" y="135" fill="#0f172a" font-size="22" font-family="Arial, sans-serif" font-weight="700">${palette.badge}</text>
    <text x="96" y="835" fill="white" font-size="60" font-family="Arial, sans-serif" font-weight="800">${palette.label}</text>
    <text x="96" y="886" fill="rgba(255,255,255,0.86)" font-size="28" font-family="Arial, sans-serif">AI generated sample preview</text>
  </svg>
  `)}`;
};

const PAYMENT_DELAY_MS = 1600;
const GENERATION_DELAY_MS = 2200;

export default function AiImageGenerator() {
  const [mode, setMode] = useState<Mode>('figure');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeContent = MODE_CONTENT[mode];
  const exampleImage = useMemo(() => buildExamplePlaceholder(mode), [mode]);

  useEffect(() => {
    if (!uploadedImage) {
      setPreviewUrl('');
      return;
    }

    const nextUrl = URL.createObjectURL(uploadedImage);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [uploadedImage]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const updateUploadedImage = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedImage(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    updateUploadedImage(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    updateUploadedImage(event.dataTransfer.files?.[0] ?? null);
  };

  const handleGenerate = () => {
    if (!uploadedImage) return;

    setIsModalOpen(true);
    setGenerationPhase('payment');

    // TODO: replace with Polar checkout initialization.
    window.setTimeout(() => {
      setGenerationPhase('generating');

      // TODO: replace with actual image generation API request and email delivery trigger.
      window.setTimeout(() => {
        setGenerationPhase('done');
      }, GENERATION_DELAY_MS);
    }, PAYMENT_DELAY_MS);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setGenerationPhase('idle');
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#fffaf5_0%,_#fff_42%,_#f8fafc_100%)] pb-32 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[28px] border border-white/70 bg-white/85 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap gap-3">
            {(['figure', 'body'] as Mode[]).map((tabMode) => {
              const tabContent = MODE_CONTENT[tabMode];
              const isActive = mode === tabMode;

              return (
                <button
                  key={tabMode}
                  type="button"
                  onClick={() => setMode(tabMode)}
                  className={`group relative flex-1 rounded-2xl px-5 py-4 text-sm font-semibold transition duration-200 sm:text-base ${
                    isActive
                      ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span className="relative z-10">{tabContent.tabLabel}</span>
                  {isActive ? (
                    <span className={`absolute inset-x-4 bottom-1 h-1 rounded-full bg-gradient-to-r ${tabContent.accentClass}`} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI Image Generator
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{activeContent.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              사진 한 장으로 원하는 스타일의 결과물을 빠르게 확인할 수 있는 단일 플로우 UI입니다.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">이미지 업로드</h2>
                <p className="mt-1 text-sm text-slate-500">드래그 앤 드롭 또는 클릭해서 이미지를 선택하세요.</p>
              </div>
              {uploadedImage ? (
                <button
                  type="button"
                  onClick={() => setUploadedImage(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="업로드 이미지 제거"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`group flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed px-6 py-10 text-center transition ${
                isDragging
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="flex w-full flex-col items-center gap-4">
                  <div className="relative w-full overflow-hidden rounded-[24px] bg-slate-100">
                    <img
                      src={previewUrl}
                      alt="업로드 미리보기"
                      className="h-[340px] w-full object-cover sm:h-[420px]"
                    />
                  </div>
                  <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-between">
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="truncate text-sm font-semibold text-slate-900">{uploadedImage?.name}</p>
                      <p className="text-xs text-slate-500">다른 이미지를 선택하려면 클릭하거나 새 파일을 드롭하세요.</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        openFilePicker();
                      }}
                      className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-slate-800"
                    >
                      이미지 변경
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition group-hover:scale-105">
                    {isDragging ? <UploadCloud className="h-9 w-9" /> : <ImagePlus className="h-9 w-9" />}
                  </div>
                  <h3 className="text-xl font-bold text-slate-950">이미지를 업로드하세요</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                    정면 또는 반신 사진일수록 결과가 안정적입니다. JPG, PNG 등 일반 이미지 파일을 사용할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      openFilePicker();
                    }}
                    className="mt-6 inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:scale-[1.02] hover:border-slate-300 hover:bg-slate-50"
                  >
                    클릭해서 업로드
                  </button>
                </>
              )}
            </label>
          </div>

          <aside className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-500">{activeContent.exampleTitle}</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{activeContent.tabLabel} 스타일 미리보기</h2>
            </div>

            <div className={`overflow-hidden rounded-[28px] bg-gradient-to-br ${activeContent.exampleGradient} p-3`}>
              <img
                src={exampleImage}
                alt={`${activeContent.tabLabel} 예시 이미지`}
                className="h-[420px] w-full rounded-[24px] object-cover shadow-[0_24px_50px_rgba(15,23,42,0.14)]"
              />
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600">{activeContent.exampleDescription}</p>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workflow Ready</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                현재는 모의 결제와 생성 상태만 구현되어 있고, 이후 Polar 결제, 생성 API, 이메일 발송을 각 단계에 연결할 수 있게 구조를 분리해 두었습니다.
              </p>
            </div>
          </aside>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/92 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center">
          <button
            type="button"
            disabled={!uploadedImage}
            onClick={handleGenerate}
            className={`flex w-full items-center justify-center rounded-[22px] px-6 py-4 text-base font-bold text-white shadow-[0_20px_45px_rgba(15,23,42,0.18)] transition sm:text-lg ${
              uploadedImage
                ? `bg-gradient-to-r ${activeContent.accentClass} hover:scale-[1.01]`
                : 'cursor-not-allowed bg-slate-300'
            }`}
          >
            {activeContent.buttonLabel}
          </button>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-[0_40px_100px_rgba(15,23,42,0.32)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">처리 상태</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {generationPhase === 'payment' && '결제 진행중...'}
                  {generationPhase === 'generating' && '이미지 생성중...'}
                  {generationPhase === 'done' && '생성 완료'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="모달 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {generationPhase === 'payment' || generationPhase === 'generating' ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
                  <LoaderCircle className="h-7 w-7 animate-spin" />
                </div>
                <p className="mt-6 text-lg font-bold text-slate-900">
                  {generationPhase === 'payment' ? '결제 진행중...' : '이미지 생성중...'}
                </p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  {generationPhase === 'payment'
                    ? '실제 서비스에서는 이 단계에서 Polar 결제창을 연결하면 됩니다.'
                    : '결제 완료 후 생성 API 요청과 결과 저장, 이메일 전송 흐름을 붙일 수 있습니다.'}
                </p>
              </div>
            ) : null}

            {generationPhase === 'done' ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
                  <img
                    src={RESULT_PLACEHOLDER}
                    alt="생성 결과 플레이스홀더"
                    className="h-[360px] w-full object-cover"
                  />
                </div>
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-700">결과 이미지 플레이스홀더가 표시되었습니다.</p>
                  <p className="mt-1 text-sm text-emerald-600">이 자리에 실제 생성 결과 URL 또는 base64 이미지를 연결하면 됩니다.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
