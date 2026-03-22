import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import OpenAI, { toFile } from 'openai';

const DEFAULT_TEXT_MODEL = process.env.OPENAI_PET_TRANSLATOR_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
const DEFAULT_TRANSCRIPTION_MODEL = process.env.OPENAI_PET_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-mini-transcribe';
const DEFAULT_TTS_MODEL = process.env.OPENAI_PET_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = process.env.OPENAI_PET_TTS_VOICE?.trim() || 'alloy';
const FFMPEG_BINARY = (process.env.FFMPEG_PATH ?? 'ffmpeg').trim() || 'ffmpeg';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const SAMPLE_ROOT = path.resolve(thisDir, '..', '..');

const PET_TRANSLATOR_PROMPT = `You translate pet sounds into human language.

Output EXACTLY 3 lines:

1. A natural sentence as if the pet is speaking
2. Emotion with percentage (e.g. 감정: 기대 82%)
3. A short explanation sentence

Rules:
- No "~want to"
- No long explanation
- Must feel like real speech
- Adjust output length based on input duration:
  short -> short sentence
  medium -> normal
  long -> longer emotional sentence`;

let client = null;
let petSampleCatalog = null;

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  client ??= new OpenAI({ apiKey });
  return client;
};

const waitForFfmpeg = (args) => new Promise((resolve, reject) => {
  const child = spawn(FFMPEG_BINARY, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
  });
});

const hasKeyword = (value, keywords) => keywords.some((keyword) => value.includes(keyword));

const classifySample = (animal, filename) => {
  const normalized = String(filename ?? '').toLowerCase();
  if (animal === 'dog') {
    if (hasKeyword(normalized, ['growl'])) return 'tense';
    if (hasKeyword(normalized, ['pant'])) return 'playful';
    if (hasKeyword(normalized, ['howl', 'howling'])) return 'sad';
    if (hasKeyword(normalized, ['distant'])) return 'alert';
    if (hasKeyword(normalized, ['small', 'cute'])) return 'playful';
    return 'alert';
  }

  if (hasKeyword(normalized, ['cute'])) return 'playful';
  if (hasKeyword(normalized, ['meowing'])) return 'sad';
  return 'neutral';
};

const loadAnimalSamples = async (animal) => {
  const folder = path.join(SAMPLE_ROOT, animal.toUpperCase());
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'))
    .map((entry) => ({
      path: path.join(folder, entry.name),
      name: entry.name,
      mood: classifySample(animal, entry.name)
    }));
};

const getPetSampleCatalog = async () => {
  if (petSampleCatalog) return petSampleCatalog;
  const [dog, cat] = await Promise.all([loadAnimalSamples('dog'), loadAnimalSamples('cat')]);
  petSampleCatalog = { dog, cat };
  return petSampleCatalog;
};

const decodeBase64Audio = (audio) => {
  if (typeof audio !== 'string' || !audio.trim()) {
    throw new Error('audio is required');
  }

  const trimmed = audio.trim();
  const dataUrlMatch = trimmed.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      buffer: Buffer.from(dataUrlMatch[2], 'base64')
    };
  }

  return {
    mimeType: 'audio/webm',
    buffer: Buffer.from(trimmed, 'base64')
  };
};

const inferExtension = (mimeType) => {
  const normalized = String(mimeType ?? '').toLowerCase();
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3';
  if (normalized.includes('ogg')) return '.ogg';
  if (normalized.includes('mp4') || normalized.includes('m4a')) return '.m4a';
  return '.webm';
};

const normalizeAudioInput = ({ file, audio, audioMimeType }) => {
  if (file?.buffer?.length) {
    return {
      buffer: file.buffer,
      mimeType: file.mimetype || 'audio/webm',
      filename: file.originalname || `pet-audio${inferExtension(file.mimetype)}`
    };
  }

  const decoded = decodeBase64Audio(audio);
  return {
    buffer: decoded.buffer,
    mimeType: audioMimeType || decoded.mimeType,
    filename: `pet-audio${inferExtension(audioMimeType || decoded.mimeType)}`
  };
};

const normalizeDuration = (duration) => {
  const numeric = Number(duration ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 10) / 10;
};

const stripLeadingNumber = (line) => line.replace(/^\s*[0-9]+[.)-]?\s*/, '').trim();

const normalizeThreeLineOutput = (content) => {
  const lines = String(content ?? '')
    .split(/\r?\n/)
    .map((line) => stripLeadingNumber(line))
    .filter(Boolean);

  if (lines.length < 3) {
    throw new Error('pet translator response format is invalid');
  }

  const [first, second, third] = lines;
  const emotionLine = second.startsWith('감정:') ? second : `감정: ${second}`;

  return {
    text: first,
    emotion: emotionLine.replace(/^감정:\s*/, '').trim(),
    description: third
  };
};

