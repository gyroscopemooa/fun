import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, Check, Download, ImagePlus, LoaderCircle, RefreshCw, Share2, UploadCloud, X } from 'lucide-react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';

import { sampleThumb, samplesForMode } from '@/lib/ai-image-samples';
import { AiSampleGallery } from './AiSampleGallery';

export type AiImageMode = 'figure' | 'body' | 'travel' | 'europe' | 'proofshot' | 'kakao' | 'instagram' | 'hanbok' | 'kimono' | 'outfit' | 'streamer' | 'pethuman' | 'hairstyle' | 'interior' | 'animation' | 'modelcut' | 'free';
type Mode = AiImageMode;
type Provider = 'openai' | 'xai';
type GenerationPhase = 'idle' | 'payment' | 'generating' | 'done' | 'error';
type Locale = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'pt' | 'vi' | 'id';

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
  paymentMode?: 'mock' | 'polar';
  paymentProducts?: {
    base?: boolean;
  };
  readiness?: {
    openAiReady?: boolean;
    xaiReady?: boolean;
    polarReady?: boolean;
  };
};

type CheckoutResponse = {
  orderId?: string;
  status?: string;
  paymentMode?: 'mock' | 'polar';
  amount?: number;
  currency?: string;
  paid?: boolean;
  checkoutUrl?: string | null;
  error?: string;
};

type OrderResponse = {
  id?: string;
  status?: string;
  checkoutUrl?: string | null;
};

type SavedDraft = {
  mode: Mode;
  userInputs: Record<Mode, string>;
  imageName: string;
  imageType: string;
  imageLastModified: number;
  imageDataUrl: string;
};

