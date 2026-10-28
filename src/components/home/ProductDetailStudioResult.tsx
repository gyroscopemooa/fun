import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Eye, FileCode, Home, LoaderCircle, PencilLine, RotateCcw, Store } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import DetailPageThemeSelect from './DetailPageThemeSelect';
import DetailPageCanvas, { MARKETPLACE_WIDTHS, ScaledFrame, renderDetailPageHtml, type SectionAction } from '@/components/home/DetailPageCanvas';
import {
  downloadText,
  exportCanvasImage,
  exportCanvasPdf,
  exportCanvasSlices,
  getExportFileBaseName,
  renderNodeToCanvas
} from '@/lib/detail-page-export';
import {
  formatApproxKrw,
  formatDetailPagePrice,
  buildPlainCopyText,
  buildRenderSections,
  classifyImages,
  ensureResultIntegrity,
  normalizeDetailPageCount,
  type GeneratedCopy,
  type ProductDetailFormValues,
  type ProductDetailResult,
  type ProductSection,
  type ThemeKey,
  type UploadedImage
} from '@/lib/product-detail-studio';
import { cn } from '@/lib/utils';

type Locale = 'ko' | 'en' | 'ja';

type DetailPageOrder = {
  id: string;
  status: string;
  checkoutUrl: string | null;
  detailPageGenerationStatus?: string | null;
  detailPageGenerationError?: string | null;
  refundStatus?: string | null;
  refundError?: string | null;
  detailPageRequest: {
    productName: string;
    price: string;
    audience: string;
    sellingPoints: string;
    prompt: string;
    theme: ThemeKey;
    pageCount: number;
    pricing: {
      total_price: number;
      currency: 'USD';
      total_amount_cents?: number;
    } | null;
    images: string[];
  } | null;
  detailPageResult?: ProductDetailResult | null;
};

const RAW_API_BASE = import.meta.env.PUBLIC_NODE_API_BASE?.trim() ?? '';
const DEV_API_BASE = 'http://127.0.0.1:8787';
const API_BASE = (RAW_API_BASE || (import.meta.env.DEV ? DEV_API_BASE : '')).replace(/\/+$/, '');
const DETAIL_PAGE_DRAFT_KEY = 'manytool.detailPageDraft';
const DETAIL_PAGE_EDITS_KEY = 'manytool.detailPageEdits.';

const RESULT_COPY = {
  ko: {
    loading: '결제 완료 결과를 불러오는 중입니다.',
    resultTitle: '상세페이지 결과',
    resultReady: '결제 완료 결과가 준비되었습니다.',
    createNew: '새 상세페이지 만들기',
    continueEdit: '이어서 수정하기',
    goHome: '메인으로',
    continuePayment: '결제 이어서 진행',
    preparing: '결제 결과를 준비하는 중입니다...',
    status: '상태',
    paidAmount: '결제 금액',
    htmlCopied: 'HTML copied',
    copyTextCopied: 'Copy text copied',
    paidResult: 'Paid Result'
  },
  en: {
    loading: 'Loading your paid result.',
    resultTitle: 'Detail Page Result',
    resultReady: 'Your paid result is ready.',
    createNew: 'Create New Detail Page',
    continueEdit: 'Continue Editing',
    goHome: 'Back to Home',
    continuePayment: 'Continue Payment',
    preparing: 'Preparing paid result...',
    status: 'Status',
    paidAmount: 'Paid Amount',
    htmlCopied: 'HTML copied',
    copyTextCopied: 'Copy text copied',
    paidResult: 'Paid Result'
  },
  ja: {
    loading: '決済済みの結果を読み込んでいます。',
    resultTitle: '商品詳細ページ結果',
    resultReady: '決済済みの結果が準備できました。',
    createNew: '新しい詳細ページを作成',
    continueEdit: '続けて編集',
    goHome: 'ホームへ',
    continuePayment: '決済を続ける',
    preparing: '決済結果を準備しています...',
    status: '状態',
    paidAmount: '決済金額',
    htmlCopied: 'HTML copied',
    copyTextCopied: 'Copy text copied',
    paidResult: 'Paid Result'
  }
} as const;

