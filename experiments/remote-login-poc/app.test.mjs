import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const newSession = id => ({
  id, token: `mock-token-${id}`, expiresAt: 300_000, authenticated: false, mode: 'mock',
});

// All browser APIs and fetch responses stay in memory. No sockets, real accounts,
// credentials, browser storage, or downloads are used by these lifecycle tests.
function fixture() {
  let now = 0;
  const elements = Object.fromEntries(
    ['start', 'login', 'download', 'close', 'status', 'url'].map(id => [id, {
      disabled: false, textContent: '', value: 'https://media.example.test/stories/test',
    }]),
  );
  const listeners = new Map();
  const requests = [], intervals = [], timeouts = [], downloads = [], blobs = [], revoked = [];
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({
    document: {
      getElementById: id => elements[id],
      createElement(tag) {
        assert.equal(tag, 'a');
        return { click() { downloads.push({ href: this.href, download: this.download }); } };
      },
    },
    window: {
      addEventListener(name, callback) {
        const handlers = listeners.get(name) || [];
        handlers.push(callback); listeners.set(name, handlers);
      },
    },
    fetch(path, options) {
      assert.equal(path, '/api');
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      return new Promise((resolve, reject) => {
        requests.push({
          body, options, reject,
          respond(result, status = 200) {
            resolve({ ok: status >= 200 && status < 300, status, json: async () => result });
          },
        });
      });
    },
    setInterval(callback) { intervals.push(callback); return intervals.length; },
    setTimeout(callback) { timeouts.push(callback); return timeouts.length; },
    URL: {
      createObjectURL(blob) { blobs.push(blob); return `blob:mock-${blobs.length}`; },
      revokeObjectURL(url) { revoked.push(url); },
    },
    Blob,
    Date: Clock,
  });
  vm.runInContext(source, context, { filename: 'app.js' });
  return {
    elements, requests, downloads, blobs, revoked,
    click: id => elements[id].onclick(),
    event(name, event = {}) { for (const listener of listeners.get(name) || []) listener(event); },
    advance(value) { now = value; for (const callback of intervals) callback(); },
    runTimeouts() { for (const callback of timeouts.splice(0)) callback(); },
  };
}

function assertIdle(ui) {
  assert.equal(ui.elements.start.disabled, false);
  for (const id of ['login', 'download', 'close']) assert.equal(ui.elements[id].disabled, true, id);
}

async function start(ui, id = 'session-one') {
  const pending = ui.click('start');
  ui.requests.at(-1).respond(newSession(id));
  await pending;
}

async function login(ui) {
  const pending = ui.click('login');
  ui.requests.at(-1).respond({ authenticated: true, expiresAt: 300_000, mode: 'mock' });
  await pending;
}

test('initial controls and rapid repeated start clicks permit one request', async () => {
  const ui = fixture();
  assertIdle(ui);
  const first = ui.click('start');
  await ui.click('start');
  await ui.click('start');
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].body.action, 'create');
  assert.equal(ui.elements.close.disabled, false, 'pending start remains cancellable');
  ui.requests[0].respond(newSession('one'));
  await first;
  assert.equal(ui.elements.start.disabled, true);
  assert.equal(ui.elements.login.disabled, false);
});

for (const dismiss of ['cancel', 'navigation and Back']) {
  test(`late create after ${dismiss} is released without restoring the screen`, async () => {
    const ui = fixture();
    const pending = ui.click('start');
    if (dismiss === 'cancel') ui.click('close');
    else {
      ui.event('pagehide');
      ui.event('pageshow', { persisted: true });
    }
    const status = ui.elements.status.textContent;
    assertIdle(ui);
    ui.requests[0].respond(newSession('late'));
    await pending;
    assertIdle(ui);
    assert.equal(ui.elements.status.textContent, status);
    assert.deepEqual(ui.requests.map(request => request.body.action), ['create', 'close']);
    assert.deepEqual(ui.requests[1].body, { action: 'close', id: 'late', token: 'mock-token-late' });
    assert.equal(ui.requests[1].options.keepalive, true);
  });
}

