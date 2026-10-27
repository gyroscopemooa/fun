import { test, expect, type Page } from '@playwright/test';
import { correctPairs } from '../model/fixtures';
import { writeFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  // Existing analytics/advertising is preserved in the app, but not exercised by local tests.
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4337') ? route.continue() : route.abort());
  await page.addInitScript(() => localStorage.setItem('manytool-locale', 'ko'));
});
async function open(page: Page, panel = false) {
  await page.goto('/tools/electric-practical');
  await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await page.getByLabel('실습 과제', { exact: true }).selectOption(panel ? 'panel' : 'basic');
}
async function connectTerminals(page: Page, a: string, b: string, count: number) {
  const from = page.getByTestId(`terminal-${a.replace(':', '-')}`), to = page.getByTestId(`terminal-${b.replace(':', '-')}`);
  await from.scrollIntoViewIfNeeded(); await to.scrollIntoViewIfNeeded();
  const start = await from.boundingBox(), end = await to.boundingBox();
  if (!start || !end) throw new Error('Terminal missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(page.getByTestId('wire-count')).toHaveText(`전선 ${count}개`);
}
async function wireLesson(page: Page, excluded = -1) {
  let count = 0; for (let i = 0; i < correctPairs.length; i++) if (i !== excluded) { const [a, b] = correctPairs[i]; await connectTerminals(page, a, b, ++count); }
}
async function press(page: Page, id: string, on: boolean) {
  const button = page.getByTestId(`press-${id}`); await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox(); if (!box) throw new Error('Button missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await expect(page.getByTestId('coil-status')).toHaveText(on ? '여자 ON' : '소자 OFF');
  await expect(page.getByTestId('lamp-status')).toHaveText(on ? '점등 ON' : '소등 OFF');
  await page.mouse.up();
}
test('mouse wire from empty → real START/hold/STOP → nine-step passing grade', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const started = Date.now(); await open(page);
  const navigation = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return { domContentLoadedMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd, responseEndMs: n.responseEnd }; });
  writeFileSync('docs/electric-practical/evidence/browser-performance.json', JSON.stringify({ browser: page.context().browser()?.version(), hydratedAfterNavigationMs: Date.now() - started, ...navigation, viewport: page.viewportSize(), productionPreview: !!process.env.ELECTRIC_PREVIEW }, null, 2));
  await wireLesson(page); await page.getByTestId('run').click();
  await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await press(page, 'START', true); await expect(page.getByTestId('coil-status')).toHaveText('여자 ON');
  await page.screenshot({ path: 'docs/electric-practical/evidence/self-hold-on.png', fullPage: true });
  await press(page, 'STOP', false); await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await press(page, 'START', true); await page.getByTestId('power').click(); await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await page.getByTestId('power').click(); await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
  await expect(page.locator('.ep-pass')).toHaveCount(9);
  await page.screenshot({ path: 'docs/electric-practical/evidence/grade-pass.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('missing hold wire fails after START release; mouse repair passes', async ({ page }) => {
  await open(page); await wireLesson(page, 5); await page.getByTestId('run').click();
  await press(page, 'START', true); await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('불합격');
  await expect(page.getByTestId('grade-report')).toContainText('MC1 NO를 START 양단에 병렬');
  await page.getByTestId('run').click(); await connectTerminals(page, ...correctPairs[5] as [string, string], 10);
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
});
test('mouse-wired L–N short trips; wire deletion and undo/redo alter diagnosis', async ({ page }) => {
  await open(page); await connectTerminals(page, 'PS1:L', 'PS1:N', 1);
  await page.getByTestId('run').click(); await expect(page.getByTestId('live-faults')).toContainText('SHORT');
  await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await page.screenshot({ path: 'docs/electric-practical/evidence/short-detected.png', fullPage: true });
  await page.getByTestId('run').click();
  await page.getByTestId('wire-W1').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Delete');
  await expect(page.getByTestId('wire-count')).toHaveText('전선 0개');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByTestId('wire-count')).toHaveText('전선 1개');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByTestId('wire-count')).toHaveText('전선 0개');
  await page.getByTestId('run').click(); await expect(page.getByTestId('live-faults')).not.toContainText('SHORT');
});
test('local save/reload and JSON roundtrip preserve behavior; corrupt import keeps work', async ({ page }) => {
  await open(page); await wireLesson(page); await page.getByRole('button', { name: '로컬 저장', exact: true }).click();
  await page.reload(); await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '로컬 불러오기', exact: true }).click(); await expect(page.getByTestId('wire-count')).toHaveText('전선 10개');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSON 내보내기', exact: true }).click();
  const download = await downloadPromise; const path = await download.path(); if (!path) throw new Error('Download missing');
  await page.getByRole('button', { name: '빈 과제로 시작', exact: true }).click();
  await page.getByLabel('회로 JSON 가져오기').setInputFiles(path); await expect(page.getByTestId('wire-count')).toHaveText('전선 10개');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
  await page.getByLabel('회로 JSON 가져오기').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') });
  await expect(page.getByRole('status', { name: '회로 작업 알림' })).toContainText('불러오기 실패'); await expect(page.getByTestId('wire-count')).toHaveText('전선 10개');
});
test('keyboard connect, snapped move, reroute and contact-property fault are functional', async ({ page }) => {
  await open(page);
  await page.getByTestId('terminal-PS1-L').focus(); await page.keyboard.press('Enter');
  await page.getByTestId('terminal-F1-1').focus(); await page.keyboard.press('Enter'); await expect(page.getByTestId('wire-count')).toHaveText('전선 1개');
  await page.getByRole('button', { name: '학습 예제 불러오기', exact: true }).click();
  const node = page.getByTestId('node-MC1'); await node.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
  await expect(node.locator('..')).toHaveAttribute('transform', 'translate(280,460)');
  await node.scrollIntoViewIfNeeded(); const box = await node.boundingBox(); if (!box) throw new Error('Node missing');
  await page.mouse.move(box.x + 30, box.y + 12); await page.mouse.down(); await page.mouse.move(box.x + 64, box.y + 46, { steps: 5 }); await page.mouse.up();
  await expect(node.locator('..')).toHaveAttribute('transform', 'translate(320,500)');
  await page.getByRole('button', { name: '확대', exact: true }).click(); await expect(page.locator('.ep-editor-tools output')).toHaveText('100%');
  await page.getByTestId('wire-W1').focus(); await page.keyboard.press('Enter');
  await page.getByLabel('선 모양', { exact: true }).selectOption('straight');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
  await page.getByRole('combobox', { name: '끝 단자', exact: true }).selectOption('PS1:N');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-report')).toContainText('SHORT');
  await page.getByRole('combobox', { name: '끝 단자', exact: true }).selectOption('F1:1');
  await page.getByRole('button', { name: '＋ 표시등', exact: true }).click(); await expect(page.getByTestId('node-PL2')).toBeAttached();
  await page.getByRole('button', { name: '선택 삭제', exact: true }).click(); await expect(page.getByTestId('node-PL2')).toHaveCount(0);
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
  await page.getByTestId('node-MC1_NO').click(); await page.getByLabel('접점 형식', { exact: true }).selectOption('AUX_NC');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('불합격'); await expect(page.getByTestId('grade-report')).toContainText('OSCILLATION');
});
test.describe('mobile touch emulation', () => {
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test('mobile read mode can operate and inspect a real loaded circuit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page);
  await expect(page.getByTestId('mobile-readonly')).toBeVisible();
  await page.getByRole('button', { name: '학습 예제 불러오기', exact: true }).click(); await page.getByTestId('run').click();
  await page.getByTestId('press-START').tap(); await expect(page.getByTestId('coil-status')).toHaveText('여자 ON');
  await page.getByTestId('press-STOP').tap(); await expect(page.getByTestId('coil-status')).toHaveText('소자 OFF');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('합격 ·');
  await page.screenshot({ path: 'docs/electric-practical/evidence/mobile-readonly.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
});
test('ManyTool entry, return and existing personal-color smoke regression', async ({ page }) => {
  await page.goto('/'); await page.locator('#tool-search').fill('전기기능사');
  await page.locator('[data-card][data-fav-key="/tools/electric-practical"]:visible').first().click();
  await expect(page).toHaveURL(/\/tools\/electric-practical/); await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('link', { name: '← ManyTool 도구 모음', exact: true }).click(); await expect(page).toHaveURL(/\/tools\/?$/);
  await page.locator('main').getByRole('link', { name: '전기기능사 실기 시뮬레이터', exact: true }).click(); await expect(page).toHaveURL(/\/tools\/electric-practical/);
  await page.goto('/'); await page.locator('#tool-search').fill('퍼스널컬러'); await page.locator('[data-card][data-fav-key="/ai-personal-color"]:visible').first().click();
  await expect(page.locator('#file-input')).toBeAttached(); await expect(page.locator('#camera-start')).toBeVisible(); await expect(page.locator('#analyze-button')).toBeDisabled(); await expect(page.locator('#status')).toBeVisible();
});
test('English browser stays on the available Korean tool route without a 404 redirect', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1365, height: 900 } });
  await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4337') ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4337/tools/electric-practical');
  await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await expect(page).toHaveURL('http://127.0.0.1:4337/tools/electric-practical');
  const links = await page.locator('header details a').evaluateAll(elements => elements.map(e => e.getAttribute('href')));
  expect(links.length).toBeGreaterThan(0); expect(links.every(href => href?.replace(/\/+$/, '') === '/tools/electric-practical')).toBe(true);
  await context.close();
});

