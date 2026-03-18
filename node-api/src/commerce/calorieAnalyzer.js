import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4.1-mini';

const calorieSchema = {
  name: 'meal_calorie_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      total_calories: { type: 'number' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      summary: { type: 'string' },
      notes: {
        type: 'array',
        items: { type: 'string' }
      },
      food_items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            estimated_portion: { type: 'string' },
            estimated_calories: { type: 'number' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
          },
          required: ['name', 'estimated_portion', 'estimated_calories', 'confidence']
        }
      }
    },
    required: ['total_calories', 'confidence', 'summary', 'notes', 'food_items']
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

const normalizeAnalysis = (payload) => ({
  totalCalories: Number(payload?.total_calories ?? 0),
  confidence: ['low', 'medium', 'high'].includes(payload?.confidence) ? payload.confidence : 'low',
  summary: typeof payload?.summary === 'string' ? payload.summary.trim() : '',
  notes: Array.isArray(payload?.notes) ? payload.notes.filter((item) => typeof item === 'string' && item.trim()) : [],
  foodItems: Array.isArray(payload?.food_items)
    ? payload.food_items.map((item) => ({
      name: typeof item?.name === 'string' ? item.name.trim() : 'Unknown',
      estimatedPortion: typeof item?.estimated_portion === 'string' ? item.estimated_portion.trim() : 'Unknown portion',
      estimatedCalories: Number(item?.estimated_calories ?? 0),
      confidence: ['low', 'medium', 'high'].includes(item?.confidence) ? item.confidence : 'low'
    }))
    : []
});

const resolveOutputLanguageInstruction = (locale) => {
  if (locale === 'en') {
    return 'Write all human-readable fields in natural English.';
  }
  return 'Write all human-readable fields in natural Korean.';
};

export const analyzeMealCalories = async ({ imageDataUrl, locale = 'ko' }) => {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('A valid image data URL is required');
  }

  const completion = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You analyze meal photos and estimate calories conservatively. Return structured JSON only.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Analyze this food photo and estimate total calories.',
              'Identify visible food items, estimate portion size, and provide a realistic calorie estimate.',
              'Do not pretend to be medically precise. Use cautious, practical estimates.',
              'If the image is unclear, lower confidence and explain uncertainty in notes.',
              resolveOutputLanguageInstruction(locale)
            ].join(' ')
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
      json_schema: calorieSchema
    }
  });

  const content = completion.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return normalizeAnalysis(parsed);
};
