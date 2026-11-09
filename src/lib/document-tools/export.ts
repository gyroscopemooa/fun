import { safeFilename } from './text';

export async function documentBlob(text: string, title: string, format: 'txt' | 'docx') {
  if (format === 'txt') return new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' });
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  return Packer.toBlob(new Document({
    creator: 'ManyTool', title,
    styles: { default: { document: { run: { font: '맑은 고딕', size: 22 }, paragraph: { spacing: { after: 120, line: 320 } } } } },
    sections: [{ children: [
      new Paragraph({ text: title || '매니툴 문서', heading: HeadingLevel.TITLE }),
      ...text.replace(/\r\n?/g, '\n').split('\n').map(line => new Paragraph({ children: [new TextRun(line)] })),
    ] }],
  }));
}

export async function saveDocument(text: string, title: string, format: 'txt' | 'docx') {
  const blob = await documentBlob(text, title, format);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(title)}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