test('stale create cleanup does not clear a newer pending start or its session', async () => {
  const ui = fixture();
  const first = ui.click('start');
  ui.click('close');
  const second = ui.click('start');
  const newerStatus = ui.elements.status.textContent;
  ui.requests[0].respond(newSession('old'));
  await first;
  assert.equal(ui.elements.start.disabled, true, 'newer start is still busy');
  assert.equal(ui.elements.login.disabled, true);
  assert.equal(ui.elements.close.disabled, false);
  assert.equal(ui.elements.status.textContent, newerStatus);
  assert.equal(ui.requests[2].body.id, 'old', 'only the stale session is released');
  ui.requests[1].respond(newSession('new'));
  await second;
  assert.equal(ui.elements.login.disabled, false);
  ui.click('close');
  assert.equal(ui.requests.at(-1).body.id, 'new');
  assertIdle(ui);
});

test('cancel while login is pending releases once and ignores its late success', async () => {
  const ui = fixture();
  await start(ui);
  const pending = ui.click('login');
  await ui.click('login');
  assert.equal(ui.requests.length, 2, 'duplicate login did not send a second request');
  assert.equal(ui.elements.close.disabled, false);
  ui.click('close');
  ui.click('close');
  const status = ui.elements.status.textContent;
  assert.equal(ui.requests.filter(request => request.body.action === 'close').length, 1);
  ui.requests[1].respond({ authenticated: true });
  await pending;
  assertIdle(ui);
  assert.equal(ui.elements.status.textContent, status);
});

test('old login failure does not clear a newer session after cancellation', async () => {
  const ui = fixture();
  await start(ui, 'old');
  const pending = ui.click('login');
  ui.click('close');
  await start(ui, 'new');
  const status = ui.elements.status.textContent;
  ui.requests[1].respond({ error: 'Old session closed' }, 404);
  await pending;
  assert.equal(ui.elements.login.disabled, false);
  assert.equal(ui.elements.start.disabled, true);
  assert.equal(ui.elements.status.textContent, status);
  ui.click('close');
  assert.equal(ui.requests.at(-1).body.id, 'new');
});

test('cancel pending download prevents a late file and suppresses repeated clicks', async () => {
  const ui = fixture();
  await start(ui);
  await login(ui);
  const pending = ui.click('download');
  await ui.click('download');
  assert.equal(ui.requests.filter(request => request.body.action === 'download').length, 1);
  ui.click('close');
  const status = ui.elements.status.textContent;
  ui.requests[2].respond({ filename: 'mock.txt', content: 'MOCK ONLY' });
  await pending;
  assert.equal(ui.downloads.length, 0);
  assert.equal(ui.blobs.length, 0);
  assert.equal(ui.elements.status.textContent, status);
  assertIdle(ui);
});

test('pagehide and repeated persisted pageshow clear an existing session once', async () => {
  const ui = fixture();
  await start(ui);
  await login(ui);
  ui.event('pagehide');
  ui.event('pageshow', { persisted: true });
  ui.event('pageshow', { persisted: true });
  assertIdle(ui);
  assert.equal(ui.requests.filter(request => request.body.action === 'close').length, 1);
  assert.match(ui.elements.status.textContent, /새 세션/);
});

test('expiry cancels pending login and its late success cannot revive the UI', async () => {
  const ui = fixture();
  await start(ui);
  const pending = ui.click('login');
  ui.advance(300_000);
  const status = ui.elements.status.textContent;
  assert.match(status, /만료/);
  assertIdle(ui);
  assert.equal(ui.requests.at(-1).body.action, 'close');
  ui.requests[1].respond({ authenticated: true });
  await pending;
  assertIdle(ui);
  assert.equal(ui.elements.status.textContent, status);
});

test('a failed start is retryable and a cancelled network failure stays silent', async () => {
  const ui = fixture();
  const first = ui.click('start');
  ui.requests[0].reject(new Error('Mock network failure'));
  await first;
  assertIdle(ui);
  assert.equal(ui.elements.status.textContent, 'Mock network failure');
  const second = ui.click('start');
  ui.click('close');
  const status = ui.elements.status.textContent;
  ui.requests[1].reject(new Error('Late mock network failure'));
  await second;
  assertIdle(ui);
  assert.equal(ui.elements.status.textContent, status);
});

test('normal download produces only the mock artifact and revokes its object URL', async () => {
  const ui = fixture();
  await start(ui);
  await login(ui);
  const pending = ui.click('download');
  ui.requests.at(-1).respond({ filename: 'mock.txt', content: 'MOCK ONLY' });
  await pending;
  assert.deepEqual(ui.downloads, [{ href: 'blob:mock-1', download: 'mock.txt' }]);
  assert.equal(await ui.blobs[0].text(), 'MOCK ONLY');
  ui.runTimeouts();
  assert.deepEqual(ui.revoked, ['blob:mock-1']);
});
