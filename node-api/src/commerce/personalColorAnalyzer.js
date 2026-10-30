import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_PERSONAL_COLOR_MODEL?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-5';

// 12-tone system: 4 seasons x 3 sub tones. Labels must stay in sync with src/lib/personal-color-tones.ts.
const TONES = {
  'spring-light': { season: '봄 웜', sub: '라이트' },
  'spring-true': { season: '봄 웜', sub: '트루' },
  'spring-bright': { season: '봄 웜', sub: '브라이트' },
  'summer-light': { season: '여름 쿨', sub: '라이트' },
  'summer-true': { season: '여름 쿨', sub: '트루' },
  'summer-mute': { season: '여름 쿨', sub: '뮤트' },
  'autumn-mute': { season: '가을 웜', sub: '뮤트' },
  'autumn-true': { season: '가을 웜', sub: '트루' },
  'autumn-deep': { season: '가을 웜', sub: '딥' },
  'winter-true': { season: '겨울 쿨', sub: '트루' },
  'winter-bright': { season: '겨울 쿨', sub: '브라이트' },
  'winter-deep': { season: '겨울 쿨', sub: '딥' }
};
const TONE_IDS = Object.keys(TONES);
const toneLabel = (id) => `${TONES[id].season} ${TONES[id].sub}`;
const toneGuide = TONE_IDS.map((id) => `${id}=${toneLabel(id)}`).join(', ');

const swatchSchema = (extraKey) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    hex: { type: 'string' },
    [extraKey]: { type: 'string' }
  },
  required: ['name', 'hex', extraKey]
});

