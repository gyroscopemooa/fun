// PDF helpers: render pages with pdf.js, build/merge/split/rotate with pdf-lib. All local.
import { canvasToJpegBytes, canvasToPngBytes, hasTransparency } from './image-codec';

const loadPdfJs = async () => {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
};

/** Renders every page to a canvas at roughly 150 dpi (scale 2 of 72 dpi). */
export const renderPdfPages = async (file: File, scale = 2, onPage?: (done: number, total: number) => void) => {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: HTMLCanvasElement[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF를 그릴 수 없어요.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push(canvas);
    onPage?.(n, doc.numPages);
  }
  await task.destroy();
  return pages;
};

export const extractPdfText = async (file: File) => {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const parts: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    const text = content.items.map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : '')).join('');
    parts.push(`--- ${n}페이지 ---\n${text.trim()}`);
  }
  await task.destroy();
  return parts.join('\n\n');
};

const A4 = { width: 595.28, height: 841.89 };

/** One PDF from images: each image on its own A4 page (portrait or landscape to match), centred with a margin. */
export const imagesToPdf = async (canvases: HTMLCanvasElement[]) => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const canvas of canvases) {
    const image = hasTransparency(canvas) ? await pdf.embedPng(await canvasToPngBytes(canvas)) : await pdf.embedJpg(await canvasToJpegBytes(canvas));
    const landscape = canvas.width > canvas.height;
    const pageSize = landscape ? { width: A4.height, height: A4.width } : A4;
    const margin = 24;
    const fit = Math.min((pageSize.width - margin * 2) / image.width, (pageSize.height - margin * 2) / image.height, 1);
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    const w = image.width * fit;
    const h = image.height * fit;
    page.drawImage(image, { x: (pageSize.width - w) / 2, y: (pageSize.height - h) / 2, width: w, height: h });
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
};

export const mergePdfs = async (files: File[]) => {
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  for (const file of files) {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return new Blob([new Uint8Array(await merged.save())], { type: 'application/pdf' });
};

export const splitPdf = async (file: File) => {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out: Blob[] = [];
  for (const index of doc.getPageIndices()) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [index]);
    single.addPage(page);
    out.push(new Blob([new Uint8Array(await single.save())], { type: 'application/pdf' }));
  }
  return out;
};

export const rotatePdf = async (file: File, by: 90 | 180 | 270) => {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  doc.getPages().forEach((page) => page.setRotation(degrees((page.getRotation().angle + by) % 360)));
  return new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' });
};

export const zipBlobs = async (entries: { name: string; blob: Blob }[]) => {
  const { zip } = await import('fflate');
  const used = new Map<string, number>();
  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    // Avoid silently overwriting entries with the same name.
    const count = used.get(entry.name) ?? 0;
    used.set(entry.name, count + 1);
    const name = count ? entry.name.replace(/(\.[^.]+)?$/, `-${count + 1}$1`) : entry.name;
    files[name] = new Uint8Array(await entry.blob.arrayBuffer());
  }
  return new Promise<Blob>((resolve, reject) => {
    zip(files, { level: 0 }, (error, data) => (error ? reject(error) : resolve(new Blob([data], { type: 'application/zip' }))));
  });
};

export type PageSpec = { index: number; rotate: 0 | 90 | 180 | 270 };

/** New PDF from chosen pages in the given order, each with an extra rotation. */
export const rebuildPdf = async (file: File, pages: PageSpec[]) => {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, pages.map((p) => p.index));
  copied.forEach((page, i) => {
    page.setRotation(degrees((page.getRotation().angle + pages[i].rotate) % 360));
    out.addPage(page);
  });
  return new Blob([new Uint8Array(await out.save())], { type: 'application/pdf' });
};

/** Parses "1-3, 5, 8-" into zero-based page indexes (in the order written). */
export const parsePageRange = (input: string, total: number) => {
  const picked: number[] = [];
  for (const part of input.split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d*)-(\d*)$/);
    if (m) {
      const from = m[1] ? Number(m[1]) : 1;
      const to = m[2] ? Number(m[2]) : total;
      const step = from <= to ? 1 : -1;
      for (let n = from; step > 0 ? n <= to : n >= to; n += step) if (n >= 1 && n <= total) picked.push(n - 1);
    } else if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= total) picked.push(n - 1);
    }
  }
  return picked;
};
