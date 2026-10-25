// HWP (binary, via hwp.js) and HWPX (zipped XML) support: text extraction and page rendering. All local.
import type Paragraph from 'hwp.js/build/models/paragraph';

export const isHwpx = (file: File) => /\.hwpx$/i.test(file.name);
export const isHwp = (file: File) => /\.hwp$/i.test(file.name) || /hwp/i.test(file.type);

type Cell = { items?: unknown } | undefined;
type TableLike = { content: unknown };
const isTable = (control: unknown): control is TableLike =>
  Boolean(control && typeof control === 'object' && 'content' in control && typeof (control as TableLike).content === 'object' && (control as TableLike).content);
// hwp.js fills table rows by index, so rows and cells can be sparse arrays or plain objects.
const listOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []) as T[];

const paragraphText = (paragraph: Paragraph): string => {
  let text = '';
  for (const char of paragraph.content) {
    if (typeof char.value === 'string') text += char.value;
    else if (char.value === 9) text += '\t';
  }
  // Tables live in paragraph controls; flatten them row by row with tabs between cells.
  for (const control of paragraph.controls) {
    if (!isTable(control)) continue;
    const rows = listOf<unknown>(control.content).map((row) =>
      listOf<Cell>(row).filter(Boolean).map((cell) => listOf<Paragraph>(cell?.items).map(paragraphText).join(' ').trim()).join('\t'));
    text += `\n${rows.join('\n')}\n`;
  }
  return text;
};

const readHwp = async (file: File) => {
  const { parse } = await import('hwp.js');
  return parse(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
};

const readHwpxSections = async (file: File) => {
  const { unzipSync, strFromU8 } = await import('fflate');
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const names = Object.keys(entries).filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  if (!names.length) throw new Error('HWPX 본문을 찾지 못했어요.');
  const parser = new DOMParser();
  return names.map((name) => {
    const xml = parser.parseFromString(strFromU8(entries[name]), 'application/xml');
    // <hp:p> paragraphs contain <hp:t> text runs.
    return Array.from(xml.getElementsByTagNameNS('*', 'p'))
      .filter((p) => !p.parentElement || p.parentElement.localName !== 'p')
      .map((p) => Array.from(p.getElementsByTagNameNS('*', 't')).map((t) => t.textContent ?? '').join(''));
  });
};

export const hwpToText = async (file: File) => {
  if (isHwpx(file)) return (await readHwpxSections(file)).map((lines) => lines.join('\n')).join('\n\n').trim();
  const doc = await readHwp(file);
  return doc.sections.map((section) => section.content.map(paragraphText).join('\n')).join('\n\n').trim();
};

const offscreenHost = (width: number) => {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;background:#fff;`;
  document.body.appendChild(host);
  return host;
};

const PAGE_STYLE_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-height', 'box-sizing', 'overflow',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-collapse',
  'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-decoration-line', 'vertical-align', 'white-space', 'word-break', 'transform', 'transform-origin',
  'table-layout', 'flex-direction', 'justify-content', 'align-items'
];

const rasterize = async (pages: HTMLElement[], onPage?: (done: number, total: number) => void) => {
  const { toCanvas } = await import('html-to-image');
  const canvases: HTMLCanvasElement[] = [];
  for (const [i, page] of pages.entries()) {
    page.style.boxShadow = 'none';
    page.style.margin = '0';
    // Document pages use system fonts and plain box styles: skip font embedding and copy only the
    // properties that affect layout, which makes rasterizing several times faster.
    canvases.push(await toCanvas(page, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true, includeStyleProperties: PAGE_STYLE_PROPS }));
    onPage?.(i + 1, pages.length);
  }
  return canvases;
};

// HWPX has no layout engine here, so text is flowed onto plain A4 pages.
const hwpxPages = (host: HTMLElement, sections: string[][]) => {
  const pages: HTMLElement[] = [];
  const newPage = () => {
    const page = document.createElement('div');
    page.style.cssText = 'width:794px;height:1123px;padding:72px 76px;box-sizing:border-box;background:#fff;color:#111;font:15px/1.7 "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;overflow:hidden;white-space:pre-wrap;word-break:keep-all;';
    host.appendChild(page);
    pages.push(page);
    return page;
  };
  let page = newPage();
  for (const lines of sections) {
    for (const line of lines) {
      const p = document.createElement('p');
      p.style.margin = '0 0 6px';
      p.textContent = line || ' ';
      page.appendChild(p);
      if (page.scrollHeight > page.clientHeight) {
        page.removeChild(p);
        page = newPage();
        page.appendChild(p);
      }
    }
    page = newPage();
  }
  if (!page.childElementCount) page.remove();
  return pages.filter((p) => p.isConnected);
};

/** Renders the document pages to canvases (hwp.js layout for HWP, simple text flow for HWPX). */
export const renderHwpPages = async (file: File, onPage?: (done: number, total: number) => void) => {
  if (isHwpx(file)) {
    const host = offscreenHost(794);
    try {
      return await rasterize(hwpxPages(host, await readHwpxSections(file)), onPage);
    } finally {
      host.remove();
    }
  }
  const { Viewer } = await import('hwp.js');
  const host = offscreenHost(1000);
  try {
    const viewer = new Viewer(host, new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    // Let layout settle; a timer (not rAF) so conversions keep running in background tabs.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const pages = Array.from(host.querySelectorAll<HTMLElement>('div[data-page-number]')).filter((el) => !el.classList.contains('hwpjs-observer'));
    if (!pages.length) throw new Error('페이지를 그리지 못했어요.');
    const canvases = await rasterize(pages, onPage);
    viewer.distory();
    return canvases;
  } finally {
    host.remove();
  }
};

/** Mounts the hwp.js viewer into a container for on-page preview. Returns a cleanup function. */
export const mountHwpPreview = async (container: HTMLElement, file: File) => {
  if (isHwpx(file)) {
    const pages = hwpxPages(container, await readHwpxSections(file));
    pages.forEach((p) => { p.style.margin = '0 auto 16px'; p.style.boxShadow = '0 1px 3px rgba(15,23,42,.15)'; });
    return () => { container.innerHTML = ''; };
  }
  const { Viewer } = await import('hwp.js');
  const viewer = new Viewer(container, new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  return () => viewer.distory();
};
