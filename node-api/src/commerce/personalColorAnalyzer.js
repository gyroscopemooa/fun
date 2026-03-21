import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4.1-mini';

const personalColorSchema = {
  name: 'personal_color_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      season: { type: 'string' },
      undertone: { type: 'string' },
      chroma: { type: 'string' },
      contrast: { type: 'string' },
      warmth_score: { type: 'number' },
      brightness_score: { type: 'number' },
      saturation_score: { type: 'number' },
      contrast_score: { type: 'number' },
      signature_keywords: {
        type: 'array',
        items: { type: 'string' }
      },
      best_colors: {
        type: 'array',
        items: { type: 'string' }
      },
      avoid_colors: {
        type: 'array',
        items: { type: 'string' }
      },
      makeup: {
        type: 'object',
        additionalProperties: false,
        properties: {
          base: { type: 'string' },
          lip: { type: 'string' },
          blush: { type: 'string' },
          eye: { type: 'string' }
        },
        required: ['base', 'lip', 'blush', 'eye']
      },
      hair: {
        type: 'object',
        additionalProperties: false,
        properties: {
          best: { type: 'string' },
          avoid: { type: 'string' }
        },
        required: ['best', 'avoid']
      },
      styling_tips: {
        type: 'array',
        items: { type: 'string' }
      },
      cautions: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: [
      'summary',
      'confidence',
      'season',
      'undertone',
      'chroma',
      'contrast',
      'warmth_score',
      'brightness_score',
      'saturation_score',
      'contrast_score',
      'signature_keywords',
      'best_colors',
      'avoid_colors',
      'makeup',
      'hair',
      'styling_tips',
      'cautions'
    ]
  }
};

let client = null;

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  client ??= new OpenAI({ apiKey });
  return client;
};

const extractJson = (content) => {
  if (!content) throw new Error('OpenAI response content is empty');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('OpenAI response did not contain JSON');
  }
  return JSON.parse(content.slice(start, end + 1));
};

const normalizeList = (items) => (
  Array.isArray(items)
    ? items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : []
);

const normalizeAnalysis = (payload) => ({
  summary: typeof payload?.summary === 'string' ? payload.summary.trim() : '',
  confidence: ['low', 'medium', 'high'].includes(payload?.confidence) ? payload.confidence : 'low',
  season: typeof payload?.season === 'string' ? payload.season.trim() : '',
  undertone: typeof payload?.undertone === 'string' ? payload.undertone.trim() : '',
  chroma: typeof payload?.chroma === 'string' ? payload.chroma.trim() : '',
  contrast: typeof payload?.contrast === 'string' ? payload.contrast.trim() : '',
  warmthScore: Number.isFinite(Number(payload?.warmth_score)) ? Math.max(0, Math.min(100, Number(payload.warmth_score))) : 50,
  brightnessScore: Number.isFinite(Number(payload?.brightness_score)) ? Math.max(0, Math.min(100, Number(payload.brightness_score))) : 50,
  saturationScore: Number.isFinite(Number(payload?.saturation_score)) ? Math.max(0, Math.min(100, Number(payload.saturation_score))) : 50,
  contrastScore: Number.isFinite(Number(payload?.contrast_score)) ? Math.max(0, Math.min(100, Number(payload.contrast_score))) : 50,
  signatureKeywords: normalizeList(payload?.signature_keywords),
  bestColors: normalizeList(payload?.best_colors),
  avoidColors: normalizeList(payload?.avoid_colors),
  makeup: {
    base: typeof payload?.makeup?.base === 'string' ? payload.makeup.base.trim() : '',
    lip: typeof payload?.makeup?.lip === 'string' ? payload.makeup.lip.trim() : '',
    blush: typeof payload?.makeup?.blush === 'string' ? payload.makeup.blush.trim() : '',
    eye: typeof payload?.makeup?.eye === 'string' ? payload.makeup.eye.trim() : ''
  },
  hair: {
    best: typeof payload?.hair?.best === 'string' ? payload.hair.best.trim() : '',
    avoid: typeof payload?.hair?.avoid === 'string' ? payload.hair.avoid.trim() : ''
  },
  stylingTips: normalizeList(payload?.styling_tips),
  cautions: normalizeList(payload?.cautions)
});

export const analyzePersonalColor = async ({ imageDataUrl, notes = '' }) => {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('A valid image data URL is required');
  }

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: [
          'You analyze personal color tendencies from a face photo.',
          'Return strict JSON only.',
          'Do not overclaim certainty.',
          'All human-readable fields must be written in natural Korean.',
          'Give practical styling guidance, not medical statements.'
        ].join(' ')
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Analyze this face photo for personal color guidance.',
              'Estimate season tone, undertone, chroma, and contrast.',
              'Also provide numeric 0-100 scores for warmth, brightness, saturation, and contrast.',
              'Use Korean personal color terminology such as 봄 웜, 여름 쿨, 가을 웜, 겨울 쿨, 저채도, 고채도, 저명도, 고명도, soft, clear when appropriate.',
              'Recommend colors, makeup, hair color, and styling tips.',
              'If the image is unclear, lower confidence and mention caution.',
              notes ? `Additional note from user: ${notes}` : ''
            ].filter(Boolean).join(' ')
          },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl }
          }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: personalColorSchema
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return normalizeAnalysis(parsed);
};
