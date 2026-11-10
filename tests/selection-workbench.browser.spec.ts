import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/selection-workbench/'); await expect(page.locator('html')).toHaveAttribute('data-manytool-import-ready', 'text'); });
test('edit and clear invalidate prior results; AI stays disabled', async ({ page }) => {
  await page.locator('#selection-source').fill('First sentence. Second sentence.');
  await page.getByRole('button', { name: '선택한 도구 실행' }).click();
  await expect(page.locator('#selection-result')).toBeVisible();
  await page.locator('#selection-source').fill('Changed input.');
  await expect(page.locator('#selection-result')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI 실행 준비 중 · 전송/차감 없음' })).toBeDisabled();
  await page.getByRole('button', { name: '모두 지우기' }).click();
  await expect(page.locator('#selection-source')).toHaveValue('');
});
test('one import requires manual execution and never overwrites edits', async ({ page }) => {
  const nonce='12345678-1234-1234-1234-123456789abc';
  await page.evaluate(nonce => document.dispatchEvent(new CustomEvent('manytool:import-v1', {detail:JSON.stringify({nonce,payload:{kind:'text',text:'Selected text.'}})})), nonce);
  await expect(page.locator('#selection-source')).toHaveValue('Selected text.');
  await expect(page.locator('#selection-result')).toHaveCount(0);
  await page.locator('#selection-source').fill('User edit.');
  await page.evaluate(nonce => document.dispatchEvent(new CustomEvent('manytool:import-v1', {detail:JSON.stringify({nonce,payload:{kind:'text',text:'Overwrite attempt.'}})})), nonce);
  await expect(page.locator('#selection-source')).toHaveValue('User edit.');
});
test('table preview and CSV formula protection', async ({ page }) => {
  await page.locator('#selection-source').fill('name\tvalue\nitem\t=1+1');
  await page.getByLabel('표 → CSV', {exact:true}).check();
  await page.getByRole('button', {name:'선택한 도구 실행'}).click();
  await expect(page.getByRole('cell', {name:'=1+1',exact:true})).toBeVisible();
  await expect(page.locator('#selection-result')).toHaveValue(/\"name\",\"value\"\r?\n\"item\",\"'=1\+1\"/);
});
