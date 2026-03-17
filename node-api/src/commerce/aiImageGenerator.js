import path from 'node:path';
import fs from 'node:fs/promises';
import OpenAI, { toFile } from 'openai';

const MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1';

let client = null;

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  client ??= new OpenAI({ apiKey });
  return client;
};

const assertMode = (mode) => {
  if (mode === 'figure' || mode === 'body') return mode;
  throw new Error('invalid mode');
};

const buildPrompt = (mode) => {
  if (mode === 'body') {
    return [
      'Transform the uploaded portrait into a premium body profile studio photo.',
      'Keep the person identity recognizable and preserve facial features.',
      'Use clean studio lighting, polished skin retouching, fit physique emphasis, premium editorial photography mood, and natural anatomy.',
      'Generate a realistic portrait photograph, not an illustration, not a cartoon, not a toy.',
      'High-end Korean body profile studio style, sharp focus, professional composition.'
    ].join(' ');
  }

  return [
    'Transform the uploaded portrait into a collectible character figure concept image.',
    'Keep the person identity recognizable and preserve facial features.',
    'Stylize the person as a premium toy figure or resin statue with detailed costume, polished materials, and a studio product-shot background.',
    'The final image should clearly look like a figure product inspired by the uploaded person.',
    'High detail, premium collectible aesthetic, clean composition.'
  ].join(' ');
};

export const generateAiImage = async ({
  mode,
  imageBuffer,
  mimeType,
  originalFilename,
  outputDir,
  id
}) => {
  const safeMode = assertMode(mode);
  const prompt = buildPrompt(safeMode);
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
    prompt,
    revisedPrompt: generated?.revised_prompt ?? null,
    fileName: outputFileName,
    filePath: outputPath
  };
};