const DEFAULT_PROVIDER: Provider = 'openai';
const ENGINE_LABEL = 'ManyTool AI';
const MODE_ORDER: Mode[] = ['figure', 'body', 'travel', 'europe', 'proofshot', 'kakao', 'instagram', 'hanbok', 'kimono', 'outfit', 'modelcut', 'streamer', 'pethuman', 'hairstyle', 'interior', 'animation', 'free'];

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
  travel: {
    tabLabel: '해외여행 배경',
    title: 'AI 해외여행 배경 생성기',
    buttonLabel: '해외여행 사진 생성',
    exampleTitle: '해외여행 배경 예시',
    exampleDescription: '인물은 유지하고 배경을 해외여행 느낌으로 자연스럽게 바꿉니다.',
    accentClass: 'from-emerald-500 via-teal-400 to-cyan-300',
    exampleGradient: 'from-emerald-100 via-teal-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: Paris street cafe',
    inputRequired: false
  },
  europe: {
    tabLabel: '유럽여행스타일',
    title: 'AI 유럽여행 스타일 생성기',
    buttonLabel: '유럽여행 스타일 생성',
    exampleTitle: '유럽여행 스타일 예시',
    exampleDescription: '유럽 감성의 거리, 카페, 골목 분위기로 자연스럽게 변환합니다.',
    accentClass: 'from-blue-500 via-sky-400 to-cyan-300',
    exampleGradient: 'from-sky-100 via-cyan-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: Paris balcony morning',
    inputRequired: false
  },
  proofshot: {
    tabLabel: '인증샷 만들기',
    title: 'AI 인증샷 만들기',
    buttonLabel: '인증샷 생성',
    exampleTitle: '인증샷 예시',
    exampleDescription: '실제 찍은 듯한 자연스러운 인증샷 분위기로 변환합니다.',
    accentClass: 'from-indigo-500 via-violet-400 to-pink-300',
    exampleGradient: 'from-indigo-100 via-violet-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: natural travel snapshot',
    inputRequired: false
  },
  kakao: {
    tabLabel: '카톡 프로필',
    title: 'AI 카톡 프로필 생성기',
    buttonLabel: '카톡 프로필 생성',
    exampleTitle: '카톡 프로필 예시',
    exampleDescription: '깔끔하고 호감 가는 카카오톡 프로필용 이미지를 만듭니다.',
    accentClass: 'from-yellow-400 via-amber-300 to-orange-300',
    exampleGradient: 'from-yellow-100 via-amber-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: clean smile profile',
    inputRequired: false
  },
  instagram: {
    tabLabel: '인스타 사진',
    title: 'AI 인스타 사진 생성기',
    buttonLabel: '인스타 사진 생성',
    exampleTitle: '인스타 사진 예시',
    exampleDescription: '요즘 감성의 세련된 인스타그램 스타일 사진으로 변환합니다.',
    accentClass: 'from-pink-500 via-rose-400 to-orange-300',
    exampleGradient: 'from-rose-100 via-pink-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: trendy lifestyle editorial',
    inputRequired: false
  },
  hanbok: {
    tabLabel: '한복스타일',
    title: 'AI 한복 스타일 생성기',
    buttonLabel: '한복 스타일 생성',
    exampleTitle: '한복 스타일 예시',
    exampleDescription: '얼굴은 유지하고 의상을 한복 스타일로 자연스럽게 바꿉니다.',
    accentClass: 'from-red-500 via-rose-400 to-amber-300',
    exampleGradient: 'from-rose-100 via-orange-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: elegant modern hanbok',
    inputRequired: false
  },
  kimono: {
    tabLabel: '기모노스타일',
    title: 'AI 기모노 스타일 생성기',
    buttonLabel: '기모노 스타일 생성',
    exampleTitle: '기모노 스타일 예시',
    exampleDescription: '얼굴은 유지하고 의상을 기모노 스타일로 자연스럽게 바꿉니다.',
    accentClass: 'from-fuchsia-500 via-rose-400 to-red-300',
    exampleGradient: 'from-fuchsia-100 via-rose-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: elegant Kyoto kimono',
    inputRequired: false
  },
  outfit: {
    tabLabel: '의상변경',
    title: 'AI 의상변경 생성기',
    buttonLabel: '의상변경 생성',
    exampleTitle: '의상변경 예시',
    exampleDescription: '포즈와 얼굴은 유지하면서 옷만 세련되게 바꿉니다.',
    accentClass: 'from-slate-700 via-slate-500 to-zinc-300',
    exampleGradient: 'from-slate-100 via-zinc-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: luxury casual fashion',
    inputRequired: false
  },
  streamer: {
    tabLabel: '방셀',
    title: 'AI 방셀 제작기',
    buttonLabel: '방셀 생성',
    exampleTitle: '방셀 예시',
    exampleDescription: '스트리머 썸네일이나 방송 홍보용 셀카 느낌으로 자연스럽게 변환합니다.',
    accentClass: 'from-violet-600 via-indigo-500 to-sky-400',
    exampleGradient: 'from-violet-100 via-indigo-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '예: 치지직 스트리머 방셀, RGB 조명',
    inputRequired: false
  },
  pethuman: {
    tabLabel: '펫인간화',
    title: 'AI 펫 인간화',
    buttonLabel: '펫 인간화 생성',
    exampleTitle: '펫 인간화 예시',
    exampleDescription: '반려동물 사진을 사람처럼 재해석하되, 종 특성과 분위기를 자연스럽게 반영합니다.',
    accentClass: 'from-amber-500 via-orange-400 to-rose-300',
    exampleGradient: 'from-amber-100 via-orange-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '?: stylish human version of a golden retriever',
    inputRequired: false
  },
  hairstyle: {
    tabLabel: '헤어',
    title: 'AI 헤어스타일 시뮬레이터',
    buttonLabel: '헤어스타일 생성',
    exampleTitle: '헤어스타일 예시',
    exampleDescription: '얼굴은 유지하고 머리 스타일만 바꿔보는 시뮬레이션 이미지로 변환합니다.',
    accentClass: 'from-rose-500 via-pink-400 to-fuchsia-300',
    exampleGradient: 'from-rose-100 via-pink-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '?: layered bob with soft bangs',
    inputRequired: false
  },
  interior: {
    tabLabel: '인테리어',
    title: 'AI 인테리어 시뮬레이터',
    buttonLabel: '인테리어 생성',
    exampleTitle: '인테리어 예시',
    exampleDescription: '내 방 사진을 업로드하면 호텔, 카페, 스튜디오 느낌으로 공간 무드를 바꿉니다.',
    accentClass: 'from-teal-600 via-emerald-500 to-lime-300',
    exampleGradient: 'from-emerald-100 via-teal-50 to-white',
    inputLabel: '추가 디테일',
    inputPlaceholder: '?: cozy boutique hotel room',
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
  modelcut: {
    tabLabel: '상품으로 모델 만들기',
    title: '상품으로 모델 만들기',
    buttonLabel: '상품으로 모델 만들기',
    exampleTitle: '상품 착장샷 예시',
    exampleDescription: '모델 고용·섭외 없이 내 상품으로 모델 만들기. 옷 사진 한 장으로 쇼핑몰용 착장샷을 만들거나, 안 입어보고 코디를 확인하는 온라인으로 입어보기를 해보세요.',
    accentClass: 'from-stone-700 via-neutral-500 to-amber-200',
    exampleGradient: 'from-stone-100 via-neutral-50 to-white',
    inputLabel: '모델·배경 요청',
    inputPlaceholder: '예: 20대 여성 모델, 야외 거리 배경',
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

const EN_MODE_CONTENT: Record<Mode, ModeContent> = {
  figure: {
    tabLabel: 'Figure',
    title: 'AI Action Figure Generator',
    buttonLabel: 'Generate figure',
    exampleTitle: 'Figure example',
    exampleDescription: 'Create premium boxed action figure images from your uploaded photo while keeping identity and overall styling cues.',
    accentClass: 'from-orange-500 via-amber-400 to-yellow-300',
    exampleGradient: 'from-orange-100 via-amber-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. modern premium packaging',
    inputRequired: false
  },
  body: {
    tabLabel: 'Fitness',
    title: 'AI Fitness Photoshoot Generator',
    buttonLabel: 'Generate fitness shot',
    exampleTitle: 'Fitness example',
    exampleDescription: 'Turn one photo into a modern fitness editorial image with realistic proportions and preserved identity.',
    accentClass: 'from-sky-600 via-cyan-500 to-teal-400',
    exampleGradient: 'from-cyan-100 via-white to-slate-50',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. dramatic studio lighting',
    inputRequired: false
  },
  travel: {
    tabLabel: 'Travel Background',
    title: 'AI Travel Background Generator',
    buttonLabel: 'Generate travel photo',
    exampleTitle: 'Travel example',
    exampleDescription: 'Keep the person and switch the background into an overseas travel scene.',
    accentClass: 'from-emerald-500 via-teal-400 to-cyan-300',
    exampleGradient: 'from-emerald-100 via-teal-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. Paris street cafe',
    inputRequired: false
  },
  europe: {
    tabLabel: 'Europe Style',
    title: 'AI Europe Travel Style Generator',
    buttonLabel: 'Generate Europe style',
    exampleTitle: 'Europe style example',
    exampleDescription: 'Recreate your image with a European city mood, street cafes, and travel aesthetics.',
    accentClass: 'from-blue-500 via-sky-400 to-cyan-300',
    exampleGradient: 'from-sky-100 via-cyan-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. Paris balcony morning',
    inputRequired: false
  },
  proofshot: {
    tabLabel: 'Snapshot',
    title: 'AI Snapshot Generator',
    buttonLabel: 'Generate snapshot',
    exampleTitle: 'Snapshot example',
    exampleDescription: 'Create a natural candid-style image that feels like a real proof shot or social snapshot.',
    accentClass: 'from-indigo-500 via-violet-400 to-pink-300',
    exampleGradient: 'from-indigo-100 via-violet-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. natural travel snapshot',
    inputRequired: false
  },
  kakao: {
    tabLabel: 'Snapchat Profile',
    title: 'AI Snapchat Profile Generator',
    buttonLabel: 'Generate Snapchat profile',
    exampleTitle: 'Snapchat profile example',
    exampleDescription: 'Create a clean, friendly profile-ready portrait for social media.',
    accentClass: 'from-yellow-400 via-amber-300 to-orange-300',
    exampleGradient: 'from-yellow-100 via-amber-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. clean smile portrait',
    inputRequired: false
  },
  instagram: {
    tabLabel: 'Instagram Photo',
    title: 'AI Instagram Photo Generator',
    buttonLabel: 'Generate Instagram photo',
    exampleTitle: 'Instagram example',
    exampleDescription: 'Generate trendy lifestyle-style photos that feel ready for Instagram.',
    accentClass: 'from-pink-500 via-rose-400 to-orange-300',
    exampleGradient: 'from-rose-100 via-pink-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. trendy lifestyle editorial',
    inputRequired: false
  },
  hanbok: {
    tabLabel: 'Hanbok Style',
    title: 'AI Hanbok Style Generator',
    buttonLabel: 'Generate hanbok style',
    exampleTitle: 'Hanbok example',
    exampleDescription: 'Keep the face and transform the outfit into an elegant hanbok-inspired look.',
    accentClass: 'from-red-500 via-rose-400 to-amber-300',
    exampleGradient: 'from-rose-100 via-orange-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. elegant modern hanbok',
    inputRequired: false
  },
  kimono: {
    tabLabel: 'Kimono Style',
    title: 'AI Kimono Style Generator',
    buttonLabel: 'Generate kimono style',
    exampleTitle: 'Kimono example',
    exampleDescription: 'Preserve the person and restyle the outfit into a refined kimono-inspired look.',
    accentClass: 'from-fuchsia-500 via-rose-400 to-red-300',
    exampleGradient: 'from-fuchsia-100 via-rose-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. elegant Kyoto kimono',
    inputRequired: false
  },
  outfit: {
    tabLabel: 'Outfit Change',
    title: 'AI Outfit Change Generator',
    buttonLabel: 'Generate outfit change',
    exampleTitle: 'Outfit example',
    exampleDescription: 'Change only the outfit while keeping the face and overall mood intact.',
    accentClass: 'from-slate-700 via-slate-500 to-zinc-300',
    exampleGradient: 'from-slate-100 via-zinc-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. luxury casual fashion',
    inputRequired: false
  },
  streamer: {
    tabLabel: 'Streamer Promo',
    title: 'AI Streamer Promo Generator',
    buttonLabel: 'Generate streamer promo',
    exampleTitle: 'Streamer promo example',
    exampleDescription: 'Create a thumbnail-ready streamer promo image with a polished streaming-room vibe.',
    accentClass: 'from-violet-600 via-indigo-500 to-sky-400',
    exampleGradient: 'from-violet-100 via-indigo-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. Twitch streamer room selfie',
    inputRequired: false
  },
  pethuman: {
    tabLabel: 'Pet Humanizer',
    title: 'AI Pet Humanizer',
    buttonLabel: 'Generate pet human',
    exampleTitle: 'Pet human example',
    exampleDescription: 'Turn a pet photo into a believable humanized portrait while keeping recognizable traits.',
    accentClass: 'from-amber-500 via-orange-400 to-rose-300',
    exampleGradient: 'from-amber-100 via-orange-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. stylish human version of a golden retriever',
    inputRequired: false
  },
  hairstyle: {
    tabLabel: 'Hair Simulator',
    title: 'AI Hairstyle Simulator',
    buttonLabel: 'Generate hairstyle',
    exampleTitle: 'Hairstyle example',
    exampleDescription: 'Change only the hairstyle while keeping the face, identity, and overall mood intact.',
    accentClass: 'from-rose-500 via-pink-400 to-fuchsia-300',
    exampleGradient: 'from-rose-100 via-pink-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. layered bob with soft bangs',
    inputRequired: false
  },
  interior: {
    tabLabel: 'Interior Simulator',
    title: 'AI Interior Simulator',
    buttonLabel: 'Generate interior',
    exampleTitle: 'Interior example',
    exampleDescription: 'Upload your room photo and restyle it into a hotel, cafe, or premium interior mood.',
    accentClass: 'from-teal-600 via-emerald-500 to-lime-300',
    exampleGradient: 'from-emerald-100 via-teal-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. cozy boutique hotel room',
    inputRequired: false
  },
  animation: {
    tabLabel: 'Animation',
    title: 'AI Animation Generator',
    buttonLabel: 'Generate animation style',
    exampleTitle: 'Animation example',
    exampleDescription: 'Turn the uploaded photo into a clean animation-style character image.',
    accentClass: 'from-violet-500 via-fuchsia-400 to-rose-300',
    exampleGradient: 'from-violet-100 via-fuchsia-50 to-white',
    inputLabel: 'Extra prompt',
    inputPlaceholder: 'e.g. cinematic anime hero',
    inputRequired: false
  },
  modelcut: {
    tabLabel: 'Product to Model',
    title: 'Create a Model for Your Product',
    buttonLabel: 'Create product model',
    exampleTitle: 'Product outfit examples',
    exampleDescription: 'Create outfit photos from your clothing without hiring a model. Make store images or try outfits online on an AI model before you buy.',
    accentClass: 'from-stone-700 via-neutral-500 to-amber-200',
    exampleGradient: 'from-stone-100 via-neutral-50 to-white',
    inputLabel: 'Model & background',
    inputPlaceholder: 'e.g. male model, outdoor street',
    inputRequired: false
  },
  free: {
    tabLabel: 'Free Style',
    title: 'AI Free Style Generator',
    buttonLabel: 'Generate custom style',
    exampleTitle: 'Free style example',
    exampleDescription: 'Describe the style you want in a short prompt and apply it to the uploaded image.',
    accentClass: 'from-fuchsia-500 via-rose-400 to-orange-300',
    exampleGradient: 'from-rose-100 via-white to-orange-50',
    inputLabel: 'Custom prompt',
    inputPlaceholder: 'e.g. cyberpunk hero',
    inputRequired: true
  }
};

const EN_LABELS = {
  mode: 'Mode',
  moreExamples: 'More examples'
} as const;

const LOCALIZED_UI = {
  en: { mode: 'Mode', moreExamples: 'More examples', prompt: 'Extra prompt', generate: 'Generate' },
  zh: { mode: '模式', moreExamples: '更多示例', prompt: '附加提示词', generate: '生成' },
  es: { mode: 'Modo', moreExamples: 'Más ejemplos', prompt: 'Indicaciones adicionales', generate: 'Generar' },
  de: { mode: 'Modus', moreExamples: 'Weitere Beispiele', prompt: 'Zusätzlicher Prompt', generate: 'Generieren' },
  fr: { mode: 'Mode', moreExamples: 'Plus d’exemples', prompt: 'Prompt supplémentaire', generate: 'Générer' },
  pt: { mode: 'Modo', moreExamples: 'Mais exemplos', prompt: 'Prompt adicional', generate: 'Gerar' },
  vi: { mode: 'Chế độ', moreExamples: 'Thêm ví dụ', prompt: 'Mô tả bổ sung', generate: 'Tạo' },
  id: { mode: 'Mode', moreExamples: 'Contoh lainnya', prompt: 'Prompt tambahan', generate: 'Buat' },
  it: { mode: 'Modalità', moreExamples: 'Altri esempi', prompt: 'Prompt aggiuntivo', generate: 'Genera' },
  nl: { mode: 'Modus', moreExamples: 'Meer voorbeelden', prompt: 'Extra prompt', generate: 'Genereren' },
  ru: { mode: 'Режим', moreExamples: 'Больше примеров', prompt: 'Дополнительный запрос', generate: 'Создать' },
  ar: { mode: 'الوضع', moreExamples: 'المزيد من الأمثلة', prompt: 'وصف إضافي', generate: 'إنشاء' },
  hi: { mode: 'मोड', moreExamples: 'और उदाहरण', prompt: 'अतिरिक्त प्रॉम्प्ट', generate: 'बनाएं' },
  tr: { mode: 'Mod', moreExamples: 'Daha fazla örnek', prompt: 'Ek istem', generate: 'Oluştur' },
  pl: { mode: 'Tryb', moreExamples: 'Więcej przykładów', prompt: 'Dodatkowy prompt', generate: 'Generuj' },
  th: { mode: 'โหมด', moreExamples: 'ตัวอย่างเพิ่มเติม', prompt: 'พรอมต์เพิ่มเติม', generate: 'สร้าง' },
  sv: { mode: 'Läge', moreExamples: 'Fler exempel', prompt: 'Extra prompt', generate: 'Skapa' },
  uk: { mode: 'Режим', moreExamples: 'Більше прикладів', prompt: 'Додатковий запит', generate: 'Створити' }
} as const;

const localizedModeContent = (locale: Locale): Record<Mode, ModeContent> => {
  const base = EN_MODE_CONTENT;
  if (locale === 'ko' || locale === 'en') return locale === 'ko' ? MODE_CONTENT : base;
  const ui = LOCALIZED_UI[locale as keyof typeof LOCALIZED_UI] ?? LOCALIZED_UI.en;
  return Object.fromEntries(Object.entries(base).map(([mode, content]) => [mode, {
    ...content,
    buttonLabel: content.buttonLabel.replace(/^Generate(?: custom style)?/, ui.generate),
    inputLabel: content.inputLabel === 'Custom prompt' ? ui.prompt : ui.prompt,
  }])) as Record<Mode, ModeContent>;
};

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: ENGINE_LABEL,
  xai: ENGINE_LABEL
};

const RAW_API_BASE = import.meta.env.PUBLIC_NODE_API_BASE?.trim() ?? '';
const DEV_API_BASE = 'http://127.0.0.1:8787';
const API_BASE = (RAW_API_BASE || (import.meta.env.DEV ? DEV_API_BASE : '')).replace(/\/+$/, '');
const PAYMENT_DELAY_MS = 1400;
const JOB_POLL_MS = 2500;
const JOB_TIMEOUT_MS = 180000;
const USER_INPUT_MAX_LENGTH = 50;
const AI_IMAGE_PRICE_CENTS = 399;
const AI_IMAGE_CURRENCY = 'USD';
const AI_IMAGE_DRAFT_STORAGE_KEY = 'manytool-ai-image-draft-v1';

const buildExamplePlaceholder = (mode: Mode) => {
  const paletteMap = {
    figure: { start: '#fb923c', end: '#facc15', label: 'PACKAGED FIGURE', badge: 'Retail Box' },
    body: { start: '#0ea5e9', end: '#2dd4bf', label: 'BODY PROFILE', badge: 'Studio Body' },
    travel: { start: '#10b981', end: '#22d3ee', label: 'TRAVEL SCENE', badge: 'Overseas Trip' },
    europe: { start: '#3b82f6', end: '#22d3ee', label: 'EUROPE TRIP', badge: 'City Mood' },
    proofshot: { start: '#6366f1', end: '#f472b6', label: 'PROOF SHOT', badge: 'Real Snapshot' },
    kakao: { start: '#facc15', end: '#fb923c', label: 'KAKAO PROFILE', badge: 'Clean Portrait' },
    instagram: { start: '#ec4899', end: '#fb923c', label: 'INSTAGRAM STYLE', badge: 'Lifestyle Shot' },
    hanbok: { start: '#ef4444', end: '#f59e0b', label: 'HANBOK STYLE', badge: 'Traditional Look' },
    kimono: { start: '#d946ef', end: '#fb7185', label: 'KIMONO STYLE', badge: 'Kyoto Look' },
    outfit: { start: '#475569', end: '#a1a1aa', label: 'OUTFIT CHANGE', badge: 'Fashion Edit' },
    streamer: { start: '#7c3aed', end: '#38bdf8', label: 'STREAMER PROMO', badge: 'Room Selfie' },
    pethuman: { start: '#f59e0b', end: '#fb7185', label: 'PET HUMANIZER', badge: 'Pet to Human' },
    hairstyle: { start: '#f43f5e', end: '#d946ef', label: 'HAIR SIMULATOR', badge: 'Style Preview' },
    interior: { start: '#0f766e', end: '#84cc16', label: 'INTERIOR DESIGN', badge: 'Room Mood' },
    animation: { start: '#8b5cf6', end: '#ec4899', label: 'ANIMATION STYLE', badge: 'Character Art' },
    modelcut: { start: '#44403c', end: '#fcd34d', label: 'AI MODEL SHOT', badge: 'Lookbook' },
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

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
      return;
    }
    reject(new Error('failed to read image file'));
  };
  reader.onerror = () => reject(new Error('failed to read image file'));
  reader.readAsDataURL(file);
});

