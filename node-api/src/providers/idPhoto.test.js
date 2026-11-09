import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { normalizeIdPhotoStyling } from './idPhotoStyling.js';
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
    for (const [outfitType, groomingMode] of [['current', 'natural'], ['suit', 'neat'], ['current', 'passport'], ['suit', 'custom']]) {
      const styling = { groomingMode, hairOptions: { flyaways: false, smoothVolume: false, clearForehead: false, tuckSides: false } };
      handler = async (_url, init) => {
        const body = init.body;
        assert.equal(body.get('n'), '3');
        assert.equal(body.get('prompt'), buildPrompt('id_photo', outfitType, styling));
        return new Response(JSON.stringify({ data: Array.from({ length: 3 }, () => ({ b64_json: source.toString('base64') })) }), { headers: { 'content-type': 'application/json' } });
      };
      const result = await generateCandidatesWithProvider({ ...args, outfitType, ...styling });
      assert.deepEqual(result.pipelineReport.hairOptions, normalizeIdPhotoStyling(styling).hairOptions);
      assert.equal(result.pipelineReport.groomingMode, groomingMode);
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


test('grooming presets, manual OFF options and passport-style identity constraints', () => {
  assert.equal(normalizeIdPhotoStyling().groomingMode, 'natural');
  assert.equal(normalizeIdPhotoStyling({ groomingMode: 'neat', hairOptions: { smoothVolume: false } }).hairOptions.smoothVolume, true);
  const custom = { groomingMode: 'custom', hairOptions: { flyaways: false, smoothVolume: false, clearForehead: false, tuckSides: false } };
  assert.deepEqual(normalizeIdPhotoStyling(custom), custom);
  const prompt = buildPrompt('id_photo', 'current', custom);
  assert.match(prompt, /Keep the original bangs and forehead coverage/);
  assert.match(prompt, /Keep side hair placement and ear coverage unchanged/);
  assert.doesNotMatch(prompt, /Keep eyes and eyebrows visible/);
  assert.match(buildPrompt('id_photo', 'current', {groomingMode:'neat'}), /just-woke-up bedhead/);
  const passport = buildPrompt('id_photo','current',{groomingMode:'passport'});
  assert.match(passport, /Do not retouch skin/);
  assert.doesNotMatch(passport, /temporary blemishes|slight natural smile/);
  for (const invalid of [{groomingMode:'unknown'}, {hairOptions:null}, {hairOptions:[]}, {hairOptions:{flyaways:'false'}}, {hairOptions:{injected:true}}]) {
    assert.throws(() => normalizeIdPhotoStyling(invalid), {statusCode:400});
  }
});
