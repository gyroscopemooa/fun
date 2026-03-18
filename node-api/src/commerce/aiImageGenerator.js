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
      userInput
        ? `Create a realistic action figure scene that follows this request exactly: ${userInput}.`
        : 'Create a high-quality packaged action figure inside a transparent plastic retail box.',
      'STRICT RULES:',
      'Preserve the original faces and identities exactly.',
      'Preserve gender exactly as in the source image. Never change gender.',
      'Keep all individuals if multiple people are present. Do not merge or remove anyone.',
      'Maintain original facial proportions and likeness with high accuracy.',
      'Outfits must strictly follow the original image unless the user explicitly requests a change.',
      'Do not alter clothing style, do not add uniforms or themed outfits unless requested.',
      'Do not introduce military clothing unless it is clearly present in the source image.',
      'Style: realistic collectible figure style, not exaggerated toy proportions.',
      'Use a natural pose based on the original image.',
      'Accurate anatomy and proportions.',
      'Visual quality: highly detailed, realistic materials, soft studio lighting, clean composition, sharp focus.',
      'Face must remain photorealistic, not plastic-like.',
      'No face distortion, no extra limbs, no deformation.'
    ].join(' ')
  },
  body: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a high-end fitness photoshoot image.',
      'STRICT RULES:',
      'Preserve original faces and identity exactly with high priority.',
      'Do not change gender under any condition.',
      'Keep all individuals if multiple people are present. Do not merge or remove anyone.',
      'Maintain original facial proportions and likeness with high accuracy.',
      'BODY AND STYLE:',
      'Fit, athletic, toned body with realistic proportions, not exaggerated.',
      'Defined muscles but natural anatomy.',
      'Female body must remain feminine and natural.',
      'Male body muscular but realistic, not cartoonish.',
      'CLOTHING:',
      'Female styling: fitted sports bra and fitted shorts or comparable clean fitness wear.',
      'Male styling: shirtless athletic upper body is allowed when non-explicit and clearly fitness-focused, with fitted training shorts or gym bottoms.',
      'Not sexualized, not explicit, but clearly fitness-focused.',
      'Do not add extra clothing layers unless required for policy compliance.',
      'POSE:',
      'Natural couple pose, close and confident, with slight body contact and a professional fitness photoshoot vibe.',
      'VISUAL QUALITY:',
      'Soft studio lighting with subtle rim light, clean white or neutral background, ultra realistic skin texture, sharp focus, high detail.',
      'Modern premium fitness editorial aesthetic, youthful, stylish, contemporary, and visually polished.',
      'IMPORTANT:',
      'Avoid over-stylization.',
      'Avoid toy, figure, or plastic look.',
      'Must look like a real fitness photoshoot, not AI art.',
      'No face distortion, no extra limbs, no deformation.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  travel: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a realistic overseas travel photo based on the uploaded image.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Keep the pose natural and photorealistic.',
      'Change the setting into a stylish overseas travel background with realistic location details.',
      'Use cinematic travel photography, natural lighting, clean composition, and sharp focus.',
      'Do not turn the result into illustration, toy, or AI-art style.',
      'Keep outfits natural unless the user explicitly requests a change.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  europe: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic European travel style image based on the uploaded photo.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Use elegant European city mood, stylish streets, cafes, balconies, or classic travel scenery.',
      'Keep the result natural, modern, cinematic, and realistic.',
      'Avoid illustration, toy look, plastic skin, or face distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  proofshot: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a natural proof-shot style photo that looks like a real candid social snapshot.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Use realistic lighting, natural pose, authentic atmosphere, and photorealistic image quality.',
      'Make it feel like a real uploaded 인증샷, not an illustration or studio render.',
      'Avoid toy look, over-retouching, or face distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  kakao: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a clean and attractive KakaoTalk profile photo.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Use flattering natural portrait lighting and a simple clean background.',
      'Make it look friendly, polished, modern, and photorealistic.',
      'Avoid over-stylization, toy look, or excessive editing.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  instagram: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a trendy Instagram-style lifestyle photo.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Use modern lifestyle editorial styling, flattering lighting, and a polished social-media-ready aesthetic.',
      'Keep the result photorealistic, youthful, stylish, and contemporary.',
      'Avoid illustration, toy look, distortion, or plastic skin.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  hanbok: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic portrait with elegant hanbok styling.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Change clothing into refined traditional or modern hanbok while keeping pose and face natural.',
      'Use premium portrait lighting, graceful composition, realistic fabric detail, and cultural elegance.',
      'Avoid cartoon styling, toy look, or face distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  kimono: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic portrait with elegant kimono styling.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Change clothing into refined traditional or modern kimono while keeping pose and face natural.',
      'Use premium portrait lighting, graceful composition, realistic fabric detail, and elegant Japanese styling.',
      'Avoid cartoon styling, toy look, plastic skin, or face distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  outfit: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic outfit change based on the uploaded image.',
      'Preserve the original faces, identities, gender, body proportions, and all individuals exactly.',
      'Keep the pose and background natural while changing only the clothing into a stylish modern fashion look.',
      'Use realistic fabric, flattering fit, clean fashion photography styling, and sharp detail.',
      'Avoid cartoon styling, toy look, plastic skin, or face distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  streamer: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic streamer promo image based on the uploaded photo.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Use a polished streaming-room aesthetic with a clean desk setup, RGB ambient lighting, monitor glow, and thumbnail-ready composition.',
      'Keep the person attractive, modern, confident, and camera-friendly without turning the image into illustration or AI art.',
      'Avoid military styling, toy look, plastic skin, or facial distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  pethuman: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic humanized portrait inspired by the uploaded pet photo.',
      'Preserve the pet identity through fur color, markings, eye color, expression, and overall personality.',
      'Transform the pet into a believable human character while keeping the result elegant, modern, and realistic.',
      'If multiple pets are present, keep all individuals and do not merge or remove anyone.',
      'Avoid cartoon styling, mascot look, toy proportions, or face distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  hairstyle: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic hairstyle simulation based on the uploaded image.',
      'Preserve the original faces, identities, gender, and all individuals exactly.',
      'Change only the hairstyle while keeping face shape, pose, lighting, and overall mood natural.',
      'Use salon-quality beauty photography, realistic hair texture, flattering shape, and clean detail.',
      'Avoid wig-like plastic texture, cartoon styling, or facial distortion.',
      userInput ? `additional detail: ${userInput}` : null
    ].filter(Boolean).join(' ')
  },
  interior: {
    requiresUserInput: false,
    stageTwoPrompt: (userInput) => [
      'Create a photorealistic interior redesign based on the uploaded room photo.',
      'Preserve the room layout, perspective, major furniture placement, and natural structure as much as possible.',
      'Restyle the room into a polished interior concept such as hotel, cafe, cozy studio, or premium home design.',
      'Use realistic materials, balanced lighting, clean composition, and believable decor changes.',
      'Avoid illustration, toy look, or unrealistic architecture deformation.',
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
  'Create a high-quality realistic image based on the uploaded photo,',
  'preserve the original faces and identities exactly,',
  'do not change gender,',
  'keep all individuals if multiple people are present,',
  'maintain natural skin texture and accurate anatomy,',
  'clean composition, soft natural lighting, sharp focus,',
  'high detail,',
  'no distortion,',
  'no extra limbs'
].join(' ');

const buildOpenAiFigurePrompt = (userInput) => [
  userInput
    ? `Create a modern premium collectible figure scene that follows this request exactly: ${userInput}.`
    : 'Create a modern premium packaged collectible figure inside a transparent plastic retail box.',
  'STRICT RULES:',
  'Preserve the original faces and identities exactly.',
  'Preserve gender exactly as in the source image. Never change gender.',
  'Keep all individuals if multiple people are present. Do not merge or remove anyone.',
  'Maintain original facial proportions and likeness with high accuracy.',
  'Outfits must strictly follow the original image unless the user explicitly requests a change.',
  'Do not alter clothing style, do not add uniforms or themed outfits unless requested.',
  'Do not introduce military clothing unless it is clearly present in the source image.',
  'Style: modern premium collectible figure aesthetic, youthful, stylish, contemporary, and visually polished.',
  'Luxury commercial product photography with trendy contemporary packaging design and upscale collector edition presentation.',
  'Faces should look attractive, youthful, photorealistic, and high-end while still matching the source identity exactly.',
  'Use a natural pose based on the original image.',
  'Accurate anatomy and proportions, not exaggerated toy proportions.',
  'Highly detailed realistic materials, soft studio lighting, subtle rim light, clean composition, sharp focus.',
  'Avoid old-fashioned toy catalog styling, cheap packaging aesthetics, dull colors, or dated product photography.',
  'Face must remain photorealistic, not plastic-like.',
  'No face distortion, no extra limbs, no deformation.'
].join(' ');

const buildStageTwoPrompt = (mode, userInput, provider = 'openai') => {
  if (mode === 'figure' && provider === 'openai') {
    return buildOpenAiFigurePrompt(userInput);
  }
  return MODE_PRESETS[mode].stageTwoPrompt(userInput);
};

const buildBodySafetyFallbackPrompt = (userInput) => [
  'Create a premium fitness editorial photoshoot based on the uploaded image.',
  'Preserve original faces, identity, gender, and all individuals exactly.',
  'Keep the result realistic and photorealistic.',
  'Athletic, toned, healthy physique with natural proportions.',
  'Female styling should use sports bra, fitted shorts, or comparable athletic gym wear when allowed by policy.',
  'Male styling may use a shirtless athletic upper body when non-explicit and clearly fitness-focused, with fitted training shorts.',
  'If policy requires more coverage, use fitted performance gym wear without changing the overall fitness editorial intent.',
  'Natural couple pose, clean studio background, soft studio lighting, sharp focus, realistic skin texture.',
  'Modern, stylish, contemporary fitness campaign aesthetic.',
  'Do not remove any person.',
  'Do not create a toy, figure, or plastic look.',
  'No face distortion, no extra limbs, no deformation.',
  userInput ? `additional detail: ${userInput}` : null
].filter(Boolean).join(' ');

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

const generateWithOpenAi = async ({ prompt }) => {
  const response = await getOpenAiClient().images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size: OUTPUT_SIZE,
    quality: 'high',
    output_format: 'png',
    background: 'opaque'
  });
  return decodeImageResult(response, 'OpenAI image generate');
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

