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
    garment: pic('sample-02-garment.webp'),
    model: pic('sample-02-model.webp'),
    useCase: 'shop',
    label: '보아 플리스 재킷 · 커플 모델',
    labelEn: 'Sherpa fleece jacket · couple models'
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
