// What each wheel offers per file kind. The convert wheel changes the format; the tools wheel edits or bundles.
import { cropCanvas, decodeToCanvas, encodeCanvas, formatOfFile, hasTransparency, scaleCanvas, transformCanvas, type RasterFormat } from './image-codec';
import { hwpToText, renderHwpPages } from './hwp-ops';
import { extractPdfText, imagesToPdf, mergePdfs, renderPdfPages, rotatePdf, splitPdf, zipBlobs } from './pdf-ops';

export type DialKind = 'image' | 'pdf' | 'hwp' | 'mixed';
export type DialMode = 'convert' | 'tools';
export type DialOutput = { name: string; blob: Blob; from: string };
export type RunContext = { progress: (text: string) => void };
export type DialAction = {
  id: string;
  /** Short petal label. */
  label: string;
  /** One line shown under the wheel while the petal is highlighted. */
  hint: string;
  /** Opens the crop/rotate/resize editor instead of running directly. */
  opensEditor?: boolean;
  /** Opens the document preview instead of running directly. */
  opensPreview?: boolean;
  /** Opens the PDF page organizer instead of running directly. */
  opensPages?: boolean;
  run?: (files: File[], ctx: RunContext) => Promise<DialOutput[]>;
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'file';
const EXT: Record<RasterFormat, string> = { jpg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', bmp: 'bmp', ico: 'ico', tiff: 'tif' };

export const kindOfFile = (file: File): 'image' | 'pdf' | 'hwp' | 'other' => {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (/\.hwpx?$/i.test(file.name) || /hwp/i.test(file.type)) return 'hwp';
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|ico|svg|tiff?|hei[cf])$/i.test(file.name)) return 'image';
  return 'other';
};

export const kindOfFiles = (files: File[]): DialKind | null => {
  const kinds = new Set(files.map(kindOfFile));
  if (kinds.has('other') || kinds.size === 0) return null;
  // HWP files are handled on their own; images and PDFs can be combined.
  if (kinds.has('hwp')) return kinds.size === 1 ? 'hwp' : null;
  return kinds.size > 1 ? 'mixed' : (kinds.values().next().value as 'image' | 'pdf');
};

/** Best guess while a drag is still in progress (only MIME types are visible, not names). */
export const kindOfDragTypes = (types: string[]): DialKind => {
  if (types.some((t) => /hwp/i.test(t))) return 'hwp';
  const pdf = types.some((t) => t === 'application/pdf');
  const image = types.some((t) => t.startsWith('image/'));
  if (pdf && image) return 'mixed';
  return pdf ? 'pdf' : 'image';
};

const eachImage = async (files: File[], ctx: RunContext, fn: (canvas: HTMLCanvasElement, file: File) => Promise<DialOutput>) => {
  const out: DialOutput[] = [];
  for (const [i, file] of files.entries()) {
    ctx.progress(`${i + 1} / ${files.length} 처리 중… ${file.name}`);
    out.push(await fn(await decodeToCanvas(file), file));
  }
  return out;
};

const convertTo = (format: RasterFormat, quality?: number) => (files: File[], ctx: RunContext) =>
  eachImage(files, ctx, async (canvas, file) => ({ name: `${baseName(file.name)}.${EXT[format]}`, blob: await encodeCanvas(canvas, format, quality), from: file.name }));

const keepFormat = (suffix: string, edit: (canvas: HTMLCanvasElement) => HTMLCanvasElement, quality = 0.92) => (files: File[], ctx: RunContext) =>
  eachImage(files, ctx, async (canvas, file) => {
    const format = formatOfFile(file);
    return { name: `${baseName(file.name)}-${suffix}.${EXT[format]}`, blob: await encodeCanvas(edit(canvas), format, quality), from: file.name };
  });

const imagesAsPdf = async (files: File[], ctx: RunContext): Promise<DialOutput[]> => {
  const canvases: HTMLCanvasElement[] = [];
  for (const [i, file] of files.entries()) {
    ctx.progress(`${i + 1} / ${files.length} 페이지 준비 중…`);
    canvases.push(await decodeToCanvas(file));
  }
  const name = files.length === 1 ? `${baseName(files[0].name)}.pdf` : `images-${files.length}pages.pdf`;
  return [{ name, blob: await imagesToPdf(canvases), from: files.map((f) => f.name).join(', ') }];
};

const pdfToImages = (format: RasterFormat) => async (files: File[], ctx: RunContext) => {
  const out: DialOutput[] = [];
  for (const file of files) {
    const pages = await renderPdfPages(file, 2, (done, total) => ctx.progress(`${file.name}: ${done} / ${total} 페이지`));
    for (const [i, page] of pages.entries()) {
      out.push({ name: `${baseName(file.name)}-p${String(i + 1).padStart(2, '0')}.${EXT[format]}`, blob: await encodeCanvas(page, format, 0.9), from: file.name });
    }
  }
  return out;
};

