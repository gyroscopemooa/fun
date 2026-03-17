import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, ImagePlus, LoaderCircle, Sparkles, UploadCloud, X } from 'lucide-react';

type Mode = 'figure' | 'body' | 'animation' | 'free';
type Provider = 'openai' | 'xai';
type GenerationPhase = 'idle' | 'payment' | 'generating' | 'done' | 'error';

type ModeContent = {
  tabLabel: string;
  title: string;
  buttonLabel: string;
  exampleTitle: string;
  exampleDescription: string;
  accentClass: string;
  exampleGradient: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputRequired: boolean;
};

type GenerateResponse = {
  ok: true;
  jobId: string;
  provider: Provider;
  mode: Mode;
  status: 'queued';
};

type JobResponse = {
  ok: true;
  job: {
    id: string;
    provider: Provider;
    mode: Mode;
    status: 'queued' | 'processing' | 'done' | 'failed';
    imageUrl: string | null;
    prompt: string | null;
    revisedPrompt: string | null;
    error: string | null;
  };
};

type ConfigResponse = {
  readiness?: {
    openAiReady?: boolean;
    xaiReady?: boolean;
  };
};

const MODE_CONTENT: Record<Mode, ModeContent> = {
  figure: {
    tabLabel: '피규어',
    title: 'AI 액션피규어 생성기',
    buttonLabel: '피규어 생성',
    exampleTitle: '피규어 예시',
    exampleDescription: '사용자 얼굴을 최대한 유지한 뒤, 패키지형 액션피규어 상품 이미지로 변환합니다.',
    accentClass: 'from-orange-500 via-amber-400 to-yellow-300',
    exampleGradient: 'from-orange-100 via-amber-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: dark moody lighting',
    inputRequired: false
  },
  body: {
    tabLabel: '바디프로필',
    title: 'AI 바디프로필 생성기',
    buttonLabel: '바디프로필 생성',
    exampleTitle: '바디프로필 예시',
    exampleDescription: '얼굴 선명도를 먼저 맞추고, 그다음 고급 바디프로필 스타일을 적용합니다.',
    accentClass: 'from-sky-600 via-cyan-500 to-teal-400',
    exampleGradient: 'from-cyan-100 via-white to-slate-50',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: strong dramatic lighting',
    inputRequired: false
  },
  animation: {
    tabLabel: '애니메이션',
    title: 'AI 애니메이션 캐릭터 생성기',
    buttonLabel: '애니메이션 생성',
    exampleTitle: '애니메이션 예시',
    exampleDescription: '얼굴 정체성은 유지하고, 깔끔한 캐릭터 일러스트 느낌의 애니메이션 스타일로 변환합니다.',
    accentClass: 'from-violet-500 via-fuchsia-400 to-rose-300',
    exampleGradient: 'from-violet-100 via-fuchsia-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: cinematic anime hero',
    inputRequired: false
  },
  free: {
    tabLabel: '자유형',
    title: 'AI 자유형 생성기',
    buttonLabel: '자유형 생성',
    exampleTitle: '자유형 예시',
    exampleDescription: '얼굴은 유지하고, 50자 이내의 짧은 설명을 반영해 원하는 스타일로 변환합니다.',
    accentClass: 'from-fuchsia-500 via-rose-400 to-orange-300',
    exampleGradient: 'from-rose-100 via-white to-orange-50',
    inputLabel: '자유형 설명',
    inputPlaceholder: '예: cyberpunk hero',
    inputRequired: true
  }
};

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  xai: 'Grok'
};

const RAW_API_BASE = import.meta.env.PUBLIC_NODE_API_BASE?.trim() ?? '';
const DEV_API_BASE = 'http://127.0.0.1:8787';
const API_BASE = (RAW_API_BASE || (import.meta.env.DEV ? DEV_API_BASE : '')).replace(/\/+$/, '');
const PAYMENT_DELAY_MS = 1400;
const JOB_POLL_MS = 2500;
const JOB_TIMEOUT_MS = 180000;
const USER_INPUT_MAX_LENGTH = 50;

