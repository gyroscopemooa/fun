import path from 'node:path';
import fs from 'node:fs/promises';
import OpenAI, { toFile } from 'openai';

const MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1';

const PROMPT_PRESETS = {
  figure: {
    base: 'highly detailed collectible action figure, realistic plastic toy texture, 1/6 scale figure, packaged in a retail display box, product photography, studio lighting, sharp focus, highly detailed accessories, premium toy packaging, clean composition',
    styles: {
      boxed: 'inside a transparent retail box with accessories, premium packaging',
      desk: 'placed on a desk environment, miniature toy style',
      studio: 'clean studio product shot, minimal background'
    }
  },
  body: {
    base: 'professional fitness photoshoot, athletic muscular body, natural skin texture, studio lighting, sharp focus, realistic proportions, high-end fitness photography, detailed muscle definition, clean background',
    styles: {
      natural: 'natural lighting, realistic body',
      fitness: 'gym environment, strong lighting',
      competition: 'bodybuilding competition stage lighting, dramatic shadows'
    }
  }
};

const UNSAFE_PATTERNS = [
  /\b(nsfw|nude|nudity|explicit|gore|blood|violence|weapon|kill|hate|porn)\b/gi,
  /[<>{}[\]$`|\\]/g
];

let client = null;

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  client ??= new OpenAI({ apiKey });
  return client;
};

const assertMode = (mode) => {
  if (mode === 'figure' || mode === 'body') return mode;
  throw new Error('invalid mode');
};

const assertStyle = (mode, style) => {
  const modeConfig = PROMPT_PRESETS[mode];
  if (!modeConfig || !modeConfig.styles[style]) {
    throw new Error('invalid style');
  }
  return style;
};

export const sanitizeUserInput = (userInput = '') => {
  let text = String(userInput).trim().slice(0, 50);
  for (const pattern of UNSAFE_PATTERNS) {
    text = text.replace(pattern, ' ');
  }
  return text.replace(/\s+/g, ' ').trim();
};

export const generatePrompt = (mode, style, userInput = '') => {
  const safeMode = assertMode(mode);
  const safeStyle = assertStyle(safeMode, style);
  const modeConfig = PROMPT_PRESETS[safeMode];
  const sanitizedInput = sanitizeUserInput(userInput);
  const parts = [modeConfig.base, modeConfig.styles[safeStyle]];

  if (sanitizedInput) {
    parts.push(`additional detail: ${sanitizedInput}`);
  }

  return parts.join(', ');
};

export const getDefaultStyleForMode = (mode) => (
  mode === 'body' ? 'natural' : 'boxed'
);

export const getPromptStyleOptions = () => ({
  figure: Object.keys(PROMPT_PRESETS.figure.styles),
  body: Object.keys(PROMPT_PRESETS.body.styles)
});

export const generateAiImage = async ({
  mode,
  style,
  userInput = '',
  imageBuffer,
  mimeType,
  originalFilename,
  outputDir,
  id
}) => {
  const safeMode = assertMode(mode);
  const safeStyle = assertStyle(safeMode, style || getDefaultStyleForMode(safeMode));
  const prompt = generatePrompt(safeMode, safeStyle, userInput);
  const extension = mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
  const uploadable = await toFile(imageBuffer, originalFilename || `source.${extension}`, { type: mimeType });

  const response = await getClient().images.edit({
    model: MODEL,
    image: uploadable,
    prompt,
    size: '1024x1536',
    quality: 'medium',
    output_format: 'png',
    background: 'opaque',
    input_fidelity: 'high'
  });

  const generated = response?.data?.[0];
  const b64 = generated?.b64_json;
  if (!b64) {
    throw new Error('OpenAI image response did not include b64_json');
  }

  const outputFileName = `${id}-${safeMode}.png`;
  const outputPath = path.join(outputDir, outputFileName);
  await fs.writeFile(outputPath, Buffer.from(b64, 'base64'));

  return {
    mode: safeMode,
    style: safeStyle,
    userInput: sanitizeUserInput(userInput),
    prompt,
    revisedPrompt: generated?.revised_prompt ?? null,
    fileName: outputFileName,
    filePath: outputPath
  };
};
