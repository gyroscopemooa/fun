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
  RotateCcw,
  ScanSearch,
  Sparkles,
  Store,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DETAIL_PAGE_MAX_COUNT,
  DETAIL_PAGE_MIN_COUNT,
  DETAIL_PAGE_TIER_OPTIONS,
  buildDetailPageHtml,
  buildDetailPagePricing,
  buildFallbackResult,
  buildFeatureCards,
  buildPlainCopyText,
  buildRenderSections,
  classifyImages,
  detailPageTestScenarios,
  ensureResultIntegrity,
  formatApproxKrw,
  formatDetailPagePrice,
  getDetailPageTier,
  iconGlyphMap,
  normalizeDetailPageCount,
  sectionLabelMap,
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

type PaymentMode = 'mock' | 'polar';
type PaymentProducts = {
  detail_page: boolean;
  detail_page_tiers?: Partial<Record<number, boolean>>;
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

const MAX_IMAGES = 30;
const RAW_API_BASE = import.meta.env.PUBLIC_NODE_API_BASE?.trim() ?? '';
const DEV_API_BASE = 'http://127.0.0.1:8787';
const API_BASE = (RAW_API_BASE || (import.meta.env.DEV ? DEV_API_BASE : '')).replace(/\/+$/, '');
const EXPORT_WIDTH = 860;
const SLICE_HEIGHT = 3000;
const SHOW_DEBUG_SCENARIOS = import.meta.env.DEV || import.meta.env.PUBLIC_DETAIL_PAGE_DEBUG === 'true';
const INVALID_API_RESPONSE_MESSAGE = '생성 서버 응답을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.';
const MISSING_API_BASE_MESSAGE = 'API 서버 주소가 설정되지 않았습니다. 배포 환경변수를 확인해주세요.';
const UNREACHABLE_API_MESSAGE = '생성 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
const INVALID_PRODUCTION_API_BASE_MESSAGE = '프로덕션 API 주소가 잘못 설정되었습니다. PUBLIC_NODE_API_BASE를 https://api.manytool.net 으로 설정해주세요.';
const DETAIL_PAGE_REQUEST_PATH = '/commerce/detail-page/generate';
const CHECKOUT_REQUEST_PATH = '/checkout';
const DETAIL_PAGE_RESULT_PATH = '/tools/product-detail-studio/result/';
const DETAIL_PAGE_DRAFT_KEY = 'manytool.detailPageDraft';

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

const buildDetailPageResultUrl = (orderId: string) => {
  if (typeof window === 'undefined') {
    return `${DETAIL_PAGE_RESULT_PATH}?orderId=${encodeURIComponent(orderId)}`;
  }
  return `${window.location.origin}${DETAIL_PAGE_RESULT_PATH}?orderId=${encodeURIComponent(orderId)}`;
};

const getExportFileBaseName = (productName: string) => {
  const normalized = productName.trim().toLowerCase().replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '');
  return normalized || 'detail-page';
};

const buildUploadedImagesFromDataUrls = (items: string[] = []): UploadedImage[] => items.map((dataUrl, index) => ({
  id: `draft-image-${index + 1}`,
  file: new File([], `draft-image-${index + 1}.jpg`, { type: 'image/jpeg' }),
  url: dataUrl,
  dataUrl
}));

const saveDetailPageDraft = ({
  formValues,
  theme,
  images
}: {
  formValues: ProductDetailFormValues;
  theme: ThemeKey;
  images: UploadedImage[];
}) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DETAIL_PAGE_DRAFT_KEY, JSON.stringify({
    formValues,
    theme,
    images: images.map((image) => image.dataUrl)
  }));
};

