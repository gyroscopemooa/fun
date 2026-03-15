import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { create } from 'zustand';
import {
  BadgeDollarSign,
  Copy,
  ImagePlus,
  Layers3,
  Sparkles,
  Store,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ThemeKey = 'minimal' | 'premium' | 'playful';

type GeneratedPage = {
  heroTitle: string;
  heroBody: string;
  featureTitle: string;
  features: string[];
  fitTitle: string;
  fitBody: string;
  detailBlocks: Array<{ title: string; body: string }>;
  cta: string;
  html: string;
};

type FormValues = {
  productName: string;
  price: string;
  audience: string;
  highlight: string;
  prompt: string;
};

type StudioState = {
  theme: ThemeKey;
  generated: GeneratedPage | null;
  setTheme: (theme: ThemeKey) => void;
  setGenerated: (generated: GeneratedPage) => void;
};

const useStudioStore = create<StudioState>((set) => ({
  theme: 'premium',
  generated: null,
  setTheme: (theme) => set({ theme }),
  setGenerated: (generated) => set({ generated })
}));

const themes: Array<{
  key: ThemeKey;
  name: string;
  accent: string;
  surface: string;
  badge: string;
  description: string;
}> = [
  {
    key: 'premium',
    name: 'Premium Commerce',
    accent: 'from-amber-300 via-orange-300 to-rose-300',
    surface: 'from-stone-950 via-stone-900 to-zinc-800',
    badge: '럭셔리 톤과 강한 구매 설득',
    description: '브랜드 감도와 전환 문장을 앞세운 프리미엄 상세페이지'
  },
  {
    key: 'minimal',
    name: 'Minimal Editorial',
    accent: 'from-sky-300 via-cyan-200 to-emerald-200',
    surface: 'from-slate-950 via-slate-900 to-slate-800',
    badge: '정보 전달과 신뢰 중심',
    description: '카탈로그처럼 간결한 정보 구조와 차분한 톤'
  },
  {
    key: 'playful',
    name: 'Playful Social',
    accent: 'from-fuchsia-300 via-pink-300 to-orange-300',
    surface: 'from-zinc-950 via-rose-950 to-orange-950',
    badge: '소셜 광고형 후킹 구성',
    description: '짧고 강한 문장으로 시선을 잡는 카드형 랜딩'
  }
];

const starterPrompts = [
  '사진의 질감과 핵심 소재를 먼저 설명하고 구매 포인트를 3단계로 풀어줘.',
  '네이버 스마트스토어용 상세페이지처럼 신뢰 요소와 사용 장면을 강조해줘.',
  '고급 브랜드 카피처럼 짧고 강한 문장으로 헤드라인을 만든 뒤 혜택을 정리해줘.'
];

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildGeneratedPage(values: FormValues, theme: ThemeKey, imageCount: number): GeneratedPage {
  const fallbackPrompt = '제품 사진을 바탕으로 구매 전환 중심의 상세페이지를 생성';
  const normalizedPrompt = values.prompt.trim() || fallbackPrompt;
  const headlineMap: Record<ThemeKey, string> = {
    premium: `${values.productName}의 디테일을 가장 설득력 있게 보여주는 프리미엄 상세페이지`,
    minimal: `${values.productName}를 한눈에 이해시키는 에디토리얼형 상세페이지`,
    playful: `${values.productName}를 보자마자 저장하고 싶게 만드는 소셜형 상세페이지`
  };
  const featureToneMap: Record<ThemeKey, string[]> = {
    premium: ['첫인상에서 고급감 전달', '핵심 효능을 바로 이해', '구매 망설임을 줄이는 설계'],
    minimal: ['정보를 빠르게 파악', '중요 스펙을 단순하게 전달', '리뷰 없이도 이해 가능한 구성'],
    playful: ['스크롤을 멈추게 하는 첫 카드', '짧은 문장으로 강한 기억 형성', '후킹과 혜택 동시 노출']
  };
  const heroBody = [
    `${values.audience}를 겨냥해 ${values.highlight}를 전면에 배치합니다.`,
    `${imageCount}장의 제품 사진을 기준으로 첫 화면, 특징 섹션, 구매 CTA 흐름을 정리합니다.`,
    `LLM 지시문은 "${normalizedPrompt}" 기준으로 확장 가능하게 설계합니다.`
  ].join(' ');
  const features = [
    `${values.highlight} 중심의 첫 구매 설득 문장`,
    `${values.price || '가격 미정'} 기준 혜택/가치 비교 카피`,
    ...featureToneMap[theme]
  ].slice(0, 4);
  const detailBlocks = [
    {
      title: '01. 첫 화면 후킹',
      body: `${values.productName} 사진에서 가장 강한 비주얼을 메인으로 두고, ${values.audience}가 즉시 이해할 수 있는 가치 문장을 배치합니다.`
    },
    {
      title: '02. 사용 장면 설득',
      body: `${values.highlight}가 실제로 어떤 장면에서 빛나는지 설명하고, 구매 전 망설임을 문장으로 줄입니다.`
    },
    {
      title: '03. LLM 작업 지시',
      body: `${normalizedPrompt} 문장을 그대로 복사해 이미지 분석형 모델이나 카피 생성형 모델에 넣을 수 있도록 구조화합니다.`
    }
  ];
  const html = `
<section class="detail-page detail-page--${theme}">
  <header>
    <p class="eyebrow">${escapeHtml(values.price || '가격 제안 가능')}</p>
    <h1>${escapeHtml(headlineMap[theme])}</h1>
    <p>${escapeHtml(heroBody)}</p>
  </header>
  <section>
    <h2>핵심 포인트</h2>
    <ul>
      ${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}
    </ul>
  </section>
  <section>
    <h2>상세 구성</h2>
    ${detailBlocks
      .map(
        (block) => `
      <article>
        <h3>${escapeHtml(block.title)}</h3>
        <p>${escapeHtml(block.body)}</p>
      </article>`
      )
      .join('')}
  </section>
  <section>
    <h2>LLM Prompt</h2>
    <p>${escapeHtml(normalizedPrompt)}</p>
  </section>
</section>`.trim();

  return {
    heroTitle: headlineMap[theme],
    heroBody,
    featureTitle: '이 상세페이지가 바로 써먹히는 이유',
    features,
    fitTitle: '추천 사용 흐름',
    fitBody: `${values.productName} 사진 업로드 -> 상세페이지 생성 -> HTML 복사 -> 스마트스토어/카페24 편집기에 적용`,
    detailBlocks,
    cta: `${values.productName} 상세페이지 초안 복사하기`,
    html
  };
}

export default function ProductDetailStudio() {
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      productName: '프리미엄 세라믹 머그컵',
      price: '29,900원',
      audience: '집들이 선물을 찾는 20-30대',
      highlight: '무광 질감과 안정적인 그립감',
      prompt: starterPrompts[0]
    }
  });
  const { theme, generated, setTheme, setGenerated } = useStudioStore();
  const [images, setImages] = useState<Array<{ file: File; url: string }>>([]);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const watchedValues = watch();

  useEffect(() => {
    if (!previewRef.current) return;
    let disposed = false;
    let zoomInstance: { detach: () => void } | null = null;

    void import('medium-zoom').then(({ default: mediumZoom }) => {
      if (disposed || !previewRef.current) return;
      zoomInstance = mediumZoom(previewRef.current.querySelectorAll('[data-zoomable]'), {
        background: 'rgba(15, 23, 42, 0.9)',
        margin: 24
      });
    });

    return () => {
      disposed = true;
      zoomInstance?.detach();
    };
  }, [generated, images]);

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  const activeTheme = useMemo(() => themes.find((item) => item.key === theme) ?? themes[0], [theme]);

  const onImagesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;

    setImages((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.url));
      return selected.slice(0, 8).map((file) => ({ file, url: URL.createObjectURL(file) }));
    });
    toast.success(`${selected.length}장의 사진을 불러왔습니다.`);
  };

  const onGenerate = handleSubmit((values) => {
    if (images.length === 0) {
      toast.error('제품 사진을 먼저 넣어주세요.');
      return;
    }

    setGenerated(buildGeneratedPage(values, theme, images.length));
    toast.success('상세페이지 초안을 생성했습니다.');
  });

  const requestCopyHtml = () => {
    if (!generated) {
      toast.error('먼저 상세페이지를 생성하세요.');
      return;
    }

    setConfirmCopy(true);
  };

  return (
    <section className="px-4 pt-8 pb-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className={cn(
          'overflow-hidden rounded-[2rem] border border-white/40 bg-gradient-to-br p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.18)] lg:p-8',
          activeTheme.surface
        )}
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full bg-gradient-to-r px-4 py-1 text-xs font-semibold text-slate-950',
                  activeTheme.accent
                )}
              >
                AI Commerce Studio
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">
                {activeTheme.badge}
              </span>
            </div>

            <div className="max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                사진만 넣으면 쇼핑몰 상세페이지 초안이 바로 나오는 메인 카드 섹션
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/72 sm:text-base">
                상품 사진, 포인트, LLM 프롬프트를 입력하면 메인 비주얼, 특징 카드, 판매 문장, 복사용 HTML까지
                한 흐름으로 정리합니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ImagePlus, title: '사진 업로드', body: '상품 이미지를 넣고 메인 컷을 바로 확인' },
                { icon: Wand2, title: '프롬프트 설계', body: 'LLM에 넘길 문장을 상세페이지 기준으로 정리' },
                { icon: Store, title: '상세페이지 생성', body: '스마트스토어형 섹션을 바로 복사' }
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <item.icon className="h-5 w-5 text-white" />
                  <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/70">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Prompt Quick Fill</p>
                  <p className="mt-1 text-sm text-white/75">한 줄 예시를 눌러 프롬프트 란에 바로 채울 수 있습니다.</p>
                </div>
                <Sparkles className="h-5 w-5 text-white/70" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setValue('prompt', prompt)}
                    className="rounded-full border border-white/14 bg-white/8 px-3 py-2 text-left text-xs text-white/80 transition hover:bg-white/14"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.06)] p-4 backdrop-blur">
            <TabGroup
              selectedIndex={themes.findIndex((item) => item.key === theme)}
              onChange={(index) => setTheme(themes[index]?.key ?? 'premium')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Theme Selection</p>
                  <h3 className="mt-1 text-lg font-bold">메인 카드 스타일 선택</h3>
                </div>
                <Layers3 className="h-5 w-5 text-white/75" />
              </div>
              <TabList className="mt-4 grid grid-cols-3 gap-2">
                {themes.map((item) => (
                  <Tab as={Fragment} key={item.key}>
                    {({ selected }) => (
                      <button
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-left text-xs transition',
                          selected
                            ? 'border-white/30 bg-white text-slate-950'
                            : 'border-white/10 bg-white/6 text-white/78 hover:bg-white/12'
                        )}
                      >
                        <div className="font-semibold">{item.name}</div>
                        <div className={cn('mt-2 h-1 rounded-full bg-gradient-to-r', item.accent)} />
                      </button>
                    )}
                  </Tab>
                ))}
              </TabList>
              <TabPanels className="mt-4">
                {themes.map((item) => (
                  <TabPanel key={item.key} className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/74">
                    {item.description}
                  </TabPanel>
                ))}
              </TabPanels>
            </TabGroup>
          </div>
        </div>

        {confirmCopy && (
          <div className="mt-6 rounded-[1.5rem] border border-amber-200/40 bg-amber-50/95 p-4 text-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">생성된 HTML 초안을 클립보드에 복사할까요?</p>
                <p className="mt-1 text-xs text-slate-600">스마트스토어나 카페24 편집기에 바로 붙여넣기할 수 있습니다.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmCopy(false)}>
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!generated) {
                      setConfirmCopy(false);
                      return;
                    }
                    await navigator.clipboard.writeText(generated.html);
                    setConfirmCopy(false);
                    toast.success('HTML 초안을 클립보드에 복사했습니다.');
                  }}
                >
                  복사 실행
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onGenerate();
            }}
            className="rounded-[1.75rem] border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Input</p>
                <h3 className="mt-1 text-xl font-black tracking-tight">상세페이지 생성 입력</h3>
              </div>
              <BadgeDollarSign className="h-5 w-5 text-slate-500" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">상품명</span>
                <input {...register('productName')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">가격 또는 혜택</span>
                <input {...register('price')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">타깃 고객</span>
                <input {...register('audience')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">핵심 포인트</span>
                <input {...register('highlight')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span>LLM 프롬프트</span>
                <span
                  title="이미지 분석형 모델이나 카피 생성형 모델에 바로 넣을 작업 지시문입니다."
                  className="cursor-help rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500"
                >
                  ?
                </span>
              </div>
              <textarea
                {...register('prompt')}
                rows={5}
                className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                placeholder="예: 업로드한 상품 사진을 분석해서 네이버 스마트스토어용 상세페이지 카피를 만들어줘..."
              />
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">상품 사진 업로드</p>
                  <p className="mt-1 text-xs text-slate-500">최대 8장. 메인 컷, 디테일 컷, 사용 장면 컷을 넣으면 좋습니다.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  사진 넣기
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onImagesSelected} />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {images.length > 0 ? (
                  images.map((image, index) => (
                    <div key={image.url} className="overflow-hidden rounded-2xl bg-slate-200">
                      <img src={image.url} alt={`업로드 상품 이미지 ${index + 1}`} className="h-24 w-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-400">
                    업로드된 이미지가 아직 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit">
                <Wand2 className="h-4 w-4" />
                상세페이지 생성
              </Button>
              <Button type="button" variant="secondary" onClick={requestCopyHtml}>
                <Copy className="h-4 w-4" />
                HTML 복사
              </Button>
            </div>
          </form>

          <div ref={previewRef} className="rounded-[1.75rem] border border-white/10 bg-white p-5 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Preview</p>
                <h3 className="mt-1 text-xl font-black tracking-tight">쇼핑몰 상세페이지 프리뷰</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{activeTheme.name}</span>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.75rem] bg-slate-950 text-white">
              <div className={cn('bg-gradient-to-r p-5', activeTheme.accent)}>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-900/70">Hero</p>
                <h4 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-slate-950">
                  {generated?.heroTitle ?? `${watchedValues.productName} 메인 상세페이지를 여기서 바로 확인하세요`}
                </h4>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-900/80">
                  {generated?.heroBody ?? '상품 정보와 사진을 입력하면 전환 중심 헤드라인, 특징 정리, CTA까지 한 화면에서 미리 볼 수 있습니다.'}
                </p>
              </div>

              <div className="p-4">
                {images.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {images.map((image, index) => (
                        <img
                          key={image.url}
                          data-zoomable
                          src={image.url}
                          alt={`상세페이지 슬라이드 이미지 ${index + 1}`}
                          className="h-[320px] min-w-full snap-center rounded-[1.5rem] object-cover"
                        />
                      ))}
                    </div>
                    {images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((image, index) => (
                          <img
                            key={`${image.url}-thumb`}
                            data-zoomable
                            src={image.url}
                            alt={`상세페이지 썸네일 ${index + 1}`}
                            className="h-20 w-full rounded-2xl object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/5 text-sm text-white/55">
                    사진을 업로드하면 메인 비주얼 갤러리가 여기에 표시됩니다.
                  </div>
                )}

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[1.5rem] bg-white/7 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/40">{generated?.featureTitle ?? 'Selling Points'}</p>
                    <div className="mt-3 grid gap-3">
                      {(generated?.features ?? [
                        `${watchedValues.highlight}를 중심으로 헤드라인 구성`,
                        `${watchedValues.price} 가격 설득 문장 추가`,
                        `${watchedValues.audience} 기준 구매 이유 정리`
                      ]).map((feature) => (
                        <div key={feature} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                          <p className="text-sm leading-6 text-white/88">{feature}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] bg-white/7 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/40">{generated?.fitTitle ?? 'Workflow'}</p>
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      {generated?.fitBody ?? `${watchedValues.productName} 정보를 입력하고 생성 버튼을 누르면 상세페이지 구조가 자동으로 정리됩니다.`}
                    </p>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-white/35">Prompt</p>
                      <p className="mt-2 text-sm leading-6 text-white/82">{watchedValues.prompt}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {(generated?.detailBlocks ?? []).map((block) => (
                    <div key={block.title} className="rounded-[1.35rem] border border-white/10 bg-white/7 p-4">
                      <h5 className="text-sm font-semibold text-white">{block.title}</h5>
                      <p className="mt-2 text-sm leading-6 text-white/76">{block.body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 text-slate-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">CTA</p>
                      <p className="mt-1 text-lg font-black tracking-tight">
                        {generated?.cta ?? `${watchedValues.productName} 상세페이지 초안 만들기`}
                      </p>
                    </div>
                    <Button type="button" onClick={requestCopyHtml}>
                      복사용 HTML 받기
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
