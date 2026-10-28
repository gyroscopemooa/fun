import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackCommerceDetailPage, normalizeCommerceDetailPage } from './detailPage.js';

test('preserves a product-specific section order and layout choices', () => {
  const payload = buildFallbackCommerceDetailPage(5, 2);
  payload.sections = ['hero', 'usage', 'ingredient', 'detail', 'cta'].map((type, i) => ({ ...payload.sections[i], type, layout: ['split', 'image-first', 'text-focus', 'split', 'text-focus'][i], image_index: i % 2 }));
  const result = normalizeCommerceDetailPage(payload, 2, 5);
  assert.deepEqual(result.section_order, ['hero', 'usage', 'ingredient', 'detail', 'cta']);
  assert.deepEqual(result.sections.map(s => s.layout), ['split', 'image-first', 'text-focus', 'split', 'text-focus']);
});

test('requested section count wins over the model count and oversized output', () => {
  const payload = buildFallbackCommerceDetailPage(10, 1);
  const result = normalizeCommerceDetailPage(payload, 1, 5);
  assert.equal(result.page_count, 5);
  assert.equal(result.sections.length, 5);
  assert.equal(result.section_order.length, 5);
  assert.equal(result.sections.at(-1).type, 'cta');
});

test('short legacy results keep working and invalid layout/image values are sanitized', () => {
  const payload = buildFallbackCommerceDetailPage(5, 1);
  payload.sections = [{ ...payload.sections[0], layout: 'unknown', image_index: 99 }];
  const result = normalizeCommerceDetailPage(payload, 1, 7);
  assert.equal(result.sections.length, 7);
  assert.equal(result.sections[0].layout, 'stacked');
  assert.equal(result.sections[0].image_index, -1);
  assert.equal(result.sections[0].type, 'hero');
  assert.equal(result.sections.at(-1).type, 'cta');
  assert.deepEqual(result.section_order, result.sections.map(s => s.type));
});
