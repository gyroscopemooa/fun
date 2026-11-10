import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, errorHints, keySentences, parseTable, tableCsv, validateText } from '../src/lib/selection-workbench/core.ts';
import { prepareAiRequest } from '../src/lib/selection-workbench/ai-contract.ts';
test('reject empty and oversized text', () => { assert.throws(() => validateText(' ')); assert.throws(() => validateText('x'.repeat(20001))); });
test('normalizes CRLF and spacing without inventing text', () => { assert.equal(cleanText(' A  B\r\n\r\n\r\n C\t D '), 'A B\n\nC D'); });
test('excerpts remain in original order and preserve exact offsets', () => {
  const source = '  첫 문장입니다.\n둘째 문장입니다! 셋째 문장도 있습니다? 마지막입니다.';
  const result = keySentences(source);
  assert.equal(result.length, 3);
  result.forEach((r, i) => { assert.equal(source.slice(r.start, r.end), r.text); if (i) assert.ok(r.start > result[i - 1].start); });
});
test('handles one long sentence and caps requested count', () => { assert.equal(keySentences('one sentence').length, 1); assert.equal(keySentences('A. B. C.', -1).length, 1); });
test('TSV table parses blank cells', () => { assert.deepEqual(parseTable('a\tb\tc\nx\t\tz', 'tsv'), [['a','b','c'],['x','','z']]); });
test('Markdown separator is not data', () => { assert.deepEqual(parseTable('| A | B |\n| --- | :---: |\n| 1 | 2 |', 'markdown'), [['A','B'],['1','2']]); });
test('reject malformed table rather than silently pad', () => { assert.throws(() => parseTable('a\tb\nx', 'tsv')); assert.throws(() => parseTable('a b', 'tsv')); });
test('reject unsupported escaped pipe', () => { assert.throws(() => parseTable('| a\\|b | c |', 'markdown')); });
test('CSV escapes quotes and prevents spreadsheet formula execution', () => { assert.equal(tableCsv([['=1+1',' @SUM(A1)','-2','+3','a"b']]), '"\'=1+1","\' @SUM(A1)","\'-2","\'+3","a""b"'); });
test('unknown errors have no fabricated diagnosis', () => { assert.deepEqual(errorHints('something happened'), []); assert.equal(errorHints('HTTP 403 Forbidden CORS').length, 2); });
test('AI disabled even with consent', () => { assert.throws(() => prepareAiRequest('explain', 'text', { providerLabel:'test', shareSelectedContent:true }), /준비/); });
test('future AI contract requires ready credits and explicit matching provider', () => {
  const capability = { enabled:true, creditsReady:true, providerLabel:'Provider A' };
  assert.throws(() => prepareAiRequest('rewrite', 'text', { providerLabel:'Provider B', shareSelectedContent:true }, capability));
  assert.throws(() => prepareAiRequest('rewrite', 'text', { providerLabel:'Provider A', shareSelectedContent:false }, capability));
  assert.deepEqual(Object.keys(prepareAiRequest('rewrite','text',{providerLabel:'Provider A',shareSelectedContent:true},capability)).sort(), ['action','consent','text']);
});

test('TSV retains trailing empty cells', () => { assert.deepEqual(parseTable('a\tb\n1\t', 'tsv'), [['a','b'],['1','']]); });

test('excerpt offsets preserve CRLF source', () => { const s='First sentence.\r\nSecond sentence!'; keySentences(s).forEach(r => assert.equal(s.slice(r.start,r.end),r.text)); });