test('default panel exposes all 80 screws; click corners, recolor, move bend and save actual wiring', async ({ page }) => {
  await open(page, true);
  for (const id of ['TB5A', 'TB5B', 'TB6A', 'TB6B']) await expect(page.locator(`[data-terminal^="${id}:"]`)).toHaveCount(20);
  await page.getByLabel('새 전선 색', { exact: true }).selectOption('brown');
  await page.getByTestId('terminal-TB5A-1B').click();
  const background = page.getByTestId('board-background');
  await background.click({ position: { x: 120 * 0.7, y: 180 * 0.7 } });
  await background.click({ position: { x: 200 * 0.7, y: 180 * 0.7 } });
  await expect(page.getByTestId('wiring-guide')).toContainText('(2/64)');
  await page.getByTestId('terminal-F1-1').click();
  await expect(page.getByTestId('wire-count')).toHaveText('전선 1개');
  await expect(page.getByTestId('wire-W1')).toHaveAttribute('data-color', 'brown');
  await page.getByRole('button', { name: '로컬 저장', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('manytool:electric-practical:v1')!));
  expect(saved.wires[0].waypoints).toEqual([{ x: 120, y: 180 }, { x: 200, y: 180 }]);
  await page.getByTestId('wire-W1').focus(); await page.keyboard.press('Enter');
  await page.getByTestId('bend-W1-0').focus(); await page.keyboard.press('ArrowRight');
  await page.getByLabel('선택 전선 색', { exact: true }).selectOption('gray');
  await expect(page.getByTestId('wire-W1')).toHaveAttribute('data-color', 'gray');
  await page.getByRole('button', { name: '로컬 저장', exact: true }).click();
  await page.reload(); await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '로컬 불러오기', exact: true }).click();
  await expect(page.getByTestId('wire-W1')).toHaveAttribute('data-color', 'gray');
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('manytool:electric-practical:v1')!));
  expect(restored.wires[0].waypoints[0]).toEqual({ x: 140, y: 180 });
  await page.getByTestId('terminal-TB5A-2B').click();
  await background.click({ position: { x: 120 * 0.7, y: 180 * 0.7 } });
  await page.keyboard.press('Backspace'); await expect(page.getByTestId('wiring-guide')).toContainText('(0/64)');
  await page.keyboard.press('Escape'); await expect(page.getByTestId('wire-preview')).toHaveCount(0);
  await expect(page.getByTestId('wire-count')).toHaveText('전선 1개');
  await page.screenshot({ path: 'docs/electric-practical/evidence/terminal-block-wiring.png', fullPage: true });
});

