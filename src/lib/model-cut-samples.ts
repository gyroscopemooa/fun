// AI model-cut before/after samples shown on /ai-model-cut.
// To add one: put the garment photo and the generated result in public/pic/model-cut/ (webp, ~1000px wide)
// and append an entry below. `useCase` picks which promo section it appears under.
// (public/pic is gitignored, so commit new files with `git add -f`.)

export type ModelCutUseCase = 'shop' | 'tryon';

export type ModelCutSample = {
  garment: string;
  model: string;
  useCase: ModelCutUseCase;
  label: string;
  labelEn: string;
};

const pic = (file: string) => `/pic/model-cut/${file}`;

export const MODEL_CUT_SAMPLES: ModelCutSample[] = [
  {
    garment: '/images/product-model/women-01-garment.webp',
    model: '/images/product-model/women-01-model.webp',
    useCase: 'shop',
    label: '스트라이프 리본 프릴 원피스 · 여성 모델',
    labelEn: 'Striped bow and ruffle dress · female model'
  },
  {
    garment: '/images/product-model/women-02-garment.webp',
    model: '/images/product-model/women-02-model.webp',
    useCase: 'shop',
    label: '그레이 레이스 숄더 니트 원피스 · 여성 모델',
    labelEn: 'Gray knit dress with lace straps · female model'
  },
  {
    garment: '/images/product-model/women-03-garment.webp',
    model: '/images/product-model/women-03-model.webp',
    useCase: 'tryon',
    label: '아이보리 리본 원피스 · 여성 데일리 코디',
    labelEn: 'Ivory bow dress · everyday outfit on a female model'
  },
  {
    garment: '/images/product-model/women-04-garment.webp',
    model: '/images/product-model/women-04-model.webp',
    useCase: 'tryon',
    label: '아이보리 리본 스트랩 니트 · 여성 청바지 코디',
    labelEn: 'Ivory knit top with bow straps · jeans outfit on a female model'
  },
  {
    garment: pic('sample-02-garment.webp'),
    model: pic('sample-02-model.webp'),
    useCase: 'shop',
    label: '보아 플리스 재킷 (베이지) · 커플 모델',
    labelEn: 'Sherpa fleece jacket (beige) · couple models'
  },
  {
    garment: pic('sample-03-garment.webp'),
    model: pic('sample-03-model.webp'),
    useCase: 'shop',
    label: '보아 플리스 재킷 (네이비) · 커플 모델',
    labelEn: 'Sherpa fleece jacket (navy) · couple models'
  },
  {
    garment: pic('sample-01-garment.webp'),
    model: pic('sample-01-model.webp'),
    useCase: 'shop',
    label: '프린팅 맨투맨 · 남성 모델',
    labelEn: 'Printed sweatshirt · male model'
  }
];

export const modelCutSamplesFor = (useCase: ModelCutUseCase) => MODEL_CUT_SAMPLES.filter((sample) => sample.useCase === useCase);
