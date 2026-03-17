import path from 'node:path';
import fs from 'node:fs/promises';
import OpenAI, { toFile } from 'openai';

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1';
const XAI_IMAGE_MODEL = process.env.XAI_IMAGE_MODEL?.trim() || 'grok-imagine-image';
const OUTPUT_SIZE = '1024x1536';
const MAX_USER_INPUT_LENGTH = 50;

const MODE_PRESETS = {
  figure: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'convert this person into a collectible action figure,',
      'keep the exact same face,',
      'toy plastic texture,',
      'realistic action figure body,',
      'military uniform,',
      'high detail accessories,',
      'packaged in a premium retail box,',
      'clear plastic blister packaging,',
      'product photography,',
      'studio lighting,',
      'sharp focus,',
      'glossy surface,',
      '8k detail,',
      'no face distortion',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  body: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'convert this person into a premium body profile photoshoot,',
      'keep the exact same face,',
      'professional fitness photoshoot,',
      'athletic muscular body,',
      'natural skin texture,',
      'studio lighting,',
      'sharp focus,',
      'realistic proportions,',
      'high-end fitness photography,',
      'detailed muscle definition,',
      'clean background,',
      'no face distortion',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  animation: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'convert this person into a high-quality animation character,',
      'keep the exact same face,',
      'clean anime-inspired character design,',
      'polished linework,',
      'cinematic character illustration,',
      'stylized but realistic facial identity,',
      'vibrant colors,',
      'sharp eyes,',
      'clean shading,',
      'sharp focus,',
      'premium character artwork,',
      'no face distortion',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  free: {
    requiresUserInput: true,
    stageTwoPrompt: (userInput) => [
      `convert this person into ${userInput},`,
      'keep exact face,',
      'high detail,',
      'realistic toy or character style,',
      'product quality,',
      'no distortion'
    ].join(' ')
  }
};

const SUPPORTED_PROVIDERS = ['openai', 'xai'];

