const SLICE_HEIGHT = 3000;
const PIXEL_RATIO = 2;

export const getExportFileBaseName = (productName: string) => {
  const normalized = productName.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'detail-page';
};

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
};

export const downloadText = (text: string, filename: string, mime = 'text/html') => {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  downloadDataUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// The node must already be laid out at exactly `width` CSS px (the canvas is rendered at the
// target marketplace width and only visually scaled down in the preview).
export const renderNodeToCanvas = async (node: HTMLElement, width: number) => {
  const { toCanvas } = await import('html-to-image');
  if (document.fonts?.ready) await document.fonts.ready;
  const height = Math.max(1, node.scrollHeight);
  return toCanvas(node, {
    cacheBust: true,
    pixelRatio: PIXEL_RATIO,
    width,
    height,
    backgroundColor: '#ffffff',
    filter: (element) => !(element instanceof HTMLElement && element.dataset.exportIgnore === 'true')
  });
};

export const exportCanvasImage = (canvas: HTMLCanvasElement, format: 'png' | 'jpg', baseName: string) => {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  downloadDataUrl(canvas.toDataURL(mime, format === 'png' ? undefined : 0.92), `${baseName}.${format}`);
};

export const exportCanvasPdf = async (canvas: HTMLCanvasElement, baseName: string) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: canvas.height >= canvas.width ? 'portrait' : 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${baseName}.pdf`);
};

// Marketplaces reject very tall single images, so cut at section boundaries near SLICE_HEIGHT.
export const exportCanvasSlices = (canvas: HTMLCanvasElement, node: HTMLElement, baseName: string) => {
  const scale = canvas.width / Math.max(1, node.offsetWidth);
  const nodeTop = node.getBoundingClientRect().top;
  const boundaries = Array.from(node.querySelectorAll<HTMLElement>('[data-export-section="true"]'))
    .map((section) => Math.round((section.getBoundingClientRect().bottom - nodeTop) * scale * (node.offsetWidth / Math.max(1, node.getBoundingClientRect().width))));
  const ranges: Array<{ top: number; height: number }> = [];
  let sliceTop = 0;
  while (sliceTop < canvas.height) {
    const targetBottom = Math.min(canvas.height, sliceTop + SLICE_HEIGHT * scale);
    const safeBoundary = boundaries.filter((bottom) => bottom > sliceTop + 400 * scale && bottom <= targetBottom).pop();
    const sliceBottom = targetBottom === canvas.height ? canvas.height : safeBoundary ?? targetBottom;
    ranges.push({ top: sliceTop, height: Math.max(1, sliceBottom - sliceTop) });
    sliceTop = sliceBottom;
  }

  ranges.forEach((range, index) => {
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = range.height;
    const context = slice.getContext('2d');
    if (!context) throw new Error('슬라이스 캔버스를 만들지 못했습니다.');
    context.drawImage(canvas, 0, range.top, canvas.width, range.height, 0, 0, canvas.width, range.height);
    downloadDataUrl(slice.toDataURL('image/jpeg', 0.92), `${baseName}-${String(index + 1).padStart(2, '0')}.jpg`);
  });
  return ranges.length;
};