const buildExamplePlaceholder = (mode: Mode) => {
  const paletteMap = {
    figure: { start: '#fb923c', end: '#facc15', label: 'PACKAGED FIGURE', badge: 'Retail Box' },
    body: { start: '#0ea5e9', end: '#2dd4bf', label: 'BODY PROFILE', badge: 'Studio Body' },
    animation: { start: '#8b5cf6', end: '#ec4899', label: 'ANIMATION STYLE', badge: 'Character Art' },
    free: { start: '#ec4899', end: '#fb923c', label: 'FREE STYLE', badge: 'Custom Style' }
  } as const;
  const palette = paletteMap[mode];

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
    <text x="96" y="835" fill="white" font-size="54" font-family="Arial, sans-serif" font-weight="800">${palette.label}</text>
    <text x="96" y="886" fill="rgba(255,255,255,0.86)" font-size="28" font-family="Arial, sans-serif">AI generated sample preview</text>
  </svg>
  `)}`;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const resolveResultUrl = (imageUrl: string) => {
  if (/^https?:\/\//.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  if (!API_BASE) return imageUrl;
  return `${API_BASE}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const sanitizeInputForClient = (value: string) => value.replace(/\s+/g, ' ').trimStart().slice(0, USER_INPUT_MAX_LENGTH);

const pollAiImageJob = async (jobId: string) => {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < JOB_TIMEOUT_MS) {
    const response = await fetch(`${API_BASE}/ai-image-generator/job/${jobId}`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.job) {
      throw new Error(payload?.error ?? '생성 상태를 불러오지 못했습니다.');
    }
    const data = payload as JobResponse;
    if (data.job.status === 'done') return data.job;
    if (data.job.status === 'failed') {
      throw new Error(data.job.error || '이미지 생성에 실패했습니다.');
    }
    await sleep(JOB_POLL_MS);
  }
  throw new Error('생성이 지연되고 있습니다. 잠시 뒤 다시 확인해주세요.');
};

const imageFrameClass = 'flex items-center justify-center overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-4';
const imageClass = 'h-auto w-auto max-w-full object-contain';

export default function AiImageGenerator() {
  const [mode, setMode] = useState<Mode>('figure');
  const [userInputs, setUserInputs] = useState<Record<Mode, string>>({
    figure: '',
    body: '',
    animation: '',
    free: ''
  });
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [resultImageUrl, setResultImageUrl] = useState('');
  const [resultPrompt, setResultPrompt] = useState('');
  const [resultProvider, setResultProvider] = useState<Provider>('openai');
  const [activeProvider, setActiveProvider] = useState<Provider>('openai');
  const [errorMessage, setErrorMessage] = useState('');
  const [providerReadiness, setProviderReadiness] = useState<Record<Provider, boolean>>({
    openai: true,
    xai: true
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeContent = MODE_CONTENT[mode];
  const activeUserInput = userInputs[mode] ?? '';
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

  useEffect(() => {
    if (!API_BASE) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/config`);
        const payload = await response.json().catch(() => null) as ConfigResponse | null;
        if (!response.ok || !payload || cancelled) return;
        setProviderReadiness({
          openai: Boolean(payload.readiness?.openAiReady),
          xai: Boolean(payload.readiness?.xaiReady)
        });
      } catch {
        if (!cancelled) {
          setProviderReadiness({
            openai: true,
            xai: true
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const updateUploadedImage = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedImage(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateUploadedImage(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    updateUploadedImage(event.dataTransfer.files?.[0] ?? null);
  };

  const handleGenerate = async (provider: Provider) => {
    if (!uploadedImage) return;

    const safeInput = sanitizeInputForClient(activeUserInput);
    if (activeContent.inputRequired && !safeInput) {
      setIsModalOpen(true);
      setGenerationPhase('error');
      setErrorMessage('자유형 모드는 짧은 스타일 설명이 필요합니다.');
      return;
    }
    if (!API_BASE) {
      setIsModalOpen(true);
      setGenerationPhase('error');
      setErrorMessage('생성 API 주소가 설정되지 않았습니다. PUBLIC_NODE_API_BASE를 확인해주세요.');
      return;
    }
    if (!providerReadiness[provider]) {
      setIsModalOpen(true);
      setGenerationPhase('error');
      setErrorMessage(`${PROVIDER_LABELS[provider]} API 키가 서버에 설정되지 않았습니다.`);
      return;
    }

    setActiveProvider(provider);
    setIsModalOpen(true);
    setGenerationPhase('payment');
    setResultImageUrl('');
    setResultPrompt('');
    setResultProvider(provider);
    setErrorMessage('');

    try {
      await sleep(PAYMENT_DELAY_MS);
      setGenerationPhase('generating');

      const formData = new FormData();
      formData.append('image', uploadedImage);
      formData.append('provider', provider);
      formData.append('mode', mode);
      formData.append('userInput', safeInput);

      const response = await fetch(`${API_BASE}/ai-image-generator/generate`, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? '이미지 생성 요청에 실패했습니다.');
      }

      const data = payload as GenerateResponse;
      const job = await pollAiImageJob(data.jobId);
      setResultPrompt(job.revisedPrompt || job.prompt || '');
      setResultProvider(job.provider);
      setResultImageUrl(resolveResultUrl(job.imageUrl || ''));
      setGenerationPhase('done');
    } catch (error) {
      setGenerationPhase('error');
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setGenerationPhase('idle');
    setErrorMessage('');
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#fffaf5_0%,_#fff_42%,_#f8fafc_100%)] pb-40 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[28px] border border-white/70 bg-white/85 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(['figure', 'body', 'animation', 'free'] as Mode[]).map((tabMode) => {
              const tabContent = MODE_CONTENT[tabMode];
              const isActive = mode === tabMode;
              return (
                <button
                  key={tabMode}
                  type="button"
                  onClick={() => setMode(tabMode)}
                  className={`group relative rounded-2xl px-5 py-4 text-sm font-semibold transition duration-200 sm:text-base ${
                    isActive ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span className="relative z-10">{tabContent.tabLabel}</span>
                  {isActive ? <span className={`absolute inset-x-4 bottom-1 h-1 rounded-full bg-gradient-to-r ${tabContent.accentClass}`} /> : null}
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
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{activeContent.exampleDescription}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">이미지 업로드</h2>
                <p className="mt-1 text-sm text-slate-500">드래그하거나 클릭해서 이미지를 선택하세요.</p>
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
                isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              {previewUrl ? (
                <div className="flex w-full flex-col items-center gap-4">
                  <div className={`${imageFrameClass} min-h-[340px] w-full sm:min-h-[420px]`}>
                    <img src={previewUrl} alt="업로드 미리보기" className={`${imageClass} max-h-[308px] rounded-[18px] sm:max-h-[388px]`} />
                  </div>
                  <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-between">
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="truncate text-sm font-semibold text-slate-900">{uploadedImage?.name}</p>
                      <p className="text-xs text-slate-500">다른 이미지를 선택하려면 클릭하거나 파일을 다시 드래그하세요.</p>
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
                    얼굴이 잘 보이는 사진일수록 결과가 안정적입니다. 먼저 얼굴 품질을 보정하고 이후 최종 스타일을 적용합니다.
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

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{activeContent.inputLabel}</p>
                <span className="text-xs font-medium text-slate-500">{activeUserInput.length}/{USER_INPUT_MAX_LENGTH}</span>
              </div>
              <input
                type="text"
                value={activeUserInput}
                maxLength={USER_INPUT_MAX_LENGTH}
                onChange={(event) => {
                  const nextValue = sanitizeInputForClient(event.target.value);
                  setUserInputs((current) => ({
                    ...current,
                    [mode]: nextValue
                  }));
                }}
                placeholder={activeContent.inputPlaceholder}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {activeContent.inputRequired
                  ? '자유형 모드는 짧은 스타일 설명이 필요합니다. 얼굴은 유지하고 설명만 추가로 반영합니다.'
                  : '선택 사항입니다. 기본 엔진 설정은 유지하고, 짧은 추가 디테일만 더합니다.'}
              </p>
            </div>
          </div>

          <aside className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-500">{activeContent.exampleTitle}</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{activeContent.tabLabel} 예시 미리보기</h2>
            </div>

            <div className={`overflow-hidden rounded-[28px] bg-gradient-to-br ${activeContent.exampleGradient} p-3`}>
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] bg-white/55 p-4">
                <img
                  src={exampleImage}
                  alt={`${activeContent.tabLabel} 예시 이미지`}
                  className={`${imageClass} max-h-[388px] rounded-[24px] shadow-[0_24px_50px_rgba(15,23,42,0.14)]`}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">2-Step Pipeline</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  1단계에서 얼굴 디테일을 먼저 보정하고, 2단계에서 최종 스타일 변환을 적용합니다. 마지막 변환이 실패하면 자동으로 1회 재시도합니다.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Provider Compare</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  같은 이미지와 같은 모드로 <strong>OpenAI</strong>와 <strong>Grok</strong>를 각각 생성해서 결과 차이를 바로 비교할 수 있습니다.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/92 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row">
          {(['openai', 'xai'] as Provider[]).map((provider) => {
            const ready = providerReadiness[provider];
            const disabled = !uploadedImage || !ready;
            return (
              <button
                key={provider}
                type="button"
                disabled={disabled}
                onClick={() => {
                  void handleGenerate(provider);
                }}
                className={`flex-1 rounded-[22px] px-6 py-4 text-base font-bold text-white shadow-[0_20px_45px_rgba(15,23,42,0.18)] transition sm:text-lg ${
                  disabled
                    ? 'cursor-not-allowed bg-slate-300'
                    : provider === 'openai'
                      ? 'bg-slate-950 hover:scale-[1.01] hover:bg-slate-800'
                      : 'bg-gradient-to-r from-sky-600 via-cyan-500 to-blue-500 hover:scale-[1.01]'
                }`}
              >
                {ready ? `${PROVIDER_LABELS[provider]}로 ${activeContent.buttonLabel}` : `${PROVIDER_LABELS[provider]} 미설정`}
              </button>
            );
          })}
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-[0_40px_100px_rgba(15,23,42,0.32)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">처리 상태</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {generationPhase === 'payment' && `${PROVIDER_LABELS[activeProvider]} 요청 준비 중`}
                  {generationPhase === 'generating' && `${PROVIDER_LABELS[activeProvider]} 생성 중`}
                  {generationPhase === 'done' && '생성 완료'}
                  {generationPhase === 'error' && '생성 실패'}
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

            {(generationPhase === 'payment' || generationPhase === 'generating') && (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
                  <LoaderCircle className="h-7 w-7 animate-spin" />
                </div>
                <p className="mt-6 text-lg font-bold text-slate-900">
                  {generationPhase === 'payment' ? `${PROVIDER_LABELS[activeProvider]} 요청 준비 중` : `${PROVIDER_LABELS[activeProvider]} 2단계 생성 중`}
                </p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  얼굴 보정 후 최종 스타일 변환을 진행하고 있습니다. 마지막 단계가 실패하면 자동으로 한 번 더 시도합니다.
                </p>
              </div>
            )}

            {generationPhase === 'done' && resultImageUrl && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Provider</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{PROVIDER_LABELS[resultProvider]}</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                    같은 입력으로 비교 가능
                  </div>
                </div>
                <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-4">
                  <img src={resultImageUrl} alt="생성 결과" className={`${imageClass} max-h-[328px] rounded-[20px]`} />
                </div>
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-700">최종 결과 이미지입니다.</p>
                  <p className="mt-1 text-sm text-emerald-600">썸네일과 상세페이지에 같은 이미지를 사용할 수 있도록 1장만 반환합니다.</p>
                </div>
                {resultPrompt ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{resultPrompt}</p>
                  </div>
                ) : null}
              </div>
            )}

            {generationPhase === 'error' && (
              <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-rose-100 p-2 text-rose-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-rose-700">이미지 생성에 실패했습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-rose-600">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