const buildImagesFromOrder = (images: string[]): UploadedImage[] => images.map((dataUrl, index) => ({
  id: `order-image-${index + 1}`,
  file: new File([], `detail-page-${index + 1}.jpg`, { type: 'image/jpeg' }),
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

type ProductDetailStudioResultProps = {
  locale?: Locale;
};

export default function ProductDetailStudioResult({ locale = 'ko' }: ProductDetailStudioResultProps) {
  const ui = RESULT_COPY[locale];
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<DetailPageOrder | null>(null);
  const [result, setResult] = useState<ProductDetailResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(ui.loading);
  const [isLoading, setIsLoading] = useState(true);
  const [originalResult, setOriginalResult] = useState<ProductDetailResult | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemeKey | null>(null);
  const [channelKey, setChannelKey] = useState(MARKETPLACE_WIDTHS[0].key);
  const exportWidth = MARKETPLACE_WIDTHS.find((item) => item.key === channelKey)?.width ?? 860;
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState<'png' | 'jpg' | 'pdf' | 'slices' | 'html' | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const nextOrderId = params.get('orderId') ?? localStorage.getItem('manytool.detailPageOrderId') ?? '';
    setOrderId(nextOrderId);
  }, []);

  useEffect(() => {
    if (!orderId || !API_BASE) return;
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      try {
        const orderResponse = await fetch(`${API_BASE}/order/${orderId}`);
        if (!orderResponse.ok) {
          throw new Error(`order lookup failed: ${orderResponse.status}`);
        }
        const nextOrder = await orderResponse.json() as DetailPageOrder;
        if (cancelled) return;
        setOrder(nextOrder);

        if (nextOrder.status !== 'paid') {
          setStatusMessage(nextOrder.status === 'pending'
            ? '결제가 아직 완료되지 않았습니다. 결제를 마치면 결과를 열 수 있습니다.'
            : nextOrder.status === 'refunded'
              ? '생성 실패로 결제가 환불되었습니다.'
            : `주문 상태: ${nextOrder.status}`);
          setResult(null);
          return;
        }

        const generateResponse = await fetch(`${API_BASE}/order/${orderId}/detail-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const payload = await generateResponse.json();
        if (!generateResponse.ok || !payload?.result) {
          if (payload?.refundStatus === 'succeeded' || payload?.refunded) {
            throw new Error('생성에 실패해 자동 환불이 완료되었습니다.');
          }
          if (payload?.refundStatus === 'pending') {
            throw new Error('생성에 실패해 환불이 진행 중입니다.');
          }
          if (payload?.refundStatus === 'failed') {
            throw new Error('생성에도 실패했고 자동 환불도 실패했습니다. 문의가 필요합니다.');
          }
          throw new Error(payload?.error?.message || payload?.error || '상세페이지 결과를 불러오지 못했습니다.');
        }
        if (cancelled) return;
        const normalized = ensureResultIntegrity(
          payload.result as ProductDetailResult,
          normalizeDetailPageCount(nextOrder.detailPageRequest?.pageCount ?? 7)
        );
        let edited: { result?: ProductDetailResult; theme?: ThemeKey | null } | null = null;
        try {
          edited = JSON.parse(localStorage.getItem(`${DETAIL_PAGE_EDITS_KEY}${orderId}`) ?? 'null');
        } catch {
          edited = null;
        }
        setOriginalResult(normalized);
        setResult(edited?.result ? ensureResultIntegrity(edited.result, normalized.page_count) : normalized);
        if (edited?.theme) setThemeOverride(edited.theme);
        setStatusMessage(ui.resultReady);
      } catch (error) {
        if (cancelled) return;
        setStatusMessage(error instanceof Error ? error.message : '결과를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const formValues = useMemo<ProductDetailFormValues | null>(() => {
    if (!order?.detailPageRequest) return null;
    return {
      productName: order.detailPageRequest.productName,
      price: order.detailPageRequest.price,
      audience: order.detailPageRequest.audience,
      sellingPoints: order.detailPageRequest.sellingPoints,
      prompt: order.detailPageRequest.prompt,
      pageCount: normalizeDetailPageCount(order.detailPageRequest.pageCount)
    };
  }, [order]);

  const images = useMemo(() => buildImagesFromOrder(order?.detailPageRequest?.images ?? []), [order]);
  const theme: ThemeKey = themeOverride ?? order?.detailPageRequest?.theme ?? 'premium';
  const classifiedImages = useMemo(() => (result ? classifyImages(result, images) : []), [result, images]);
  const renderSections = useMemo(() => (result ? buildRenderSections(result, images) : []), [result, images]);
  const copyText = useMemo(() => (
    formValues && result
      ? buildPlainCopyText({ formValues, result })
      : ''
  ), [formValues, result]);
  const hiddenCount = result?.sections.filter((section) => section.hidden).length ?? 0;

  useEffect(() => {
    if (!orderId || !result || !originalResult) return;
    try {
      localStorage.setItem(`${DETAIL_PAGE_EDITS_KEY}${orderId}`, JSON.stringify({ result, theme: themeOverride }));
    } catch {
      // Storage full or blocked: edits still live in memory for this visit.
    }
  }, [orderId, result, originalResult, themeOverride]);

  const updateCopy = (patch: Partial<GeneratedCopy>) => {
    setResult((current) => (current ? { ...current, generated_copy: { ...current.generated_copy, ...patch } } : current));
  };

  const updateSection = (index: number, patch: Partial<ProductSection>) => {
    setResult((current) => {
      if (!current) return current;
      const sections = current.sections.map((section, sectionIndex) => (sectionIndex === index ? { ...section, ...patch } : section));
      return { ...current, sections };
    });
  };

  const onSectionAction = (index: number, action: SectionAction) => {
    if (action === 'image') {
      const currentImage = renderSections.find((section) => section.sourceIndex === index)?.imageIndex ?? -1;
      if (images.length) updateSection(index, { image_index: (currentImage + 1) % images.length });
      return;
    }
    if (action === 'hide') {
      updateSection(index, { hidden: true });
      return;
    }
    setResult((current) => {
      if (!current) return current;
      const target = action === 'up' ? index - 1 : index + 1;
      // Index 0 is the hero; keep it pinned to the top.
      if (target < 1 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });
  };

  const onRestoreHidden = () => {
    setResult((current) => (current ? { ...current, sections: current.sections.map((section) => ({ ...section, hidden: false })) } : current));
  };

  const onResetEdits = () => {
    if (!originalResult) return;
    setResult(originalResult);
    setThemeOverride(null);
    localStorage.removeItem(`${DETAIL_PAGE_EDITS_KEY}${orderId}`);
    toast.success('처음 생성된 상태로 되돌렸습니다.');
  };

  const onCopy = async (value: string, message: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const runExport = async (kind: 'png' | 'jpg' | 'pdf' | 'slices' | 'html') => {
    if (!result || !formValues) return;
    setIsExporting(kind);
    const wasEditing = isEditing;
    if (wasEditing) setIsEditing(false);
    const baseName = `${getExportFileBaseName(formValues.productName)}-${exportWidth}px`;
    try {
      if (kind === 'html') {
        const html = await renderDetailPageHtml({
          title: result.generated_copy.seo_title,
          result,
          sections: renderSections,
          formValues,
          theme,
          width: exportWidth
        });
        downloadText(html, `${baseName}.html`);
        return;
      }
      // Let the non-editing render commit before rasterizing.
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      if (!exportRef.current) throw new Error('아직 저장할 결과가 준비되지 않았습니다.');
      const canvas = await renderNodeToCanvas(exportRef.current, exportWidth);
      if (kind === 'pdf') await exportCanvasPdf(canvas, baseName);
      else if (kind === 'slices') toast.success(`${exportCanvasSlices(canvas, exportRef.current, baseName)}장으로 나눠 저장했습니다.`);
      else exportCanvasImage(canvas, kind, baseName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setIsExporting(null);
      if (wasEditing) setIsEditing(true);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{ui.paidResult}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{ui.resultTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{statusMessage}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">{ui.status}: {order?.status ?? 'loading'}</span>
          {order?.detailPageRequest?.pricing?.total_price ? (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {ui.paidAmount}: {formatDetailPagePrice(Number(order.detailPageRequest.pricing.total_price), order.detailPageRequest.pricing.currency)} ({formatApproxKrw(Number(order.detailPageRequest.pricing.total_price))})
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => { window.location.href = '/tools/product-detail-studio/'; }}>
            <Store className="h-4 w-4" />
            {ui.createNew}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!formValues) return;
              saveDetailPageDraft({ formValues, theme, images });
              window.location.href = '/tools/product-detail-studio/';
            }}
          >
            <Store className="h-4 w-4" />
            {ui.continueEdit}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { window.location.href = '/'; }}>
            <Home className="h-4 w-4" />
            {ui.goHome}
          </Button>
        </div>
        {order?.status === 'pending' && order.checkoutUrl ? (
          <div className="mt-4">
            <Button type="button" onClick={() => { window.location.href = order.checkoutUrl ?? ''; }}>
              <Store className="h-4 w-4" />
              {ui.continuePayment}
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
          <p className="mt-3 text-sm">{ui.preparing}</p>
        </div>
      ) : null}

      {!isLoading && result && formValues ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[340px_1fr]">
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Marketplace</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">판매 채널 규격</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {MARKETPLACE_WIDTHS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setChannelKey(item.key)}
                    className={cn(
                      'rounded-2xl border px-3 py-2 text-left text-sm transition',
                      channelKey === item.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'
                    )}
                  >
                    <span className="block font-bold">{item.label}</span>
                    <span className={cn('text-xs', channelKey === item.key ? 'text-white/70' : 'text-slate-400')}>가로 {item.width}px</span>
                  </button>
                ))}
              </div>

              <DetailPageThemeSelect value={theme} onChange={setThemeOverride} locale={locale} />
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Edit</p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">직접 수정하기</h2>
                </div>
                <Button type="button" variant={isEditing ? 'default' : 'secondary'} onClick={() => setIsEditing((value) => !value)}>
                  {isEditing ? <Eye className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
                  {isEditing ? '미리보기' : '편집 모드'}
                </Button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                편집 모드에서 문구를 클릭해 바로 고치고, 섹션별로 사진 변경·순서 이동·숨기기를 할 수 있어요. 수정 내용은 이 브라우저에 자동 저장됩니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hiddenCount > 0 ? (
                  <Button type="button" variant="outline" onClick={onRestoreHidden}>숨긴 섹션 {hiddenCount}개 복원</Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={onResetEdits}>
                  <RotateCcw className="h-4 w-4" />
                  처음 상태로
                </Button>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Download</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{exportWidth}px로 저장</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" onClick={() => void runExport('slices')} disabled={isExporting !== null} className="col-span-2">
                  {isExporting === 'slices' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  업로드용 분할 JPG
                </Button>
                {(['jpg', 'png', 'pdf'] as const).map((kind) => (
                  <Button key={kind} type="button" variant="secondary" onClick={() => void runExport(kind)} disabled={isExporting !== null}>
                    {isExporting === kind ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {kind === 'pdf' ? 'PDF' : `한 장 ${kind.toUpperCase()}`}
                  </Button>
                ))}
                <Button type="button" variant="secondary" onClick={() => void runExport('html')} disabled={isExporting !== null}>
                  {isExporting === 'html' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
                  HTML
                </Button>
                <Button type="button" variant="outline" onClick={() => void onCopy(copyText, ui.copyTextCopied)} className="col-span-2">
                  <Copy className="h-4 w-4" />
                  카피 텍스트 복사
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                오픈마켓은 아주 긴 이미지 한 장을 거부하는 경우가 많아, 섹션 경계에 맞춰 나눈 분할 JPG 업로드를 추천해요.
              </p>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Images</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {classifiedImages.map((item, index) => (
                  <div key={`${item.image.id}-${item.role}`} className="overflow-hidden rounded-xl bg-slate-100">
                    <img src={item.image.url} alt={`classified-${index + 1}`} className="h-20 w-full object-cover" />
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">#{index + 1} {item.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0 rounded-[1.7rem] border border-slate-200 bg-slate-100 p-3 shadow-sm sm:p-5">
            <div className="mx-auto overflow-hidden rounded-2xl shadow-[0_18px_48px_rgba(15,23,42,0.12)]" style={{ maxWidth: exportWidth }}>
              <ScaledFrame ref={exportRef} width={exportWidth}>
                <DetailPageCanvas
                  result={result}
                  sections={renderSections}
                  formValues={formValues}
                  theme={theme}
                  width={exportWidth}
                  editable={isEditing}
                  onEditCopy={updateCopy}
                  onEditSection={updateSection}
                  onSectionAction={onSectionAction}
                />
              </ScaledFrame>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

