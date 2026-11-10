import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./browser-app.js', import.meta.url), 'utf8');
const session = id => ({ id, token: `mock-${id}`, expiresAt: 300_000, mode: 'chromium-fixture' });
const frame = (image = 'mock-jpeg', authenticated = false) => ({ image, authenticated, width: 390, height: 640 });

// Exercise only UI control logic. Images, DOM, timers and requests are fake;
// these tests neither launch Chromium nor claim visual/pixel verification.
function fixture() {
  let now = 0;
  const elements = Object.fromEntries(['start', 'login', 'download', 'close', 'status', 'url', 'screen'].map(id => [id, {
    disabled: false, textContent: '', value: 'https://media.example.test/stories/demo',
    removeAttribute(name) { delete this[name]; },
    getBoundingClientRect() { return { left: 10, top: 20, width: 195, height: 320 }; },
  }]));
  const requests = [], intervals = [], listeners = new Map(), downloads = [], blobs = [], timeouts = [], revoked = [];
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({
    document: {
      getElementById: id => elements[id],
      createElement: () => ({ click() { downloads.push({ href: this.href, filename: this.download }); } }),
    },
    window: { addEventListener(name, listener) { listeners.set(name, listener); } },
    fetch(path, options) {
      assert.equal(path, '/api');
      const body = JSON.parse(options.body);
      return new Promise((resolve, reject) => requests.push({
        body, options, reject,
        respond(value, status = 200) { resolve({ ok: status >= 200 && status < 300, status, json: async () => value }); },
      }));
    },
    setInterval(callback) { intervals.push(callback); },
    setTimeout(callback) { timeouts.push(callback); },
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:mock'; }, revokeObjectURL(url) { revoked.push(url); } },
    atob,
    Blob,
    Date: Clock,
  });
  vm.runInContext(source, context, { filename: 'browser-app.js' });
  return {
    elements, requests, downloads, blobs, revoked,
    click: (id, event) => elements[id].onclick(event),
    event(name, event = {}) { listeners.get(name)?.(event); },
    poll: () => intervals[1](),
    expire() { now = 300_000; intervals[0](); },
    runTimeouts() { for (const callback of timeouts.splice(0)) callback(); },
  };
}

async function start(ui, id = 'one') {
  const pending = ui.click('start');
  ui.requests.at(-1).respond(session(id));
  await pending;
}

async function showFrame(ui, image = 'mock-jpeg', authenticated = false) {
  const pending = ui.poll();
  ui.requests.at(-1).respond(frame(image, authenticated));
  await pending;
}

function assertIdle(ui) {
  assert.equal(ui.elements.start.disabled, false);
  assert.equal(ui.elements.download.disabled, true);
  assert.equal(ui.elements.close.disabled, true);
  assert.equal(ui.elements.screen.src, undefined);
}

test('browser polling sends one frame at a time and renders only the supplied mock JPEG', async () => {
  const ui = fixture();
  await start(ui);
  const pending = ui.poll();
  await ui.poll(); await ui.poll();
  assert.deepEqual(ui.requests.map(r => r.body.action), ['create', 'frame']);
  ui.requests[1].respond(frame());
  await pending;
  assert.equal(ui.elements.screen.src, 'data:image/jpeg;base64,mock-jpeg');
  assert.equal(ui.elements.download.disabled, true);
  await showFrame(ui, 'logged-in', true);
  assert.equal(ui.elements.download.disabled, false);
});

test('scaled browser click uses viewport coordinates and repeated clicks send once', async () => {
  const ui = fixture();
  await start(ui); await showFrame(ui);
  const event = { clientX: 107.5, clientY: 180 };
  const pending = ui.click('screen', event);
  await ui.click('screen', event);
  await ui.poll();
  assert.equal(ui.requests.length, 3, 'no duplicate click or frame while click is busy');
  assert.deepEqual(ui.requests[2].body, { action: 'click', id: 'one', token: 'mock-one', x: 195, y: 320 });
  assert.equal(ui.elements.close.disabled, false);
  ui.requests[2].respond({ authenticated: true });
  await pending;
  assert.equal(ui.elements.download.disabled, false);
});

for (const action of ['cancel', 'Back', 'expiry']) {
  test(`pending browser frame after ${action} cannot restore its image or login state`, async () => {
    const ui = fixture();
    await start(ui); await showFrame(ui, 'old', true);
    const pending = ui.poll();
    if (action === 'cancel') ui.click('close');
    else if (action === 'Back') { ui.event('pagehide'); ui.event('pageshow', { persisted: true }); }
    else ui.expire();
    const status = ui.elements.status.textContent;
    assertIdle(ui);
    ui.requests[2].respond(frame('late', true));
    await pending;
    assertIdle(ui);
    assert.equal(ui.elements.status.textContent, status);
    assert.equal(ui.requests.filter(r => r.body.action === 'close').length, 1);
  });
}

