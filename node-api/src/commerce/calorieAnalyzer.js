import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_CALORIE_MODEL?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-5';

const GOALS = {
  lose: 'weight loss (calorie deficit, high protein, high fiber)',
  maintain: 'weight maintenance (balanced meal)',
  gain: 'muscle gain (enough calories and high protein)'
};

const confidenceEnum = { type: 'string', enum: ['low', 'medium', 'high'] };

const scorePart = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number' },
    comment: { type: 'string' }
  },
  required: ['score', 'comment']
};

const calorieSchema = {
  name: 'meal_calorie_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: { type: 'boolean' },
      meal_name: { type: 'string' },
      summary: { type: 'string' },
      confidence: confidenceEnum,
      total_calories: { type: 'number' },
      calorie_min: { type: 'number' },
      calorie_max: { type: 'number' },
      macros: {
        type: 'object',
        additionalProperties: false,
        properties: {
          carbs_g: { type: 'number' },
          protein_g: { type: 'number' },
          fat_g: { type: 'number' },
          fiber_g: { type: 'number' },
          sugar_g: { type: 'number' },
          sodium_mg: { type: 'number' }
        },
        required: ['carbs_g', 'protein_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']
      },
      food_items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            emoji: { type: 'string' },
            estimated_portion: { type: 'string' },
            grams: { type: 'number' },
            estimated_calories: { type: 'number' },
            carbs_g: { type: 'number' },
            protein_g: { type: 'number' },
            fat_g: { type: 'number' },
            confidence: confidenceEnum
          },
          required: ['name', 'emoji', 'estimated_portion', 'grams', 'estimated_calories', 'carbs_g', 'protein_g', 'fat_g', 'confidence']
        }
      },
      meal_score: { type: 'number' },
      score_breakdown: {
        type: 'object',
        additionalProperties: false,
        properties: {
          balance: scorePart,
          protein: scorePart,
          fiber: scorePart,
          sodium_sugar: scorePart
        },
        required: ['balance', 'protein', 'fiber', 'sodium_sugar']
      },
      highlights: { type: 'array', items: { type: 'string' } },
      improvements: { type: 'array', items: { type: 'string' } },
      swaps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            calories_saved: { type: 'number' },
            reason: { type: 'string' }
          },
          required: ['from', 'to', 'calories_saved', 'reason']
        }
      },
      notes: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'is_food',
      'meal_name',
      'summary',
      'confidence',
      'total_calories',
      'calorie_min',
      'calorie_max',
      'macros',
      'food_items',
      'meal_score',
      'score_breakdown',
      'highlights',
      'improvements',
      'swaps',
      'notes'
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

const text = (value, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value) * 10) / 10) : 0);
const score = (value) => (Number.isFinite(Number(value)) ? Math.round(Math.max(0, Math.min(100, Number(value)))) : 50);
const confidence = (value) => (['low', 'medium', 'high'].includes(value) ? value : 'low');
const list = (items) => (Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []);
const part = (value) => ({ score: score(value?.score), comment: text(value?.comment) });

