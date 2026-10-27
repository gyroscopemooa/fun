import { fault, type CircuitDocument, type PublicControls, type SimulationInput, type SimulationResult } from '../model/schema.ts';
import { validateDocument } from '../model/validate.ts';
import { compileCircuit, reachable } from '../engine/compile.ts';
import { simulatePublic } from './simulate.ts';
import { publicControls, publicOne } from './lesson.ts';

export function publicScenarios(doc: CircuitDocument) {
  const delay = doc.components.find(c => c.id === 'T')?.params?.delayMs ?? 3000;
  const period = doc.components.find(c => c.id === 'FR')?.params?.periodMs ?? 500;
  const stopped = { MC1: false, MC2: false, M1: false, M2: false, RL: false, GL: false, YL: false, BZ: false };
  const first = { ...stopped, MC1: true, M1: true, RL: true }, both = { ...first, MC2: true, M2: true, GL: true };
  const step = (name: string, expected: Record<string, boolean>, buttons: string[] = [], elapsedMs = 0, controls: Partial<PublicControls> = {}, powerOn = true) => ({ name, expected, input: { pressedButtons: buttons, elapsedMs, controls: { ...publicControls, ...controls }, powerOn } satisfies SimulationInput });
  return [
    step('전원 투입 · EOCR 대기', { ...stopped, EOCR: true }),
    step('수동 PB1 · MC1 기동', { ...first, T: true }, ['PB1']),
    step('PB1 해제 · 자기유지', first),
    step('설정시간 직전 · MC2 대기', first, [], delay - 1),
    step('설정시간 도달 · MC2 기동', both, [], 1),
    step('PB0 정지', { ...stopped, T: false }, ['PB0']),
    step('PB0 해제 · 재기동 없음', stopped),
    step('수동 재기동', first, ['PB1']),
    step('전원 차단', stopped, [], 0, {}, false),
    step('전원 복구 · 자동 재기동 없음', stopped),
    step('자동 · 저수위 대기', { ...stopped, FLS: true }, [], 0, { mode: 'A' }),
    step('자동 · 상한 수위 감지', { ...first, X: true, T: false }, [], 0, { mode: 'A', water: 'high' }),
    step('자동 · 중간 수위 유지', { ...first, X: true }, [], 0, { mode: 'A', water: 'middle' }),
    step('자동 · 하한 수위 해제', { ...stopped, X: false }, [], 0, { mode: 'A', water: 'low' }),
    step('수동 전환 · 정지', stopped),
    step('수동 다시 START', first, ['PB1']),
    step('두 전동기 출력 운전', both, [], delay),
    step('EOCR 시험 트립 · 부저', { ...stopped, FR: true, BZ: true }, [], 0, { overload: true }),
    step('FR 한 주기 · 황색등', { ...stopped, FR: true, YL: true }, [], period),
    step('FR 다음 주기 · 부저', { ...stopped, FR: true, BZ: true }, [], period),
    step('EOCR RESET', { ...stopped, FR: false }, [], 0, { resetOverload: true }),
    step('MCCB 개방', { ...stopped, EOCR: false }, [], 0, { breakerOn: false }),
  ];
}
export function blankPublicState(): SimulationResult {
  return { energized: {}, contactsClosed: {}, faults: [], stable: true, iterations: 0, timeMs: 0, powerOn: false, tripped: [], sourceTripped: false, latchedFaults: [], voltages: {}, loadVoltages: {}, currents: {}, supplyCurrent: 0, activeWireIds: [] };
}
export function gradePublic(doc: CircuitDocument) {
  const requirements = [...validateDocument(doc)];
  for (const c of publicOne(false).components) if (!doc.components.some(x => x.id === c.id && x.kind === c.kind)) requirements.push(fault('MISWIRE', [c.id], `공개 1번 지정 기기 ${c.id} (${c.kind})가 필요합니다.`));
  const counts = new Map<string, number>();
  for (const w of doc.wires) for (const t of [w.from, w.to]) { const k = `${t.componentId}:${t.terminalId}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  for (const [t, n] of counts) if (n > 2) requirements.push(fault('MISWIRE', [t], `한 나사 단자에 ${n}가닥이 연결되었습니다. 단자대에서 분기하세요.`));
  const invalid = requirements.some(f => ['INVALID_MODEL', 'INVALID_TERMINAL'].includes(f.code));
  if (!invalid) {
    const graph = compileCircuit(doc, {}), earth = reachable('PS1:PE', graph.edges);
    for (const t of ['TB2:4B', 'TB3:4B', 'FLS:1']) if (!earth.has(t)) requirements.push(fault('EARTH', [t], `${t} 보호도체가 전원 PE와 연결되지 않았습니다.`));
    // External devices must enter through a panel terminal block. Check connectivity after removing those blocks.
    const external = new Set(['PS1', 'TB1', 'TB2', 'TB3', 'TB4', 'WATER', 'PB0', 'PB1', 'SS', 'RL', 'GL', 'YL', 'BZ']);
    const internal = new Set(['F', 'EOCR', 'MCCB', 'X', 'FR', 'T', 'FLS', 'MC1', 'MC2']);
    const noPanelEdges = graph.edges.filter(e => !['TB5A:', 'TB5B:', 'TB6A:', 'TB6B:'].some(prefix => e.a.startsWith(prefix) || e.b.startsWith(prefix)));
    for (const c of doc.components.filter(c => external.has(c.id))) for (const t of c.terminals) {
      if ([...reachable(`${c.id}:${t}`, noPanelEdges)].some(n => internal.has(n.split(':')[0]))) requirements.push(fault('MISWIRE', [c.id, t], '제어판 외부 배선은 TB5/TB6 단자대를 거쳐야 합니다.'));
    }
  }
  let state = blankPublicState();
  const steps = invalid ? [] : publicScenarios(doc).map(s => {
    state = simulatePublic(doc, state, s.input);
    const mismatches = Object.entries(s.expected).filter(([id, on]) => !!state.energized[id] !== on).map(([id]) => id);
    const passed = state.stable && !mismatches.length && !state.faults.some(f => f.severity === 'error');
    return { ...s, on: s.expected.MC1 ?? false, affected: mismatches, hint: '단자 연결과 기기 전압을 확인하세요.', passed, result: state, issues: passed ? [] : [fault('MISWIRE', mismatches, `${s.name}: ${mismatches.join(', ') || '회로 오류'} 동작이 기대와 다릅니다.`), ...state.faults] };
  });
  const safety = steps.flatMap(s => s.result.faults.filter(f => ['SHORT', 'OVERCURRENT', 'PROTECTION_BYPASS', 'OSCILLATION', 'EARTH', 'PHASE'].includes(f.code)));
  const behaviorPassed = steps.length === publicScenarios(doc).length && steps.every(s => s.passed), requirementsPassed = !requirements.length, safetyPassed = !safety.length && !requirements.some(f => f.code === 'EARTH');
  return { passed: behaviorPassed && requirementsPassed && safetyPassed, behaviorPassed, requirementsPassed, safetyPassed, steps, requirements, safety };
}
