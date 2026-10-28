import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../node-api/package.json', import.meta.url));
require('dotenv').config({ path: path.join(root, 'node-api/.env') });
const sharp = require('sharp');
const { generateAiImage } = await import('../node-api/src/commerce/aiImageGenerator.js');
const inputs = process.argv.slice(2);
if (inputs.length !== 4) throw new Error('Pass the four garment image paths in sample order.');
const assets = path.join(root, 'public/images/product-model');
const rawDir = path.join(root, 'node-api/node-api-storage/product-model-samples');
await fs.mkdir(assets, { recursive: true });
await fs.mkdir(rawDir, { recursive: true });
const requests = [
 '20대 성인 여성 모델, 밝은 스튜디오, 전신, 자연스러운 정면 포즈',
 '20대 성인 여성 모델, 밝은 스튜디오, 전신, 자연스러운 정면 포즈',
 '20대 성인 여성 모델, 밝은 카페 앞, 전신, 데일리 코디',
 '20대 성인 여성 모델, 밝은 거리, 청바지 코디, 전신'
];
let failures = 0;
for (let i = 0; i < inputs.length; i++) {
 const id = `women-${String(i+1).padStart(2, '0')}`;
 const evidence = path.join(rawDir, `${id}.json`);
 try { await fs.access(evidence); console.log(`${id}: already generated; skipping`); continue; } catch {}
 try {
  const imageBuffer = await fs.readFile(inputs[i]);
  console.log(`${id}: generating with local modelcut pipeline`);
  const result = await generateAiImage({ provider: 'openai', mode: 'modelcut', userInput: requests[i], imageBuffer, mimeType: 'image/png', originalFilename: `${id}-garment.png`, outputDir: rawDir, id });
  await sharp(imageBuffer).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(assets, `${id}-garment.webp`));
  await sharp(result.filePath).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(assets, `${id}-model.webp`));
  const record = { id, generatedAt: new Date().toISOString(), pipeline: 'node-api/src/commerce/aiImageGenerator.js#generateAiImage', model: process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2', inputSha256: crypto.createHash('sha256').update(imageBuffer).digest('hex'), ...result };
  await fs.writeFile(evidence, JSON.stringify(record, null, 2));
  console.log(`${id}: saved actual generated result`);
 } catch (error) {
  failures++;
  console.error(`${id}: failed (${error.status || error.code || error.name}): ${error.message}`);
 }
}
if (failures) process.exitCode = 1;
