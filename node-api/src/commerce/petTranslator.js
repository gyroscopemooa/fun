import OpenAI, { toFile } from 'openai';

const DEFAULT_TEXT_MODEL = process.env.OPENAI_PET_TRANSLATOR_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
const DEFAULT_TRANSCRIPTION_MODEL = process.env.OPENAI_PET_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-mini-transcribe';
const DEFAULT_TTS_MODEL = process.env.OPENAI_PET_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = process.env.OPENAI_PET_TTS_VOICE?.trim() || 'alloy';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

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

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  client ??= new OpenAI({ apiKey });
  return client;
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

const transcribePetAudio = async ({ buffer, mimeType, filename, animal }) => {
  const file = await toFile(buffer, filename, { type: mimeType });
  const response = await getClient().audio.transcriptions.create({
    file,
    model: DEFAULT_TRANSCRIPTION_MODEL,
    response_format: 'verbose_json',
    prompt: animal === 'cat'
      ? 'Cat meowing, purring, yowling, hissing, chirping, short pet vocalizations.'
      : 'Dog barking, whining, howling, panting, growling, short pet vocalizations.'
  });

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

const synthesizePetCommandAudio = async ({ text, animal }) => {
  const speech = await getClient().audio.speech.create({
    model: DEFAULT_TTS_MODEL,
    voice: DEFAULT_TTS_VOICE,
    input: buildPetSpeechInput({ text, animal })
  });

  const buffer = Buffer.from(await speech.arrayBuffer());
  return {
    audio: buffer.toString('base64'),
    mimeType: 'audio/mpeg'
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
    const commandAudio = await synthesizePetCommandAudio({ text: result.text, animal });
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
