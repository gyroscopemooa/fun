import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, LoaderCircle, Store } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  buildDetailPageHtml,
  buildFeatureCards,
  formatDetailPagePrice,
  buildPlainCopyText,
  buildRenderSections,
  classifyImages,
  ensureResultIntegrity,
  normalizeDetailPageCount,
  themes,
  type ProductDetailFormValues,
  type ProductDetailResult,
  type ThemeKey,
  type UploadedImage
} from '@/lib/product-detail-studio';
import { cn } from '@/lib/utils';

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
const EXPORT_WIDTH = 860;

const buildImagesFromOrder = (images: string[]): UploadedImage[] => images.map((dataUrl, index) => ({
  id: `order-image-${index + 1}`,
  file: new File([], `detail-page-${index + 1}.jpg`, { type: 'image/jpeg' }),
  url: dataUrl,
  dataUrl
}));

const getExportFileBaseName = (productName: string) => {
  const normalized = productName.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '');
  return normalized || 'detail-page';
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
};

export default function ProductDetailStudioResult() {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<DetailPageOrder | null>(null);
  const [result, setResult] = useState<ProductDetailResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading paid result...');
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingSlices, setIsExportingSlices] = useState(false);
  const [isExportingFile, setIsExportingFile] = useState<'png' | 'jpg' | 'pdf' | null>(null);
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
            ? 'Payment is still pending. Complete checkout to unlock the result.'
            : nextOrder.status === 'refunded'
              ? 'Generation failed and the payment was refunded.'
            : `Order status: ${nextOrder.status}`);
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
            throw new Error('Generation failed and the payment was refunded automatically.');
          }
          if (payload?.refundStatus === 'pending') {
            throw new Error('Generation failed. Refund has started and is still pending.');
          }
          if (payload?.refundStatus === 'failed') {
            throw new Error('Generation failed and the automatic refund also failed. Please contact support.');
          }
          throw new Error(payload?.error?.message || payload?.error || 'detail page result is not available');
        }
        if (cancelled) return;
        const normalized = ensureResultIntegrity(
          payload.result as ProductDetailResult,
          normalizeDetailPageCount(nextOrder.detailPageRequest?.pageCount ?? 7)
        );
        setResult(normalized);
        setStatusMessage('Paid result ready.');
      } catch (error) {
        if (cancelled) return;
        setStatusMessage(error instanceof Error ? error.message : 'failed to load result');
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
  const theme = order?.detailPageRequest?.theme ?? 'premium';
  const activeTheme = useMemo(() => themes.find((item) => item.key === theme) ?? themes[0], [theme]);
  const classifiedImages = useMemo(() => (result ? classifyImages(result, images) : []), [result, images]);
  const renderSections = useMemo(() => (result ? buildRenderSections(result, images) : []), [result, images]);
  const featureCards = useMemo(() => (result ? buildFeatureCards(result) : []), [result]);
  const html = useMemo(() => (
    formValues && result
      ? buildDetailPageHtml({ formValues, result, images, theme })
      : ''
  ), [formValues, result, images, theme]);
  const copyText = useMemo(() => (
    formValues && result
      ? buildPlainCopyText({ formValues, result })
      : ''
  ), [formValues, result]);

  const renderExportCanvas = async () => {
    if (!exportRef.current || !result) {
      throw new Error('Generate result is not ready yet.');
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

  const onCopy = async (value: string, message: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const onExportImage = async (format: 'png' | 'jpg') => {
    if (!result || !formValues) return;
    setIsExportingFile(format);
    try {
      const canvas = await renderExportCanvas();
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'png' ? undefined : 0.92;
      downloadDataUrl(
        canvas.toDataURL(mime, quality),
        `${getExportFileBaseName(formValues.productName)}.${format === 'png' ? 'png' : 'jpg'}`
      );
    } finally {
      setIsExportingFile(null);
    }
  };

  const onExportPdf = async () => {
    if (!result || !formValues) return;
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
      pdf.save(`${getExportFileBaseName(formValues.productName)}.pdf`);
    } finally {
      setIsExportingFile(null);
    }
  };

  const onExportSlices = async () => {
    if (!exportRef.current || !result || !formValues) return;
    setIsExportingSlices(true);
    try {
      const canvas = await renderExportCanvas();
      downloadDataUrl(canvas.toDataURL('image/png'), `${getExportFileBaseName(formValues.productName)}-full.png`);
    } finally {
      setIsExportingSlices(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Paid Result</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Product Detail Studio Result</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{statusMessage}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">order: {orderId || 'missing'}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">status: {order?.status ?? 'loading'}</span>
          {order?.detailPageRequest?.pricing?.total_price ? (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              amount: {formatDetailPagePrice(Number(order.detailPageRequest.pricing.total_price), order.detailPageRequest.pricing.currency)}
            </span>
          ) : null}
        </div>
        {order?.status === 'pending' && order.checkoutUrl ? (
          <div className="mt-4">
            <Button type="button" onClick={() => { window.location.href = order.checkoutUrl ?? ''; }}>
              <Store className="h-4 w-4" />
              Continue Checkout
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
          <p className="mt-3 text-sm">Preparing paid result...</p>
        </div>
      ) : null}

      {!isLoading && result && formValues ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.34fr_1fr]">
          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => void onCopy(html, 'HTML copied')}>
                <Copy className="h-4 w-4" />
                HTML
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopy(copyText, 'Copy text copied')}>
                <Copy className="h-4 w-4" />
                Copy Text
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportImage('png')} disabled={isExportingFile !== null}>
                {isExportingFile === 'png' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PNG
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportImage('jpg')} disabled={isExportingFile !== null}>
                {isExportingFile === 'jpg' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                JPG
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportPdf()} disabled={isExportingFile !== null}>
                {isExportingFile === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onExportSlices()} disabled={isExportingSlices}>
                {isExportingSlices ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PNG Full
              </Button>
            </div>

            <div className="mt-5 grid gap-3 rounded-[1.4rem] bg-slate-50 p-4 md:grid-cols-3">
              {classifiedImages.map((item, index) => (
                <div key={`${item.image.id}-${item.role}`} className="rounded-[1.2rem] bg-white p-3 shadow-sm">
                  <img src={item.image.url} alt={`classified-${index + 1}`} className="h-28 w-full rounded-xl object-cover" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.role}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div ref={exportRef} className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
              <div className={cn('bg-gradient-to-br px-7 pb-7 pt-8', activeTheme.heroSurface)}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero</p>
                <h2 className="mt-3 text-[2rem] font-black leading-[1.08] tracking-tight text-slate-950">
                  {result.generated_copy.headline}
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-slate-600">{result.generated_copy.subheadline}</p>
                {renderSections[0]?.image ? (
                  <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-slate-200">
                    <img src={renderSections[0].image.url} alt={renderSections[0].title} className="block h-auto w-full object-cover" />
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {result.generated_copy.key_selling_points.map((point) => (
                    <span key={point} className="rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-slate-700">
                      {point}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white px-6 py-6">
                <div className="grid gap-3 md:grid-cols-2">
                  {featureCards.map((card) => (
                    <article key={`${card.glyph}-${card.title}`} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{card.glyph}</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-950">{card.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-6 space-y-6">
                  {renderSections.slice(1).map((section) => (
                    <section key={section.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{section.type}</p>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{section.title}</h3>
                      <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-600">{section.text}</p>
                      <div className="mt-4 overflow-hidden rounded-[1.4rem] bg-slate-200">
                        <img src={section.image.url} alt={section.title} className={`block h-auto w-full ${section.cropClass}`} />
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