const normalizeAnalysis = (payload, goal) => {
  const foodItems = Array.isArray(payload?.food_items)
    ? payload.food_items.map((item) => ({
      name: text(item?.name, '알 수 없는 음식'),
      emoji: text(item?.emoji, '🍽️').slice(0, 4),
      estimatedPortion: text(item?.estimated_portion, '분량 불명'),
      grams: num(item?.grams),
      estimatedCalories: num(item?.estimated_calories),
      carbsG: num(item?.carbs_g),
      proteinG: num(item?.protein_g),
      fatG: num(item?.fat_g),
      confidence: confidence(item?.confidence)
    }))
    : [];
  const itemTotal = foodItems.reduce((sum, item) => sum + item.estimatedCalories, 0);
  const totalCalories = num(payload?.total_calories) || itemTotal;
  const min = num(payload?.calorie_min);
  const max = num(payload?.calorie_max);

  return {
    version: 2,
    goal,
    isFood: payload?.is_food !== false,
    mealName: text(payload?.meal_name, '분석한 식사'),
    summary: text(payload?.summary),
    confidence: confidence(payload?.confidence),
    totalCalories,
    calorieRange: {
      min: min && min <= totalCalories ? min : Math.round(totalCalories * 0.85),
      max: max && max >= totalCalories ? max : Math.round(totalCalories * 1.15)
    },
    macros: {
      carbsG: num(payload?.macros?.carbs_g),
      proteinG: num(payload?.macros?.protein_g),
      fatG: num(payload?.macros?.fat_g),
      fiberG: num(payload?.macros?.fiber_g),
      sugarG: num(payload?.macros?.sugar_g),
      sodiumMg: num(payload?.macros?.sodium_mg)
    },
    foodItems,
    mealScore: score(payload?.meal_score),
    scoreBreakdown: {
      balance: part(payload?.score_breakdown?.balance),
      protein: part(payload?.score_breakdown?.protein),
      fiber: part(payload?.score_breakdown?.fiber),
      sodiumSugar: part(payload?.score_breakdown?.sodium_sugar)
    },
    highlights: list(payload?.highlights),
    improvements: list(payload?.improvements),
    swaps: Array.isArray(payload?.swaps)
      ? payload.swaps
        .map((item) => ({ from: text(item?.from), to: text(item?.to), caloriesSaved: Math.round(num(item?.calories_saved)), reason: text(item?.reason) }))
        .filter((item) => item.from && item.to)
      : [],
    notes: list(payload?.notes)
  };
};

// Reasoning-only parameters are rejected by older chat models such as gpt-4.1.
const reasoningOptions = (model) => (/^(gpt-5|o\d)/.test(model) ? { reasoning_effort: 'low' } : {});

export const analyzeMealCalories = async ({ imageDataUrl, goal = 'maintain', locale = 'ko' }) => {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('A valid image data URL is required');
  }
  const safeGoal = GOALS[goal] ? goal : 'maintain';
  const language = locale === 'en' ? 'natural English' : 'natural Korean';

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    ...reasoningOptions(DEFAULT_MODEL),
    messages: [
      {
        role: 'system',
        content: [
          'You are a registered-dietitian style assistant that analyzes meal photos.',
          `Return strict JSON only. All human-readable fields must be ${language}.`,
          'Set is_food to false when the photo shows no food or drink; then keep numbers at 0, leave food_items and swaps empty, and use summary and improvements to explain how to retake the photo.',
          'Identify every visible food and drink, estimate portion in everyday units plus grams, then estimate calories and carbs/protein/fat per item using standard nutrition databases (Korean foods: use typical Korean restaurant portions).',
          'Account for hidden calories: cooking oil, sauces, dressings, soup broth, sugar in drinks. Mention big uncertainties in notes.',
          'total_calories must equal the sum of item calories; calorie_min/calorie_max give a realistic range around it.',
          'macros are meal totals; also estimate fiber, sugar and sodium (Korean soups and kimchi are high sodium).',
          `Score the meal 0-100 for the user goal: ${GOALS[safeGoal]}. score_breakdown rates balance, protein, fiber (vegetables) and sodium_sugar control 0-100, each with one short comment.`,
          'meal_name is a short natural name for the whole meal (e.g. 김치찌개 백반).',
          'Each food_item gets one fitting food emoji.',
          'highlights: 1-3 good points. improvements: 1-3 practical tips.',
          'swaps: 2-3 realistic substitutions for items in this meal (e.g. 흰쌀밥 → 현미밥 반 공기) with calories_saved per swap; for gain goal, swaps may add protein instead and calories_saved can be 0.',
          'Be practical and non-judgmental. This is not medical advice; do not diagnose.'
        ].join(' ')
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this meal photo.' },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: calorieSchema
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return normalizeAnalysis(parsed, safeGoal);
};
