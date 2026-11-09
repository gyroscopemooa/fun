import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import OpenAI, { toFile } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { normalizeIdPhotoStyling, groomingPrompt, beautyPrompt } from './idPhotoStyling.js';
import { VARIANT_PROFILES, getToolPreset } from './pipelineConfig.js';

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';
const OUTPUT_SIZE = '1024x1536';
const CANDIDATE_COUNT = VARIANT_PROFILES.length;

let client = null;
const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  client ??= new OpenAI({ apiKey, timeout: 240_000, maxRetries: 0 });
  return client;
};

const IDENTITY_RULES = [
  'The uploaded image is a photo of a real person. The result must be the SAME person and clearly recognizable as them.',
  'IDENTITY (highest priority): keep the exact face shape, eyes, eyelids, nose, mouth, eyebrows, ears, skin tone, moles, age and gender. Preserve the real hairline and hair color; hair arrangement follows the selected grooming options.',
  'Do not beautify, slim, reshape, de-age or change any facial feature. Do not swap the face.'
];

const OUTFIT_RULES = {
  suit: 'Dress the person in a neat, well-fitted dark navy business suit jacket over a crisp white shirt (a simple dark tie for men, an open collar blouse for women), with natural fit and folds.',
  current: 'Keep the person\'s original clothing exactly: same garment, neckline, color and pattern. Do not add a suit, jacket, shirt, blouse or tie. Only tidy obvious wrinkles.'
};

const TOOL_PROMPTS = {
  id_photo: [
    'Create a Korean ID photo (증명사진) for a resume or student card.',
    'Face the camera straight on, head level, neutral expression with mouth closed or a very slight natural smile, both eyes open.',
    'Correct mild head yaw, pitch and roll so the face and shoulders face the camera directly. Keep the actual person\'s facial proportions and natural asymmetry; do not invent a different face.',
    'Frame head and top of shoulders, head centered horizontally, eyes about 40% from the top, some empty space above the head.',
    'Plain pure white background with no shadows or texture. Even soft studio lighting, sharp focus.',
    'Light natural retouching only: even out skin tone and remove temporary blemishes. Hair grooming follows the selected options.'
  ],
  passport_photo: [
    'Create a passport-style photo.',
    'Face the camera straight on, head level, neutral expression, mouth closed, both eyes open and clearly visible, no head tilt.',
    'Frame head and top of shoulders, head centered horizontally, eyes about 42% from the top, some empty space above the head.',
    'Plain pure white background with no shadows. Even, shadow-free front lighting, sharp focus.',
    'Do not retouch the face or skin at all. Only fix the background, lighting and pose. No accessories covering the face.'
  ],
  headshot: [
    'Create a professional business headshot for LinkedIn, a resume or a company profile.',
    'Natural confident expression with a slight smile, facing the camera or turned very slightly.',
    'Frame head and shoulders, head centered horizontally, eyes about 36% from the top.',
    'Soft light gray seamless studio background, flattering soft studio lighting, sharp focus, true-to-life colors.',
    'Subtle natural retouching only: even skin tone, tidy hair. Keep real skin texture.'
  ]
};

export const buildPrompt = (toolType, outfitType, styling = {}) => {
  const normalized = toolType === 'id_photo' ? normalizeIdPhotoStyling(styling) : null;
  const passportStyle = normalized?.groomingMode === 'passport';
  const toolRules = (TOOL_PROMPTS[toolType] ?? TOOL_PROMPTS.id_photo).filter((rule) =>
    !rule.startsWith('Light natural retouching') && (!passportStyle || !rule.startsWith('Face the camera'))
  );
  return [
    ...IDENTITY_RULES.filter((rule) => !normalized?.retouchEnabled || !rule.startsWith('Do not beautify')).map((rule) => normalized?.beautyOptions.contour ? rule.replace('exact face shape,', 'recognizable facial structure,') : rule),
    ...toolRules,
    ...(normalized ? [groomingPrompt(normalized), beautyPrompt(normalized)] : ['Preserve the original hairstyle.']),
    'Keep hands and distracting objects out of the final head-and-shoulders crop. If the face is partly obscured, reconstruct conservatively from visible features; never substitute a different person.',
    OUTFIT_RULES[normalized?.fullPackage ? 'suit' : outfitType] ?? OUTFIT_RULES.current,
    'Photorealistic photograph, not an illustration. No text, no watermark, no frame, no extra people.'
  ].join(' ');
};

const decodeImages = async (response) => Promise.all((response?.data ?? []).map(async (item) => {
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`image download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('OpenAI image edit returned no image');
}));

export async function generateWithOpenAiImage({ inputPath, storageDir, jobId, toolType, outfitType, groomingMode, hairOptions, retouchEnabled, fullPackage, beautyOptions }) {
  const startedAt = Date.now();
  const preset = getToolPreset(toolType);
  const prompt = buildPrompt(toolType, outfitType, { groomingMode, hairOptions, retouchEnabled, fullPackage, beautyOptions });

  // Normalize orientation and size before upload; phone photos are often huge and EXIF-rotated.
  const source = await sharp(await fs.readFile(inputPath))
    .rotate()
    .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();

  const response = await getClient().images.edit({
    model: OPENAI_IMAGE_MODEL,
    image: await toFile(source, 'portrait.jpg', { type: 'image/jpeg' }),
    prompt,
    n: CANDIDATE_COUNT,
    size: OUTPUT_SIZE,
    quality: 'medium',
    output_format: 'png',
    background: 'opaque',
    // Only the gpt-image-1 family accepts input_fidelity; newer models reject it.
    ...(/^gpt-image-1(\.|$|-)/.test(OPENAI_IMAGE_MODEL) ? { input_fidelity: 'high' } : {})
  });
  const images = await decodeImages(response);
  if (!images.length) throw new Error('OpenAI image edit returned no images');
  const generationMs = Date.now() - startedAt;

  const generated = [];
  for (const [index, buffer] of images.entries()) {
    const variant = VARIANT_PROFILES[index]?.name ?? `variant-${index + 1}`;
    const filePath = path.join(storageDir, `${jobId}-${uuidv4().slice(0, 8)}-${variant}.jpg`);
    await sharp(buffer)
      .flatten({ background: preset.background })
      .resize(preset.outputWidth, preset.outputHeight, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 94 })
      .toFile(filePath);
    generated.push({
      variant,
      filePath,
      identityScore: null,
      regenerated: false,
      // No biometric or quality assessment has been performed.
      score: null
    });
  }

  return {
    generated,
    pipelineReport: {
      toolType,
      outfitType,
      ...(toolType === 'id_photo' ? normalizeIdPhotoStyling({ groomingMode, hairOptions, retouchEnabled, fullPackage, beautyOptions }) : {}),
      engine: 'openai_image',
      model: OPENAI_IMAGE_MODEL,
      generatedVariants: generated.map((item) => item.variant),
      recommendedVariant: generated[0]?.variant ?? null,
      variantIdentityScores: {},
      identityRejectedVariants: [],
      identityRegeneratedVariants: [],
      qualityFeedback: [],
      externalBackgroundCall: true,
      cache: {},
      timings: { variants: generationMs, total: Date.now() - startedAt }
    }
  };
}
