import { fault, type CircuitDocument, type Component, type PublicControls, type SimulationInput, type SimulationResult } from '../model/schema.ts';
import { validateDocument } from '../model/validate.ts';
import { compileCircuit, path, reachable, type Edge } from '../engine/compile.ts';
import { publicControls } from './lesson.ts';

type Complex = [number, number];
const plus = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const minus = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Complex, k: number): Complex => [a[0] * k, a[1] * k];
const magnitude = (a: Complex) => Math.hypot(...a);
const zero: Complex = [0, 0];
export function loadPins(c: Component): [string, string] | null {
  if (c.kind === 'MC12' || c.kind === 'EOCR12') return ['6', '12'];
  if (c.kind === 'FLS8') return ['5', '6'];
  if (['RELAY8', 'TIMER8', 'FLICKER8'].includes(c.kind)) return ['2', '7'];
  if (c.kind === 'LAMP' || c.kind === 'BUZZER') return ['X1', 'X2'];
  return null;
}
function graphFor(doc: CircuitDocument, on: Record<string, boolean>, timers: Record<string, number>, fls: Record<string, boolean>, trip: boolean, controls: PublicControls, pressed: string[], tripped: string[]) {
  const base = compileCircuit(doc, {}), edges = [...base.edges], closed: Record<string, boolean> = {};
  for (const c of doc.components) {
    const add = (a: string, b: string, yes = true) => {
      closed[`${c.id}:${a}-${b}`] = yes;
      if (yes) edges.push({ a: `${c.id}:${a}`, b: `${c.id}:${b}`, id: `${c.id}:${a}-${b}`, kind: 'contact' });
    };
    const powered = !!on[c.id]; closed[c.id] = powered;
    switch (c.kind) {
      case 'MC12': for (const [a, b] of [['1', '7'], ['2', '8'], ['3', '9'], ['4', '10']]) add(a, b, powered); add('5', '11', !powered); break;
      case 'EOCR12': for (const [a, b] of [['1', '7'], ['2', '8'], ['3', '9'], ['10', '11']]) add(a, b); add('4', '10', !trip); add('5', '11', trip); closed[c.id] = !trip; break;
      case 'RELAY8': add('1', '3', powered); add('1', '4', !powered); add('8', '6', powered); add('8', '5', !powered); break;
      case 'TIMER8': { const done = powered && (timers[c.id] ?? 0) >= (c.params?.delayMs ?? 3000); add('1', '3', powered); add('8', '6', done); add('8', '5', !done); closed[c.id] = done; break; }
      case 'FLICKER8': { const phase = powered && Math.floor((timers[c.id] ?? 0) / (c.params?.periodMs ?? 500)) % 2 === 1; add('8', '6', phase); add('8', '5', !phase); closed[c.id] = phase; break; }
      case 'FLS8': add('4', '3', powered && !!fls[c.id]); add('4', '2', !(powered && fls[c.id])); closed[c.id] = powered && !!fls[c.id]; break;
      case 'BREAKER3': for (const [a, b] of [['1', '2'], ['3', '4'], ['5', '6']]) add(a, b, controls.breakerOn); closed[c.id] = controls.breakerOn; break;
      case 'FUSE2': add('1', '2', !tripped.includes(c.id)); add('3', '4', !tripped.includes(c.id)); closed[c.id] = !tripped.includes(c.id); break;
      case 'SELECTOR': add('M1', 'M2', controls.mode === 'M'); add('A1', 'A2', controls.mode === 'A'); break;
      case 'BUTTON4': add('13', '14', pressed.includes(c.id)); add('21', '22', !pressed.includes(c.id)); closed[c.id] = pressed.includes(c.id); break;
      case 'WATER_SENSOR': add('E1', 'E3', controls.water === 'high'); add('E2', 'E3', controls.water !== 'low'); break;
    }
  }
  const parents = new Map(base.nodes.map(n => [n, n]));
  const root = (n: string): string => { let r = n; while (parents.get(r) !== r) r = parents.get(r)!; return r; };
  for (const e of edges) { const a = root(e.a), b = root(e.b); if (a !== b) parents.set(b, a); }
  return { nodes: base.nodes, edges, net: new Map(base.nodes.map(n => [n, root(n)])), closed };
}
/** Balanced 3-phase RMS phasor source; static resistor equivalents for coils/lamps. No AC animation. */
function solvePublic(doc: CircuitDocument, graph: ReturnType<typeof graphFor>) {
  const source = doc.components.find(c => c.kind === 'THREE_PHASE')!;
  const v = (source.params?.voltage ?? 220) / Math.sqrt(3);
  const phases: [string, Complex][] = [[`${source.id}:L1`, [v, 0]], [`${source.id}:L2`, [-v / 2, -v * Math.sqrt(3) / 2]], [`${source.id}:L3`, [-v / 2, v * Math.sqrt(3) / 2]], [`${source.id}:PE`, zero]];
  const known = new Map<string, Complex>();
  const shorts: [string, string][] = [];
  phases.forEach(([p, value], i) => { const n = graph.net.get(p)!; for (let j = 0; j < i; j++) if (graph.net.get(phases[j][0]) === n) shorts.push([phases[j][0], p]); known.set(n, value); });
  const loads = doc.components.flatMap(c => { const pins = loadPins(c); if (!pins) return []; const [a, b] = pins.map(p => `${c.id}:${p}`); return [{ c, a, b, u: graph.net.get(a)!, v: graph.net.get(b)!, resistance: c.params?.resistance ?? 4840 }]; });
  const loadEdges: Edge[] = loads.map(l => ({ a: l.u, b: l.v, id: l.c.id, kind: 'contact' }));
  const anchored = new Set([...known.keys()].flatMap(n => [...reachable(n, loadEdges)]));
  const unknown = [...new Set(graph.net.values())].filter(n => anchored.has(n) && !known.has(n));
  const index = new Map(unknown.map((n, i) => [n, i]));
  const values = new Map(known), m = unknown.map(() => Array<number>(unknown.length + 2).fill(0));
  if (!shorts.length) {
    for (const l of loads) if (l.u !== l.v) for (const [a, b] of [[l.u, l.v], [l.v, l.u]]) {
      const i = index.get(a); if (i === undefined) continue; const g = 1 / l.resistance; m[i][i] += g; const j = index.get(b);
      if (j !== undefined) m[i][j] -= g;
      else { const p = known.get(b) ?? zero; m[i][unknown.length] += g * p[0]; m[i][unknown.length + 1] += g * p[1]; }
    }
    for (let col = 0; col < unknown.length; col++) {
      let pivot = col; for (let row = col + 1; row < unknown.length; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
      [m[pivot], m[col]] = [m[col], m[pivot]]; const d = m[col][col]; if (Math.abs(d) < 1e-14) throw new Error('Singular public circuit');
      for (let j = col; j < unknown.length + 2; j++) m[col][j] /= d;
      for (let row = 0; row < unknown.length; row++) if (row !== col) { const f = m[row][col]; for (let j = col; j < unknown.length + 2; j++) m[row][j] -= f * m[col][j]; }
    }
    unknown.forEach((n, i) => values.set(n, [m[i][unknown.length], m[i][unknown.length + 1]]));
  }
  const currents: Record<string, Complex> = {}, voltage: Record<string, number> = {}, injection = new Map<string, Complex>([...known.keys()].map(n => [n, zero]));
  for (const l of loads) {
    const dv = values.has(l.u) && values.has(l.v) ? minus(values.get(l.u)!, values.get(l.v)!) : zero;
    voltage[l.c.id] = magnitude(dv); currents[l.c.id] = scale(dv, 1 / l.resistance);
    if (injection.has(l.u)) injection.set(l.u, plus(injection.get(l.u)!, currents[l.c.id]));
    if (injection.has(l.v)) injection.set(l.v, minus(injection.get(l.v)!, currents[l.c.id]));
  }
  return { phases, shorts, loads, values, currents, voltage, injection };
}
export function simulatePublic(doc: CircuitDocument, previous: SimulationResult, input: SimulationInput): SimulationResult {
  const result: SimulationResult = { energized: {}, contactsClosed: {}, faults: [], stable: true, iterations: 0, timeMs: previous.timeMs + Math.max(0, input.elapsedMs || 0), powerOn: input.powerOn ?? true, tripped: [...previous.tripped], sourceTripped: previous.sourceTripped, latchedFaults: [...previous.latchedFaults], voltages: {}, loadVoltages: {}, currents: {}, supplyCurrent: 0, activeWireIds: [], timers: {}, flsMemory: {}, eocrTrip: false, phaseCurrents: {} };
  const controls: PublicControls = input.controls ?? publicControls;
  result.faults = validateDocument(doc);
  if (typeof controls.breakerOn !== 'boolean' || typeof controls.overload !== 'boolean' || (controls.resetOverload !== undefined && typeof controls.resetOverload !== 'boolean') || !Number.isFinite(input.elapsedMs) || input.elapsedMs < 0 || !['M', 'A'].includes(controls.mode) || !['low', 'middle', 'high'].includes(controls.water) || input.pressedButtons.some(id => !doc.components.some(c => c.id === id && c.kind === 'BUTTON4'))) result.faults.push(fault('INVALID_MODEL', [], '공개 1번 입력 값이 잘못되었습니다.'));
  if (result.faults.some(f => f.severity === 'error')) return { ...result, stable: false };
  const loads = doc.components.filter(c => loadPins(c));
  const wiredTerminals = new Set(doc.wires.flatMap(w => [`${w.from.componentId}:${w.from.terminalId}`, `${w.to.componentId}:${w.to.terminalId}`]));
  for (const c of loads) for (const pin of loadPins(c)!) if (!wiredTerminals.has(`${c.id}:${pin}`)) result.faults.push(fault('OPEN', [`${c.id}:${pin}`], `${c.id} 전원 단자 ${pin}에 전선이 없습니다.`, 'warning'));
  const off = Object.fromEntries(loads.map(c => [c.id, false]));
  result.energized = { ...off, M1: false, M2: false };
  if (!result.powerOn || result.sourceTripped) { result.faults.push(...result.latchedFaults); result.contactsClosed = graphFor(doc, off, {}, {}, false, controls, input.pressedButtons, result.tripped).closed; return result; }
  let on = Object.fromEntries(loads.map(c => [c.id, !!previous.energized[c.id]])), fls = { ...previous.flsMemory }, trip = controls.resetOverload ? false : !!previous.eocrTrip;
  const elapsed: Record<string, number> = Object.fromEntries(doc.components.filter(c => c.kind === 'TIMER8' || c.kind === 'FLICKER8').map(c => [c.id, previous.energized[c.id] ? (previous.timers?.[c.id] ?? 0) + input.elapsedMs : 0]));
  const seen = new Set<string>();
  for (let i = 1; i <= 32; i++) {
    result.iterations = i;
    const sig = JSON.stringify([on, fls, trip]); if (seen.has(sig)) break; seen.add(sig);
    const timers = Object.fromEntries(Object.entries(elapsed).map(([id, t]) => [id, on[id] ? t : 0]));
    const graph = graphFor(doc, on, timers, fls, trip, controls, input.pressedButtons, result.tripped);
    const net = solvePublic(doc, graph);
    if (net.shorts.length) {
      const affected = net.shorts.flatMap(([a, b]) => path(a, b, graph.edges).flatMap(e => [e.id, e.a, e.b]));
      const f = fault('SHORT', [...new Set(affected)], '서로 다른 상 또는 상–PE가 부하 없이 직접 연결되었습니다. 보호 차단했습니다.');
      result.faults.push(f); result.latchedFaults = [f]; result.sourceTripped = true; return result;
    }
    for (const fuse of doc.components.filter(c => c.kind === 'FUSE2')) for (const [a, b] of [['1', '2'], ['3', '4']]) {
      const side = reachable(`${fuse.id}:${a}`, graph.edges, `${fuse.id}:${a}-${b}`);
      if (side.has(`${fuse.id}:${b}`)) { result.faults.push(fault('PROTECTION_BYPASS', [fuse.id], '퓨즈를 우회하는 도선 경로입니다.')); continue; }
      let current: Complex = zero;
      for (const l of net.loads) { if (side.has(l.a)) current = plus(current, net.currents[l.c.id]); if (side.has(l.b)) current = minus(current, net.currents[l.c.id]); }
      for (const [p] of net.phases) if (side.has(p)) current = minus(current, net.injection.get(graph.net.get(p)!) ?? zero);
      if (magnitude(current) > (fuse.params?.ratingAmps ?? 10)) { const f = fault('OVERCURRENT', [fuse.id], `퓨즈 계산 전류 ${magnitude(current).toFixed(3)} A가 정격을 초과했습니다.`); result.faults.push(f); result.latchedFaults = [f]; result.sourceTripped = true; result.tripped.push(fuse.id); return result; }
    }
    const next = Object.fromEntries(loads.map(c => [c.id, net.voltage[c.id] >= 0.8 * (c.params?.nominalVoltage ?? 220)]));
    const nextFls: Record<string, boolean> = {};
    for (const c of doc.components.filter(c => c.kind === 'FLS8')) {
      const connected = reachable(`${c.id}:1`, graph.edges);
      nextFls[c.id] = next[c.id] && (connected.has(`${c.id}:7`) || !!fls[c.id]) && connected.has(`${c.id}:8`);
    }
    const eocrPowered = doc.components.some(c => c.kind === 'EOCR12' && next[c.id]);
    const nextTrip = eocrPowered && (controls.resetOverload ? false : trip || controls.overload);
    if (JSON.stringify([next, nextFls, nextTrip]) === JSON.stringify([on, fls, trip])) {
      result.energized = { ...result.energized, ...next }; result.contactsClosed = graph.closed; result.timers = Object.fromEntries(Object.entries(timers).map(([id, t]) => [id, next[id] ? t : 0])); result.flsMemory = nextFls; result.eocrTrip = nextTrip;
      result.voltages = Object.fromEntries(graph.nodes.map(t => [t, net.values.has(graph.net.get(t)!) ? magnitude(net.values.get(graph.net.get(t)!)!) : null]));
      result.loadVoltages = net.voltage; result.currents = Object.fromEntries(Object.entries(net.currents).map(([id, c]) => [id, magnitude(c)]));
      result.phaseCurrents = Object.fromEntries(net.phases.map(([p]) => [p, magnitude(net.injection.get(graph.net.get(p)!) ?? zero)]));
      result.supplyCurrent = Math.max(0, ...Object.values(result.phaseCurrents));
      const pe = net.phases[3][0];
      if ((result.phaseCurrents[pe] ?? 0) > 1e-8) result.faults.push(fault('EARTH', [pe], '보호도체 PE에 부하 귀환 전류가 흐릅니다. 제어회로의 귀환선을 확인하세요.'));
      for (const l of net.loads) {
        if (graph.net.get(l.a) === graph.net.get(l.b)) result.faults.push(fault('MISWIRE', [l.a, l.b], `${l.c.id} 양단이 같은 전위로 묶였습니다.`));
        const voltage = net.voltage[l.c.id]; if (voltage > 1e-6 && voltage < 0.8 * (l.c.params?.nominalVoltage ?? 220)) result.faults.push(fault('UNDERVOLTAGE', [l.a, l.b], `${l.c.id} 계산 전압 ${voltage.toFixed(1)} V가 동작 기준보다 낮습니다.`));
      }
      const active = new Set<string>(), conductive = [...graph.edges, ...net.loads.filter(l => magnitude(net.currents[l.c.id]) > 1e-9).map(l => ({ a: l.a, b: l.b, id: l.c.id, kind: 'contact' as const }))];
      for (const l of net.loads.filter(l => magnitude(net.currents[l.c.id]) > 1e-9)) for (const end of [l.a, l.b]) {
        const withoutLoad = conductive.filter(e => e.id !== l.c.id);
        for (const [source] of net.phases) { const route = path(source, end, withoutLoad); if (route.length) { route.filter(e => e.kind === 'wire').forEach(e => active.add(e.id)); break; } }
      }
      result.activeWireIds = [...active].sort();
      for (const [output, tb, mc] of [['M1', 'TB2', 'MC1'], ['M2', 'TB3', 'MC2']]) {
        const valid = [1, 2, 3].every(n => graph.net.get(`${tb}:${n}B`) === graph.net.get(net.phases[n - 1][0])); result.energized[output] = valid;
        if (next[mc] && !valid) result.faults.push(fault('PHASE', [tb, mc], `${tb}의 U/V/W에 L1/L2/L3가 순서대로 도달하지 않습니다. 주회로를 점검하세요.`));
      }
      return result;
    }
    on = next; fls = nextFls; trip = nextTrip;
  }
  result.stable = false; result.faults.push(fault('OSCILLATION', doc.components.filter(c => loadPins(c)).map(c => c.id), '기기 접점 상태가 반복되어 안정된 동작점에 도달하지 못했습니다.')); return result;
}