const generateOpenAiBodyImage = async ({ userInput }) => {
  const prompt = buildStageTwoPrompt('body', userInput, 'openai');
  const result = await generateWithOpenAi({ prompt });
  return {
    ...result,
    attempts: 1,
    prompt,
    stageOnePrompt: null,
    stageOneRevisedPrompt: null
  };
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
  const prompt = buildStageTwoPrompt(mode, userInput, provider);
  const fallbackPrompt = mode === 'body' ? buildBodySafetyFallbackPrompt(userInput) : null;
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const activePrompt = (
        mode === 'body'
        && fallbackPrompt
        && lastError instanceof Error
        && /safety|sexual/i.test(lastError.message)
      )
        ? fallbackPrompt
        : prompt;
      const result = await editImage({
        provider,
        imageBuffer: portraitBuffer,
        mimeType: 'image/png',
        fileName: `portrait-${mode}-stage-two.png`,
        prompt: activePrompt
      });
      return {
        ...result,
        attempts: attempt + 1,
        prompt: activePrompt
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

  if (safeProvider === 'openai' && safeMode === 'body') {
    try {
      const generated = await generateOpenAiBodyImage({
        userInput: safeUserInput
      });

      const outputFileName = `${id}-${safeProvider}-${safeMode}.png`;
      const outputPath = path.join(outputDir, outputFileName);
      await fs.writeFile(outputPath, generated.buffer);

      return {
        provider: safeProvider,
        mode: safeMode,
        userInput: safeUserInput,
        prompt: generated.prompt,
        revisedPrompt: generated.revisedPrompt,
        stageOnePrompt: generated.stageOnePrompt,
        stageOneRevisedPrompt: generated.stageOneRevisedPrompt,
        retryCount: generated.attempts,
        fileName: outputFileName,
        filePath: outputPath
      };
    } catch (error) {
      // Fall back to the original edit pipeline when text-to-image fails or produces no usable asset.
    }
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
