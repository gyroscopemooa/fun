// Lip detection (MediaPipe Face Landmarker, loaded from CDN on first use) and canvas lip tinting.

const MEDIAPIPE_VERSION = '1.1.0';
const MEDIAPIPE_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Face-mesh landmark indices, ordered around each contour (corner 61/78 to corner 291/308).
const UPPER_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375];
const UPPER_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324];

export type Point = { x: number; y: number };
export type LipShape = { outer: Point[]; inner: Point[]; center: Point; width: number };

type Landmarker = { detect: (image: HTMLImageElement | HTMLCanvasElement) => { faceLandmarks: { x: number; y: number }[][] } };

let landmarkerPromise: Promise<Landmarker> | null = null;

const loadLandmarker = () => {
  landmarkerPromise ??= (async () => {
    const vision = await import(/* @vite-ignore */ `${MEDIAPIPE_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE_BASE}/wasm`);
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL },
      runningMode: 'IMAGE',
      numFaces: 1
    }) as Promise<Landmarker>;
  })().catch((error) => {
    landmarkerPromise = null;
    throw error;
  });
  return landmarkerPromise;
};

export const detectLips = async (image: HTMLImageElement): Promise<LipShape | null> => {
  const landmarker = await loadLandmarker();
  const face = landmarker.detect(image).faceLandmarks?.[0];
  if (!face) return null;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const pt = (i: number) => ({ x: face[i].x * w, y: face[i].y * h });
  const outer = [...UPPER_OUTER, ...[...LOWER_OUTER].reverse()].map(pt);
  const inner = [...UPPER_INNER, ...[...LOWER_INNER].reverse()].map(pt);
  const left = pt(61);
  const right = pt(291);
  const center = { x: (pt(13).x + pt(14).x) / 2, y: (pt(13).y + pt(14).y) / 2 };
  return { outer, inner, center, width: Math.hypot(right.x - left.x, right.y - left.y) };
};

export type Finish = 'matte' | 'gloss';

const tracePath = (ctx: CanvasRenderingContext2D, points: Point[]) => {
  const last = points[points.length - 1];
  ctx.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
  // Curving through each landmark toward the next midpoint keeps the lip line from looking polygonal.
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  ctx.closePath();
};

const makeMask = (width: number, height: number, lips: LipShape) => {
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext('2d');
  if (!ctx) return mask;
  ctx.filter = `blur(${Math.max(1, lips.width / 90)}px)`;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  tracePath(ctx, lips.outer);
  tracePath(ctx, lips.inner);
  ctx.fill('evenodd');
  return mask;
};

/** Paints the photo with tinted lips onto `target` (sized to the photo). */
export const renderLips = (
  target: HTMLCanvasElement,
  image: HTMLImageElement,
  lips: LipShape | null,
  hex: string,
  intensity: number,
  finish: Finish
) => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(image, 0, 0, width, height);
  if (!lips || intensity <= 0) return;

  const mask = makeMask(width, height, lips);
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext('2d');
  if (!lctx) return;

  // 1) Hue/saturation from the shade while keeping the photo's lip texture and lighting.
  lctx.drawImage(image, 0, 0, width, height);
  lctx.globalCompositeOperation = 'color';
  lctx.globalAlpha = Math.min(1, intensity * 1.05);
  lctx.fillStyle = hex;
  lctx.fillRect(0, 0, width, height);
  // 2) Multiply adds the shade's depth so dark shades actually read as dark.
  lctx.globalCompositeOperation = 'multiply';
  lctx.globalAlpha = intensity * 0.45;
  lctx.fillRect(0, 0, width, height);

  if (finish === 'gloss') {
    lctx.globalCompositeOperation = 'soft-light';
    lctx.globalAlpha = 0.55;
    lctx.drawImage(image, 0, 0, width, height);
    const r = lips.width * 0.28;
    const gx = lips.center.x;
    const gy = lips.center.y + lips.width * 0.12;
    const glow = lctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    glow.addColorStop(0, 'rgba(255,255,255,0.55)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.globalCompositeOperation = 'screen';
    lctx.globalAlpha = 0.6;
    lctx.fillStyle = glow;
    lctx.fillRect(gx - r, gy - r, r * 2, r * 2);
  }

  // Keep only the lip area of the tinted layer, then lay it over the photo.
  lctx.globalCompositeOperation = 'destination-in';
  lctx.globalAlpha = 1;
  lctx.drawImage(mask, 0, 0);
  ctx.drawImage(layer, 0, 0);
};

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/** Mixes a #RRGGBB colour toward white (amount > 0) or black (amount < 0). */
export const shade = (hex: string, amount: number) => {
  const raw = hex.replace('#', '');
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const channels = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16)).map((c) => clampByte(c + (target - c) * t));
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};
