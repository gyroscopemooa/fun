import { isLoad, terminalKeys, type CircuitDocument } from '../model/schema.ts';
import { compileCircuit, reachable, type Edge } from './compile.ts';

/** Ideal conductors are collapsed first; resistive loads remain edges in the nodal system. */
export function solve(doc: CircuitDocument, contacts: Record<string, boolean>) {
  const graph = compileCircuit(doc, contacts);
  const source = doc.components.find(c => c.kind === 'SUPPLY')!;
  const [l, n] = terminalKeys(source), L = graph.net.get(l)!, N = graph.net.get(n)!;
  const loads = doc.components.filter(isLoad).map(c => {
    const [a, b] = terminalKeys(c);
    return { c, a, b, u: graph.net.get(a)!, v: graph.net.get(b)!, resistance: c.params?.resistance ?? (c.kind === 'COIL' ? 240 : 480) };
  });
  const loadEdges: Edge[] = loads.map(x => ({ a: x.u, b: x.v, id: x.c.id, kind: 'contact' }));
  const anchored = new Set([...reachable(L, loadEdges), ...reachable(N, loadEdges)]);
  const nets = [...new Set(graph.net.values())].filter(x => anchored.has(x) && x !== L && x !== N);
  const index = new Map(nets.map((v, i) => [v, i]));
  const values = new Map<string, number>([[L, 24], [N, 0]]);
  const matrix = nets.map(() => Array<number>(nets.length + 1).fill(0));
  if (L !== N) {
    for (const { u, v, resistance } of loads) {
      if (u === v) continue;
      for (const [a, b] of [[u, v], [v, u]]) {
        const i = index.get(a); if (i === undefined) continue;
        const g = 1 / resistance; matrix[i][i] += g;
        const j = index.get(b); if (j !== undefined) matrix[i][j] -= g;
        else matrix[i][nets.length] += g * (values.get(b) ?? 0);
      }
    }
    for (let col = 0; col < nets.length; col++) {
      let pivot = col;
      for (let row = col + 1; row < nets.length; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
      [matrix[pivot], matrix[col]] = [matrix[col], matrix[pivot]];
      const divisor = matrix[col][col];
      if (Math.abs(divisor) < 1e-14) throw new Error('Singular anchored conductance matrix');
      for (let j = col; j <= nets.length; j++) matrix[col][j] /= divisor;
      for (let row = 0; row < nets.length; row++) if (row !== col) {
        const factor = matrix[row][col];
        for (let j = col; j <= nets.length; j++) matrix[row][j] -= factor * matrix[col][j];
      }
    }
    nets.forEach((v, i) => values.set(v, matrix[i][nets.length]));
  }
  const voltages = Object.fromEntries(graph.nodes.map(t => [t, values.get(graph.net.get(t)!) ?? null]));
  const currents: Record<string, number> = {}, loadVoltages: Record<string, number> = {};
  let supplyCurrent = 0;
  for (const x of loads) {
    const voltage = values.has(x.u) && values.has(x.v) ? values.get(x.u)! - values.get(x.v)! : 0;
    loadVoltages[x.c.id] = voltage; currents[x.c.id] = voltage / x.resistance;
    if (x.u === L) supplyCurrent += currents[x.c.id];
    if (x.v === L) supplyCurrent -= currents[x.c.id];
  }
  return { graph, l, n, L, N, loads, voltages, loadVoltages, currents, supplyCurrent };
}