export default function ProductDetailStudio() {
  const defaultFormValues: ProductDetailFormValues = {
    productName: '프리미엄 세라믹 머그컵',
    price: '29,900원 / 2컬러',
    audience: '감성 주방 아이템을 찾는 20-30대 고객',
    sellingPoints: '보온감, 묵직한 세라믹 질감, 선물하기 좋은 디자인',
    prompt: starterPrompts[0],
    pageCount: 7
  };
  const { register, handleSubmit, reset, setValue, watch } = useForm<ProductDetailFormValues>({
    defaultValues: {
      ...defaultFormValues
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
  const [isExportingFile, setIsExportingFile] = useState<'png' | 'jpg' | 'pdf' | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('mock');
  const [paymentProducts, setPaymentProducts] = useState<PaymentProducts>({ detail_page: false });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zoomRootRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const values = watch();
  const normalizedPageCount = normalizeDetailPageCount(values.pageCount);
  const pricingSummary = buildDetailPagePricing(normalizedPageCount);
  const activeTier = getDetailPageTier(normalizedPageCount);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawDraft = window.localStorage.getItem(DETAIL_PAGE_DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        formValues?: Partial<ProductDetailFormValues>;
        theme?: ThemeKey;
        images?: string[];
      };
      if (draft.formValues?.productName) setValue('productName', draft.formValues.productName);
      if (draft.formValues?.price) setValue('price', draft.formValues.price);
      if (draft.formValues?.audience) setValue('audience', draft.formValues.audience);
      if (draft.formValues?.sellingPoints) setValue('sellingPoints', draft.formValues.sellingPoints);
      if (draft.formValues?.prompt) setValue('prompt', draft.formValues.prompt);
      if (Number.isFinite(Number(draft.formValues?.pageCount))) {
        setValue('pageCount', normalizeDetailPageCount(Number(draft.formValues?.pageCount)));
      }
      if (draft.theme) setTheme(draft.theme);
      if (Array.isArray(draft.images) && draft.images.length) {
        setImages(buildUploadedImagesFromDataUrls(draft.images.slice(0, MAX_IMAGES)));
      }
    } catch {
      window.localStorage.removeItem(DETAIL_PAGE_DRAFT_KEY);
    }
  }, [setTheme, setValue]);

  useEffect(() => {
    if (!API_BASE || hasInvalidProductionApiBase) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/config`);
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled) return;
        setPaymentMode(payload?.paymentMode === 'polar' ? 'polar' : 'mock');
        setPaymentProducts({
          detail_page: Boolean(payload?.paymentProducts?.detail_page),
          detail_page_tiers: payload?.paymentProducts?.detail_page_tiers ?? {}
        });
      } catch {
        if (cancelled) return;
        setPaymentMode('mock');
        setPaymentProducts({ detail_page: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasInvalidProductionApiBase]);

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
    const pageCount = normalizeDetailPageCount(formValues.pageCount);
    if (!images.length) {
      toast.error('먼저 상품 이미지를 업로드해주세요.');
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
          pageCount,
          pricing: buildDetailPagePricing(pageCount),
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

      const nextResult = ensureResultIntegrity(payload.result as ProductDetailResult, pageCount);
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
      toast.error('먼저 상세페이지를 생성해주세요.');
      return;
    }
    await navigator.clipboard.writeText(html);
    toast.success('HTML을 복사했습니다.');
  };

  const onCopyText = async () => {
    if (!copyText) {
      toast.error('먼저 상세페이지를 생성해주세요.');
      return;
    }
    await navigator.clipboard.writeText(copyText);
    toast.success('카피 텍스트를 복사했습니다.');
  };

  const renderExportCanvas = async () => {
    if (!exportRef.current || !result) {
      throw new Error('먼저 상세페이지를 생성해주세요.');
    }

    const sourceWidth = Math.max(1, exportRef.current.getBoundingClientRect().width);
    const scale = EXPORT_WIDTH / sourceWidth;
    const exportHeight = Math.max(1, Math.round(exportRef.current.scrollHeight * scale));
    const { toCanvas } = await import('html-to-image');
    return toCanvas(exportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      height: exportHeight,
      canvasWidth: EXPORT_WIDTH * 2,
      canvasHeight: exportHeight * 2,
      width: EXPORT_WIDTH,
      style: {
        width: `${EXPORT_WIDTH}px`,
        maxWidth: `${EXPORT_WIDTH}px`
      }
    });
  };

  const onPageCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    const nextValue = Number.isFinite(rawValue) ? rawValue : DETAIL_PAGE_MIN_COUNT;
    setValue('pageCount', nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    });
  };

  const onExportImage = async (format: 'png' | 'jpg') => {
    if (!result) {
      toast.error('먼저 상세페이지를 생성해주세요.');
      return;
    }

    setIsExportingFile(format);
    try {
      const canvas = await renderExportCanvas();
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'png' ? undefined : 0.92;
      downloadDataUrl(
        canvas.toDataURL(mime, quality),
        `${getExportFileBaseName(values.productName)}.${format === 'png' ? 'png' : 'jpg'}`
      );
      toast.success(`${format.toUpperCase()} 파일을 저장했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '이미지 저장에 실패했습니다.');
    } finally {
      setIsExportingFile(null);
    }
  };

  const onExportPdf = async () => {
    if (!result) {
      toast.error('먼저 상세페이지를 생성해주세요.');
      return;
    }

    setIsExportingFile('pdf');
    try {
      const canvas = await renderExportCanvas();
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: canvas.height >= canvas.width ? 'portrait' : 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${getExportFileBaseName(values.productName)}.pdf`);
      toast.success('PDF 파일을 저장했습니다.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF 저장에 실패했습니다.');
    } finally {
      setIsExportingFile(null);
    }
  };

  const onStartCheckout = handleSubmit(async (formValues) => {
    if (!images.length) {
      toast.error('먼저 상품 이미지를 최소 1장 업로드해주세요.');
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

    if (paymentMode !== 'polar') {
      toast.message('Payment mode is currently mock.');
      return;
    }

    if (!paymentProducts.detail_page) {
      toast.error('상세페이지 티어 결제 상품이 아직 설정되지 않았습니다.');
      return;
    }

    setIsStartingCheckout(true);
    try {
      const pageCount = normalizeDetailPageCount(formValues.pageCount);
      const tierEnabled = paymentProducts.detail_page_tiers?.[pageCount];
      if (paymentProducts.detail_page_tiers && tierEnabled === false) {
        throw new Error(`${pageCount}장 티어 결제가 아직 설정되지 않았습니다.`);
      }
      const pricing = buildDetailPagePricing(pageCount);
      saveDetailPageDraft({
        formValues: {
          ...formValues,
          pageCount
        },
        theme,
        images
      });
      const requestUrl = `${API_BASE}${CHECKOUT_REQUEST_PATH}`;
      const pendingResultUrl = buildDetailPageResultUrl('pending');
      const redirectBaseUrl = pendingResultUrl.replace('orderId=pending', 'orderId=');
      console.info('[ProductDetailStudio] checkout request URL:', requestUrl);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'detail_page',
          amount: pricing.total_amount_cents,
          currency: pricing.currency,
          successUrl: redirectBaseUrl,
          returnUrl: redirectBaseUrl,
          detailPageRequest: {
            productName: formValues.productName,
            price: formValues.price,
            audience: formValues.audience,
            sellingPoints: formValues.sellingPoints,
            prompt: formValues.prompt,
            theme,
            pageCount,
            pricing,
            images: images.map((image) => image.dataUrl)
          }
        })
      });
      console.info('[ProductDetailStudio] checkout response status:', response.status);
      const rawBody = await response.text();
      const payload = rawBody ? JSON.parse(rawBody) : null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'checkout request failed');
      }

      if (payload?.orderId) {
        localStorage.setItem('manytool.detailPageOrderId', String(payload.orderId));
      }

      if (payload?.paid && payload?.orderId) {
        window.location.href = buildDetailPageResultUrl(String(payload.orderId));
        return;
      }

      if (payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      throw new Error('checkout url is missing');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'failed to start checkout');
    } finally {
      setIsStartingCheckout(false);
    }
  });

  const onExportSlices = async () => {
    if (!exportRef.current || !result) {
      toast.error('먼저 상세페이지를 생성해주세요.');
      return;
    }

    setIsExportingSlices(true);
    try {
      const canvas = await renderExportCanvas();
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
      toast.success(`${sliceRanges.length}개의 PNG 슬라이스를 저장했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '슬라이스 저장에 실패했습니다.');
    } finally {
      setIsExportingSlices(false);
    }
  };

  const onClearInputs = () => {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    setImages([]);
    setResult(null);
    setHtml('');
    setCopyText('');
    setApiError('');
    reset(defaultFormValues);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DETAIL_PAGE_DRAFT_KEY);
    }
    toast.success('입력값과 이미지를 비웠습니다.');
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

            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/46">Marketplace Ready</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-[3.35rem]">
                {'\uC1FC\uD551\uBAB0\u00B7\uC624\uD508\uB9C8\uCF13\u00B7\uC790\uC0AC\uBAB0\uC5D0 \uC62C\uB9B4 \uC0C1\uC138\uD398\uC774\uC9C0\uB97C \uBE60\uB974\uAC8C \uC81C\uC791\uD569\uB2C8\uB2E4.'}
              </h1>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/74 sm:text-[1.05rem]">
                {'\uC2A4\uB9C8\uD2B8\uC2A4\uD1A0\uC5B4, \uCFE0\uD321, 11\uBC88\uAC00, \uB124\uC774\uBC84, \uC625\uC158, \uC704\uBA54\uD504, \uD1A0\uC2A4, \uCE74\uCE74\uC624, \uC790\uC0AC\uBAB0\uC5D0 \uBC14\uB85C \uC751\uC6A9\uD560 \uC218 \uC788\uB294'}
                {' '}
                {'\uD310\uB9E4\uC6A9 \uC0C1\uC138\uD398\uC774\uC9C0 \uCD08\uC548\uC744 \uC0C1\uD488 \uC0AC\uC9C4\uACFC \uC815\uBCF4\uB9CC\uC73C\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4.'}
              </p>
            </div>

            <div className="hidden rounded-[1.8rem] border border-white/12 bg-black/12 px-5 py-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Marketplace Ready</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-[2rem]">
                쇼핑몰·오픈마켓·자사몰에 올릴 상세페이지를 빠르게 시작합니다.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/74 sm:text-base">
                스마트스토어, 쿠팡, 11번가, 네이버, 옥션, 위메프, 토스, 카카오, 자사몰에 어울리는 판매형 상세페이지를
                사진과 상품 정보만으로 빠르게 정리할 수 있게 구성했습니다.
              </p>
            </div>

            <div className="max-w-2xl">
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                상품 사진과 상품 정보를 판매용 상세페이지 초안으로 바로 정리합니다.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/72 sm:text-base">
                업로드 이미지를 hero, detail, usage로 자동 분류하고 선택한 페이지 수에 맞춰 긴 흐름의 판매형 상세페이지를 구성합니다.
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-[rgba(255,206,220,0.24)] bg-[linear-gradient(135deg,rgba(255,245,247,0.12),rgba(255,230,238,0.08),rgba(255,255,255,0.04))] p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Why It Sells</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight text-white">예뻐 보이고, 잘 팔리게 만드는 판매 흐름</h2>
                </div>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white/78">
                  soft conversion angle
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/76">
                결과물만 만드는 툴이 아니라 판매 페이지 자체에서 구매 이유가 더 잘 보이도록 구성했습니다.
                선물하기 좋은 상품인지, 집 분위기를 바꿔주는 아이템인지, 사진 몇 장만으로도 갖고 싶어 보이게 만들 수 있는지 같은 구매 포인트를 자연스럽게 전달합니다.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  '작은 셀러도 브랜드처럼 보이게 하는 첫 화면 구성',
                  '선물, 자기만족, 분위기 전환 같은 구매 이유를 짧게 설명',
                  '상품 사진만으로도 감성 흐름과 구매 흐름이 함께 이어지게 구성',
                  '과하지 않게 설득하는 판매형 상세페이지 카피를 빠르게 정리'
                ].map((point) => (
                  <div key={point} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/82">
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ScanSearch, title: '이미지 분류', body: '히어로컷, 디테일컷, 사용컷을 자동으로 나눕니다.' },
                { icon: Wand2, title: '섹션 생성', body: '1장부터 20장까지 선택한 분량에 맞춰 섹션을 동적으로 구성합니다.' },
                { icon: Download, title: '다중 저장', body: 'HTML, PNG, JPG, PDF, 복사 텍스트까지 바로 저장합니다.' }
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
                  <p className="mt-1 text-sm text-white/74">자주 쓰는 지시문을 바로 넣을 수 있습니다.</p>
                </div>
                <Sparkles className="h-5 w-5 text-white/70" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  { title: 'Gift Angle', body: '집들이, 생일, 작은 감사 선물처럼 구매 명분이 바로 보이는 상품에 잘 맞습니다.' },
                  { title: 'Mood Upgrade', body: '실용성뿐 아니라 사진발, 공간 무드, 취향 만족감까지 같이 전달하는 구조를 빠르게 만듭니다.' },
                  { title: 'Soft Persuasion', body: '과장하지 않아도 예뻐 보이고 사고 싶어 보이게 만드는 판매 흐름을 정리합니다.' }
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,220,232,0.88)]">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-white/74">{item.body}</p>
                  </div>
                ))}
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
              void onStartCheckout();
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
                <input type="hidden" {...register('pageCount', { valueAsNumber: true })} value={normalizedPageCount} />
                <div className="flex flex-wrap gap-2">
                  {DETAIL_PAGE_TIER_OPTIONS.map((option) => {
                    const selected = normalizedPageCount === option.pageCount;
                    return (
                      <button
                        key={option.pageCount}
                        type="button"
                        onClick={() => setValue('pageCount', option.pageCount, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true
                        })}
                        className={cn(
                          'min-w-[64px] rounded-full border px-3 py-1.5 text-center text-sm transition',
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        )}
                      >
                        <p className="font-bold">{option.pageCount}장</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500">5, 7, 10, 15, 20장 티어 중에서 선택할 수 있습니다.</p>
              </label>
            </div>

            <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected Tier</p>
                  <h3 className="mt-1 text-base font-black text-slate-950">{activeTier.pageCount}장 · {activeTier.name}</h3>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  장수가 많을수록 더 흐름이 자연스럽고 설명이 풍부해집니다
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{activeTier.summary}</p>
            </div>

            <div className="mt-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">핵심 판매 포인트</span>
                <textarea
                  {...register('sellingPoints')}
                  rows={3}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                  placeholder="예: 3중 보온 구조, 감성적인 컬러감, 선물하기 좋은 패키지"
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
                  placeholder="예: 스마트스토어 흐름으로 7장 구성, proof 섹션은 신뢰감 있게 정리해줘"
                />
              </label>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">상품 이미지 업로드</p>
                  <p className="mt-1 text-xs text-slate-500">최대 30장까지 업로드할 수 있습니다. 이미지가 적어도 부족한 섹션은 자동으로 재구성합니다.</p>
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
                    아직 업로드한 이미지가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {apiError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {apiError}
              </div>
            ) : null}

            <div className="hidden mt-5 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">선택 장수: {pricingSummary.page_count}장</p>
                <p className="text-xs text-slate-500">장당 약 {Math.round(pricingSummary.unit_price * 1450).toLocaleString('ko-KR')}원</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated</p>
                <p className="font-semibold text-slate-900">예상 금액: 약 {Math.round(pricingSummary.total_price * 1450).toLocaleString('ko-KR')}원</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">선택 장수: {pricingSummary.page_count}장</p>
                <p className="text-xs text-slate-500">장당 {formatDetailPagePrice(pricingSummary.unit_price, pricingSummary.currency)}</p>
                <p className="text-xs text-slate-400">장당 {formatApproxKrw(pricingSummary.unit_price)} 수준</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated</p>
                <p className="font-semibold text-slate-900">예상 금액: {formatDetailPagePrice(pricingSummary.total_price, pricingSummary.currency)}</p>
                <p className="text-xs text-slate-400">{formatApproxKrw(pricingSummary.total_price)} / 실제 결제는 USD 기준</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" disabled={isStartingCheckout}>
                {isStartingCheckout ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                Pay and Generate
              </Button>
              <Button type="button" variant="outline" onClick={onClearInputs}>
                <RotateCcw className="h-4 w-4" />
                입력값 비우기
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyHtml()} disabled={!html}>
                <Copy className="h-4 w-4" />
                HTML
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyText()} disabled={!copyText}>
                <Copy className="h-4 w-4" />
                Copy Text
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportImage('png')} disabled={!result || isExportingFile !== null}>
                {isExportingFile === 'png' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PNG
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportImage('jpg')} disabled={!result || isExportingFile !== null}>
                {isExportingFile === 'jpg' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                JPG
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportPdf()} disabled={!result || isExportingFile !== null}>
                {isExportingFile === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
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
                {result ? `${result.page_count} pages` : `${normalizedPageCount} pages`}
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
                    {result?.generated_copy.subheadline ?? '상품명, 가격, 타깃 고객, 업로드 이미지 기준으로 상세페이지 카피가 생성됩니다.'}
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
                      생성 후 선택한 페이지 수에 맞는 긴 흐름의 상세페이지가 렌더링됩니다.
                    </div>
                  )}

                  <section className="pt-6">
                    <div className="rounded-[1.8rem] bg-slate-950 px-6 py-7 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">SEO / CTA</p>
                      <h4 className="mt-2 text-[1.9rem] font-black leading-[1.15] tracking-tight">
                        {result?.generated_copy.seo_title ?? '생성 후 SEO title이 여기에 표시됩니다.'}
                      </h4>
                      <p className="mt-4 text-[15px] leading-7 text-white/80">
                        {result?.generated_copy.cta ?? '생성 후 CTA 문구가 여기에 표시됩니다.'}
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