test('terminal-block example holds, releases, preserves wire color and detects a bridged short', async ({ page }) => {
  await open(page, true);
  await page.getByRole('button', { name: '단자대 경유 예제', exact: true }).click();
  await page.getByTestId('wire-W1').focus(); await page.keyboard.press('Enter');
  await page.getByLabel('선택 전선 색', { exact: true }).selectOption('brown');
  await page.getByTestId('run').click(); await press(page, 'START', true);
  await expect(page.getByTestId('wire-W1')).toHaveAttribute('data-color', 'brown');
  await expect(page.getByTestId('wire-W1')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('lamp-bulb-PL1')).toHaveAttribute('data-on', 'true');
  await expect(page.getByTestId('node-status-MC1_NO')).toHaveText('닫힘 ━');
  await page.getByTestId('grade').click(); await expect(page.locator('.ep-pass')).toHaveCount(9);
  await page.screenshot({ path: 'docs/electric-practical/evidence/terminal-block-running.png', fullPage: true });
  await press(page, 'STOP', false); await expect(page.getByTestId('lamp-bulb-PL1')).toHaveAttribute('data-on', 'false');
  await page.getByTestId('run').click();
  await page.getByTestId('terminal-TB5A-1B').click(); await page.getByTestId('terminal-TB5A-2B').click();
  await page.getByTestId('run').click(); await expect(page.getByTestId('live-faults')).toContainText('SHORT');
});

