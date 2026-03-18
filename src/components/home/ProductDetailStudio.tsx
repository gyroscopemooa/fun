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

type Locale = 'ko' | 'en' | 'ja';

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
const DETAIL_PAGE_REQUEST_PATH = '/commerce/detail-page/generate';
const CHECKOUT_REQUEST_PATH = '/checkout';
const DETAIL_PAGE_RESULT_PATH = '/tools/product-detail-studio/result/';
const DETAIL_PAGE_DRAFT_KEY = 'manytool.detailPageDraft';

const UI_COPY = {
  ko: {
    invalidApiResponse: '생성 서버 응답을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.',
    missingApiBase: 'API 서버 주소가 설정되지 않았습니다. 배포 환경변수를 확인해주세요.',
    unreachableApi: '생성 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    invalidProductionApiBase: '프로덕션 API 주소가 잘못 설정되었습니다. PUBLIC_NODE_API_BASE를 https://api.manytool.net 으로 설정해주세요.',
    sample: {
      productName: '프리미엄 세라믹 머그컵',
      price: '29,900원 / 2컬러',
      audience: '감성 주방 아이템을 찾는 20-30대 고객',
      sellingPoints: '보온감, 묵직한 세라믹 질감, 선물하기 좋은 디자인',
    },
    loadImagesSuccess: (count: number) => `${count}장의 이미지를 불러왔습니다.`,
    uploadFail: '이미지 업로드에 실패했습니다.',
    uploadFirst: '먼저 상품 이미지를 업로드해주세요.',
    generateFail: '상세페이지 생성에 실패했습니다.',
    generatedSuccess: (count: number) => `${count}장 구성의 상세페이지가 생성되었습니다.`,
    copyHtml: 'HTML을 복사했습니다.',
    copyText: '카피 텍스트를 복사했습니다.',
    saveImageFail: '이미지 저장에 실패했습니다.',
    savePdfFail: 'PDF 저장에 실패했습니다.',
    uploadAtLeastOne: '먼저 상품 이미지를 최소 1장 업로드해주세요.',
    paymentProductMissing: '상세페이지 티어 결제 상품이 아직 설정되지 않았습니다.',
    tierNotReady: (count: number) => `${count}장 티어 결제가 아직 설정되지 않았습니다.`,
    sliceSaveFail: '슬라이스 저장에 실패했습니다.',
    sliceSaveSuccess: (count: number) => `${count}개의 PNG 슬라이스를 저장했습니다.`,
    clearSuccess: '입력값과 이미지를 비웠습니다.',
    heroEyebrow: '쇼핑몰 판매형 상세페이지',
    heroTitle: '쇼핑몰·오픈마켓·자사몰에 올릴 상세페이지를 빠르게 시작합니다.',
    heroBody: '스마트스토어, 쿠팡, 11번가, 네이버, 옥션, 위메프, 토스, 카카오, 자사몰에 어울리는 판매형 상세페이지를 사진과 상품 정보만으로 빠르게 정리할 수 있게 구성했습니다.',
    sectionTitle: '예뻐 보이고, 잘 팔리게 만드는 판매 흐름',
    sectionBody: '결과물만 만드는 툴이 아니라 판매 페이지 자체에서 구매 이유가 더 잘 보이도록 구성했습니다.',
    paletteTitle: '디자인 톤 선택',
    inputEyebrow: 'Input',
    inputTitle: '상품 입력',
    productName: '상품명',
    price: '가격 / 옵션',
    audience: '타깃 고객',
    pageCount: '페이지 수',
    tierHint: '5, 7, 10, 15, 20장 티어 중에서 선택할 수 있습니다.',
    selectedTier: 'Selected Tier',
    selectedTierHint: '장수가 많을수록 더 흐름이 자연스럽고 설명이 풍부해집니다',
    sellingPoints: '핵심 판매 포인트',
    prompt: 'LLM 프롬프트',
    sellingPointsPlaceholder: '예: 3중 보온 구조, 감성적인 컬러감, 선물하기 좋은 패키지',
    promptPlaceholder: '예: 스마트스토어 흐름으로 7장 구성, proof 섹션은 신뢰감 있게 정리해줘',
    imageUploadTitle: '상품 이미지 업로드',
    imageUploadBody: '최대 30장까지 업로드할 수 있습니다. 이미지가 적어도 부족한 섹션은 자동으로 재구성합니다.',
    chooseImages: '이미지 선택',
    noImages: '아직 업로드한 이미지가 없습니다.',
    selectedPages: '선택 장수',
    perPageApprox: '장당',
    estimated: '예상 금액',
    usdNotice: '실제 결제는 USD 기준',
    payAndGenerate: 'Pay and Generate',
    clearInputs: '입력값 비우기',
    copyTextButton: 'Copy Text',
    termsNoticePrefix: '결제를 진행하면',
    terms: '이용약관',
    privacy: '개인정보 처리방침',
    refund: '환불정책',
    termsNoticeSuffix: '에 동의한 것으로 간주됩니다.',
    preview: 'Preview',
    detailPageVertical: '860px vertical detail page',
    pages: 'pages',
    classifiedPlaceholder: '생성 후 hero / detail / usage 자동 분류가 여기에 표시됩니다.',
    hero: 'Hero',
    headlinePlaceholder: '상세페이지 헤드라인이 여기에 표시됩니다.',
    subheadlinePlaceholder: '상품명, 가격, 타깃 고객, 업로드 이미지 기준으로 상세페이지 카피가 생성됩니다.',
    renderedPlaceholder: '생성 후 선택한 페이지 수에 맞는 긴 흐름의 상세페이지가 렌더링됩니다.',
    seoCta: 'SEO / CTA',
    seoPlaceholder: '생성 후 SEO title이 여기에 표시됩니다.',
    ctaPlaceholder: '생성 후 CTA 문구가 여기에 표시됩니다.'
  },
  en: {
    invalidApiResponse: 'Could not parse the generation server response. Please try again later.',
    missingApiBase: 'API base URL is missing. Check the deployment environment variables.',
    unreachableApi: 'Could not reach the generation server. Please try again later.',
    invalidProductionApiBase: 'The production API base is invalid. Set PUBLIC_NODE_API_BASE to https://api.manytool.net.',
    sample: {
      productName: 'Premium Ceramic Mug',
      price: '$24.90 / 2 colors',
      audience: 'Customers in their 20s and 30s looking for cozy kitchen items',
      sellingPoints: 'Heat retention, premium ceramic texture, gift-friendly design',
    },
    loadImagesSuccess: (count: number) => `Loaded ${count} image(s).`,
    uploadFail: 'Failed to upload images.',
    uploadFirst: 'Upload product images first.',
    generateFail: 'Failed to generate the detail page.',
    generatedSuccess: (count: number) => `Generated a ${count}-page detail page draft.`,
    copyHtml: 'HTML copied.',
    copyText: 'Copy text copied.',
    saveImageFail: 'Failed to save the image.',
    savePdfFail: 'Failed to save the PDF.',
    uploadAtLeastOne: 'Upload at least one product image first.',
    paymentProductMissing: 'The detail page payment product is not configured yet.',
    tierNotReady: (count: number) => `The ${count}-page tier is not configured yet.`,
    sliceSaveFail: 'Failed to save PNG slices.',
    sliceSaveSuccess: (count: number) => `Saved ${count} PNG slice(s).`,
    clearSuccess: 'Cleared inputs and images.',
    heroEyebrow: 'Sales-focused ecommerce detail page',
    heroTitle: 'Start a product detail page for marketplaces and brand stores in one flow.',
    heroBody: 'Built for Smart Store, Coupang, 11st, Naver, Auction, Wemakeprice, Toss, Kakao, and self-hosted stores with product images and structured product info.',
    sectionTitle: 'A sales flow that looks polished and sells more clearly',
    sectionBody: 'This is not just a layout generator. It is designed to make buying reasons more visible across the whole page.',
    paletteTitle: 'Choose a design tone',
    inputEyebrow: 'Input',
    inputTitle: 'Product Input',
    productName: 'Product Name',
    price: 'Price / Options',
    audience: 'Target Audience',
    pageCount: 'Page Count',
    tierHint: 'Choose from 5, 7, 10, 15, or 20 page tiers.',
    selectedTier: 'Selected Tier',
    selectedTierHint: 'More pages usually create a smoother flow and richer explanations.',
    sellingPoints: 'Key Selling Points',
    prompt: 'LLM Prompt',
    sellingPointsPlaceholder: 'Example: triple heat retention, soft neutral color, gift-friendly package',
    promptPlaceholder: 'Example: Build a 7-page Smart Store style layout with a trustworthy proof section',
    imageUploadTitle: 'Upload Product Images',
    imageUploadBody: 'You can upload up to 30 images. Missing sections are reconstructed automatically when needed.',
    chooseImages: 'Choose Images',
    noImages: 'No images uploaded yet.',
    selectedPages: 'Selected Pages',
    perPageApprox: 'Per page',
    estimated: 'Estimated',
    usdNotice: 'Actual checkout is charged in USD',
    payAndGenerate: 'Pay and Generate',
    clearInputs: 'Clear Inputs',
    copyTextButton: 'Copy Text',
    termsNoticePrefix: 'By continuing with payment, you agree to the',
    terms: 'Terms',
    privacy: 'Privacy Policy',
    refund: 'Refund Policy',
    termsNoticeSuffix: '.',
    preview: 'Preview',
    detailPageVertical: '860px vertical detail page',
    pages: 'pages',
    classifiedPlaceholder: 'Automatic hero / detail / usage image classification will appear here after generation.',
    hero: 'Hero',
    headlinePlaceholder: 'Your detail page headline will appear here after generation.',
    subheadlinePlaceholder: 'Generated copy based on product name, price, audience, and uploaded images will appear here.',
    renderedPlaceholder: 'The long-form detail page preview for your selected page count will render here after generation.',
    seoCta: 'SEO / CTA',
    seoPlaceholder: 'The generated SEO title will appear here.',
    ctaPlaceholder: 'The generated CTA copy will appear here.'
  },
  ja: {
    invalidApiResponse: '生成サーバーの応答を処理できませんでした。しばらくしてから再度お試しください。',
    missingApiBase: 'API サーバーの設定がありません。環境変数を確認してください。',
    unreachableApi: '生成サーバーに接続できませんでした。しばらくしてから再度お試しください。',
    invalidProductionApiBase: '本番 API の設定が正しくありません。PUBLIC_NODE_API_BASE を https://api.manytool.net に設定してください。',
    sample: {
      productName: 'プレミアム セラミックマグ',
      price: '$24.90 / 2カラー',
      audience: '雰囲気のあるキッチン雑貨を探す20〜30代',
      sellingPoints: '保温性、上質なセラミック質感、ギフト向けデザイン',
    },
    loadImagesSuccess: (count: number) => `${count}枚の画像を読み込みました。`,
    uploadFail: '画像のアップロードに失敗しました。',
    uploadFirst: '先に商品画像をアップロードしてください。',
    generateFail: '商品詳細ページの生成に失敗しました。',
    generatedSuccess: (count: number) => `${count}ページ構成の詳細ページを生成しました。`,
    copyHtml: 'HTML をコピーしました。',
    copyText: 'コピー文をコピーしました。',
    saveImageFail: '画像の保存に失敗しました。',
    savePdfFail: 'PDF の保存に失敗しました。',
    uploadAtLeastOne: '先に商品画像を1枚以上アップロードしてください。',
    paymentProductMissing: '商品詳細ページの決済商品がまだ設定されていません。',
    tierNotReady: (count: number) => `${count}ページのティア決済がまだ設定されていません。`,
    sliceSaveFail: 'PNG スライスの保存に失敗しました。',
    sliceSaveSuccess: (count: number) => `${count}個の PNG スライスを保存しました。`,
    clearSuccess: '入力内容と画像をクリアしました。',
    heroEyebrow: '販売向け 商品詳細ページ',
    heroTitle: 'マーケットプレイスや自社EC向けの商品詳細ページをすばやく開始できます。',
    heroBody: 'Smart Store、Coupang、11st、Naver、Auction、Wemakeprice、Toss、Kakao、自社ECに合う販売型の商品詳細ページを、写真と商品情報だけで整理できます。',
    sectionTitle: '見栄えがよく、売れやすい販売フロー',
    sectionBody: 'ただのレイアウト生成ではなく、ページ全体で購入理由が伝わりやすくなる構成を目指しています。',
    paletteTitle: 'デザイントーンを選択',
    inputEyebrow: 'Input',
    inputTitle: '商品入力',
    productName: '商品名',
    price: '価格 / オプション',
    audience: 'ターゲット顧客',
    pageCount: 'ページ数',
    tierHint: '5 / 7 / 10 / 15 / 20 ページのティアから選択できます。',
    selectedTier: 'Selected Tier',
    selectedTierHint: 'ページ数が多いほど流れが自然で説明も豊かになります。',
    sellingPoints: '主な訴求ポイント',
    prompt: 'LLM プロンプト',
    sellingPointsPlaceholder: '例: 3重保温構造、落ち着いたカラー、ギフト向けパッケージ',
    promptPlaceholder: '例: Smart Store 向けの7ページ構成で、信頼感のある proof セクションを入れてください',
    imageUploadTitle: '商品画像アップロード',
    imageUploadBody: '最大30枚までアップロードできます。画像が少ない場合でも不足セクションを自動で補います。',
    chooseImages: '画像を選択',
    noImages: 'まだ画像がアップロードされていません。',
    selectedPages: '選択ページ数',
    perPageApprox: '1ページあたり',
    estimated: '予想金額',
    usdNotice: '実際の決済は USD 基準です',
    payAndGenerate: 'Pay and Generate',
    clearInputs: '入力をクリア',
    copyTextButton: 'Copy Text',
    termsNoticePrefix: '決済を進めると、',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    refund: '返金ポリシー',
    termsNoticeSuffix: 'に同意したものとみなされます。',
    preview: 'Preview',
    detailPageVertical: '860px vertical detail page',
    pages: 'pages',
    classifiedPlaceholder: '生成後に hero / detail / usage の自動分類結果がここに表示されます。',
    hero: 'Hero',
    headlinePlaceholder: '生成後に商品詳細ページの見出しがここに表示されます。',
    subheadlinePlaceholder: '商品名、価格、顧客層、アップロード画像をもとに生成されたコピーがここに表示されます。',
    renderedPlaceholder: '生成後に、選択したページ数に応じた長い商品詳細ページプレビューがここに表示されます。',
    seoCta: 'SEO / CTA',
    seoPlaceholder: '生成後に SEO タイトルがここに表示されます。',
    ctaPlaceholder: '生成後に CTA 文がここに表示されます。'
  }
} as const;

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

