import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../node-api/package.json', import.meta.url));
require('dotenv').config({ path: path.join(root, 'node-api/.env') });
const sharp = require('sharp');
const { analyzeMealCalories } = await import('../node-api/src/commerce/calorieAnalyzer.js');
const inputDir = process.argv[2];
if (!inputDir) throw new Error('Pass the directory containing the supplied food photos.');
const recipes = [
  { id: 'chicken-salad', label: '치킨 샐러드', emoji: '🥗', file: 'codex-clipboard-a55ced54-0a7d-43b4-b74c-ad454bdeb221.png' },
  { id: 'jajangmyeon', label: '짜장면', emoji: '🍜', file: 'codex-clipboard-ffcf4cf2-9edd-4742-bcdf-0fdf13976b12.png' },
  { id: 'tuna-sushi', label: '참치 초밥', emoji: '🍣', file: 'codex-clipboard-d0afad7d-9aca-4579-91bd-016cb7012fac.png' }
];
const output = path.join(root, 'src/data/calorie-samples');
const assets = path.join(root, 'public/images/calorie-samples');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(assets, { recursive: true });
for (const recipe of recipes) {
  const destination = path.join(output, `${recipe.id}.json`);
  try { await fs.access(destination); console.log(`${recipe.id}: existing analysis retained`); continue; } catch {}
  const original = await fs.readFile(path.join(inputDir, recipe.file));
  const photo = await sharp(original).rotate().resize({ width: 1500, height: 1500, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  await fs.writeFile(path.join(assets, `${recipe.id}.webp`), photo);
  console.log(`${recipe.id}: analyzing supplied photo with production calorie analyzer`);
  const analysis = await analyzeMealCalories({ imageDataUrl: `data:image/webp;base64,${photo.toString('base64')}`, goal: 'maintain', locale: 'ko' });
  if (!analysis.isFood || !analysis.foodItems?.length) throw new Error(`${recipe.id}: no food analysis returned`);
  const record = { id: recipe.id, label: recipe.label, emoji: recipe.emoji, photoUrl: `/images/calorie-samples/${recipe.id}.webp`, generatedAt: new Date().toISOString(), model: process.env.OPENAI_CALORIE_MODEL?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-5', pipeline: 'node-api/src/commerce/calorieAnalyzer.js#analyzeMealCalories', sourceSha256: createHash('sha256').update(original).digest('hex'), analysis };
  await fs.writeFile(destination, JSON.stringify(record, null, 2) + '\n');
  console.log(`${recipe.id}: saved ${analysis.totalCalories} kcal, ${analysis.foodItems.length} food items`);
}
