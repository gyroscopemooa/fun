import type { AiImageMode } from '@/components/home/AiImageGenerator';

// Past ManyTool AI results in public/pic/SLA (thumbnails in public/pic/SLA/thumbs, 480px webp).
export type AiSampleCategory = 'figure' | 'body' | 'free' | 'animation';

export type AiSample = { file: string; category: AiSampleCategory };

export const AI_SAMPLE_CATEGORIES: { id: AiSampleCategory; label: string; emoji: string; mode: AiImageMode }[] = [
  { id: 'figure', label: '피규어', emoji: '🧸', mode: 'figure' },
  { id: 'body', label: '바디프로필', emoji: '💪', mode: 'body' },
  { id: 'free', label: '자유 스타일', emoji: '🎨', mode: 'free' },
  { id: 'animation', label: '애니메이션', emoji: '✏️', mode: 'animation' }
];

const s = (file: string, category: AiSampleCategory): AiSample => ({ file, category });

export const AI_SAMPLES: AiSample[] = [
  s('a17927fb-1cf3-418e-9662-d6e2fb54430f-xai-free.png', 'free'),
  s('1b31c9c3-4bb2-4b1d-bae9-d9d2ea98b910.png', 'figure'),
  s('b3e2be3e-af5b-4636-a490-130baf41fd5a-xai-body.png', 'body'),
  s('18164267-ff6e-481b-beb5-bafe47b66efa-xai-figure.png', 'figure'),
  s('d5d15693-5c1c-42fb-b187-91686be119e3-xai-free.png', 'free'),
  s('86d3dd4f-08a6-45cf-9a60-1a1bdbe33c26.png', 'body'),
  s('20260318_002527.png', 'figure'),
  s('aecbb8f7-b183-410a-b8b3-8c0d508ee6e2-xai-body.png', 'body'),
  s('b2ba7846-c5f3-4fe2-865c-3e94c090a9ba-xai-free.png', 'free'),
  s('231201a2-9c80-4489-bea5-175f2ac96638-xai-figure.png', 'figure'),
  s('다운로드 (7).png', 'animation'),
  s('2f404c17-3735-4de1-a13d-30e1cc688a1c-openai-body.png', 'body'),
  s('898312d3-4b3e-4ac5-919a-7f79566f5685-xai-free.png', 'free'),
  s('OpenAI Playground 2026-03-18 at 04.30.04.png', 'figure'),
  s('f6e3e3c0-6bc2-438b-bd7f-62182946245f-xai-body.png', 'body'),
  s('2e4f4b92-88a9-4ec7-9afe-dc0e6c1f6fb1-xai-figure.png', 'figure'),
  s('07e91bba-09fb-4d87-a9fd-3980666a7afa-xai-free.png', 'free'),
  s('53376b40-78bb-4a5b-8865-b15a9f7c246c-openai-figure.png', 'figure'),
  s('240c8aed-f1c4-4e78-834d-311f34134f2e-xai-free.png', 'free'),
  s('64a67f1c-b1fc-42b4-b769-9a6f668128d7-xai-figure.png', 'figure'),
  s('3a3bbff5-807c-4526-b39e-6f5acfddc181-xai-free.png', 'free'),
  s('665bb11b-5532-4538-8895-623d215351f4-xai-figure.png', 'figure'),
  s('a27c5acf-fa1f-42f5-bcfd-c832f901fa2f.png', 'free'),
  s('7500c861-ef56-4627-851f-c242795b3537-xai-figure.png', 'figure'),
  s('8b6a2257-d373-48c1-b75e-15e763ab0166-xai-free.png', 'free'),
  s('7b88386d-131e-4a2c-9e7d-d0107c0884b2-xai-figure.png', 'figure'),
  s('a7a40012-a8fd-4806-a99e-9d9e2db2ff7a-xai-figure.png', 'figure'),
  s('e871d594-bc0a-40c9-a468-37603086497d-xai-figure.png', 'figure'),
  s('ea822f90-601b-46b2-b7f5-6a25fe8cbc7c-openai-figure.png', 'figure')
];

export const sampleFull = (sample: AiSample) => `/pic/SLA/${sample.file}`;
export const sampleThumb = (sample: AiSample) => `/pic/SLA/thumbs/${sample.file.replace(/\.(png|jpe?g)$/i, '.webp')}`;
export const categoryOf = (id: AiSampleCategory) => AI_SAMPLE_CATEGORIES.find((item) => item.id === id) ?? AI_SAMPLE_CATEGORIES[0];

/** Samples for the hero carousel: the active mode's category first, then everything else. */
export const samplesForMode = (mode: AiImageMode) => {
  const own = AI_SAMPLES.filter((item) => categoryOf(item.category).mode === mode);
  return own.length ? [...own, ...AI_SAMPLES.filter((item) => !own.includes(item))].slice(0, 8) : null;
};
