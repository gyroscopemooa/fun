/** Local-only utilities. These functions do not call AI or transmit text. */
export const MAX_INPUT = 20000;
export function validateText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('먼저 글을 입력해 주세요.');
  if (value.length > MAX_INPUT) throw new Error(`입력은 ${MAX_INPUT.toLocaleString()}자 이하로 나누어 주세요.`);
  return value.replace(/\r\n?/g, '\n');
}
export function cleanText(value: string): string {
  return validateText(value).split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
export interface Excerpt { text: string; start: number; end: number }
/** Extractive, deterministic ranking. Never generates unsupported claims. */
export function keySentences(value: string, count = 3): Excerpt[] {
  validateText(value);
  const text = value;
  const limit = Math.max(1, Math.min(8, Number.isFinite(count) ? Math.floor(count) : 3));
  const sentences = [...text.matchAll(/[^\n.!?。！？]+(?:[.!?。！？]+|$|\n)/g)].map(match => {
    const leading = match[0].length - match[0].trimStart().length;
    const content = match[0].trim();
    return { text: content, start: match.index! + leading, end: match.index! + leading + content.length };
  }).filter(s => s.text.length > 0);
  const terms = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
  const frequencies = new Map<string, number>();
  sentences.forEach(s => new Set(terms(s.text)).forEach(term => frequencies.set(term, (frequencies.get(term) || 0) + 1)));
  return sentences.map((s, i) => ({ ...s, score: [...new Set(terms(s.text))].reduce((n, term) => n + (frequencies.get(term) || 0), 0) / Math.sqrt(Math.max(1, terms(s.text).length)) + (i === 0 ? 0.2 : 0) }))
    .sort((a, b) => b.score - a.score || a.start - b.start).slice(0, limit).sort((a, b) => a.start - b.start)
    .map(({ text, start, end }) => ({ text, start, end }));
}
export type TableFormat = 'tsv' | 'markdown';
export function parseTable(value: string, format: TableFormat): string[][] {
  const lines = validateText(value).split('\n').filter(line => line.trim());
  if (lines.length > 500) throw new Error('표는 500행 이하로 나누어 주세요.');
  const rows = lines.map(line => {
    if (format === 'tsv') return line.split('\t').map(cell => cell.trim());
    if (/\\\|/.test(line)) throw new Error('셀 안의 파이프(|) 문자는 탭 구분 형식으로 바꾸어 주세요.');
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  }).filter(row => !(format === 'markdown' && row.every(cell => /^:?-{3,}:?$/.test(cell))));
  const width = rows[0]?.length || 0;
  if (width < 2) throw new Error('두 열 이상인 탭 구분 표 또는 Markdown 표를 입력해 주세요.');
  if (width > 50) throw new Error('표는 50열 이하로 나누어 주세요.');
  if (rows.some(row => row.length !== width)) throw new Error('행마다 열 수가 다릅니다. 미리보기에서 원문을 확인해 주세요.');
  return rows;
}
export function tableCsv(rows: string[][]): string {
  // Prefix potentially executable spreadsheet formulas; quoting alone is insufficient.
  const protect = (cell: string) => /^[\s\u0000-\u001f]*[=+\-@]/.test(cell) ? `'${cell}` : cell;
  return rows.map(row => row.map(cell => `"${protect(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
export function errorHints(value: string): string[] {
  const text = validateText(value);
  const rules: Array<[RegExp, string]> = [
    [/\b401\b|unauthorized/i, '401: 로그인 만료 또는 인증 누락일 수 있습니다. 공식 로그인 상태를 확인하세요.'],
    [/\b403\b|forbidden/i, '403: 권한·접근 정책 때문에 거절될 수 있습니다. 관리자에게 접근 권한을 확인하세요.'],
    [/\b404\b|not found/i, '404: 주소 또는 파일이 없을 수 있습니다. URL과 배포 경로를 확인하세요.'],
    [/\b429\b|too many requests/i, '429: 요청 제한일 수 있습니다. 안내된 대기 시간을 지킨 뒤 다시 시도하세요.'],
    [/\b50[0234]\b|bad gateway|service unavailable/i, '5xx: 서버나 중간 연결 문제일 수 있습니다. 서비스 상태와 서버 로그를 확인하세요.'],
    [/cors|cross.origin/i, 'CORS: 서버의 허용 출처 설정을 확인하세요. 브라우저 보안을 끄는 방식은 권하지 않습니다.'],
    [/timeout|timed out|시간 초과/i, '시간 초과: 네트워크 상태와 처리 시간을 확인하세요. 결제 등은 재시도 전 완료 여부를 확인하세요.'],
  ];
  return rules.filter(([pattern]) => pattern.test(text)).map(([, hint]) => hint);
}
