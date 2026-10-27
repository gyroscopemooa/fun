import type { Component, Point, Wire } from '../model/schema.ts';

export const socketKind = (c: Component) => ['MC12', 'EOCR12', 'RELAY8', 'TIMER8', 'FLICKER8', 'FLS8'].includes(c.kind);
export const terminalBlock = (c: Component) => c.kind === 'TERMINAL_BLOCK' || c.kind === 'TERMINAL4';
export const dimensions = (c: Component) => terminalBlock(c) ? { width: c.terminals.length / 2 * 42 + 20, height: 108 } : socketKind(c) ? { width: c.terminals.length === 12 ? 210 : 180, height: 164 } : ['THREE_PHASE', 'BREAKER3'].includes(c.kind) ? { width: 190, height: 140 } : ['FUSE2', 'BUTTON4', 'SELECTOR', 'WATER_SENSOR'].includes(c.kind) ? { width: 160, height: 140 } : { width: 160, height: 108 };
export function terminalOffset(c: Component, terminal: string): Point {
  if (terminalBlock(c)) return { x: 31 + (Number.parseInt(terminal) - 1) * 42, y: terminal.endsWith('A') ? 38 : 94 };
  if (c.terminals.length === 12) { const n = Number(terminal) - 1; return { x: 20 + n % 6 * 34, y: n < 6 ? 48 : 146 }; }
  if (socketKind(c)) { const i = ['6', '5', '4', '3', '7', '8', '1', '2'].indexOf(terminal); return { x: 24 + i % 4 * 44, y: i < 4 ? 48 : 146 }; }
  if (c.kind === 'THREE_PHASE') return { x: 25 + c.terminals.indexOf(terminal) * 44, y: 116 };
  if (c.kind === 'WATER_SENSOR') return { x: 26 + c.terminals.indexOf(terminal) * 54, y: 116 };
  if (c.kind === 'BREAKER3' || c.kind === 'FUSE2') { const n = Number(terminal) - 1; return { x: 30 + Math.floor(n / 2) * 60, y: n % 2 ? 122 : 48 }; }
  if (c.kind === 'SELECTOR' || c.kind === 'BUTTON4') { const n = c.terminals.indexOf(terminal); return { x: 40 + Math.floor(n / 2) * 80, y: n % 2 ? 122 : 48 }; }
  return { x: c.kind === 'JUNCTION' ? 80 : c.terminals.indexOf(terminal) === 0 ? 0 : 160, y: 58 };
}
export function orthogonalPoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const last = result.at(-1);
    if (last && last.x !== p.x && last.y !== p.y) result.push(Math.abs(p.x - last.x) >= Math.abs(p.y - last.y) ? { x: p.x, y: last.y } : { x: last.x, y: p.y });
    if (!last || last.x !== p.x || last.y !== p.y) result.push(p);
  }
  return result;
}
export function wirePoints(w: Pick<Wire, 'route' | 'waypoints' | 'bend'>, a: Point, b: Point): Point[] {
  if (w.route === 'straight') return [a, b];
  if (w.waypoints?.length) return orthogonalPoints([a, ...w.waypoints, b]);
  const bend = w.bend ?? (a.x + b.x) / 2;
  return [a, { x: bend, y: a.y }, { x: bend, y: b.y }, b];
}
export const pathData = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

/** Leave each screw outward before taking the automatic orthogonal route. Manual corners win. */
export function automaticCorners(a: Point, b: Point, ca: Component, cb: Component, ta: string, tb: string): Point[] {
  const escape = (p: Point, c: Component, t: string): Point => terminalBlock(c) || socketKind(c) || ['BREAKER3', 'FUSE2', 'BUTTON4', 'SELECTOR', 'THREE_PHASE', 'WATER_SENSOR'].includes(c.kind)
    ? { x: p.x, y: p.y + (terminalOffset(c, t).y < dimensions(c).height / 2 ? -28 : 28) }
    : { x: p.x + (c.terminals.indexOf(t) === 0 ? -28 : 28), y: p.y };
  const aa = escape(a, ca, ta), bb = escape(b, cb, tb), av = escape(a, ca, ta).x === a.x, bv = escape(b, cb, tb).x === b.x;
  if (!av && !bv) {
    const y = Math.max(10, Math.min(a.y, b.y) - 90);
    return [aa, { x: aa.x, y }, { x: bb.x, y }, bb];
  }
  if (av && bv) {
    const x = Math.max(10, Math.min(a.x - terminalOffset(ca, ta).x, b.x - terminalOffset(cb, tb).x) - 24);
    return [aa, { x, y: aa.y }, { x, y: bb.y }, bb];
  }
  return av ? [aa, { x: bb.x, y: aa.y }, bb] : [aa, { x: aa.x, y: bb.y }, bb];
}