const dataUrlToFile = async (dataUrl: string, name: string, type: string, lastModified: number) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: type || blob.type || 'image/png', lastModified });
};

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
const SLA_ALL_IMAGES = [
  '/pic/SLA/07e91bba-09fb-4d87-a9fd-3980666a7afa-xai-free.png',
  '/pic/SLA/18164267-ff6e-481b-beb5-bafe47b66efa-xai-figure.png',
  '/pic/SLA/1b31c9c3-4bb2-4b1d-bae9-d9d2ea98b910.png',
  '/pic/SLA/20260318_002527.png',
  '/pic/SLA/231201a2-9c80-4489-bea5-175f2ac96638-xai-figure.png',
  '/pic/SLA/240c8aed-f1c4-4e78-834d-311f34134f2e-xai-free.png',
  '/pic/SLA/2e4f4b92-88a9-4ec7-9afe-dc0e6c1f6fb1-xai-figure.png',
  '/pic/SLA/2f404c17-3735-4de1-a13d-30e1cc688a1c-openai-body.png',
  '/pic/SLA/3a3bbff5-807c-4526-b39e-6f5acfddc181-xai-free.png',
  '/pic/SLA/53376b40-78bb-4a5b-8865-b15a9f7c246c-openai-figure.png',
  '/pic/SLA/64a67f1c-b1fc-42b4-b769-9a6f668128d7-xai-figure.png',
  '/pic/SLA/665bb11b-5532-4538-8895-623d215351f4-xai-figure.png',
  '/pic/SLA/7500c861-ef56-4627-851f-c242795b3537-xai-figure.png',
  '/pic/SLA/7b88386d-131e-4a2c-9e7d-d0107c0884b2-xai-figure.png',
  '/pic/SLA/86d3dd4f-08a6-45cf-9a60-1a1bdbe33c26.png',
  '/pic/SLA/898312d3-4b3e-4ac5-919a-7f79566f5685-xai-free.png',
  '/pic/SLA/8b6a2257-d373-48c1-b75e-15e763ab0166-xai-free.png',
  '/pic/SLA/a17927fb-1cf3-418e-9662-d6e2fb54430f-xai-free.png',
  '/pic/SLA/a27c5acf-fa1f-42f5-bcfd-c832f901fa2f.png',
  '/pic/SLA/a7a40012-a8fd-4806-a99e-9d9e2db2ff7a-xai-figure.png',
  '/pic/SLA/aecbb8f7-b183-410a-b8b3-8c0d508ee6e2-xai-body.png',
  '/pic/SLA/b2ba7846-c5f3-4fe2-865c-3e94c090a9ba-xai-free.png',
  '/pic/SLA/b3e2be3e-af5b-4636-a490-130baf41fd5a-xai-body.png',
  '/pic/SLA/d5d15693-5c1c-42fb-b187-91686be119e3-xai-free.png',
  '/pic/SLA/e871d594-bc0a-40c9-a468-37603086497d-xai-figure.png',
  '/pic/SLA/ea822f90-601b-46b2-b7f5-6a25fe8cbc7c-openai-figure.png',
  '/pic/SLA/f6e3e3c0-6bc2-438b-bd7f-62182946245f-xai-body.png',
  '/pic/SLA/OpenAI Playground 2026-03-18 at 04.30.04.png',
  '/pic/SLA/다운로드 (7).png'
];
const SLA_HERO_IMAGES = [
  '/pic/SLA/a17927fb-1cf3-418e-9662-d6e2fb54430f-xai-free.png',
  '/pic/SLA/b3e2be3e-af5b-4636-a490-130baf41fd5a-xai-body.png',
  '/pic/SLA/aecbb8f7-b183-410a-b8b3-8c0d508ee6e2-xai-body.png',
  '/pic/SLA/d5d15693-5c1c-42fb-b187-91686be119e3-xai-free.png',
  '/pic/SLA/b2ba7846-c5f3-4fe2-865c-3e94c090a9ba-xai-free.png',
  '/pic/SLA/898312d3-4b3e-4ac5-919a-7f79566f5685-xai-free.png'
];
const SLA_SUPPORT_IMAGES = SLA_ALL_IMAGES;

