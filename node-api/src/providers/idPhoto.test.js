import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { buildPrompt } from './openAiPortraitProvider.js';
import { generateCandidatesWithProvider, isIdPhotoEnabled } from './providerRouter.js';

test('ID photo launch, outfit edits and fail-closed behavior', async () => {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'manytool-id-photo-'));
  try {
    process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
    process.env.EXTERNAL_AI_ENABLED = 'false';
    delete process.env.ID_PHOTO_ENABLED;
    assert.equal(isIdPhotoEnabled(), true);
    const source = await sharp({ create: { width: 32, height: 48, channels: 3, background: 'white' } }).png().toBuffer();
    const inputPath = path.join(dir, 'input.png');
    await fs.writeFile(inputPath, source);
    const args = { inputPath, storageDir: dir, jobId: 'test', toolType: 'id_photo', outfitType: 'current' };
    let handler;
    globalThis.fetch = (...args) => handler(...args);
    for (const outfitType of ['current', 'suit']) {
      handler = async (_url, init) => {
        const body = init.body;
        assert.equal(body.get('n'), '3');
        assert.equal(body.get('prompt'), buildPrompt('id_photo', outfitType));
        return new Response(JSON.stringify({ data: Array.from({ length: 3 }, () => ({ b64_json: source.toString('base64') })) }), { headers: { 'content-type': 'application/json' } });
      };
      const result = await generateCandidatesWithProvider({ ...args, outfitType });
      assert.equal(result.pipelineReport.resolvedProvider, 'openai_image');
      assert.equal(result.pipelineReport.fallbackToLocalSharp, false);
      assert.equal(result.generated.length, 3);
      assert.equal(result.generated[0].score, null);
      const meta = await sharp(result.generated[0].filePath).metadata();
      assert.equal(meta.width, 600);
      assert.equal(meta.height, 800);
    }
    assert.match(buildPrompt('id_photo', 'current'), /Do not add a suit/);
    assert.match(buildPrompt('id_photo', 'suit'), /business suit jacket/);
    handler = async () => new Response(JSON.stringify({ error: { message: 'test outage' } }), { status: 503, headers: { 'content-type': 'application/json' } });
    await assert.rejects(generateCandidatesWithProvider(args), /test outage/);
    process.env.ID_PHOTO_ENABLED = 'false';
    assert.equal(isIdPhotoEnabled(), false);
    await assert.rejects(generateCandidatesWithProvider(args), { statusCode: 503 });
    delete process.env.ID_PHOTO_ENABLED;
    delete process.env.OPENAI_API_KEY;
    assert.equal(isIdPhotoEnabled(), false);
    await assert.rejects(generateCandidatesWithProvider(args), { statusCode: 503 });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['OPENAI_API_KEY', 'EXTERNAL_AI_ENABLED', 'ID_PHOTO_ENABLED']) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + 'manytool-id-photo-'));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