const buildPromptContext = ({ transcript, animal, mode, durationSeconds }) => [
  `Animal: ${animal}`,
  `Mode: ${mode}`,
  `Detected duration: ${durationSeconds || 0} seconds`,
  `Transcribed audio: ${transcript || '(no clear words, mostly pet vocalization)'}`,
  'Write the three lines in natural Korean.',
  'Return exactly 3 lines and nothing else.'
].join('\n');

const transcodeAudioForTranscription = async ({ buffer, filename }) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-stt-'));
  const inputPath = path.join(tempDir, filename || 'pet-input.webm');
  const outputPath = path.join(tempDir, 'pet-input.wav');

  try {
    await fs.writeFile(inputPath, buffer);
    await waitForFfmpeg([
      '-y',
      '-i', inputPath,
      '-ac', '1',
      '-ar', '16000',
      outputPath
    ]);
    const nextBuffer = await fs.readFile(outputPath);
    return {
      buffer: nextBuffer,
      mimeType: 'audio/wav',
      filename: 'pet-input.wav'
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

const transcribePetAudio = async ({ buffer, mimeType, filename, animal }) => {
  const prompt = animal === 'cat'
    ? 'Cat meowing, purring, yowling, hissing, chirping, short pet vocalizations.'
    : 'Dog barking, whining, howling, panting, growling, short pet vocalizations.';
  let response = null;

  try {
    const file = await toFile(buffer, filename, { type: mimeType });
    response = await getClient().audio.transcriptions.create({
      file,
      model: DEFAULT_TRANSCRIPTION_MODEL,
      response_format: 'verbose_json',
      prompt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.toLowerCase().includes('corrupted') && !message.toLowerCase().includes('unsupported')) {
      throw error;
    }

    const transcoded = await transcodeAudioForTranscription({ buffer, filename });
    const transcodedFile = await toFile(transcoded.buffer, transcoded.filename, { type: transcoded.mimeType });
    response = await getClient().audio.transcriptions.create({
      file: transcodedFile,
      model: DEFAULT_TRANSCRIPTION_MODEL,
      response_format: 'verbose_json',
      prompt
    });
  }

  return {
    transcript: typeof response?.text === 'string' ? response.text.trim() : '',
    durationSeconds: normalizeDuration(response?.duration)
  };
};

const generatePetTranslation = async ({ transcript, animal, mode, durationSeconds }) => {
  const completion = await getClient().chat.completions.create({
    model: DEFAULT_TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: PET_TRANSLATOR_PROMPT
      },
      {
        role: 'user',
        content: buildPromptContext({ transcript, animal, mode, durationSeconds })
      }
    ]
  });

  return normalizeThreeLineOutput(completion.choices?.[0]?.message?.content ?? '');
};

const buildPetSpeechInput = ({ text, animal }) => {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (animal === 'cat') {
    return `야옹, 냐앙, 냥. 사람처럼 또박또박 한국어 문장을 읽지 말고, 고양이가 우는 소리와 짧은 리듬 중심으로 표현해. 의미 힌트만 살짝 반영해: ${trimmed}`;
  }

  return `멍, 멍멍, 컹컹, 왈. 사람처럼 또박또박 한국어 문장을 읽지 말고, 강아지가 짖는 소리와 짧은 리듬 중심으로 표현해. 의미 힌트만 살짝 반영해: ${trimmed}`;
};

const inferTargetMood = ({ text, emotion, animal }) => {
  const normalized = `${text ?? ''} ${emotion ?? ''}`.toLowerCase();
  if (animal === 'dog') {
    if (hasKeyword(normalized, ['화', '분노', '경계', '불안', '짜증', 'growl'])) return 'tense';
    if (hasKeyword(normalized, ['슬픔', '외로', '그리움', 'sad'])) return 'sad';
    if (hasKeyword(normalized, ['기쁨', '신남', '반가', '즐거', 'play'])) return 'playful';
    return 'alert';
  }

  if (hasKeyword(normalized, ['기쁨', '신남', '반가', 'play'])) return 'playful';
  if (hasKeyword(normalized, ['슬픔', '불안', '짜증', 'sad'])) return 'sad';
  return 'neutral';
};

const shuffle = (items) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const getSamplePlan = (text) => {
  const length = String(text ?? '').trim().length;
  if (length <= 8) return { sampleCount: 1, clipSeconds: 0.7 };
  if (length <= 24) return { sampleCount: 2, clipSeconds: 0.85 };
  if (length <= 48) return { sampleCount: 2, clipSeconds: 1.0 };
  return { sampleCount: 3, clipSeconds: 1.15 };
};

const selectPetSamples = async ({ animal, text, emotion }) => {
  const catalog = await getPetSampleCatalog();
  const pool = catalog[animal] ?? [];
  if (!pool.length) return [];

  const targetMood = inferTargetMood({ text, emotion, animal });
  const preferred = pool.filter((sample) => sample.mood === targetMood);
  const backup = pool.filter((sample) => sample.mood !== targetMood);
  const { sampleCount } = getSamplePlan(text);
  const picked = [];

  for (const sample of [...shuffle(preferred), ...shuffle(backup)]) {
    if (!picked.find((item) => item.path === sample.path)) {
      picked.push(sample);
    }
    if (picked.length >= sampleCount) break;
  }

  return picked;
};

const concatPetSamples = async (samples, text) => {
  if (!samples.length) return null;
  const { clipSeconds } = getSamplePlan(text);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-sfx-'));
  const preparedPaths = [];
  const outputPath = path.join(tempDir, 'pet-command.mp3');

  try {
    for (let index = 0; index < samples.length; index += 1) {
      const preparedPath = path.join(tempDir, `clip-${index}.mp3`);
      preparedPaths.push(preparedPath);
      await waitForFfmpeg([
        '-y',
        '-i', samples[index].path,
        '-t', String(clipSeconds),
        '-af', 'afade=t=out:st=0.45:d=0.2',
        preparedPath
      ]);
    }

    if (preparedPaths.length === 1) {
      const buffer = await fs.readFile(preparedPaths[0]);
      return { audio: buffer.toString('base64'), mimeType: 'audio/mpeg' };
    }

    const listPath = path.join(tempDir, 'concat.txt');
    const listContent = preparedPaths
      .map((samplePath) => `file '${samplePath.replace(/'/g, "'\\''")}'`)
      .join('\n');
    await fs.writeFile(listPath, listContent, 'utf8');
    await waitForFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c:a', 'libmp3lame',
      outputPath
    ]);
    const buffer = await fs.readFile(outputPath);
    return { audio: buffer.toString('base64'), mimeType: 'audio/mpeg' };
  } catch {
    const buffer = await fs.readFile(samples[0].path);
    return { audio: buffer.toString('base64'), mimeType: 'audio/mpeg' };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

const synthesizePetCommandAudio = async ({ text, emotion, animal }) => {
  const sampleSelection = await selectPetSamples({ animal, text, emotion });
  const sampleAudio = await concatPetSamples(sampleSelection, text);
  if (sampleAudio) {
    return {
      ...sampleAudio,
      audioSource: 'sample',
      sampleCount: sampleSelection.length
    };
  }

  const speech = await getClient().audio.speech.create({
    model: DEFAULT_TTS_MODEL,
    voice: DEFAULT_TTS_VOICE,
    input: buildPetSpeechInput({ text, animal })
  });

  const buffer = Buffer.from(await speech.arrayBuffer());
  return {
    audio: buffer.toString('base64'),
    mimeType: 'audio/mpeg',
    audioSource: 'tts',
    sampleCount: 0
  };
};

export const analyzePetAudio = async ({ audioInput, animal = 'dog', mode = 'analyze', textInput = '' }) => {
  if (!['dog', 'cat'].includes(animal)) {
    throw new Error('animal must be dog or cat');
  }
  if (!['analyze', 'command'].includes(mode)) {
    throw new Error('mode must be analyze or command');
  }

  const normalizedTextInput = typeof textInput === 'string' ? textInput.trim() : '';
  if (!audioInput?.buffer?.length && !normalizedTextInput) {
    throw new Error('audio is required');
  }
  if (audioInput?.buffer?.length > MAX_AUDIO_BYTES) {
    throw new Error('audio file is too large');
  }

  const transcription = normalizedTextInput
    ? {
        transcript: normalizedTextInput,
        durationSeconds: 0
      }
    : await transcribePetAudio({
        buffer: audioInput.buffer,
        mimeType: audioInput.mimeType,
        filename: audioInput.filename,
        animal
      });

  const result = await generatePetTranslation({
    transcript: transcription.transcript,
    animal,
    mode,
    durationSeconds: transcription.durationSeconds
  });

  if (mode === 'command') {
    const commandAudio = await synthesizePetCommandAudio({
      text: result.text,
      emotion: result.emotion,
      animal
    });
    return {
      ...commandAudio,
      text: result.text,
      emotion: result.emotion,
      description: result.description,
      transcript: transcription.transcript,
      durationSeconds: transcription.durationSeconds
    };
  }

  return {
    text: result.text,
    emotion: result.emotion,
    description: result.description,
    transcript: transcription.transcript,
    durationSeconds: transcription.durationSeconds
  };
};

export const parsePetAudioPayload = ({ file, audio, audioMimeType }) => {
  if (!file?.buffer?.length && !(typeof audio === 'string' && audio.trim())) {
    return null;
  }
  return normalizeAudioInput({ file, audio, audioMimeType });
};
