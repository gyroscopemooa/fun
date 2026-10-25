// Image decode/encode helpers for the file dial. Everything runs in the browser; heavy codecs load on demand.

export type RasterFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'bmp' | 'ico' | 'tiff';

// utif2 is CommonJS: Vite exposes it as `default`, the types as a namespace.
const loadUtif = async () => {
  const mod = await import('utif2');
  return ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
};

const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

export const isHeic = (file: File) => /hei[cf]/.test(file.type) || ['heic', 'heif'].includes(extOf(file.name));
export const isTiff = (file: File) => file.type === 'image/tiff' || ['tif', 'tiff'].includes(extOf(file.name));

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const ctxOf = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('이 브라우저에서는 이미지 처리를 할 수 없어요.');
  return ctx;
};

const loadViaImgTag = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 열 수 없어요. 지원하지 않는 형식일 수 있어요.'));
    img.src = url;
  });

/** Decodes any supported image file (incl. HEIC and TIFF) into a canvas. */
export const decodeToCanvas = async (file: File): Promise<HTMLCanvasElement> => {
  if (isTiff(file)) {
    const UTIF = await loadUtif();
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    UTIF.decodeImage(buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const canvas = canvasOf(ifds[0].width, ifds[0].height);
    ctxOf(canvas).putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
    return canvas;
  }
  let source: Blob = file;
  if (isHeic(file)) {
    try {
      // Safari decodes HEIC natively; other browsers need the converter.
      const bitmap = await createImageBitmap(file);
      const canvas = canvasOf(bitmap.width, bitmap.height);
      ctxOf(canvas).drawImage(bitmap, 0, 0);
      return canvas;
    } catch {
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({ blob: file, toType: 'image/png' });
      source = Array.isArray(converted) ? converted[0] : converted;
    }
  }
  let drawable: ImageBitmap | HTMLImageElement;
  try {
    drawable = await createImageBitmap(source);
  } catch {
    drawable = await loadViaImgTag(source);
  }
  const width = 'naturalWidth' in drawable ? drawable.naturalWidth || 1024 : drawable.width;
  const height = 'naturalHeight' in drawable ? drawable.naturalHeight || 1024 : drawable.height;
  const canvas = canvasOf(width, height);
  ctxOf(canvas).drawImage(drawable, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const hasTransparency = (canvas: HTMLCanvasElement) => {
  const { data } = ctxOf(canvas).getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) return true;
  return false;
};

const flattenOnWhite = (canvas: HTMLCanvasElement) => {
  const out = canvasOf(canvas.width, canvas.height);
  const ctx = ctxOf(out);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 저장하지 못했어요.'))), type, quality);
  });

// 24-bit BMP writer (bottom-up rows, 4-byte padding).
const encodeBmp = (canvas: HTMLCanvasElement) => {
  const { width, height } = canvas;
  const { data } = ctxOf(flattenOnWhite(canvas)).getImageData(0, 0, width, height);
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const buffer = new ArrayBuffer(54 + rowSize * height);
  const view = new DataView(buffer);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, buffer.byteLength, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, rowSize * height, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  const bytes = new Uint8Array(buffer);
  for (let y = 0; y < height; y += 1) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      bytes[row + x * 3] = data[i + 2];
      bytes[row + x * 3 + 1] = data[i + 1];
      bytes[row + x * 3 + 2] = data[i];
    }
  }
  return new Blob([buffer], { type: 'image/bmp' });
};

export const scaleCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const out = canvasOf(width, height);
  const ctx = ctxOf(out);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
};

