export const MAX_TEXT = 3000;
// Keep short clauses below the tokenizer limit; never silently discard a long input.
export function splitForTranslation(text: string): string[] {
  const chunks: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) { chunks.push(''); continue; }
    let rest = line;
    while (rest.length > 180) {
      const prefix = rest.slice(0, 180);
      const boundary = Math.max(prefix.lastIndexOf('. '), prefix.lastIndexOf('! '), prefix.lastIndexOf('? '), prefix.lastIndexOf(' '));
      let end = boundary > 70 ? boundary + 1 : 180;
      if (/[\uD800-\uDBFF]/.test(rest[end - 1])) end--;
      chunks.push(rest.slice(0, end));
      rest = rest.slice(end);
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

export function safeFilename(title: string) {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/[. ]+$/g, '').trim().slice(0, 80) || '매니툴 문서';
}