test('new session can poll before an old frame settles; old finally cannot unlock the new flight', async () => {
  const ui = fixture();
  await start(ui, 'old');
  const oldFrame = ui.poll();
  ui.click('close');
  await start(ui, 'new');
  const newFrame = ui.poll();
  assert.equal(ui.requests.at(-1).body.action, 'frame');
  assert.equal(ui.requests.at(-1).body.id, 'new');
  const requestCount = ui.requests.length;
  ui.requests[1].respond(frame('old', true));
  await oldFrame;
  await ui.poll();
  assert.equal(ui.requests.length, requestCount, 'the newer frame remains in flight');
  ui.requests[4].respond(frame('new', false));
  await newFrame;
  assert.equal(ui.elements.screen.src, 'data:image/jpeg;base64,new');
  assert.equal(ui.elements.download.disabled, true);
});

test('pre-click frame response cannot overwrite a newer authenticated click result', async () => {
  const ui = fixture();
  await start(ui); await showFrame(ui);
  const pendingFrame = ui.poll();
  const pendingClick = ui.click('screen', { clientX: 40, clientY: 70 });
  ui.requests[3].respond({ authenticated: true });
  await pendingClick;
  const status = ui.elements.status.textContent;
  ui.requests[2].respond(frame('stale-before-click', false));
  await pendingFrame;
  assert.equal(ui.elements.download.disabled, false);
  assert.equal(ui.elements.status.textContent, status);
  assert.equal(ui.elements.screen.src, 'data:image/jpeg;base64,mock-jpeg');
});

test('late click success after cancellation does not restore authentication', async () => {
  const ui = fixture();
  await start(ui); await showFrame(ui);
  const pending = ui.click('screen', { clientX: 40, clientY: 70 });
  ui.click('close');
  const status = ui.elements.status.textContent;
  ui.requests[2].respond({ authenticated: true });
  await pending;
  assertIdle(ui);
  assert.equal(ui.elements.status.textContent, status);
});

test('terminal frame failure removes the last screenshot and returns to a restartable state', async () => {
  const ui = fixture();
  await start(ui); await showFrame(ui, 'private-fixture-screen', true);
  const pending = ui.poll();
  ui.requests.at(-1).respond({ error: 'Session replaced' }, 404);
  await pending;
  assertIdle(ui);
  assert.match(ui.elements.status.textContent, /Session replaced/);
});

test('late browser create after navigation is released without starting screenshot polling', async () => {
  const ui = fixture();
  const pending = ui.click('start');
  ui.event('pagehide'); ui.event('pageshow', { persisted: true });
  ui.requests[0].respond(session('late'));
  await pending;
  await ui.poll();
  assertIdle(ui);
  assert.deepEqual(ui.requests.map(r => r.body.action), ['create', 'close']);
  assert.equal(ui.requests[1].body.id, 'late');
  assert.equal(ui.requests[1].options.keepalive, true);
});

test('fixture download decodes exact WebM bytes, uses fixed metadata and revokes its blob URL', async () => {
  const ui = fixture();
  await start(ui); await showFrame(ui, 'authenticated', true);
  const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 128, 255]);
  const pending = ui.click('download');
  await ui.click('download');
  assert.equal(ui.requests.filter(r => r.body.action === 'download').length, 1);
  ui.requests.at(-1).respond({ filename: 'manytool-test-video.webm', mime: 'video/webm', contentBase64: bytes.toString('base64'), fixtureOnly: true });
  await pending;
  assert.deepEqual(ui.downloads, [{ href: 'blob:mock', filename: 'manytool-test-video.webm' }]);
  assert.equal(ui.blobs[0].type, 'video/webm');
  assert.deepEqual(Buffer.from(await ui.blobs[0].arrayBuffer()), bytes);
  assert.match(ui.elements.status.textContent, /외부 사이트 영상은 아닙니다/);
  ui.runTimeouts();
  assert.deepEqual(ui.revoked, ['blob:mock']);
});

test('cancelling fixture media request prevents its late WebM from downloading', async () => {
  const ui = fixture();
  await start(ui); await showFrame(ui, 'authenticated', true);
  const pending = ui.click('download');
  const request = ui.requests.at(-1);
  ui.click('close');
  request.respond({ filename: 'manytool-test-video.webm', mime: 'video/webm', contentBase64: 'GkXfow==', fixtureOnly: true });
  await pending;
  assert.equal(ui.downloads.length, 0);
  assert.equal(ui.blobs.length, 0);
  assertIdle(ui);
});
