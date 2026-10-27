import { key, type CircuitDocument, type TerminalRef, type Point, type WireColor } from '../model/schema.ts';
export type History = { present: CircuitDocument; past: CircuitDocument[]; future: CircuitDocument[] };
export const history = (doc: CircuitDocument): History => ({ present: doc, past: [], future: [] });
export const commit = (h: History, doc: CircuitDocument): History => ({ present: doc, past: [...h.past.slice(-49), h.present], future: [] });
export const undo = (h: History): History => h.past.length ? { present: h.past.at(-1)!, past: h.past.slice(0, -1), future: [h.present, ...h.future] } : h;
export const redo = (h: History): History => h.future.length ? { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) } : h;
export function connect(doc: CircuitDocument, from: TerminalRef, to: TerminalRef, waypoints: Point[] = [], color: WireColor = 'yellow'): CircuitDocument {
  if (key(from) === key(to) || doc.wires.some(w => [key(w.from), key(w.to)].sort().join('|') === [key(from), key(to)].sort().join('|'))) return doc;
  if (doc.wires.length >= 240) throw new Error('전선은 최대 240개입니다.');
  let i = 1; while (doc.wires.some(w => w.id === `W${i}`)) i++;
  return { ...doc, wires: [...doc.wires, { id: `W${i}`, from, to, route: 'orthogonal', waypoints, color }] };
}
export function removeSelection(doc: CircuitDocument, selection: { type: 'wire' | 'component'; id: string }): CircuitDocument {
  if (selection.type === 'wire') return { ...doc, wires: doc.wires.filter(w => w.id !== selection.id) };
  const positions = { ...doc.ui?.positions }; delete positions[selection.id];
  return { ...doc, components: doc.components.filter(c => c.id !== selection.id), wires: doc.wires.filter(w => w.from.componentId !== selection.id && w.to.componentId !== selection.id), ui: { positions } };
}
export const snap = (value: number) => Math.max(0, Math.min(1800, Math.round(value / 20) * 20));