const hwpToImages = (format: RasterFormat) => async (files: File[], ctx: RunContext) => {
  const out: DialOutput[] = [];
  for (const file of files) {
    const pages = await renderHwpPages(file, (done, total) => ctx.progress(`${file.name}: ${done} / ${total} 페이지`));
    for (const [i, page] of pages.entries()) {
      out.push({ name: `${baseName(file.name)}-p${String(i + 1).padStart(2, '0')}.${EXT[format]}`, blob: await encodeCanvas(page, format, 0.92), from: file.name });
    }
  }
  return out;
};

const zipAll = async (files: File[]) => [{ name: files.length === 1 ? `${baseName(files[0].name)}.zip` : `manytool-${files.length}files.zip`, blob: await zipBlobs(files.map((f) => ({ name: f.name, blob: f }))), from: `${files.length}개 파일` }];

export const ACTIONS: Record<DialKind, Record<DialMode, DialAction[]>> = {
  image: {
    convert: [
      { id: 'jpg', label: 'JPG', hint: 'JPG: 어디서나 열리는 가장 보편적인 사진 형식', run: convertTo('jpg', 0.92) },
      { id: 'png', label: 'PNG', hint: 'PNG: 화질 손실 없음, 투명 배경 유지', run: convertTo('png') },
      { id: 'webp', label: 'WEBP', hint: 'WEBP: JPG보다 가벼운 웹용 이미지', run: convertTo('webp', 0.85) },
      { id: 'avif', label: 'AVIF', hint: 'AVIF: 가장 작은 용량의 차세대 이미지 (변환이 조금 느려요)', run: convertTo('avif', 0.7) },
      { id: 'pdf', label: 'PDF', hint: 'PDF: 사진들을 A4 페이지로 묶은 PDF 한 개', run: imagesAsPdf },
      { id: 'bmp', label: 'BMP', hint: 'BMP: 압축하지 않은 비트맵 (오래된 프로그램용)', run: convertTo('bmp') },
      { id: 'tiff', label: 'TIFF', hint: 'TIFF: 인쇄·출판용 무손실 이미지', run: convertTo('tiff') },
      { id: 'ico', label: 'ICO', hint: 'ICO: 16~256px 크기가 들어간 아이콘·파비콘', run: convertTo('ico') }
    ],
    tools: [
      { id: 'edit', label: '자르기', hint: '자르기·회전·크기: 비율을 정해 자르고 원하는 크기로 저장', opensEditor: true },
      { id: 'compress', label: '용량 줄이기', hint: '용량 줄이기: 품질 75%로 다시 저장 (PNG는 WEBP/JPG로)', run: (files, ctx) =>
        eachImage(files, ctx, async (canvas, file) => {
          const original = formatOfFile(file);
          const format: RasterFormat = original === 'jpg' || original === 'webp' ? original : hasTransparency(canvas) ? 'webp' : 'jpg';
          return { name: `${baseName(file.name)}-small.${EXT[format]}`, blob: await encodeCanvas(canvas, format, 0.75), from: file.name };
        }) },
      { id: 'half', label: '50% 축소', hint: '50% 축소: 가로세로를 절반으로 줄여 같은 형식으로 저장', run: keepFormat('half', (c) => scaleCanvas(c, c.width / 2, c.height / 2)) },
      { id: 'rotate', label: '회전 90°', hint: '회전: 시계 방향으로 90도 돌리기', run: keepFormat('rotated', (c) => transformCanvas(c, { rotate: 90 })) },
      { id: 'flip', label: '좌우 반전', hint: '좌우 반전: 거울처럼 뒤집기 (셀카 좌우 맞추기)', run: keepFormat('flipped', (c) => transformCanvas(c, { flipX: true })) },
      { id: 'gray', label: '흑백', hint: '흑백: 색을 빼고 흑백 사진으로', run: keepFormat('gray', (c) => transformCanvas(c, { grayscale: true })) },
      { id: 'strip', label: '정보 지우기', hint: '정보 지우기: 촬영 위치·기기 정보(EXIF) 없이 다시 저장', run: keepFormat('clean', (c) => cropCanvas(c, { x: 0, y: 0, width: c.width, height: c.height }), 0.95) },
      { id: 'zip', label: 'ZIP', hint: 'ZIP: 선택한 파일을 압축파일 하나로 묶기', run: zipAll }
    ]
  },
  pdf: {
    convert: [
      { id: 'pdf-jpg', label: 'JPG', hint: 'JPG: 페이지마다 JPG 이미지로 저장', run: pdfToImages('jpg') },
      { id: 'pdf-png', label: 'PNG', hint: 'PNG: 페이지마다 선명한 PNG로 저장', run: pdfToImages('png') },
      { id: 'pdf-webp', label: 'WEBP', hint: 'WEBP: 페이지마다 가벼운 WEBP로 저장', run: pdfToImages('webp') },
      { id: 'pdf-txt', label: 'TXT', hint: 'TXT: PDF 안의 글자만 텍스트 파일로 추출', run: async (files, ctx) => {
        const out: DialOutput[] = [];
        for (const file of files) {
          ctx.progress(`${file.name}: 글자 추출 중…`);
          out.push({ name: `${baseName(file.name)}.txt`, blob: new Blob([await extractPdfText(file)], { type: 'text/plain;charset=utf-8' }), from: file.name });
        }
        return out;
      } }
    ],
    tools: [
      { id: 'pages', label: '페이지 정리', hint: '페이지 정리: 범위로 뽑기·순서 바꾸기·빼기·페이지별 회전', opensPages: true },
      { id: 'merge', label: '합치기', hint: '합치기: 놓은 순서대로 PDF 여러 개를 하나로', run: async (files, ctx) => {
        ctx.progress('PDF 합치는 중…');
        return [{ name: `merged-${files.length}files.pdf`, blob: await mergePdfs(files), from: files.map((f) => f.name).join(', ') }];
      } },
      { id: 'split', label: '나누기', hint: '나누기: 모든 페이지를 한 장짜리 PDF로', run: async (files, ctx) => {
        const out: DialOutput[] = [];
        for (const file of files) {
          ctx.progress(`${file.name}: 페이지 나누는 중…`);
          (await splitPdf(file)).forEach((blob, i) => out.push({ name: `${baseName(file.name)}-p${String(i + 1).padStart(2, '0')}.pdf`, blob, from: file.name }));
        }
        return out;
      } },
      { id: 'pdf-rotate', label: '회전 90°', hint: '회전: 모든 페이지를 시계 방향으로 90도', run: async (files) =>
        Promise.all(files.map(async (file) => ({ name: `${baseName(file.name)}-rotated.pdf`, blob: await rotatePdf(file, 90), from: file.name }))) },
      { id: 'pdf-zip', label: 'ZIP', hint: 'ZIP: 선택한 PDF를 압축파일 하나로 묶기', run: zipAll }
    ]
  },
  hwp: {
    convert: [
      { id: 'hwp-pdf', label: 'PDF', hint: 'PDF: 한글 문서를 페이지 그대로 PDF로 (복잡한 서식은 다를 수 있어요)', run: async (files, ctx) => {
        const out: DialOutput[] = [];
        for (const file of files) {
          ctx.progress(`${file.name}: 페이지 그리는 중…`);
          const pages = await renderHwpPages(file, (done, total) => ctx.progress(`${file.name}: ${done} / ${total} 페이지`));
          out.push({ name: `${baseName(file.name)}.pdf`, blob: await imagesToPdf(pages), from: file.name });
        }
        return out;
      } },
      { id: 'hwp-txt', label: 'TXT', hint: 'TXT: 본문과 표 안의 글자만 텍스트 파일로 추출', run: async (files, ctx) => {
        const out: DialOutput[] = [];
        for (const file of files) {
          ctx.progress(`${file.name}: 글자 추출 중…`);
          out.push({ name: `${baseName(file.name)}.txt`, blob: new Blob([await hwpToText(file)], { type: 'text/plain;charset=utf-8' }), from: file.name });
        }
        return out;
      } },
      { id: 'hwp-jpg', label: 'JPG', hint: 'JPG: 페이지마다 JPG 이미지로 저장', run: hwpToImages('jpg') },
      { id: 'hwp-png', label: 'PNG', hint: 'PNG: 페이지마다 선명한 PNG로 저장', run: hwpToImages('png') }
    ],
    tools: [
      { id: 'hwp-preview', label: '미리보기', hint: '미리보기: 한글 프로그램 없이 브라우저에서 문서 열어 보기', opensPreview: true },
      { id: 'hwp-zip', label: 'ZIP', hint: 'ZIP: 선택한 문서를 압축파일 하나로 묶기', run: zipAll }
    ]
  },
  mixed: {
    convert: [
      { id: 'mixed-pdf', label: 'PDF 하나로', hint: 'PDF 하나로: 사진은 페이지로 바꾸고 PDF와 순서대로 합치기', run: async (files, ctx) => {
        const parts: File[] = [];
        for (const [i, file] of files.entries()) {
          ctx.progress(`${i + 1} / ${files.length} 준비 중…`);
          if (kindOfFile(file) === 'pdf') parts.push(file);
          else parts.push(new File([await imagesToPdf([await decodeToCanvas(file)])], `${baseName(file.name)}.pdf`, { type: 'application/pdf' }));
        }
        return [{ name: `combined-${files.length}files.pdf`, blob: await mergePdfs(parts), from: files.map((f) => f.name).join(', ') }];
      } }
    ],
    tools: [{ id: 'mixed-zip', label: 'ZIP', hint: 'ZIP: 선택한 파일을 압축파일 하나로 묶기', run: zipAll }]
  }
};

/** After a drop the real kind is known; keep the user's choice when the same kind of petal exists there. */
export const matchAction = (kind: DialKind, mode: DialMode, picked: DialAction | undefined) => {
  if (!picked) return undefined;
  const actions = ACTIONS[kind][mode];
  return actions.find((a) => a.id === picked.id) ?? actions.find((a) => a.label === picked.label);
};