const UNSAFE_PATTERNS = [
  /\b(nsfw|nude|nudity|explicit|gore|blood|violence|weapon|kill|hate|porn)\b/gi,
  /[<>{}[\]$`|\\]/g
];

let openAiClient = null;
let xaiClient = null;

const getOpenAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  openAiClient ??= new OpenAI({ apiKey });
  return openAiClient;
};

const getXaiClient = () => {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error('XAI_API_KEY is missing');
  xaiClient ??= new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  });
  return xaiClient;
};

const bufferToDataUrl = (buffer, mimeType) => `data:${mimeType};base64,${buffer.toString('base64')}`;

const ensureOk = async (response, label) => {
  if (response.ok) return;
  const detail = await response.text().catch(() => '');
  throw new Error(`${label} failed: ${response.status} ${detail}`.trim());
};

const decodeImageResult = async (result, label) => {
  const generated = result?.data?.[0];
  const b64 = generated?.b64_json;
  if (typeof b64 === 'string' && b64) {
    return {
      buffer: Buffer.from(b64, 'base64'),
      revisedPrompt: generated?.revised_prompt ?? null
    };
  }

  const url = generated?.url;
  if (typeof url === 'string' && url) {
    const response = await fetch(url);
    await ensureOk(response, `${label} image download`);
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      revisedPrompt: generated?.revised_prompt ?? null
    };
  }

  throw new Error(`${label} did not include b64_json or url`);
};

export const assertMode = (mode) => {
  if (typeof mode === 'string' && Object.hasOwn(MODE_PRESETS, mode)) return mode;
  throw new Error('invalid mode');
};

export const assertProvider = (provider) => {
  if (typeof provider === 'string' && SUPPORTED_PROVIDERS.includes(provider)) return provider;
  throw new Error('invalid provider');
};

export const sanitizeUserInput = (userInput = '') => {
  let text = String(userInput).trim().slice(0, MAX_USER_INPUT_LENGTH);
  for (const pattern of UNSAFE_PATTERNS) {
    text = text.replace(pattern, ' ');
  }
  return text.replace(/\s+/g, ' ').trim();
};

export const getModeOptions = () => Object.keys(MODE_PRESETS);
export const getProviderOptions = () => [...SUPPORTED_PROVIDERS];

const buildStageOnePrompt = () => [
  'ultra realistic portrait of a Korean male,',
  'perfect symmetrical face,',
  'sharp eyes,',
  'natural skin texture,',
  'real human proportions,',
  'studio lighting,',
  '8k detail,',
  'highly detailed face,',
  'no distortion,',
  'no extra limbs,',
  'correct anatomy'
].join(' ');

const buildStageTwoPrompt = (mode, userInput) => MODE_PRESETS[mode].stageTwoPrompt(userInput);

export const generatePrompt = (mode, userInput = '') => {
  const safeMode = assertMode(mode);
  const safeInput = sanitizeUserInput(userInput);
  return {
    stageOnePrompt: buildStageOnePrompt(),
    stageTwoPrompt: buildStageTwoPrompt(safeMode, safeInput)
  };
};

const editWithOpenAi = async ({ imageBuffer, mimeType, fileName, prompt }) => {
  const uploadable = await toFile(imageBuffer, fileName, { type: mimeType });
  const response = await getOpenAiClient().images.edit({
    model: OPENAI_IMAGE_MODEL,
    image: uploadable,
    prompt,
    size: OUTPUT_SIZE,
    quality: 'medium',
    output_format: 'png',
    background: 'opaque',
    input_fidelity: 'high'
  });
  return decodeImageResult(response, 'OpenAI image edit');
};

const editWithXai = async ({ imageBuffer, mimeType, prompt }) => {
  const response = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY?.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: XAI_IMAGE_MODEL,
      image: {
        type: 'image_url',
        url: bufferToDataUrl(imageBuffer, mimeType)
      },
      prompt,
      response_format: 'b64_json'
    })
  });
  await ensureOk(response, 'xAI image edit');
  const payload = await response.json();
  return decodeImageResult(payload, 'xAI image edit');
};

const editImage = async ({ provider, imageBuffer, mimeType, fileName, prompt }) => {
  if (provider === 'openai') {
    return editWithOpenAi({ imageBuffer, mimeType, fileName, prompt });
  }
  if (provider === 'xai') {
    return editWithXai({ imageBuffer, mimeType, prompt });
  }
  throw new Error('unsupported provider');
};

const generateStageOnePortrait = async ({ provider, imageBuffer, mimeType, originalFilename }) => (
  editImage({
    provider,
    imageBuffer,
    mimeType,
    fileName: originalFilename || 'source-stage-one.jpg',
    prompt: buildStageOnePrompt()
  })
);

const generateStageTwoImage = async ({ provider, mode, portraitBuffer, userInput, retryCount = 1 }) => {
  const prompt = buildStageTwoPrompt(mode, userInput);
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const result = await editImage({
        provider,
        imageBuffer: portraitBuffer,
        mimeType: 'image/png',
        fileName: `portrait-${mode}-stage-two.png`,
        prompt
      });
      return {
        ...result,
        attempts: attempt + 1,
        prompt
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('stage two image generation failed');
};

export const generateAiImage = async ({
  provider = 'openai',
  mode,
  userInput = '',
  imageBuffer,
  mimeType,
  originalFilename,
  outputDir,
  id
}) => {
  const safeProvider = assertProvider(provider);
  const safeMode = assertMode(mode);
  const safeUserInput = sanitizeUserInput(userInput);
  const modeConfig = MODE_PRESETS[safeMode];
  if (modeConfig.requiresUserInput && !safeUserInput) {
    throw new Error('userInput is required for free mode');
  }

  if (safeProvider === 'openai') {
    getOpenAiClient();
  } else {
    getXaiClient();
  }

  const stageOne = await generateStageOnePortrait({
    provider: safeProvider,
    imageBuffer,
    mimeType,
    originalFilename
  });

  const stageTwo = await generateStageTwoImage({
    provider: safeProvider,
    mode: safeMode,
    portraitBuffer: stageOne.buffer,
    userInput: safeUserInput,
    retryCount: 1
  });

  const outputFileName = `${id}-${safeProvider}-${safeMode}.png`;
  const outputPath = path.join(outputDir, outputFileName);
  await fs.writeFile(outputPath, stageTwo.buffer);

  return {
    provider: safeProvider,
    mode: safeMode,
    userInput: safeUserInput,
    prompt: stageTwo.prompt,
    revisedPrompt: stageTwo.revisedPrompt,
    stageOnePrompt: buildStageOnePrompt(),
    stageOneRevisedPrompt: stageOne.revisedPrompt,
    retryCount: stageTwo.attempts,
    fileName: outputFileName,
    filePath: outputPath
  };
};