const personalColorSchema = {
  name: 'personal_color_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      tone_id: { type: 'string', enum: TONE_IDS },
      runner_up_tone_id: { type: 'string', enum: TONE_IDS },
      match_percent: { type: 'number' },
      undertone: { type: 'string' },
      chroma: { type: 'string' },
      contrast: { type: 'string' },
      warmth_score: { type: 'number' },
      brightness_score: { type: 'number' },
      saturation_score: { type: 'number' },
      contrast_score: { type: 'number' },
      feature_colors: {
        type: 'object',
        additionalProperties: false,
        properties: {
          skin_hex: { type: 'string' },
          hair_hex: { type: 'string' },
          eye_hex: { type: 'string' }
        },
        required: ['skin_hex', 'hair_hex', 'eye_hex']
      },
      photo_check: {
        type: 'object',
        additionalProperties: false,
        properties: {
          score: { type: 'number' },
          lighting: { type: 'string' },
          issues: { type: 'array', items: { type: 'string' } }
        },
        required: ['score', 'lighting', 'issues']
      },
      signature_keywords: { type: 'array', items: { type: 'string' } },
      best_colors: { type: 'array', items: swatchSchema('use') },
      avoid_colors: { type: 'array', items: swatchSchema('reason') },
      makeup: {
        type: 'object',
        additionalProperties: false,
        properties: {
          base: { type: 'string' },
          lip: { type: 'string' },
          lip_hex: { type: 'string' },
          blush: { type: 'string' },
          blush_hex: { type: 'string' },
          eye: { type: 'string' },
          eye_hex: { type: 'string' }
        },
        required: ['base', 'lip', 'lip_hex', 'blush', 'blush_hex', 'eye', 'eye_hex']
      },
      hair: {
        type: 'object',
        additionalProperties: false,
        properties: {
          best: { type: 'string' },
          best_hex: { type: 'string' },
          avoid: { type: 'string' }
        },
        required: ['best', 'best_hex', 'avoid']
      },
      styling_tips: { type: 'array', items: { type: 'string' } },
      cautions: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'summary',
      'confidence',
      'tone_id',
      'runner_up_tone_id',
      'match_percent',
      'undertone',
      'chroma',
      'contrast',
      'warmth_score',
      'brightness_score',
      'saturation_score',
      'contrast_score',
      'feature_colors',
      'photo_check',
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

const text = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeList = (items) => (
  Array.isArray(items)
    ? items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : []
);

const normalizeHex = (value) => {
  const raw = text(value).replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw.split('').map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return '';
};

const score = (value, fallback = 50) => (
  Number.isFinite(Number(value)) ? Math.round(Math.max(0, Math.min(100, Number(value)))) : fallback
);

const normalizeSwatches = (items, extraKey) => (
  Array.isArray(items)
    ? items
      .map((item) => ({ name: text(item?.name), hex: normalizeHex(item?.hex), [extraKey]: text(item?.[extraKey]) }))
      .filter((item) => item.name && item.hex)
    : []
);

const normalizeAnalysis = (payload) => {
  const toneId = TONE_IDS.includes(payload?.tone_id) ? payload.tone_id : 'summer-true';
  const runnerUp = TONE_IDS.includes(payload?.runner_up_tone_id) && payload.runner_up_tone_id !== toneId
    ? payload.runner_up_tone_id
    : '';
  const bestPalette = normalizeSwatches(payload?.best_colors, 'use');
  const avoidPalette = normalizeSwatches(payload?.avoid_colors, 'reason');

  return {
    version: 2,
    summary: text(payload?.summary),
    confidence: ['low', 'medium', 'high'].includes(payload?.confidence) ? payload.confidence : 'low',
    toneId,
    toneLabel: toneLabel(toneId),
    runnerUpToneId: runnerUp,
    matchPercent: score(payload?.match_percent, 70),
    // season/secondaryTone/bestColors are kept for the result email and older readers.
    season: TONES[toneId].season,
    secondaryTone: TONES[toneId].sub,
    undertone: text(payload?.undertone),
    chroma: text(payload?.chroma),
    contrast: text(payload?.contrast),
    warmthScore: score(payload?.warmth_score),
    brightnessScore: score(payload?.brightness_score),
    saturationScore: score(payload?.saturation_score),
    contrastScore: score(payload?.contrast_score),
    featureColors: {
      skin: normalizeHex(payload?.feature_colors?.skin_hex),
      hair: normalizeHex(payload?.feature_colors?.hair_hex),
      eye: normalizeHex(payload?.feature_colors?.eye_hex)
    },
    photoCheck: {
      score: score(payload?.photo_check?.score, 60),
      lighting: text(payload?.photo_check?.lighting),
      issues: normalizeList(payload?.photo_check?.issues)
    },
    signatureKeywords: normalizeList(payload?.signature_keywords),
    bestPalette,
    avoidPalette,
    bestColors: bestPalette.map((item) => item.name),
    avoidColors: avoidPalette.map((item) => item.name),
    makeup: {
      base: text(payload?.makeup?.base),
      lip: text(payload?.makeup?.lip),
      lipHex: normalizeHex(payload?.makeup?.lip_hex),
      blush: text(payload?.makeup?.blush),
      blushHex: normalizeHex(payload?.makeup?.blush_hex),
      eye: text(payload?.makeup?.eye),
      eyeHex: normalizeHex(payload?.makeup?.eye_hex)
    },
    hair: {
      best: text(payload?.hair?.best),
      bestHex: normalizeHex(payload?.hair?.best_hex),
      avoid: text(payload?.hair?.avoid)
    },
    stylingTips: normalizeList(payload?.styling_tips),
    cautions: normalizeList(payload?.cautions)
  };
};

// Reasoning-only parameters are rejected by older chat models such as gpt-4.1.
const reasoningOptions = (model) => (/^(gpt-5|o\d)/.test(model) ? { reasoning_effort: 'low' } : {});

const outputLanguage = (locale) => ({
  ko: 'natural Korean', en: 'natural English', es: 'natural Spanish', zh: 'natural Simplified Chinese',
  ja: 'natural Japanese', de: 'natural German', fr: 'natural French', pt: 'natural Portuguese',
  vi: 'natural Vietnamese', id: 'natural Indonesian'
}[locale] ?? 'natural English');

export const analyzePersonalColor = async ({ imageDataUrl, notes = '', locale = 'en' }) => {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('A valid image data URL is required');
  }

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    ...reasoningOptions(DEFAULT_MODEL),
    messages: [
      {
        role: 'system',
        content: [
          'You are a professional personal color consultant analyzing a face photo.',
          `Return strict JSON only. All human-readable fields must be ${outputLanguage(locale)}.`,
          `Classify into exactly one of the 12 tones: ${toneGuide}.`,
          'Judge in this order: 1) undertone from skin (yellow/peach vs pink/blue base, jaw and neck area), 2) value from skin lightness and hair/eye depth, 3) chroma from how clear or grayish the overall coloring looks, 4) contrast between skin, hair, brows and eyes.',
          'light = high value, low-mid contrast. true = the season center. bright = high chroma and clarity. mute = low chroma, grayish softness. deep = low value, high depth.',
          'Pick runner_up_tone_id as the closest neighboring tone and match_percent (55-95) as how strongly the photo fits tone_id over it.',
          'Prioritize natural skin, eye, brow and hair over clothes, accessories and background.',
          'Treat heavy makeup, dyed hair, filters, colored lighting and white balance shifts as unreliable; mention them in photo_check.issues and lower confidence.',
          'If evidence is mixed, keep the closest stable tone, lower confidence and add cautions instead of jumping to a distant season.',
          'feature_colors are your best estimate of natural skin (cheek), hair and iris colors as #RRGGBB hex.',
          'best_colors: exactly 8 colors that fit tone_id, each with a color name in the selected language, an accurate #RRGGBB hex, and a short use (where to wear it).',
          'avoid_colors: exactly 4 colors with a selected-language name, #RRGGBB hex and a short reason why they clash.',
          'makeup lip_hex, blush_hex, eye_hex and hair best_hex must be realistic product-like shades as #RRGGBB.',
          'photo_check.score (0-100) rates how reliable the photo is for color analysis; lighting describes the light briefly.',
          'Give 3-5 signature_keywords, 3-5 styling_tips and 1-3 cautions. Give practical styling guidance, not medical statements.'
        ].join(' ')
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Analyze this face photo for 12-tone personal color.',
              'summary: 2 sentences describing why this tone fits, citing visible skin, hair and eye traits.',
              'undertone, chroma, contrast: use short terms in the selected language.',
              'Scores 0-100: warmth (0 = very cool, 100 = very warm), brightness, saturation, contrast.',
              notes ? `Additional note from user: ${notes}` : ''
            ].filter(Boolean).join(' ')
          },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl, detail: 'high' }
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
