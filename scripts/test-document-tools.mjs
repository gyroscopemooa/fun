import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

const base = process.env.DOCUMENT_TOOLS_TEST_URL || 'http://127.0.0.1:4371';
const live = process.env.DOCUMENT_TOOLS_REAL === '1';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) console.log('URL:', frame.url()); });
  page.on('requestfailed', request => { if (/huggingface|jsdelivr|tessdata|xethub/.test(request.url())) console.log('DOWNLOAD FAILED:', request.url(), request.failure()?.errorText); });
  page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER:', msg.text().slice(0, 300)); });
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith(base) || url.startsWith('blob:') || (live && /https:\/\/(cdn\.jsdelivr\.net|huggingface\.co|[^/]*\.huggingface\.co|[^/]*\.xethub\.hf\.co|tessdata\.projectnaptha\.com)\//.test(url)) ? route.continue() : route.abort();
  });
  async function visit(path) {
    const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await page.waitForSelector('astro-island[component-url*="DocumentWorkshop"]:not([ssr])', { state: 'attached', timeout: 90000 });
  }
  await visit('/photo-to-document');
  await page.getByLabel('문서 제목', { exact: true }).fill('테스트 문서');
  await page.locator('.dw-panel textarea').last().fill('한글과 English <테스트> & 내용\n두 번째 문단');
  for (const [label, extension] of [['TXT 저장', 'txt'], ['Word 저장 (.docx)', 'docx']]) {
    const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: label, exact: true }).click();
    const download = await waiting; assert.equal(download.suggestedFilename(), `테스트 문서.${extension}`);
    const bytes = await readFile(await download.path());
    if (extension === 'txt') assert(bytes.toString('utf8').includes('한글과 English <테스트> & 내용\n두 번째 문단'));
    else { const entries = unzipSync(bytes); const xml = strFromU8(entries['word/document.xml']); assert(xml.includes('한글과 English &lt;테스트&gt; &amp; 내용')); assert(xml.includes('두 번째 문단')); }
  }
  assert.equal(await page.locator('a[href="https://transtream.app/"]').count() > 0, true);
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 300;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000'; ctx.font = '60px Arial'; ctx.fillText('Hello ManyTool 12345', 50, 110); ctx.font = '48px "Malgun Gothic"'; ctx.fillText('사진으로 문서 만들기', 50, 210);
    return c.toDataURL().split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await page.waitForTimeout(300);
  console.log('PHOTO selected:', await page.locator('h1').allTextContents());
  if (live) {
    await page.locator('.dw-panel textarea').last().fill('');
    await page.getByRole('button', { name: '사진 속 글자 가져오기' }).click();
    await page.waitForTimeout(5000); console.log('PHOTO status:', await page.locator('.dw-status').innerText(), await page.locator('.dw-error').allTextContents(), await page.locator('.dw-panel textarea').last().inputValue());
    await expect(page.locator('.dw-panel textarea').last()).toHaveValue(/Hello Many\s?Tool 12345/, { timeout: 180000 });
    console.log('PASS real photo recognition:', await page.locator('.dw-panel textarea').last().inputValue());
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: 'tmp/document-tools-mobile.png', fullPage: true });
  await visit('/voice-to-document');
  await page.getByRole('button', { name: '마이크로 녹음하기', exact: true }).click();
  await expect(page.getByRole('button', { name: /녹음 마치기/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /녹음 마치기/ }).click();
  await expect(page.getByRole('button', { name: '음성을 글로 바꾸기' })).toBeEnabled();
  await expect(page.locator('.dw-status')).toContainText('녹음이 준비되었습니다');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.wav', mimeType: 'audio/wav', buffer: Buffer.from('invalid audio') });
  await page.getByRole('button', { name: '음성을 글로 바꾸기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '음성을 글로 바꾸기' })).toBeEnabled();
  if (live) {
    await page.locator('.document-workshop select').selectOption('en');
    await page.locator('input[type=file]').setInputFiles('tmp/document-tools-jfk.wav');
    await page.getByRole('button', { name: '음성을 글로 바꾸기' }).click();
    await expect(page.locator('.dw-panel textarea').last()).toHaveValue(/country/i, { timeout: 360000 });
    console.log('PASS real audio:', await page.locator('.dw-panel textarea').last().inputValue());
  }
  await visit('/text-translator');
  await page.getByLabel('TXT 파일 가져오기').setInputFiles({ name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('안녕하세요. 만나서 반갑습니다.') });
  await expect(page.locator('.dw-panel textarea').first()).toHaveValue('안녕하세요. 만나서 반갑습니다.');
  if (live) {
    await page.getByRole('button', { name: '번역하기', exact: true }).click();
    await expect(page.locator('.dw-panel textarea').last()).toHaveValue(/hello|hi|meet|nice/i, { timeout: 360000 });
    console.log('PASS real Korean→English:', await page.locator('.dw-panel textarea').last().inputValue());
    await page.locator('.document-workshop select').selectOption('en');
    await page.locator('.dw-panel textarea').first().fill('Hello. It is nice to meet you.');
    await page.getByRole('button', { name: '번역하기', exact: true }).click();
    await expect(page.locator('.dw-panel textarea').last()).toHaveValue(/[가-힣]/, { timeout: 600000 });
    console.log('PASS real English→Korean:', await page.locator('.dw-panel textarea').last().inputValue());
  }
  await page.locator('.dw-panel textarea').first().fill('가'.repeat(3001));
  await expect(page.getByRole('button', { name: '번역하기', exact: true })).toBeDisabled();
  console.log('PASS document downloads, escaped DOCX XML, text import, audio error recovery, length limit, mobile layout');
} finally { await browser.close(); }