test('public 1 complete example operates manual timer, automatic water and EOCR flicker through actual pins', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tools/electric-practical'); await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByLabel('실습 과제', { exact: true })).toHaveValue('public1');
  await expect(page.locator('[data-terminal^="MC1:"]')).toHaveCount(12); await expect(page.locator('[data-terminal^="MC2:"]')).toHaveCount(12); await expect(page.locator('[data-terminal^="T:"]')).toHaveCount(8);
  await expect(page.getByTestId('wire-count')).toHaveText('전선 101개');
  await page.getByTestId('run').click(); await page.getByTestId('press-PB1').click();
  await expect(page.getByTestId('public-state-MC1')).toHaveAttribute('data-on', 'true');
  await expect(page.getByTestId('public-state-MC2')).toHaveAttribute('data-on', 'false');
  await expect(page.getByTestId('public-state-MC2')).toHaveAttribute('data-on', 'true', { timeout: 6000 });
  await expect(page.getByTestId('public-state-M2')).toHaveAttribute('data-on', 'true');
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await page.screenshot({ path: 'docs/electric-practical/evidence/public-one-manual.png', fullPage: true });
  await page.getByTestId('press-PB0').click(); await expect(page.getByTestId('public-state-MC1')).toHaveAttribute('data-on', 'false');
  await page.getByLabel('SS 운전 모드').selectOption('A'); await page.getByLabel('수위 입력').selectOption('high');
  await expect(page.getByTestId('public-state-MC1')).toHaveAttribute('data-on', 'true'); await expect(page.getByTestId('public-state-MC2')).toHaveAttribute('data-on', 'false');
  await page.getByLabel('수위 입력').selectOption('middle'); await expect(page.getByTestId('public-state-MC1')).toHaveAttribute('data-on', 'true');
  await page.getByLabel('수위 입력').selectOption('low'); await expect(page.getByTestId('public-state-MC1')).toHaveAttribute('data-on', 'false');
  await page.getByRole('button', { name: 'EOCR 시험 트립', exact: true }).click();
  await expect(page.getByTestId('public-state-FR')).toHaveAttribute('data-on', 'true');
  await expect(page.getByTestId('public-state-BZ')).toHaveAttribute('data-on', 'true');
  await expect(page.getByTestId('public-state-YL')).toHaveAttribute('data-on', 'true');
  await page.getByRole('button', { name: 'EOCR RESET', exact: true }).click(); await expect(page.getByTestId('public-state-FR')).toHaveAttribute('data-on', 'false');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('공개 1번 동작 시나리오 통과'); await expect(page.locator('.ep-pass')).toHaveCount(22);
  await page.getByTestId('run').click(); await page.getByText('어떻게 연결했나요?', { exact: false }).click();
  await expect(page.locator('.ep-connection-list tbody tr')).toHaveCount(101);
  await page.getByRole('button', { name: 'W1 보기', exact: true }).click(); await expect(page.getByLabel('배선 보기')).toHaveValue('selected');
  expect(errors).toEqual([]);
});

test('public 1 real wire break fails; repair, JSON restore and timing configuration work', async ({ page }) => {
  await page.goto('/tools/electric-practical'); await expect(page.getByTestId('simulator-ready')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '로컬 저장', exact: true }).click();
  const document = await page.evaluate(() => JSON.parse(localStorage.getItem('manytool:electric-practical:v1')!));
  const wire = document.wires.find((w: { to: { componentId: string; terminalId: string } }) => w.to.componentId === 'MC2' && w.to.terminalId === '6');
  await page.getByTestId(`wire-${wire.id}`).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Delete');
  await page.getByTestId('grade').click(); await expect(page.getByTestId('grade-result')).toContainText('불합격'); await expect(page.getByTestId('grade-report')).toContainText('MC2');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await page.getByTestId('grade').click(); await expect(page.locator('.ep-pass')).toHaveCount(22);
  await page.getByTestId('node-T').focus(); await page.keyboard.press('Enter'); await page.getByLabel('기기 시간 설정').selectOption('1000');
  await page.getByTestId('run').click(); await page.getByTestId('press-PB1').click(); await expect(page.getByTestId('public-state-MC2')).toHaveAttribute('data-on', 'true', { timeout: 3000 });
  await page.getByTestId('run').click(); await page.getByRole('button', { name: '빈 과제로 시작', exact: true }).click(); await expect(page.getByTestId('wire-count')).toHaveText('전선 0개');
  await page.getByLabel('회로 JSON 가져오기').setInputFiles({ name: 'public-1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await page.getByTestId('grade').click(); await expect(page.locator('.ep-pass')).toHaveCount(22);
});
