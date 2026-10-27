import { isPublicOne } from '../public-one/lesson.ts';
import { simulatePublic } from '../public-one/simulate.ts';
import { fault, isLoad, terminalKeys, type CircuitDocument, type Fault, type SimulationInput, type SimulationResult } from '../model/schema.ts';
import { openTerminals, validateDocument } from '../model/validate.ts';
import { path, reachable } from './compile.ts';
import { solve } from './conductivity.ts';

export const MAX_ITERATIONS = 32;
export function initialState(): SimulationResult {
  return { energized: {}, contactsClosed: {}, faults: [], stable: true, iterations: 0, timeMs: 0, powerOn: false, tripped: [], sourceTripped: false, latchedFaults: [], voltages: {}, loadVoltages: {}, currents: {}, supplyCurrent: 0, activeWireIds: [] };
}
function contacts(doc: CircuitDocument, energized: Record<string, boolean>, pressed: string[], tripped: string[]) {
  return Object.fromEntries(doc.components.filter(c => ['PUSH_NO', 'PUSH_NC', 'AUX_NO', 'AUX_NC', 'FUSE'].includes(c.kind)).map(c => [c.id,
    c.kind === 'PUSH_NO' ? pressed.includes(c.id) : c.kind === 'PUSH_NC' ? !pressed.includes(c.id) : c.kind === 'AUX_NO' ? !!energized[c.linkId!] : c.kind === 'AUX_NC' ? !energized[c.linkId!] : !tripped.includes(c.id),
  ]));
}
/** Pure deterministic state transition; elapsed time is virtual and never reads a clock. */
export function simulate(doc: CircuitDocument, previous: SimulationResult, input: SimulationInput): SimulationResult {
  if (isPublicOne(doc)) return simulatePublic(doc, previous, input);
  const validation = validateDocument(doc);
  const result: SimulationResult = { ...initialState(), timeMs: previous.timeMs + (Number.isFinite(input.elapsedMs) && input.elapsedMs >= 0 ? input.elapsedMs : 0), powerOn: input.powerOn ?? true,
    tripped: [...previous.tripped], sourceTripped: previous.sourceTripped, latchedFaults: [...previous.latchedFaults] };
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0 || input.pressedButtons.some(id => !doc.components.some(c => c.id === id && ['PUSH_NO', 'PUSH_NC'].includes(c.kind)))) validation.push(fault('INVALID_MODEL', input.pressedButtons, '유효한 버튼과 0 이상의 가상 시간이 필요합니다.'));
  if (validation.some(f => f.severity === 'error')) return { ...result, faults: validation, stable: false };
  const loads = doc.components.filter(isLoad);
  result.energized = Object.fromEntries(loads.map(c => [c.id, false]));
  result.contactsClosed = contacts(doc, result.energized, input.pressedButtons, result.tripped);
  result.faults = [...validation, ...openTerminals(doc), ...result.latchedFaults];
  if (!result.powerOn || result.sourceTripped || result.tripped.length) return result;
  let energized = Object.fromEntries(loads.map(c => [c.id, !!previous.energized[c.id]]));
  const seen = new Set<string>();
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    result.iterations = iteration;
    const signature = JSON.stringify(energized);
    if (seen.has(signature)) break;
    seen.add(signature);
    const closed = contacts(doc, energized, input.pressedButtons, result.tripped);
    const network = solve(doc, closed);
    if (network.L === network.N) {
      const shortPath = path(network.l, network.n, network.graph.edges);
      const affected = shortPath.flatMap(e => [e.id, e.a, e.b]);
      const f = fault('SHORT', [...new Set(affected)], '부하를 거치지 않는 L–N 직결 경로입니다. 보호 차단 후 결선을 수정하고 초기화하세요.');
      result.tripped = doc.components.filter(c => c.kind === 'FUSE' && shortPath.some(e => e.id === c.id)).map(c => c.id);
      result.sourceTripped = true; result.latchedFaults = [f]; result.faults.push(f);
      result.contactsClosed = contacts(doc, result.energized, input.pressedButtons, result.tripped);
      return result;
    }
    const overcurrent: Fault[] = [];
    for (const fuse of doc.components.filter(c => c.kind === 'FUSE')) {
      const [a, b] = terminalKeys(fuse);
      const side = reachable(a, network.graph.edges, fuse.id);
      if (side.has(b)) { overcurrent.push(fault('PROTECTION_BYPASS', [fuse.id, a, b], '퓨즈를 우회하는 도선/접점 경로가 있습니다.')); continue; }
      // For a bridge conductor, KCL gives the exact current through the fuse.
      // Include the source injection when the chosen side contains a supply terminal.
      let outgoing = 0;
      for (const x of network.loads) {
        if (side.has(x.a)) outgoing += network.currents[x.c.id];
        if (side.has(x.b)) outgoing -= network.currents[x.c.id];
      }
      if (side.has(network.l)) outgoing -= network.supplyCurrent;
      if (side.has(network.n)) outgoing += network.supplyCurrent;
      if (Math.abs(outgoing) > (fuse.params?.ratingAmps ?? 0.5) + 1e-9) {
        overcurrent.push(fault('OVERCURRENT', [fuse.id, a, b], `계산 전류 ${Math.abs(outgoing).toFixed(3)} A가 퓨즈 정격 ${(fuse.params?.ratingAmps ?? 0.5).toFixed(3)} A를 초과합니다.`));
        result.tripped.push(fuse.id);
      }
    }
    if (result.tripped.length) {
      result.latchedFaults = overcurrent; result.faults.push(...overcurrent);
      result.sourceTripped = true; // Educational source interlock after any protection event.
      result.contactsClosed = contacts(doc, result.energized, input.pressedButtons, result.tripped);
      return result;
    }
    const next: Record<string, boolean> = {};
    for (const c of loads) {
      const voltage = network.loadVoltages[c.id];
      next[c.id] = (c.kind === 'COIL' ? voltage : Math.abs(voltage)) >= (c.params?.nominalVoltage ?? 24) * 0.8;
    }
    if (JSON.stringify(next) === signature) {
      result.energized = next; result.contactsClosed = closed;
      result.voltages = network.voltages; result.currents = network.currents; result.loadVoltages = network.loadVoltages; result.supplyCurrent = network.supplyCurrent;
      result.faults.push(...overcurrent);
      const active = new Set<string>();
      // Representative source/return paths use computed nonzero-current load edges too.
      const currentEdges = [...network.graph.edges, ...network.loads.filter(x => Math.abs(network.currents[x.c.id]) > 1e-9).map(x => ({ a: x.a, b: x.b, id: x.c.id, kind: 'contact' as const }))];
      for (const x of network.loads) {
        if (network.voltages[x.a] === null || network.voltages[x.b] === null) result.faults.push(fault('FLOATING', [x.a, x.b], '전원 기준에 연결되지 않은 부하입니다.', 'warning'));
        if (x.u === x.v) result.faults.push(fault('MISWIRE', [x.a, x.b], '부하 양단이 같은 전기 노드입니다. 유효 전위차가 없습니다.'));
        const v = network.loadVoltages[x.c.id];
        if (x.c.kind === 'COIL' && v < -1e-6) result.faults.push(fault('REVERSED', [x.a, x.b], '이 과제의 극성 있는 24V 코일은 A1(+), A2(리턴) 결선이 필요합니다.'));
        if (Math.abs(v) > 1e-6 && Math.abs(v) < 19.2) result.faults.push(fault('UNDERVOLTAGE', [x.a, x.b], `부하 전압 ${Math.abs(v).toFixed(2)} V가 동작 문턱 19.2 V보다 낮습니다.`, 'warning'));
        if (Math.abs(network.currents[x.c.id]) > 1e-9) {
          const high = v > 0 ? x.a : x.b, low = v > 0 ? x.b : x.a;
          for (const e of [...path(network.l, high, currentEdges.filter(e => e.id !== x.c.id)), ...path(low, network.n, currentEdges.filter(e => e.id !== x.c.id))]) if (e.kind === 'wire') active.add(e.id);
        }
      }
      result.activeWireIds = [...active].sort();
      return result;
    }
    energized = next;
  }
  result.stable = false;
  result.faults.push(fault('OSCILLATION', doc.components.filter(c => c.kind === 'COIL' || c.kind.startsWith('AUX')).map(c => c.id), '접점 피드백이 안정 상태에 수렴하지 않습니다. NO/NC와 연동 코일을 확인하세요.'));
  result.contactsClosed = contacts(doc, result.energized, input.pressedButtons, result.tripped);
  return result;
}