type ProductDetailStudioProps = {
  locale?: Locale;
};

export default function ProductDetailStudio({ locale = 'ko' }: ProductDetailStudioProps) {
  const ui = UI_COPY[locale];
  const defaultFormValues: ProductDetailFormValues = {
    productName: ui.sample.productName,
    price: ui.sample.price,
    audience: ui.sample.audience,
    sellingPoints: ui.sample.sellingPoints,
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
      setApiError(ui.invalidProductionApiBase);
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
      toast.success(ui.loadImagesSuccess(loadedImages.length));
    } catch (error) {
      previous.forEach((image) => URL.revokeObjectURL(image.url));
      setImages([]);
      toast.error(error instanceof Error ? error.message : ui.uploadFail);
    } finally {
      event.target.value = '';
    }
  };

  const onGenerate = handleSubmit(async (formValues) => {
    const pageCount = normalizeDetailPageCount(formValues.pageCount);
    if (!images.length) {
      toast.error(ui.uploadFirst);
      return;
    }

    if (!API_BASE) {
      setApiError(ui.missingApiBase);
      toast.error(ui.missingApiBase);
      return;
    }

    if (hasInvalidProductionApiBase) {
      setApiError(ui.invalidProductionApiBase);
      toast.error(ui.invalidProductionApiBase);
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
        throw new Error(payload?.error || ui.generateFail);
      }

      const nextResult = ensureResultIntegrity(payload.result as ProductDetailResult, pageCount);
      setResult(nextResult);
      setHtml(buildDetailPageHtml({ formValues, result: nextResult, images, theme }));
      setCopyText(buildPlainCopyText({ formValues, result: nextResult }));
      toast.success(ui.generatedSuccess(nextResult.page_count));
    } catch (error) {
      const fallbackMessage = ui.generateFail;
      const rawMessage = error instanceof Error ? error.message : fallbackMessage;
      const message = rawMessage === 'Failed to fetch'
        ? ui.unreachableApi
        : rawMessage === 'Unexpected end of JSON input'
          ? ui.invalidApiResponse
          : rawMessage;
      setApiError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  });

  const onCopyHtml = async () => {
    if (!html) {
      toast.error(ui.generateFail);
      return;
    }
    await navigator.clipboard.writeText(html);
    toast.success(ui.copyHtml);
  };

  const onCopyText = async () => {
    if (!copyText) {
      toast.error(ui.generateFail);
      return;
    }
    await navigator.clipboard.writeText(copyText);
    toast.success(ui.copyText);
  };

  const renderExportCanvas = async () => {
    if (!exportRef.current || !result) {
      throw new Error(ui.generateFail);
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
      toast.error(ui.generateFail);
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
      toast.error(error instanceof Error ? error.message : ui.saveImageFail);
    } finally {
      setIsExportingFile(null);
    }
  };

  const onExportPdf = async () => {
    if (!result) {
      toast.error(ui.generateFail);
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
      toast.error(error instanceof Error ? error.message : ui.savePdfFail);
    } finally {
      setIsExportingFile(null);
    }
  };

  const onStartCheckout = handleSubmit(async (formValues) => {
    if (!images.length) {
      toast.error(ui.uploadAtLeastOne);
      return;
    }

    if (!API_BASE) {
      setApiError(ui.missingApiBase);
      toast.error(ui.missingApiBase);
      return;
    }

    if (hasInvalidProductionApiBase) {
      setApiError(ui.invalidProductionApiBase);
      toast.error(ui.invalidProductionApiBase);
      return;
    }

    if (paymentMode !== 'polar') {
      toast.message('Payment mode is currently mock.');
      return;
    }

    if (!paymentProducts.detail_page) {
      toast.error(ui.paymentProductMissing);
      return;
    }

    setIsStartingCheckout(true);
    try {
      const pageCount = normalizeDetailPageCount(formValues.pageCount);
      const tierEnabled = paymentProducts.detail_page_tiers?.[pageCount];
      if (paymentProducts.detail_page_tiers && tierEnabled === false) {
        throw new Error(ui.tierNotReady(pageCount));
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
      toast.error(ui.generateFail);
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
      toast.success(ui.sliceSaveSuccess(sliceRanges.length));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ui.sliceSaveFail);
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
    toast.success(ui.clearSuccess);
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
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/46">{ui.heroEyebrow}</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-[3.35rem]">
                {ui.heroTitle}
              </h1>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/74 sm:text-[1.05rem]">
                {ui.heroBody}
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
                {ui.heroTitle}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/72 sm:text-base">
                {ui.subheadlinePlaceholder}
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-[rgba(255,206,220,0.24)] bg-[linear-gradient(135deg,rgba(255,245,247,0.12),rgba(255,230,238,0.08),rgba(255,255,255,0.04))] p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Why It Sells</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">{ui.sectionTitle}</h2>
                </div>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white/78">
                  soft conversion angle
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/76">{ui.sectionBody}</p>
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
                <h2 className="mt-1 text-xl font-bold">{ui.paletteTitle}</h2>
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
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.inputEyebrow}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">{ui.inputTitle}</h2>
              </div>
              <Wand2 className="h-5 w-5 text-slate-500" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{ui.productName}</span>
                <input {...register('productName')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{ui.price}</span>
                <input {...register('price')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{ui.audience}</span>
                <input {...register('audience')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{ui.pageCount}</span>
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
                <p className="text-xs text-slate-500">{ui.tierHint}</p>
              </label>
            </div>

            <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected Tier</p>
                  <h3 className="mt-1 text-base font-black text-slate-950">{activeTier.pageCount}장 · {activeTier.name}</h3>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {ui.selectedTierHint}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{activeTier.summary}</p>
            </div>

            <div className="mt-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{ui.sellingPoints}</span>
                <textarea
                  {...register('sellingPoints')}
                  rows={3}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                  placeholder={ui.sellingPointsPlaceholder}
                />
              </label>
            </div>

            <div className="mt-4">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{ui.prompt}</span>
                <textarea
                  {...register('prompt')}
                  rows={4}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                  placeholder={ui.promptPlaceholder}
                />
              </label>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{ui.imageUploadTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">{ui.imageUploadBody}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  {ui.chooseImages}
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
                    {ui.noImages}
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
                <p className="font-semibold text-slate-900">{ui.selectedPages}: {pricingSummary.page_count}장</p>
                <p className="text-xs text-slate-500">장당 약 {Math.round(pricingSummary.unit_price * 1450).toLocaleString('ko-KR')}원</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated</p>
                <p className="font-semibold text-slate-900">예상 금액: 약 {Math.round(pricingSummary.total_price * 1450).toLocaleString('ko-KR')}원</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">{ui.selectedPages}: {pricingSummary.page_count}장</p>
                <p className="text-xs text-slate-500">장당 {formatDetailPagePrice(pricingSummary.unit_price, pricingSummary.currency)}</p>
                <p className="text-xs text-slate-400">장당 {formatApproxKrw(pricingSummary.unit_price)} 수준</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated</p>
                <p className="font-semibold text-slate-900">예상 금액: {formatDetailPagePrice(pricingSummary.total_price, pricingSummary.currency)}</p>
                <p className="text-xs text-slate-400">{formatApproxKrw(pricingSummary.total_price)} / {ui.usdNotice}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" disabled={isStartingCheckout}>
                {isStartingCheckout ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                {ui.payAndGenerate}
              </Button>
              <Button type="button" variant="outline" onClick={onClearInputs}>
                <RotateCcw className="h-4 w-4" />
                {ui.clearInputs}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyHtml()} disabled={!html}>
                <Copy className="h-4 w-4" />
                HTML
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onCopyText()} disabled={!copyText}>
                <Copy className="h-4 w-4" />
                {ui.copyTextButton}
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

            <p className="mt-4 text-xs leading-6 text-slate-500">
              {ui.termsNoticePrefix}{' '}
              <a href="/terms" className="font-medium text-slate-700 underline underline-offset-4">{ui.terms}</a>,{' '}
              <a href="/privacy" className="font-medium text-slate-700 underline underline-offset-4">{ui.privacy}</a>,{' '}
              <a href="/refund-policy" className="font-medium text-slate-700 underline underline-offset-4">{ui.refund}</a>
              {ui.termsNoticeSuffix}
            </p>
          </form>

          <div ref={zoomRootRef} className="rounded-[1.7rem] border border-white/10 bg-white p-5 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{ui.preview}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">{ui.detailPageVertical}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {result ? `${result.page_count} ${ui.pages}` : `${normalizedPageCount} ${ui.pages}`}
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
                  {ui.classifiedPlaceholder}
                </div>
              )}
            </div>

            <div className="mt-5 overflow-x-auto rounded-[1.6rem] bg-slate-100 p-3">
              <div ref={exportRef} className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                <div className={cn('bg-gradient-to-br px-7 pb-7 pt-8', activeTheme.heroSurface)}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{ui.hero}</p>
                  <h3 className="mt-3 text-[2rem] font-black leading-[1.08] tracking-tight text-slate-950">
                    {result?.generated_copy.headline ?? `${values.productName} - ${ui.headlinePlaceholder}`}
                  </h3>
                  <p className="mt-4 text-[15px] leading-7 text-slate-600">
                    {result?.generated_copy.subheadline ?? ui.subheadlinePlaceholder}
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
                      {ui.renderedPlaceholder}
                    </div>
                  )}

                  <section className="pt-6">
                    <div className="rounded-[1.8rem] bg-slate-950 px-6 py-7 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{ui.seoCta}</p>
                      <h4 className="mt-2 text-[1.9rem] font-black leading-[1.15] tracking-tight">
                        {result?.generated_copy.seo_title ?? ui.seoPlaceholder}
                      </h4>
                      <p className="mt-4 text-[15px] leading-7 text-white/80">
                        {result?.generated_copy.cta ?? ui.ctaPlaceholder}
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

