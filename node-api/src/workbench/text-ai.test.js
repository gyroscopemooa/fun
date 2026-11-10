import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextProvider, createGatedTextService, prepareTextRequest, TEXT_ACTIONS } from './text-ai.js';
const request = { action: 'summarize', text: 'Selected text', consent: { providerLabel: 'OpenAI', shareSelectedContent: true }, requestKey: '0123456789abcdef' };
const result = text => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] }));
test('all five text actions are validated; image actions fail closed', () => {
  for (const action of TEXT_ACTIONS) assert.equal(prepareTextRequest({ ...request, action }).action, action);
  for (const action of ['image-translate', 'image-table', '__proto__']) assert.throws(() => prepareTextRequest({ ...request, action }), /UNSUPPORTED_ACTION/);
});
test('consent and text bounds reject without provider transmission', async () => {
  let calls = 0; const generate = createTextProvider({ apiKey: 'test', model: 'configured-model', fetcher: () => { calls++; } });
  for (const body of [{ ...request, text: '' }, { ...request, text: 'x'.repeat(20001) }, { ...request, consent: null }, { ...request, consent: { providerLabel: 'Other', shareSelectedContent: true } }]) await assert.rejects(generate(body));
  assert.equal(calls, 0);
});
test('fixed endpoint, bounded output, no storage/tools and isolated source text', async () => {
  const generate = createTextProvider({ apiKey: 'test', model: 'configured-model', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1800); assert.equal(body.tools, undefined);
    assert.match(body.instructions, /untrusted/); assert.equal(body.input[0].content[0].text, request.text);
    assert.equal(body.cookie, undefined); return result('요약');
  } });
  assert.equal((await generate({ ...request, url: 'secret', cookie: 'secret' })).text, '요약');
});
test('provider failures and incomplete responses disclose no upstream details', async () => {
  for (const fetcher of [async () => { throw Error('API_KEY_PRIVATE'); }, async () => new Response('private', { status: 401 }), async () => new Response('{bad'), async () => new Response(JSON.stringify({ status: 'incomplete' }))]) {
    await assert.rejects(createTextProvider({ apiKey: 'test', model: 'm', fetcher })(request), error => !error.message.includes('private') && !error.message.includes('API_KEY'));
  }
});
test('oversized and empty responses fail closed', async () => {
  for (const text of ['', 'x'.repeat(20001), 'x'.repeat(300000)]) await assert.rejects(createTextProvider({ apiKey: 'test', model: 'm', fetcher: async () => result(text) })(request), /INVALID_PROVIDER_RESPONSE/);
});
test('disabled and unconfigured services never execute', async () => {
  let calls = 0; const generate = async () => { calls++; };
  for (const config of [{}, { enabled: true, generate }, { generate, creditTransaction: generate }]) {
    const service = createGatedTextService(config); assert.equal(service.capability().enabled, false); await assert.rejects(service.run(request, {}), /AI_NOT_READY/);
  }
  assert.equal(calls, 0);
});
test('authenticated context and idempotency key are mandatory before credit adapter', async () => {
  let calls = 0; const service = createGatedTextService({ enabled: true, generate: async () => 'done', creditTransaction: async ({ execute }) => { calls++; return execute(); } });
  await assert.rejects(service.run(request, { authenticated: false, accountId: 'a' }), /AUTH_REQUIRED/);
  await assert.rejects(service.run({ ...request, requestKey: 'short' }, { authenticated: true, accountId: 'a' }), /INVALID_REQUEST_KEY/);
  assert.equal(calls, 0);
  assert.equal(await service.run(request, { authenticated: true, accountId: 'a' }), 'done'); assert.equal(calls, 1);
});