// ICO with PNG-compressed entries (supported by Windows Vista+ and all browsers).
const encodeIco = async (canvas: HTMLCanvasElement) => {
  const side = Math.max(canvas.width, canvas.height);
  const square = canvasOf(side, side);
  ctxOf(square).drawImage(canvas, (side - canvas.width) / 2, (side - canvas.height) / 2);
  const sizes = [16, 32, 48, 64, 128, 256].filter((s) => s <= Math.max(side, 16));
  const pngs = await Promise.all(sizes.map(async (s) => new Uint8Array(await (await toBlob(scaleCanvas(square, s, s), 'image/png')).arrayBuffer())));
  const header = 6 + 16 * sizes.length;
  const total = header + pngs.reduce((sum, p) => sum + p.length, 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, sizes.length, true);
  let offset = header;
  sizes.forEach((s, i) => {
    const entry = 6 + i * 16;
    view.setUint8(entry, s >= 256 ? 0 : s);
    view.setUint8(entry + 1, s >= 256 ? 0 : s);
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, pngs[i].length, true);
    view.setUint32(entry + 12, offset, true);
    new Uint8Array(buffer, offset, pngs[i].length).set(pngs[i]);
    offset += pngs[i].length;
  });
  return new Blob([buffer], { type: 'image/x-icon' });
};

const encodeAvif = async (canvas: HTMLCanvasElement, quality: number) => {
  // Use the browser encoder when it exists; otherwise the WASM encoder.
  const native = await toBlob(canvas, 'image/avif', quality).catch(() => null);
  if (native && native.type === 'image/avif') return native;
  const { encode } = await import('@jsquash/avif');
  const imageData = ctxOf(canvas).getImageData(0, 0, canvas.width, canvas.height);
  const buffer = await encode(imageData, { quality: Math.round(quality * 100) });
  return new Blob([buffer], { type: 'image/avif' });
};

const encodeTiff = async (canvas: HTMLCanvasElement) => {
  const UTIF = await loadUtif();
  const { data } = ctxOf(canvas).getImageData(0, 0, canvas.width, canvas.height);
  const buffer = UTIF.encodeImage(new Uint8Array(data.buffer), canvas.width, canvas.height);
  return new Blob([buffer], { type: 'image/tiff' });
};

export const MIME: Record<RasterFormat, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff'
};

export const encodeCanvas = async (canvas: HTMLCanvasElement, format: RasterFormat, quality = 0.9): Promise<Blob> => {
  switch (format) {
    case 'jpg': return toBlob(flattenOnWhite(canvas), 'image/jpeg', quality);
    case 'png': return toBlob(canvas, 'image/png');
    case 'webp': return toBlob(canvas, 'image/webp', quality);
    case 'avif': return encodeAvif(canvas, Math.min(quality, 0.8));
    case 'bmp': return encodeBmp(canvas);
    case 'ico': return encodeIco(canvas);
    case 'tiff': return encodeTiff(canvas);
  }
};

/** Same-format re-encode target for tools that keep the original type. */
export const formatOfFile = (file: File): RasterFormat => {
  const ext = extOf(file.name);
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'jpg';
  if (ext === 'webp') return 'webp';
  if (ext === 'avif') return 'avif';
  if (ext === 'bmp') return 'bmp';
  if (ext === 'ico') return 'ico';
  if (ext === 'tif' || ext === 'tiff') return 'tiff';
  if (ext === 'heic' || ext === 'heif') return 'jpg';
  return 'png';
};

export const transformCanvas = (canvas: HTMLCanvasElement, op: { rotate?: 0 | 90 | 180 | 270; flipX?: boolean; grayscale?: boolean }) => {
  const rotate = op.rotate ?? 0;
  const swap = rotate === 90 || rotate === 270;
  const out = canvasOf(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height);
  const ctx = ctxOf(out);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  if (op.flipX) ctx.scale(-1, 1);
  if (op.grayscale) ctx.filter = 'grayscale(1)';
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
};

export const cropCanvas = (canvas: HTMLCanvasElement, rect: { x: number; y: number; width: number; height: number }) => {
  const out = canvasOf(rect.width, rect.height);
  ctxOf(out).drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);
  return out;
};

export const canvasToJpegBytes = async (canvas: HTMLCanvasElement, quality = 0.92) =>
  new Uint8Array(await (await toBlob(flattenOnWhite(canvas), 'image/jpeg', quality)).arrayBuffer());

export const canvasToPngBytes = async (canvas: HTMLCanvasElement) => new Uint8Array(await (await toBlob(canvas, 'image/png')).arrayBuffer());
