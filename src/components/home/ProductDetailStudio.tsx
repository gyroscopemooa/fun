import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { create } from 'zustand';
import {
  Copy,
  Download,
  ImagePlus,
  LoaderCircle,
  ScanSearch,
  Sparkles,
  Store,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  buildDetailPagePricing,
  buildDetailPageHtml,
  buildFallbackResult,
  buildFeatureCards,
  buildPlainCopyText,
  buildRenderSections,
  classifyImages,
  detailPageTestScenarios,
  ensureResultIntegrity,
  iconGlyphMap,
  sectionLabelMap,
  starterPrompts,
  themes,
  type PageCountOption,
  type ProductDetailFormValues,
  type ProductDetailResult,
  type ThemeKey,
  type UploadedImage
} from '@/lib/product-detail-studio';
import { cn } from '@/lib/utils';

type StudioState = {
  theme: ThemeKey;
  result: ProductDetailResult | null;
  html: string;
  copyText: string;
  isGenerating: boolean;
  setTheme: (theme: ThemeKey) => void;
  setResult: (result: ProductDetailResult | null) => void;
  setHtml: (html: string) => void;
  setCopyText: (copyText: string) => void;
  setIsGenerating: (value: boolean) => void;
};

const useStudioStore = create<StudioState>((set) => ({
  theme: 'premium',
  result: null,
  html: '',
  copyText: '',
  isGenerating: false,
  setTheme: (theme) => set({ theme }),
  setResult: (result) => set({ result }),
  setHtml: (html) => set({ html }),
  setCopyText: (copyText) => set({ copyText }),
  setIsGenerating: (isGenerating) => set({ isGenerating })
}));

const MAX_IMAGES = 10;
const RAW_API_BASE = import.meta.env.PUBLIC_NODE_API_BASE?.trim() ?? '';
const DEV_API_BASE = 'http://127.0.0.1:8787';
const API_BASE = (RAW_API_BASE || (import.meta.env.DEV ? DEV_API_BASE : '')).replace(/\/+$/, '');
const EXPORT_WIDTH = 860;
const SLICE_HEIGHT = 3000;
const PAGE_COUNT_OPTIONS: PageCountOption[] = [5, 7, 10];
const SHOW_DEBUG_SCENARIOS = import.meta.env.DEV || import.meta.env.PUBLIC_DETAIL_PAGE_DEBUG === 'true';
const INVALID_API_RESPONSE_MESSAGE = '생성 서버 응답을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.';
const MISSING_API_BASE_MESSAGE = 'API 서버 주소가 설정되지 않았습니다. 배포 환경변수를 확인해주세요.';
const UNREACHABLE_API_MESSAGE = '생성 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
const INVALID_PRODUCTION_API_BASE_MESSAGE = '프로덕션 API 주소가 잘못 설정되었습니다. PUBLIC_NODE_API_BASE를 https://api.manytool.net 으로 설정해주세요.';
const DETAIL_PAGE_REQUEST_PATH = '/commerce/detail-page/generate';

const resizeImageToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
  reader.onload = () => {
    const source = new Image();
    source.onerror = () => reject(new Error('이미지 미리보기를 만들지 못했습니다.'));
    source.onload = () => {
      const maxSide = 1440;
      const ratio = Math.min(1, maxSide / Math.max(source.width, source.height));
      const width = Math.max(1, Math.round(source.width * ratio));
      const height = Math.max(1, Math.round(source.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('이미지 캔버스를 초기화하지 못했습니다.'));
        return;
      }
      context.drawImage(source, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    source.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

const loadImages = async (files: File[]) => Promise.all(
  files.slice(0, MAX_IMAGES).map(async (file, index) => ({
    id: `${file.name}-${file.lastModified}-${index}`,
    file,
    url: URL.createObjectURL(file),
    dataUrl: await resizeImageToDataUrl(file)
  }))
);

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
};

export default function ProductDetailStudio() {
  const { register, handleSubmit, setValue, watch } = useForm<ProductDetailFormValues>({
    defaultValues: {
      productName: '프리미엄 세라믹 머그컵',
      price: '29,900원 / 2컬러',
      audience: '감성 주방 아이템을 찾는 20-30대',
      sellingPoints: '보온감, 묵직한 세라믹 질감, 선물하기 좋은 디자인',
      prompt: starterPrompts[0],
      pageCount: 7
    }
  });
  const {
    theme,
    result,
    html,
    copyText,
    isGenerating,
    setTheme,
    setResult,
    setHtml,
    setCopyText,
    setIsGenerating
  } = useStudioStore();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [apiError, setApiError] = useState('');
  const [isExportingSlices, setIsExportingSlices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zoomRootRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const values = watch();
  const pricingSummary = buildDetailPagePricing(values.pageCount as PageCountOption);
  const activeTheme = useMemo(() => themes.find((item) => item.key === theme) ?? themes[0], [theme]);
  const renderSections = useMemo(() => (result ? buildRenderSections(result, images) : []), [result, images]);
  const classifiedImages = useMemo(() => (result ? classifyImages(result, images) : []), [result, images]);
  const featureCards = useMemo(() => (result ? buildFeatureCards(result) : []), [result]);
  const hasInvalidProductionApiBase = !import.meta.env.DEV && API_BASE === 'https://manytool.net';

  useEffect(() => {
    if (!zoomRootRef.current || images.length === 0) return;
    let disposed = false;
    let zoomInstance: { detach: () => void } | null = null;

    void import('medium-zoom').then(({ default: mediumZoom }) => {
      if (disposed || !zoomRootRef.current) return;
      zoomInstance = mediumZoom(zoomRootRef.current.querySelectorAll('[data-zoomable]'), {
        background: 'rgba(15, 23, 42, 0.88)',
        margin: 20
      });
    });

    return () => {
      disposed = true;
      zoomInstance?.detach();
    };
  }, [images, result]);

  useEffect(() => () => {
    images.forEach((image) => URL.revokeObjectURL(image.url));
  }, [images]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.info('[ProductDetailStudio] PUBLIC_NODE_API_BASE:', RAW_API_BASE || '(empty)');
    console.info(
      '[ProductDetailStudio] detail page API:',
      API_BASE ? `${API_BASE}${DETAIL_PAGE_REQUEST_PATH}` : '(missing API base URL)'
    );
    if (hasInvalidProductionApiBase) {
      console.error('[ProductDetailStudio] invalid production API base:', API_BASE);
      setApiError(INVALID_PRODUCTION_API_BASE_MESSAGE);
    }
  }, []);

  const onImagesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []).slice(0, MAX_IMAGES);
    if (!nextFiles.length) return;

    const previous = images;
    try {
      const loadedImages = await loadImages(nextFiles);
      setImages(loadedImages);
      setResult(null);
      setHtml('');
      setCopyText('');
      previous.forEach((image) => URL.revokeObjectURL(image.url));
      toast.success(`${loadedImages.length}장의 이미지를 불러왔습니다.`);
    } catch (error) {
      previous.forEach((image) => URL.revokeObjectURL(image.url));
      setImages([]);
      toast.error(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.');
    } finally {
      event.target.value = '';
    }
  };

  const onGenerate = handleSubmit(async (formValues) => {
    if (!images.length) {
      toast.error('먼저 상품 이미지를 업로드해 주세요.');
      return;
    }

    if (!API_BASE) {
      setApiError(MISSING_API_BASE_MESSAGE);
      toast.error(MISSING_API_BASE_MESSAGE);
      return;
    }

    if (hasInvalidProductionApiBase) {
      setApiError(INVALID_PRODUCTION_API_BASE_MESSAGE);
      toast.error(INVALID_PRODUCTION_API_BASE_MESSAGE);
      return;
    }

    setApiError('');
    setIsGenerating(true);

    try {
      const requestUrl = `${API_BASE}${DETAIL_PAGE_REQUEST_PATH}`;
      console.info('[ProductDetailStudio] detail page request URL:', requestUrl);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: formValues.productName,
          price: formValues.price,
          audience: formValues.audience,
          sellingPoints: formValues.sellingPoints,
          prompt: formValues.prompt,
          theme,
          pageCount: Number(formValues.pageCount),
          pricing: buildDetailPagePricing(formValues.pageCount),
          images: images.map((image) => image.dataUrl)
        })
      });
      console.info('[ProductDetailStudio] detail page response status:', response.status);
      const rawBody = await response.text();
      if (!response.ok) {
        console.error('[ProductDetailStudio] detail page error response body:', rawBody || '(empty)');
      }
      const payload = rawBody ? JSON.parse(rawBody) : null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error || '상세페이지 생성에 실패했습니다.');
      }

      const nextResult = ensureResultIntegrity(payload.result as ProductDetailResult, formValues.pageCount);
      setResult(nextResult);
      setHtml(buildDetailPageHtml({ formValues, result: nextResult, images, theme }));
      setCopyText(buildPlainCopyText({ formValues, result: nextResult }));
      toast.success(`${nextResult.page_count}장 구성의 상세페이지가 생성되었습니다.`);
    } catch (error) {
      const fallbackMessage = '상세페이지 생성에 실패했습니다.';
      const rawMessage = error instanceof Error ? error.message : fallbackMessage;
      const message = rawMessage === 'Failed to fetch'
        ? UNREACHABLE_API_MESSAGE
        : rawMessage === 'Unexpected end of JSON input'
          ? INVALID_API_RESPONSE_MESSAGE
          : rawMessage;
      setApiError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  });

  const onCopyHtml = async () => {
    if (!html) {
      toast.error('먼저 상세페이지를 생성해 주세요.');
      return;
    }
    await navigator.clipboard.writeText(html);
    toast.success('HTML을 복사했습니다.');
  };

  const onCopyText = async () => {
    if (!copyText) {
      toast.error('먼저 상세페이지를 생성해 주세요.');
      return;
    }
    await navigator.clipboard.writeText(copyText);
    toast.success('카피 텍스트를 복사했습니다.');
  };

  const onExportSlices = async () => {
    if (!exportRef.current || !result) {
      toast.error('먼저 상세페이지를 생성해 주세요.');
      return;
    }

    setIsExportingSlices(true);
    try {
      const { toCanvas } = await import('html-to-image');
      const canvas = await toCanvas(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        canvasWidth: EXPORT_WIDTH * 2,
        width: EXPORT_WIDTH
      });
      const sectionNodes = Array.from(exportRef.current.querySelectorAll<HTMLElement>('[data-export-section="true"]'));
      const scale = canvas.width / EXPORT_WIDTH;
      const boundaries = sectionNodes.map((node) => ({
        top: Math.round(node.offsetTop * scale),
        bottom: Math.round((node.offsetTop + node.offsetHeight) * scale)
      }));
      const sliceRanges: Array<{ top: number; height: number }> = [];
      let sliceTop = 0;
      while (sliceTop < canvas.height) {
        const targetBottom = Math.min(canvas.height, sliceTop + (SLICE_HEIGHT * scale));
        const safeBoundary = boundaries
          .map((item) => item.bottom)
          .filter((bottom) => bottom > sliceTop + 400 && bottom <= targetBottom)
          .pop();
        const sliceBottom = safeBoundary ?? targetBottom;
        sliceRanges.push({ top: sliceTop, height: Math.max(1, sliceBottom - sliceTop) });
        sliceTop = sliceBottom;
      }

      for (let index = 0; index < sliceRanges.length; index += 1) {
        const range = sliceRanges[index];
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = range.height;
        const context = sliceCanvas.getContext('2d');
        if (!context) {
          throw new Error('슬라이스 캔버스를 만들지 못했습니다.');
        }
        context.drawImage(canvas, 0, range.top, canvas.width, range.height, 0, 0, canvas.width, range.height);
        downloadDataUrl(sliceCanvas.toDataURL('image/png'), `page${index + 1}.png`);
      }
      toast.success(`${sliceRanges.length}개의 섹션 기준 슬라이스를 저장했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '슬라이스 저장에 실패했습니다.');
    } finally {
      setIsExportingSlices(false);
    }
  };

  return (
    <section className="px-4 pb-10 pt-8 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={cn(
          'overflow-hidden rounded-[2rem] border border-white/40 bg-gradient-to-br text-white shadow-[0_24px_100px_rgba(15,23,42,0.16)]',
          activeTheme.shell
        )}
      >
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.04fr_0.96fr] lg:px-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('rounded-full bg-gradient-to-r px-4 py-1 text-xs font-semibold text-slate-900', activeTheme.accent)}>
                AI Detail Page Builder
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
                860px mobile commerce layout
              </span>
            </div>

            <div className="max-w-2xl">
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                상품 사진과 상품 정보를 한국형 모바일 상세페이지로 바로 변환합니다.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/72 sm:text-base">
                업로드 이미지를 hero, detail, usage로 자동 분류하고 선택한 장수에 맞춰 긴 세로형 쇼핑몰 상세페이지를 생성합니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ScanSearch, title: '이미지 분류', body: '대표컷, 디테일컷, 사용컷을 자동으로 나눕니다.' },
                { icon: Wand2, title: '섹션 생성', body: '5장, 7장, 10장 흐름에 맞는 섹션을 동적으로 구성합니다.' },
                { icon: Download, title: '3종 export', body: 'HTML, PNG 슬라이스, 카피 텍스트를 바로 뽑습니다.' }
              ].map((item) => (
                <div key={item.title} className="rounded-[1.6rem] border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <item.icon className="h-5 w-5 text-white" />
                  <h2 className="mt-4 text-sm font-semibold">{item.title}</h2>
                  <p className="mt-2 text-xs leading-5 text-white/68">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Prompt Quick Fill</p>
                  <p className="mt-1 text-sm text-white/74">자주 쓰는 지시문으로 테스트 속도를 줄입니다.</p>
                </div>
                <Sparkles className="h-5 w-5 text-white/70" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setValue('prompt', prompt)}
                    className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs text-white/82 transition hover:bg-white/14"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {SHOW_DEBUG_SCENARIOS ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {detailPageTestScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => {
                        setValue('pageCount', scenario.pageCount);
                        setValue('sellingPoints', scenario.sellingPoints);
                        setValue('audience', scenario.audience);
                        setValue('prompt', scenario.prompt);
                        toast.message(`Test scenario loaded: ${scenario.description}`);
                      }}
                      className="rounded-2xl border border-white/12 bg-white/6 px-3 py-3 text-left text-xs text-white/78 transition hover:bg-white/12"
                    >
                      {scenario.description}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-white/7 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Theme</p>
                <h2 className="mt-1 text-xl font-bold">디자인 톤 선택</h2>
              </div>
              <Store className="h-5 w-5 text-white/72" />
            </div>
            <TabGroup
              selectedIndex={themes.findIndex((item) => item.key === theme)}
              onChange={(index) => setTheme(themes[index]?.key ?? 'premium')}
            >
              <TabList className="mt-4 grid grid-cols-3 gap-2">
                {themes.map((item) => (
                  <Tab as={Fragment} key={item.key}>
                    {({ selected }) => (
                      <button
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-left text-xs transition',
                          selected
                            ? 'border-white/35 bg-white text-slate-950'
                            : 'border-white/10 bg-white/5 text-white/78 hover:bg-white/12'
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
                  <TabPanel key={item.key} className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-white/72">
                    {item.description}
                  </TabPanel>
                ))}
              </TabPanels>
            </TabGroup>
          </div>
        </div>

        <div className="grid gap-6 border-t border-white/10 bg-[rgba(255,255,255,0.03)] px-6 py-7 xl:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onGenerate();
            }}
            className="rounded-[1.7rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Input</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">상품 입력</h2>
              </div>
              <Wand2 className="h-5 w-5 text-slate-500" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">상품명</span>
                <input {...register('productName')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">가격 / 옵션</span>
                <input {...register('price')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">타깃 고객</span>
                <input {...register('audience')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">페이지 수</span>
                <select {...register('pageCount', { valueAsNumber: true })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400">
                  {PAGE_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>{count} pages</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">키 셀링 포인트</span>
                <textarea
                  {...register('sellingPoints')}
                  rows={3}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                  placeholder="예: 3중 보온 구조, 감성적인 컬러감, 선물용 패키지"
                />
              </label>
            </div>

            <div className="mt-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">LLM 프롬프트</span>
                <textarea
                  {...register('prompt')}
                  rows={4}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                  placeholder="예: 스마트스토어형 톤으로 7장 상세페이지를 만들고 proof 섹션에 신뢰감을 더해줘."
                />
              </label>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">상품 이미지 업로드</p>
                  <p className="mt-1 text-xs text-slate-500">최대 10장까지 업로드할 수 있습니다. 1장만 있어도 생성되며 부족한 섹션은 자동 재사용됩니다.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  이미지 선택
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void onImagesSelected(event); }} />
              <div className="mt-4 grid grid-cols-5 gap-2">
                {images.length > 0 ? images.map((image, index) => (
                  <div key={image.id} className="overflow-hidden rounded-2xl bg-slate-200">
                    <img src={image.url} alt={`업로드 이미지 ${index + 1}`} className="h-24 w-full object-cover" />
                  </div>
                )) : (
                  <div className="col-span-5 rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-400">
                    아직 업로드된 이미지가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {apiError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {apiError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">선택 장수: {pricingSummary.page_count}장</p>
                <p className="text-xs text-slate-500">장당 {pricingSummary.unit_price.toLocaleString('ko-KR')}원</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated</p>
                <p className="font-semibold text-slate-900">예상 금액: {pricingSummary.total_price.toLocaleString('ko-KR')}원</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate Detail Page
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyHtml()} disabled={!html}>
                <Copy className="h-4 w-4" />
                HTML
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyText()} disabled={!copyText}>
                <Copy className="h-4 w-4" />
                Copy Text
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportSlices()} disabled={!result || isExportingSlices}>
                {isExportingSlices ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PNG Slices
              </Button>
            </div>
          </form>

          <div ref={zoomRootRef} className="rounded-[1.7rem] border border-white/10 bg-white p-5 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preview</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">860px vertical detail page</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {result ? `${result.page_count} pages` : `${values.pageCount} pages`}
              </span>
            </div>

            <div className="mt-4 grid gap-3 rounded-[1.4rem] bg-slate-50 p-4 md:grid-cols-3">
              {classifiedImages.length > 0 ? classifiedImages.map((item, index) => (
                <div key={`${item.image.id}-${item.role}`} className="rounded-[1.2rem] bg-white p-3 shadow-sm">
                  <img src={item.image.url} alt={`classified-${index + 1}`} className="h-28 w-full rounded-xl object-cover" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.role}</p>
                </div>
              )) : (
                <div className="rounded-[1.2rem] bg-white px-4 py-6 text-sm text-slate-500 md:col-span-3">
                  생성 후 hero / detail / usage 자동 분류가 여기에 표시됩니다.
                </div>
              )}
            </div>

            <div className="mt-5 overflow-x-auto rounded-[1.6rem] bg-slate-100 p-3">
              <div ref={exportRef} className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                <div className={cn('bg-gradient-to-br px-7 pb-7 pt-8', activeTheme.heroSurface)}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero</p>
                  <h3 className="mt-3 text-[2rem] font-black leading-[1.08] tracking-tight text-slate-950">
                    {result?.generated_copy.headline ?? `${values.productName} 상세페이지 헤드라인이 여기에 표시됩니다.`}
                  </h3>
                  <p className="mt-4 text-[15px] leading-7 text-slate-600">
                    {result?.generated_copy.subheadline ?? '상품명, 가격, 타깃 고객, 업로드 이미지를 바탕으로 모바일 상세페이지가 생성됩니다.'}
                  </p>
                  {renderSections[0]?.image ? (
                    <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-slate-200">
                      <img data-zoomable src={renderSections[0].image.url} alt={renderSections[0].title} className="block h-auto w-full object-cover" />
                    </div>
                  ) : null}
                </div>

                <div className="px-6 pb-10 pt-6">
                  {renderSections.length > 0 ? renderSections.map((section) => (
                    <section key={section.id} data-export-section="true" className="border-b border-slate-200 py-6 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                          {iconGlyphMap[section.type]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{sectionLabelMap[section.type]}</p>
                          <h4 className="mt-1 text-[1.75rem] font-black leading-[1.15] tracking-tight text-slate-950">{section.title}</h4>
                        </div>
                      </div>
                      <p className="mt-4 text-[15px] leading-7 text-slate-600">{section.text}</p>

                      {section.type === 'feature' && featureCards.length > 0 ? (
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {featureCards.map((item) => (
                            <div key={`${section.id}-${item.title}`} className="rounded-[1.4rem] bg-slate-50 p-5">
                              <div className="text-xl font-bold text-slate-900">{item.glyph}</div>
                              <p className="mt-3 text-lg font-bold text-slate-950">{item.title}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-5 overflow-hidden rounded-[1.75rem] bg-slate-200">
                        <img data-zoomable src={section.image.url} alt={section.title} className={cn('block h-auto w-full', section.cropClass)} />
                        <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs tracking-[0.12em] text-slate-400">
                          {section.toneNote} / image #{section.imageIndex + 1}
                        </div>
                      </div>
                    </section>
                  )) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm leading-7 text-slate-500">
                      생성 후 선택한 페이지 수에 맞는 긴 세로형 상세페이지가 렌더링됩니다.
                    </div>
                  )}

                  <section className="pt-6">
                    <div className="rounded-[1.8rem] bg-slate-950 px-6 py-7 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">SEO / CTA</p>
                      <h4 className="mt-2 text-[1.9rem] font-black leading-[1.15] tracking-tight">
                        {result?.generated_copy.seo_title ?? '생성 후 SEO title이 표시됩니다.'}
                      </h4>
                      <p className="mt-4 text-[15px] leading-7 text-white/80">
                        {result?.generated_copy.cta ?? '생성 후 CTA 문구가 표시됩니다.'}
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