const GENERATION_STEPS = [
  { label: '사진 분석', detail: '얼굴과 포즈를 읽고 있어요', afterSeconds: 0 },
  { label: '얼굴 보정', detail: '얼굴 디테일을 선명하게 다듬어요', afterSeconds: 8 },
  { label: '스타일 변환', detail: '선택한 스타일을 입히고 있어요', afterSeconds: 20 },
  { label: '마무리', detail: '색감과 디테일을 정리하고 있어요', afterSeconds: 45 }
];
const QUICK_SWITCH_MODES: Mode[] = ['figure', 'body', 'instagram', 'animation', 'hanbok', 'travel'];

type AiImageGeneratorProps = {
  locale?: Locale;
  initialMode?: Mode;
  /** Dedicated single-tool pages (e.g. /ai-model-cut): hide the other style tabs, style switches and the mixed sample gallery. */
  lockMode?: boolean;
  /** Hero carousel images for pages whose samples are not in the shared SLA gallery. */
  heroImageUrls?: string[];
};

export default function AiImageGenerator({ locale = 'ko', initialMode = 'figure', lockMode = false, heroImageUrls }: AiImageGeneratorProps) {
  // Until each locale has a reviewed copy deck, non-Korean locales use the
  // English UI instead of accidentally showing Korean strings. The locale is
  // still preserved so translated dictionaries can be added incrementally.
  const modeContentMap = localizedModeContent(locale);
  const uiLabels = locale === 'ko' ? { mode: '모드', moreExamples: '스타일별 샘플 갤러리' } : locale === 'en' ? EN_LABELS : (LOCALIZED_UI[locale as keyof typeof LOCALIZED_UI] ?? EN_LABELS);
  const generatorCopy = ({
    en: { upload: 'Upload image', uploadHint: 'Drag or click to choose an image.', uploadPrompt: 'Upload an image', change: 'Change image', ready: 'Your final image is ready.', saveHint: 'Save the high-resolution original and share it on your profile or social media.', save: 'Save', share: 'Share' },
    it: { upload: 'Carica immagine', uploadHint: 'Trascina o fai clic per scegliere un’immagine.', uploadPrompt: 'Carica un’immagine', change: 'Cambia immagine', ready: 'La tua immagine finale è pronta.', saveHint: 'Salva l’originale ad alta risoluzione e condividilo sui social.', save: 'Salva', share: 'Condividi' },
    nl: { upload: 'Afbeelding uploaden', uploadHint: 'Sleep of klik om een afbeelding te kiezen.', uploadPrompt: 'Upload een afbeelding', change: 'Afbeelding wijzigen', ready: 'Je eindafbeelding is klaar.', saveHint: 'Sla het origineel in hoge resolutie op en deel het op sociale media.', save: 'Opslaan', share: 'Delen' },
    ru: { upload: 'Загрузить изображение', uploadHint: 'Перетащите файл или нажмите, чтобы выбрать изображение.', uploadPrompt: 'Загрузите изображение', change: 'Изменить изображение', ready: 'Итоговое изображение готово.', saveHint: 'Сохраните оригинал в высоком качестве и поделитесь им.', save: 'Сохранить', share: 'Поделиться' },
    ar: { upload: 'رفع صورة', uploadHint: 'اسحب أو انقر لاختيار صورة.', uploadPrompt: 'ارفع صورة', change: 'تغيير الصورة', ready: 'الصورة النهائية جاهزة.', saveHint: 'احفظ النسخة الأصلية عالية الدقة وشاركها على الشبكات الاجتماعية.', save: 'حفظ', share: 'مشاركة' },
    hi: { upload: 'इमेज अपलोड करें', uploadHint: 'इमेज चुनने के लिए ड्रैग या क्लिक करें।', uploadPrompt: 'इमेज अपलोड करें', change: 'इमेज बदलें', ready: 'आपकी अंतिम इमेज तैयार है।', saveHint: 'हाई-रिज़ॉल्यूशन मूल इमेज सेव करें और शेयर करें।', save: 'सेव', share: 'शेयर' },
    tr: { upload: 'Görsel yükle', uploadHint: 'Görsel seçmek için sürükleyin veya tıklayın.', uploadPrompt: 'Bir görsel yükleyin', change: 'Görseli değiştir', ready: 'Son görseliniz hazır.', saveHint: 'Yüksek çözünürlüklü orijinali kaydedin ve paylaşın.', save: 'Kaydet', share: 'Paylaş' },
    pl: { upload: 'Prześlij obraz', uploadHint: 'Przeciągnij lub kliknij, aby wybrać obraz.', uploadPrompt: 'Prześlij obraz', change: 'Zmień obraz', ready: 'Twój obraz końcowy jest gotowy.', saveHint: 'Zapisz oryginał w wysokiej rozdzielczości i udostępnij go.', save: 'Zapisz', share: 'Udostępnij' },
    th: { upload: 'อัปโหลดรูปภาพ', uploadHint: 'ลากหรือคลิกเพื่อเลือกรูปภาพ', uploadPrompt: 'อัปโหลดรูปภาพ', change: 'เปลี่ยนรูปภาพ', ready: 'รูปภาพสุดท้ายพร้อมแล้ว', saveHint: 'บันทึกต้นฉบับความละเอียดสูงและแชร์บนโซเชียล', save: 'บันทึก', share: 'แชร์' },
    sv: { upload: 'Ladda upp bild', uploadHint: 'Dra eller klicka för att välja en bild.', uploadPrompt: 'Ladda upp en bild', change: 'Byt bild', ready: 'Din färdiga bild är klar.', saveHint: 'Spara originalet i hög upplösning och dela det.', save: 'Spara', share: 'Dela' },
    uk: { upload: 'Завантажити зображення', uploadHint: 'Перетягніть або натисніть, щоб вибрати зображення.', uploadPrompt: 'Завантажте зображення', change: 'Змінити зображення', ready: 'Підсумкове зображення готове.', saveHint: 'Збережіть оригінал у високій якості та поділіться ним.', save: 'Зберегти', share: 'Поділитися' }
  } as const)[locale as 'en' | 'it' | 'nl' | 'ru' | 'ar' | 'hi' | 'tr' | 'pl' | 'th' | 'sv' | 'uk'] ?? { upload: 'Upload image', uploadHint: 'Drag and drop or click to choose an image.', uploadPrompt: 'Upload an image', change: 'Change image', ready: 'Your final result image is ready.', saveHint: 'Save the high-resolution original and share it to your profile or social media.', save: 'Save', share: 'Share' };
  const statusCopy = ({
    en: { generating: 'Generating', done: 'Generation complete', failed: 'Generation failed' }, it: { generating: 'Generazione in corso', done: 'Generazione completata', failed: 'Generazione non riuscita' }, nl: { generating: 'Bezig met genereren', done: 'Generatie voltooid', failed: 'Generatie mislukt' }, ru: { generating: 'Создание', done: 'Создание завершено', failed: 'Не удалось создать' }, ar: { generating: 'جارٍ الإنشاء', done: 'اكتمل الإنشاء', failed: 'فشل الإنشاء' }, hi: { generating: 'बनाया जा रहा है', done: 'जनरेशन पूरा हुआ', failed: 'जनरेशन विफल' }, tr: { generating: 'Oluşturuluyor', done: 'Oluşturma tamamlandı', failed: 'Oluşturma başarısız' }, pl: { generating: 'Generowanie', done: 'Generowanie ukończone', failed: 'Generowanie nie powiodło się' }, th: { generating: 'กำลังสร้าง', done: 'สร้างเสร็จแล้ว', failed: 'สร้างไม่สำเร็จ' }, sv: { generating: 'Skapar', done: 'Skapandet är klart', failed: 'Det gick inte att skapa' }, uk: { generating: 'Створення', done: 'Створення завершено', failed: 'Не вдалося створити' }
  } as const)[locale as 'en' | 'it' | 'nl' | 'ru' | 'ar' | 'hi' | 'tr' | 'pl' | 'th' | 'sv' | 'uk'] ?? { generating: 'Generating', done: 'Generation complete', failed: 'Generation failed' };
  const feedbackCopy = ({
    en: { saved: 'Image saved.', saveFailed: 'Could not save the image. Please try again.', shared: 'Share sheet opened.', copied: 'Result image link copied.', shareFailed: 'Could not complete sharing.' },
    it: { saved: 'Immagine salvata.', saveFailed: 'Impossibile salvare l’immagine. Riprova.', shared: 'Scheda di condivisione aperta.', copied: 'Link dell’immagine copiato.', shareFailed: 'Condivisione non riuscita.' },
    nl: { saved: 'Afbeelding opgeslagen.', saveFailed: 'Afbeelding opslaan mislukt. Probeer het opnieuw.', shared: 'Deelvenster geopend.', copied: 'Link naar resultaat gekopieerd.', shareFailed: 'Delen mislukt.' },
    ru: { saved: 'Изображение сохранено.', saveFailed: 'Не удалось сохранить изображение. Повторите попытку.', shared: 'Окно публикации открыто.', copied: 'Ссылка на изображение скопирована.', shareFailed: 'Не удалось поделиться.' },
    ar: { saved: 'تم حفظ الصورة.', saveFailed: 'تعذر حفظ الصورة. حاول مرة أخرى.', shared: 'تم فتح نافذة المشاركة.', copied: 'تم نسخ رابط الصورة.', shareFailed: 'تعذرت المشاركة.' },
    hi: { saved: 'इमेज सेव हो गई।', saveFailed: 'इमेज सेव नहीं हो सकी। फिर कोशिश करें।', shared: 'शेयर शीट खुल गई।', copied: 'रिज़ल्ट इमेज लिंक कॉपी हो गया।', shareFailed: 'शेयर पूरा नहीं हो सका।' },
    tr: { saved: 'Görsel kaydedildi.', saveFailed: 'Görsel kaydedilemedi. Tekrar deneyin.', shared: 'Paylaşım paneli açıldı.', copied: 'Sonuç görseli bağlantısı kopyalandı.', shareFailed: 'Paylaşım tamamlanamadı.' },
    pl: { saved: 'Obraz zapisany.', saveFailed: 'Nie udało się zapisać obrazu. Spróbuj ponownie.', shared: 'Otwarto panel udostępniania.', copied: 'Skopiowano link do obrazu.', shareFailed: 'Nie udało się udostępnić.' },
    th: { saved: 'บันทึกรูปภาพแล้ว', saveFailed: 'บันทึกรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง', shared: 'เปิดหน้าต่างแชร์แล้ว', copied: 'คัดลอกลิงก์รูปภาพแล้ว', shareFailed: 'แชร์ไม่สำเร็จ' },
    sv: { saved: 'Bilden har sparats.', saveFailed: 'Det gick inte att spara bilden. Försök igen.', shared: 'Delningspanelen öppnades.', copied: 'Länken till resultatbilden kopierades.', shareFailed: 'Det gick inte att dela.' },
    uk: { saved: 'Зображення збережено.', saveFailed: 'Не вдалося зберегти зображення. Спробуйте ще раз.', shared: 'Вікно поширення відкрито.', copied: 'Посилання на зображення скопійовано.', shareFailed: 'Не вдалося поділитися.' }
  } as const)[locale as 'en' | 'it' | 'nl' | 'ru' | 'ar' | 'hi' | 'tr' | 'pl' | 'th' | 'sv' | 'uk'] ?? { saved: 'Image saved.', saveFailed: 'Could not save the image. Please try again.', shared: 'Share sheet opened.', copied: 'Result image link copied.', shareFailed: 'Could not complete sharing.' };
  const [mode, setMode] = useState<Mode>(initialMode);
  const [userInputs, setUserInputs] = useState<Record<Mode, string>>({
    figure: '',
    body: '',
    travel: '',
    europe: '',
    proofshot: '',
    kakao: '',
    instagram: '',
    hanbok: '',
    kimono: '',
    outfit: '',
    streamer: '',
    pethuman: '',
    hairstyle: '',
    interior: '',
    animation: '',
    modelcut: '',
    free: ''
  });
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [resultImageUrl, setResultImageUrl] = useState('');
  const [resultPrompt, setResultPrompt] = useState('');
  const [activeProvider, setActiveProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMode, setPaymentMode] = useState<'mock' | 'polar'>('mock');
  const [isPolarBaseReady, setIsPolarBaseReady] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [shouldAutoGenerateAfterPayment, setShouldAutoGenerateAfterPayment] = useState(false);
  const [resultActionMessage, setResultActionMessage] = useState('');
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [providerReadiness, setProviderReadiness] = useState<Record<Provider, boolean>>({
    openai: true,
    xai: true
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeContent = modeContentMap[mode];
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
        setPaymentMode(payload.paymentMode === 'polar' ? 'polar' : 'mock');
        setIsPolarBaseReady(payload.paymentMode === 'polar' ? Boolean(payload.paymentProducts?.base) : true);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    void (async () => {
      const raw = window.sessionStorage.getItem(AI_IMAGE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as SavedDraft;
        const restoredFile = await dataUrlToFile(
          saved.imageDataUrl,
          saved.imageName,
          saved.imageType,
          saved.imageLastModified
        );
        if (cancelled) return;
        if (lockMode && saved.mode !== initialMode) return;
        setMode(saved.mode);
        setUserInputs((current) => ({ ...current, ...saved.userInputs }));
        setUploadedImage(restoredFile);
      } catch {
        window.sessionStorage.removeItem(AI_IMAGE_DRAFT_STORAGE_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !API_BASE) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    if (!orderId) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/order/${encodeURIComponent(orderId)}`);
        const payload = await response.json().catch(() => null) as OrderResponse | null;
        if (!response.ok || cancelled) return;
        if (payload?.status === 'paid') {
          setIsPaid(true);
          setCurrentOrderId(orderId);
          setShouldAutoGenerateAfterPayment(true);
        }
      } catch {
        // Keep the page usable even if order verification fails.
      } finally {
        if (!cancelled) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  useEffect(() => {
    if (typeof window === 'undefined' || !API_BASE) return;
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');
    if (!jobId) return;

    let cancelled = false;

    void (async () => {
      try {
        const job = await pollAiImageJob(jobId);
        if (cancelled) return;
        setResultPrompt(job.revisedPrompt || job.prompt || '');
        setResultImageUrl(resolveResultUrl(job.imageUrl || ''));
        setIsModalOpen(true);
        setGenerationPhase('done');
      } catch {
        // Ignore invalid result links and keep the page usable.
      } finally {
        if (!cancelled) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  useEffect(() => {
    if (!shouldAutoGenerateAfterPayment || !uploadedImage || generationPhase !== 'idle') return;
    setShouldAutoGenerateAfterPayment(false);
    void handleGenerate(DEFAULT_PROVIDER);
  }, [shouldAutoGenerateAfterPayment, uploadedImage, generationPhase]);

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

  const persistDraftForCheckout = async () => {
    if (typeof window === 'undefined' || !uploadedImage) return;
    const draft: SavedDraft = {
      mode,
      userInputs,
      imageName: uploadedImage.name,
      imageType: uploadedImage.type,
      imageLastModified: uploadedImage.lastModified,
      imageDataUrl: await fileToDataUrl(uploadedImage)
    };
    window.sessionStorage.setItem(AI_IMAGE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  };

  const requestBaseCheckout = async () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const response = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productType: 'base',
        amount: AI_IMAGE_PRICE_CENTS,
        currency: AI_IMAGE_CURRENCY,
        successUrl: currentUrl,
        returnUrl: currentUrl
      })
    });
    const payload = await response.json().catch(() => null) as CheckoutResponse | null;
    if (!response.ok || !payload) {
      throw new Error(payload?.error ?? 'checkout failed');
    }
    return payload;
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

    if (paymentMode === 'polar') {
      if (!isPolarBaseReady) {
        setIsModalOpen(true);
        setGenerationPhase('error');
        setErrorMessage('Polar base product is not configured yet.');
        return;
      }
      if (!isPaid) {
        try {
          await persistDraftForCheckout();
          const checkout = await requestBaseCheckout();
          if (checkout.paid) {
            setIsPaid(true);
            setCurrentOrderId(checkout.orderId ?? null);
          } else if (checkout.checkoutUrl) {
            window.location.href = checkout.checkoutUrl;
            return;
          } else {
            throw new Error('checkout url is missing');
          }
        } catch (error) {
          setIsModalOpen(true);
          setGenerationPhase('error');
          setErrorMessage(error instanceof Error ? error.message : 'Failed to start checkout.');
          return;
        }
      }
    }

    setActiveProvider(provider);
    setIsModalOpen(true);
    setGenerationPhase('payment');
    setResultImageUrl('');
    setResultPrompt('');
    setIsPromptExpanded(false);
    setErrorMessage('');

    try {
      await sleep(PAYMENT_DELAY_MS);
      setGenerationPhase('generating');

      const formData = new FormData();
      formData.append('image', uploadedImage);
      formData.append('provider', provider);
      formData.append('mode', mode);
      formData.append('userInput', safeInput);
      if (currentOrderId) {
        formData.append('orderId', currentOrderId);
      }

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
      setResultImageUrl(resolveResultUrl(job.imageUrl || ''));
      setGenerationPhase('done');
      if (paymentMode === 'polar') {
        setIsPaid(false);
        setCurrentOrderId(null);
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(AI_IMAGE_DRAFT_STORAGE_KEY);
      }
    } catch (error) {
      setGenerationPhase('error');
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const heroImages = useMemo(
    () => (heroImageUrls?.length ? heroImageUrls : samplesForMode(mode)?.map(sampleThumb) ?? SLA_HERO_IMAGES),
    [mode, heroImageUrls]
  );

  useEffect(() => {
    if (generationPhase !== 'generating' && generationPhase !== 'payment') {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [generationPhase]);

  const useStyleFromGallery = (nextMode: Mode) => {
    setMode(nextMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setGenerationPhase('idle');
    setErrorMessage('');
    setResultActionMessage('');
    setIsPromptExpanded(false);
  };

  const handleDownloadResult = async () => {
    if (!resultImageUrl) return;
    try {
      const response = await fetch(resultImageUrl);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `manytool-ai-${mode}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setResultActionMessage(feedbackCopy.saved);
    } catch {
      setResultActionMessage(feedbackCopy.saveFailed);
    }
  };

  const handleShareResult = async () => {
    if (!resultImageUrl || typeof window === 'undefined') return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ManyTool AI Result',
          text: 'ManyTool AI로 생성한 이미지입니다.',
          url: resultImageUrl
        });
        setResultActionMessage(feedbackCopy.shared);
        return;
      }
      await navigator.clipboard.writeText(resultImageUrl);
      setResultActionMessage(feedbackCopy.copied);
    } catch {
      setResultActionMessage(feedbackCopy.shareFailed);
    }
  };

  const handleShareResultV2 = async () => {
    if (!resultImageUrl || typeof window === 'undefined') return;
    const sharePageUrl = window.location.href;
    const shareText = `ManyTool AI result\nPage: ${sharePageUrl}\nImage: ${resultImageUrl}`;
    try {
      if (navigator.share) {
        try {
          const response = await fetch(resultImageUrl);
          if (!response.ok) throw new Error('share download failed');
          const blob = await response.blob();
          const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
          const file = new File([blob], `manytool-ai-${mode}.${extension}`, { type: blob.type || 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'ManyTool AI Result',
              text: `ManyTool AI generated image\n${sharePageUrl}`,
              files: [file]
            });
            setResultActionMessage(feedbackCopy.shared);
            return;
          }
        } catch {
          // Fall back to page link sharing.
        }
        await navigator.share({
          title: 'ManyTool AI Result',
          text: shareText,
          url: sharePageUrl
        });
        setResultActionMessage(feedbackCopy.shared);
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setResultActionMessage(feedbackCopy.copied);
    } catch {
      setResultActionMessage(feedbackCopy.shareFailed);
    }
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#fffaf5_0%,_#fff_42%,_#f8fafc_100%)] pb-40 text-slate-900">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className={`${lockMode ? 'hidden' : ''} rounded-[28px] border border-white/70 bg-white/85 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur`}>
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{uiLabels.mode}</span>
            <span className="text-xs font-medium text-slate-500">{modeContentMap[mode].tabLabel}</span>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none sm:hidden">
            {MODE_ORDER.map((tabMode) => {
              const tabContent = modeContentMap[tabMode];
              const isActive = mode === tabMode;
              return (
                <button
                  key={tabMode}
                  type="button"
                  onClick={() => setMode(tabMode)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition duration-200 ${
                    isActive
                      ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {tabContent.tabLabel}
                </button>
              );
            })}
          </div>

          <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            {MODE_ORDER.map((tabMode) => {
              const tabContent = modeContentMap[tabMode];
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
              {ENGINE_LABEL}
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{activeContent.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{activeContent.exampleDescription}</p>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 xl:gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="min-w-0 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6 lg:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{generatorCopy.upload}</h2>
                <p className="mt-1 text-sm text-slate-500">{generatorCopy.uploadHint}</p>
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
              className={`group flex min-w-0 min-h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed px-4 py-6 text-center transition sm:min-h-[300px] sm:px-6 sm:py-8 lg:min-h-[340px] xl:min-h-[360px] xl:py-10 ${
                isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              {previewUrl ? (
                  <div className="flex min-w-0 w-full flex-col items-center gap-4">
                  <div className={`${imageFrameClass} min-h-[170px] w-full sm:min-h-[280px] lg:min-h-[340px] xl:min-h-[420px]`}>
                    <img src={previewUrl} alt="업로드 미리보기" className={`${imageClass} max-h-[170px] rounded-[18px] sm:max-h-[250px] lg:max-h-[310px] xl:max-h-[388px]`} />
                  </div>
                  <div className="flex min-w-0 w-full flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-between">
                    <div className="min-w-0 w-full text-center sm:text-left">
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
                      {generatorCopy.change}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition group-hover:scale-105">
                    {isDragging ? <UploadCloud className="h-9 w-9" /> : <ImagePlus className="h-9 w-9" />}
                  </div>
                  <h3 className="text-xl font-bold text-slate-950">{generatorCopy.uploadPrompt}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                    {mode === 'modelcut'
                      ? '옷 전체가 잘 보이는 바닥컷·행거컷·마네킹컷을 올려주세요. 색상·패턴·로고를 그대로 살려 AI 모델에게 입혀 드립니다.'
                      : '얼굴이 잘 보이는 사진일수록 결과가 안정적입니다. 먼저 얼굴 품질을 보정하고 이후 최종 스타일을 적용합니다.'}
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
              {!activeContent.inputRequired ? (
                <p className="mt-1 text-[11px] leading-5 text-amber-700">
                  {locale === 'ko' ? '짧은 프롬프트가 더 잘 나옵니다. 긴 프롬프트는 품질이 오히려 떨어질 수 있습니다.' : 'Short prompts work better. Long prompts can reduce quality.'}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="min-w-0 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6 lg:p-7">
            <div className="mb-5">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">예시 미리보기</h2>
            </div>

            <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-100 via-white to-orange-50 p-3">
              <div className="relative min-h-[260px] rounded-[24px] bg-white/75 p-3 sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[420px] sm:p-4">
                <div className="absolute left-4 top-4 z-10 rounded-full border border-white/70 bg-slate-950/78 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  ManyTool AI Picks
                </div>
                <Swiper
                  key={mode}
                  modules={[Autoplay, Pagination]}
                  slidesPerView={1}
                  loop={heroImages.length > 1}
                  autoplay={{
                    delay: 2800,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                  }}
                  pagination={{ clickable: true }}
                  className="promo-swiper h-full"
                >
                  {heroImages.map((image, index) => (
                    <SwiperSlide key={image}>
                      <div className="flex min-h-[260px] items-center justify-center sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[420px]">
                        <img
                          src={image}
                          alt={`ManyTool AI promo preview ${index + 1}`}
                          loading={index === 0 ? 'eager' : 'lazy'}
                          onError={(event) => {
                            event.currentTarget.src = exampleImage;
                          }}
                          className={`${imageClass} max-h-[220px] rounded-[24px] shadow-[0_24px_50px_rgba(15,23,42,0.14)] sm:max-h-[280px] lg:max-h-[320px] xl:max-h-[388px]`}
                        />
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">How it works</p>
                <ol className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[['📷', '사진 업로드'], ['🪄', '얼굴 보정'], ['🖼️', '스타일 완성']].map(([icon, label], index) => (
                    <li key={label} className="rounded-2xl bg-white px-2 py-3 shadow-sm">
                      <span className="block text-xl">{icon}</span>
                      <span className="mt-1 block text-[11px] font-bold text-slate-700">{index + 1}. {label}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  얼굴 디테일을 먼저 보정한 뒤 최종 스타일을 입혀요. 마지막 단계가 실패하면 자동으로 한 번 더 시도해요.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">ManyTool AI</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {activeContent.exampleDescription}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {locale === 'en' ? 'Discount code: manytool50' : '할인코드: manytool50'}
                </p>
              </div>
            </div>
          </aside>
        </section>

        {lockMode ? null : <AiSampleGallery title={uiLabels.moreExamples} onUseStyle={useStyleFromGallery} locale={locale} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/92 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!uploadedImage || !providerReadiness[DEFAULT_PROVIDER] || (paymentMode === 'polar' && !isPolarBaseReady)}
            onClick={() => {
              void handleGenerate(DEFAULT_PROVIDER);
            }}
            className={`flex-1 rounded-[22px] px-6 py-4 text-base font-bold text-white shadow-[0_20px_45px_rgba(15,23,42,0.18)] transition sm:text-lg ${
              !uploadedImage || !providerReadiness[DEFAULT_PROVIDER] || (paymentMode === 'polar' && !isPolarBaseReady)
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-gradient-to-r from-slate-950 via-slate-800 to-slate-700 hover:scale-[1.01]'
            }`}
          >
            {providerReadiness[DEFAULT_PROVIDER] ? `${ENGINE_LABEL}로 ${activeContent.buttonLabel}` : `${ENGINE_LABEL} 준비 중`}
          </button>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 px-4 py-4 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[32px] bg-white p-6 shadow-[0_40px_100px_rgba(15,23,42,0.32)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">처리 상태</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {locale === 'ko' ? '할인코드: manytool50' : 'Discount code: manytool50'}
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {generationPhase === 'payment' && `${PROVIDER_LABELS[activeProvider]} 요청 준비 중`}
                  {generationPhase === 'generating' && `${PROVIDER_LABELS[activeProvider]} ${statusCopy.generating}`}
                  {generationPhase === 'done' && statusCopy.done}
                  {generationPhase === 'error' && statusCopy.failed}
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
                {generationPhase === 'generating' ? (
                  <ol className="mt-6 w-full max-w-xs space-y-2 text-left">
                    {GENERATION_STEPS.map((step, index) => {
                      const current = GENERATION_STEPS.filter((item) => elapsedSeconds >= item.afterSeconds).length - 1;
                      const state = index < current ? 'done' : index === current ? 'active' : 'todo';
                      return (
                        <li key={step.label} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${state === 'active' ? 'bg-white shadow-sm' : ''}`}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-slate-950 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {state === 'done' ? <Check className="h-4 w-4" /> : state === 'active' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : index + 1}
                          </span>
                          <span>
                            <span className={`block text-sm font-bold ${state === 'todo' ? 'text-slate-400' : 'text-slate-900'}`}>{step.label}</span>
                            {state === 'active' ? <span className="block text-xs text-slate-500">{step.detail}</span> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                <p className="mt-4 text-xs font-semibold text-slate-400">{elapsedSeconds}초 경과 · 보통 30초~1분 걸려요</p>
              </div>
            )}

            {generationPhase === 'done' && resultImageUrl && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Engine</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{ENGINE_LABEL}</p>
                  </div>
                  <div className={`rounded-full bg-gradient-to-r ${activeContent.accentClass} px-3 py-1 text-xs font-black text-white shadow-sm`}>
                    {activeContent.tabLabel} 완성
                  </div>
                </div>
                <div className="flex min-h-[260px] sm:min-h-[360px] items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-4">
                  {previewUrl ? (
                    <div className="relative w-full max-w-[360px] overflow-hidden rounded-[20px]">
                      <img src={resultImageUrl} alt="생성 결과" className="block h-auto w-full" />
                      <img
                        src={previewUrl}
                        alt="원본 사진"
                        className="absolute inset-0 h-full w-full object-cover"
                        style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
                      />
                      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${compareSplit}%` }} />
                      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">BEFORE</span>
                      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">AFTER</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={compareSplit}
                        onChange={(event) => setCompareSplit(Number(event.target.value))}
                        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                        aria-label="원본과 결과 비교"
                      />
                    </div>
                  ) : (
                    <img src={resultImageUrl} alt="생성 결과" className={`${imageClass} max-h-[240px] sm:max-h-[328px] rounded-[20px]`} />
                  )}
                </div>
                {previewUrl ? <p className="-mt-2 text-center text-xs text-slate-400">이미지를 좌우로 밀면 원본과 비교할 수 있어요</p> : null}
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-700">{generatorCopy.ready}</p>
                  <p className="mt-1 text-sm text-emerald-600">{generatorCopy.saveHint}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { void handleDownloadResult(); }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" />
                    {generatorCopy.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleShareResultV2(); }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
                  >
                    <Share2 className="h-4 w-4" />
                    {generatorCopy.share}
                  </button>
                </div>
                {resultActionMessage ? (
                  <p className="text-center text-xs font-medium text-slate-500">{resultActionMessage}</p>
                ) : null}
                <div className={`${lockMode ? 'hidden' : ''} rounded-3xl border border-slate-200 bg-white px-4 py-3`}>
                  <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5" />
                    같은 사진으로 다른 스타일 만들기
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_SWITCH_MODES.filter((item) => item !== mode).slice(0, 5).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => { setMode(item); closeModal(); }}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-900 hover:bg-white"
                      >
                        {modeContentMap[item].tabLabel}
                      </button>
                    ))}
                  </div>
                </div>
                {resultPrompt ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setIsPromptExpanded((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt</p>
                      <span className="text-xs font-semibold text-slate-500">{isPromptExpanded ? 'Hide' : 'Show'}</span>
                    </button>
                    <p className={`mt-2 break-words text-sm leading-6 ${isPromptExpanded ? 'text-slate-600' : 'line-clamp-2 text-slate-500'}`}>
                      {resultPrompt}
                    </p>
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
