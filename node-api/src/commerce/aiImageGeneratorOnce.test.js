import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { generateAiImageOnce } from './aiImageGenerator.js';

test('existing image modes keep stage semantics; strict payment calls never retry/fallback unknown outcomes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-once-'));
  const previous = { fetch: globalThis.fetch, openai: process.env.OPENAI_API_KEY, xai: process.env.XAI_API_KEY };
  const calls = []; let failAt = null, returnUrl = false;
  try {
    process.env.OPENAI_API_KEY = 'test-only-not-real'; process.env.XAI_API_KEY = 'test-only-not-real';
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith('https://api.openai.com/') && !String(url).startsWith('https://api.x.ai/')) throw Error('No network permitted in test');
      calls.push({ url: String(url), options });
      if (calls.length === failAt) return new Response(JSON.stringify({ error: { message: 'uncertain provider failure' } }), { status: 503, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ data: [returnUrl ? { url: 'http://127.0.0.1/private' } : { b64_json: png.toString('base64') }] }), { headers: { 'content-type': 'application/json' } });
    };
    const input = { id: 'fixture', provider: 'openai', mode: 'figure', userInput: '', imageBuffer: png, mimeType: 'image/png', originalFilename: 'input.png', outputDir: dir };
    for (const [provider, mode, stages] of [['openai','figure',2],['openai','modelcut',1],['openai','body',1],['xai','free',2],['xai','modelcut',1]]) {
      calls.length = 0;
      const result = await generateAiImageOnce({ ...input, provider, mode, userInput: 'studio style' });
      assert.equal(calls.length, stages); assert.equal(result.provider, provider); assert.equal(result.mode, mode);
      assert.deepEqual(await fs.readFile(result.filePath), png);
    }
    for (const [provider, mode, failingStage] of [['openai','figure',2],['openai','modelcut',1],['openai','body',1],['xai','figure',2],['xai','modelcut',1]]) {
      calls.length = 0; failAt = failingStage;
      await assert.rejects(generateAiImageOnce({ ...input, provider, mode }), /uncertain provider failure/);
      assert.equal(calls.length, failingStage);
    }
    calls.length = 0; failAt = null; returnUrl = true;
    await assert.rejects(generateAiImageOnce({ ...input, mode: 'modelcut' }), /Inline image output required/);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.openai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous.openai;
    if (previous.xai === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = previous.xai;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
