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
  buildDetailPageHtml,
  buildPlainCopyText,
  buildSectionPlans,
  classifyImages,
  iconGlyphMap,
  starterPrompts,
  themes,
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

const MAX_IMAGES = 8;
const API_BASE = import.meta.env.PUBLIC_NODE_API_BASE || 'http://127.0.0.1:8787';
const EXPORT_WIDTH = 860;
const SLICE_HEIGHT = 3000;

const resizeImageToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
  reader.onload = () => {
    const source = new Image();
    source.onerror = () => reject(new Error('이미지 미리보기를 만들지 못했습니다.'));
    source.onload = () => {
      const maxSide = 1800;
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
      resolve(canvas.toDataURL('image/jpeg', 0.86));
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
      audience: '감도 있는 주방 소품을 찾는 20-30대',
      highlight: '묵직한 세라믹 질감과 선물하기 좋은 분위기',
      prompt: starterPrompts[0]
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
  const activeTheme = useMemo(() => themes.find((item) => item.key === theme) ?? themes[0], [theme]);
  const sections = useMemo(() => (result ? buildSectionPlans(result, images) : []), [result, images]);
  const classifiedImages = useMemo(() => (result ? classifyImages(result, images) : []), [result, images]);

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
      toast.success(`${loadedImages.length}장의 상품 이미지를 불러왔습니다.`);
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

    setApiError('');
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/commerce/detail-page/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formValues,
          theme,
          images: images.map((image) => image.dataUrl)
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error || '상세페이지 생성에 실패했습니다.');
      }

      const nextResult = payload.result as ProductDetailResult;
      setResult(nextResult);
      setHtml(buildDetailPageHtml({ formValues, result: nextResult, images, theme }));
      setCopyText(buildPlainCopyText({ formValues, result: nextResult }));
      toast.success('섹션형 상세페이지 초안이 생성되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '상세페이지 생성에 실패했습니다.';
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
    toast.success('HTML을 클립보드에 복사했습니다.');
  };

  const onCopyText = async () => {
    if (!copyText) {
      toast.error('먼저 상세페이지를 생성해 주세요.');
      return;
    }
    await navigator.clipboard.writeText(copyText);
    toast.success('카피 텍스트를 클립보드에 복사했습니다.');
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
      const totalSlices = Math.ceil(canvas.height / SLICE_HEIGHT);

      for (let index = 0; index < totalSlices; index += 1) {
        const sliceCanvas = document.createElement('canvas');
        const sliceHeight = Math.min(SLICE_HEIGHT, canvas.height - (index * SLICE_HEIGHT));
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        const context = sliceCanvas.getContext('2d');
        if (!context) {
          throw new Error('슬라이스 캔버스를 만들지 못했습니다.');
        }
        context.drawImage(
          canvas,
          0,
          index * SLICE_HEIGHT,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
        downloadDataUrl(sliceCanvas.toDataURL('image/png'), `detail-page-slice-${index + 1}.png`);
      }

      toast.success(`${totalSlices}개의 3000px 슬라이스 이미지를 저장했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '슬라이스 이미지 내보내기에 실패했습니다.');
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
                Section Detail Builder
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
                860px mobile detail page
              </span>
            </div>

            <div className="max-w-2xl">
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                이미지를 섹션별로 분류해서 긴 세로형 쇼핑몰 상세페이지로 바로 변환합니다.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/72 sm:text-base">
                업로드 이미지를 hero, detail, usage 컷으로 분류하고 Hero, Key Selling Points, Feature Icons,
                Usage Scenario, Detail Description, CTA 섹션을 860px 기준 세로 레이아웃으로 생성합니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ScanSearch, title: '이미지 분류', body: 'AI가 hero, detail, usage 역할을 나눕니다.' },
                { icon: Wand2, title: '섹션 생성', body: '6개 핵심 섹션을 세로형 흐름으로 묶습니다.' },
                { icon: Download, title: '멀티 export', body: 'HTML, 복사용 텍스트, 3000px 슬라이스 이미지를 뽑습니다.' }
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
                  <p className="mt-1 text-sm text-white/74">자주 쓰는 지시문을 바로 넣어서 테스트 속도를 줄입니다.</p>
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
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-white/7 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Theme</p>
                <h2 className="mt-1 text-xl font-bold">상세페이지 톤 선택</h2>
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
                <h2 className="mt-1 text-xl font-black tracking-tight">상품 입력값</h2>
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
                <span className="font-semibold">핵심 포인트</span>
                <input {...register('highlight')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span>LLM 프롬프트</span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">custom</span>
              </div>
              <textarea
                {...register('prompt')}
                rows={5}
                className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                placeholder="예: 업로드한 상품 사진을 분석해서 hero, detail, usage 섹션이 살아 있는 스마트스토어용 상세페이지를 만들어줘."
              />
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">상품 사진 업로드</p>
                  <p className="mt-1 text-xs text-slate-500">최대 8장까지 올릴 수 있습니다. 대표컷, 디테일컷, 사용컷이 섞여 있으면 좋습니다.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  사진 선택
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void onImagesSelected(event); }} />
              <div className="mt-4 grid grid-cols-4 gap-2">
                {images.length > 0 ? images.map((image, index) => (
                  <div key={image.id} className="overflow-hidden rounded-2xl bg-slate-200">
                    <img src={image.url} alt={`업로드 이미지 ${index + 1}`} className="h-24 w-full object-cover" />
                  </div>
                )) : (
                  <div className="col-span-4 rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-400">
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

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                상세페이지 생성
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyHtml()} disabled={!html}>
                <Copy className="h-4 w-4" />
                HTML 복사
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyText()} disabled={!copyText}>
                <Copy className="h-4 w-4" />
                카피 복사
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportSlices()} disabled={!result || isExportingSlices}>
                {isExportingSlices ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                슬라이스 저장
              </Button>
            </div>
          </form>

          <div ref={zoomRootRef} className="rounded-[1.7rem] border border-white/10 bg-white p-5 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preview</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">860px 세로 상세페이지</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{activeTheme.name}</span>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[1.6rem] bg-slate-100 p-3">
              <div ref={exportRef} className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                <div className={cn('bg-gradient-to-br px-7 pb-7 pt-8', activeTheme.heroSurface)}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero</p>
                  <h3 className="mt-3 text-[2rem] font-black leading-[1.1] tracking-tight text-slate-950">
                    {result?.headline ?? `${values.productName}의 첫인상을 선명하게 보여줄 영역입니다.`}
                  </h3>
                  <p className="mt-4 text-[15px] leading-7 text-slate-600">
                    {result?.sub_headline ?? 'AI 생성 후에는 실제 쇼핑몰 상세페이지 구조에 맞는 헤드라인과 서브 카피가 여기서 시작됩니다.'}
                  </p>
                  {sections[0]?.image ? (
                    <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-slate-200">
                      <img data-zoomable src={sections[0].image.url} alt={sections[0].title} className="block h-auto w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.35rem] bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">상품명</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{values.productName}</p>
                    </div>
                    <div className="rounded-[1.35rem] bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">가격/옵션</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{values.price || result?.product_info.price_note}</p>
                    </div>
                    <div className="rounded-[1.35rem] bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">타깃</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{values.audience}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-10 pt-6">
                  {sections.length > 0 ? sections.map((section) => (
                    <section key={section.id} className="border-b border-slate-200 py-6 last:border-b-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{section.label}</p>
                      <h4 className="mt-2 text-[1.9rem] font-black leading-[1.15] tracking-tight text-slate-950">{section.title}</h4>
                      <p className="mt-4 text-[15px] leading-7 text-slate-600">{section.body}</p>

                      {section.icons?.length ? (
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {section.icons.map((item) => (
                            <div key={`${section.id}-${item.label}`} className="rounded-[1.4rem] bg-slate-50 p-5">
                              <div className="text-xl">{iconGlyphMap[item.icon] ?? '✦'}</div>
                              <p className="mt-3 text-lg font-bold text-slate-950">{item.label}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {section.bullets?.length ? (
                        <div className="mt-5 grid gap-3">
                          {section.bullets.map((item) => (
                            <div key={`${section.id}-${item}`} className="rounded-[1.4rem] bg-slate-50 px-5 py-4 text-[15px] leading-7 text-slate-700">
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {section.image ? (
                        <div className="mt-5 overflow-hidden rounded-[1.75rem] bg-slate-200">
                          <img data-zoomable src={section.image.url} alt={section.title} className="block h-auto w-full object-cover" />
                        </div>
                      ) : null}
                    </section>
                  )) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm leading-7 text-slate-500">
                      생성 후에는 Hero, Key Selling Points, Feature Icons, Usage Scenario, Detail Description, CTA가
                      세로형 상세페이지로 배치됩니다.
                    </div>
                  )}

                  <section className="border-b border-slate-200 py-6 last:border-b-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Image Roles</p>
                    <h4 className="mt-2 text-[1.9rem] font-black leading-[1.15] tracking-tight text-slate-950">업로드 이미지를 역할별로 분류</h4>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {classifiedImages.length > 0 ? classifiedImages.map((item, index) => (
                        <div key={`${item.image.id}-${item.role}`} className="overflow-hidden rounded-[1.4rem] bg-slate-50">
                          <img src={item.image.url} alt={`분류 이미지 ${index + 1}`} className="h-44 w-full object-cover" />
                          <div className="p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.role}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{item.reason}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-[1.4rem] bg-slate-50 px-5 py-8 text-sm text-slate-500 sm:col-span-3">
                          생성 후에 이미지 역할 분류가 표시됩니다.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="pt-6">
                    <div className="rounded-[1.8rem] bg-slate-950 px-6 py-7 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">SEO / CTA</p>
                      <h4 className="mt-2 text-[1.9rem] font-black leading-[1.15] tracking-tight">
                        {result?.seo.naver_title ?? '생성 후 SEO 타이틀과 CTA가 표시됩니다.'}
                      </h4>
                      <p className="mt-4 text-[15px] leading-7 text-white/80">
                        {result?.cta ?? '상세페이지 생성 후 전환형 CTA 문구가 들어갑니다.'}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {(result?.seo.product_tags ?? []).map((tag) => (
                          <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/78">
                            #{tag}
                          </span>
                        ))}
                      </div>
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
