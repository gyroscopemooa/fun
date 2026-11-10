import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { generateWithOpenAiImage } from './openAiPortraitProvider.js';

test('portrait provider requests exact purchased count with mocked transport only', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'portrait-count-'));
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
  let calls = 0, wrongCount = false;
  try {
    process.env.OPENAI_API_KEY = 'test-only-not-real';
    const source = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
    const inputPath = path.join(dir, 'source.png'); await fs.writeFile(inputPath, source);
    globalThis.fetch = async (_url, init) => {
      const count = Number(init.body.get('n'));
      calls++;
      assert.ok([2, 3, 7].includes(count));
      return new Response(JSON.stringify({ data: Array.from({ length: wrongCount ? 1 : count }, () => ({ b64_json: source.toString('base64') })) }), { headers: { 'content-type': 'application/json' } });
    };
    const args = { inputPath, storageDir: dir, jobId: 'test', toolType: 'id_photo', outfitType: 'current' };
    for (const candidateCount of [2, 3, 7]) assert.equal((await generateWithOpenAiImage({ ...args, candidateCount })).generated.length, candidateCount);
    await assert.rejects(generateWithOpenAiImage({ ...args, candidateCount: 100 }), /Invalid portrait/);
    assert.equal(calls, 3);
    wrongCount = true;
    await assert.rejects(generateWithOpenAiImage(args), /unexpected candidate count/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
