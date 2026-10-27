import { key, terminalKeys, type CircuitDocument } from '../model/schema.ts';
export type Edge = { a: string; b: string; id: string; kind: 'wire' | 'contact' | 'terminal' };
export function compileCircuit(doc: CircuitDocument, contacts: Record<string, boolean>) {
  const nodes = doc.components.flatMap(terminalKeys);
  const edges: Edge[] = doc.wires.map(w => ({ a: key(w.from), b: key(w.to), id: w.id, kind: 'wire' }));
  for (const c of doc.components) if (contacts[c.id]) { const [a, b] = terminalKeys(c); edges.push({ a, b, id: c.id, kind: 'contact' }); }
  // Each pole joins its two screws. Adjacent poles are electrically isolated.
  for (const c of doc.components.filter(c => c.kind === 'TERMINAL_BLOCK' || c.kind === 'TERMINAL4')) {
    for (let i = 1; i <= c.terminals.length / 2; i++) edges.push({ a: `${c.id}:${i}A`, b: `${c.id}:${i}B`, id: `${c.id}:${i}:internal`, kind: 'terminal' });
  }
  const parent = new Map(nodes.map(n => [n, n]));
  const root = (n: string): string => { let r = n; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
  for (const { a, b } of edges) { const ra = root(a), rb = root(b); if (ra !== rb) parent.set(rb, ra); }
  return { nodes, edges, net: new Map(nodes.map(n => [n, root(n)])) };
}
export function reachable(start: string, edges: Edge[], omit?: string): Set<string> {
  const visited = new Set([start]); const pending = [start];
  while (pending.length) {
    const n = pending.pop()!;
    for (const e of edges) {
      if (e.id === omit) continue;
      const next = e.a === n ? e.b : e.b === n ? e.a : undefined;
      if (next !== undefined && !visited.has(next)) { visited.add(next); pending.push(next); }
    }
  }
  return visited;
}
/** A computed representative conductive path, never an animation or geometric intersection. */
export function path(start: string, end: string, edges: Edge[]): Edge[] {
  const previous = new Map<string, { node: string; edge: Edge }>();
  const visited = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length && !visited.has(end); i++) for (const edge of edges) {
    const n = queue[i], next = edge.a === n ? edge.b : edge.b === n ? edge.a : undefined;
    if (next !== undefined && !visited.has(next)) { visited.add(next); previous.set(next, { node: n, edge }); queue.push(next); }
  }
  if (!visited.has(end)) return [];
  const result: Edge[] = []; let n = end;
  while (n !== start) { const p = previous.get(n)!; result.push(p.edge); n = p.node; }
  return result.reverse();
}
