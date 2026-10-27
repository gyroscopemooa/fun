import { isPublicOne } from '../public-one/lesson.ts';
import { gradePublic } from '../public-one/grade.ts';
import { fault, type CircuitDocument, type Fault } from '../model/schema.ts';
import { openTerminals, validateDocument } from '../model/validate.ts';
import { initialState, simulate } from '../engine/simulate.ts';
import { compileCircuit, reachable } from '../engine/compile.ts';
import { scenarios } from './scenarios.ts';

export function grade(doc: CircuitDocument) {
  if (isPublicOne(doc)) return gradePublic(doc);
  const structural = validateDocument(doc);
  const requirements: Fault[] = [...structural, ...openTerminals(doc)];
  const required = { PS1: 'SUPPLY', F1: 'FUSE', START: 'PUSH_NO', STOP: 'PUSH_NC', MC1: 'COIL', MC1_NO: 'AUX_NO', PL1: 'LAMP' };
  for (const [id, kind] of Object.entries(required)) if (!doc.components.some(c => c.id === id && c.kind === kind)) requirements.push(fault('MISWIRE', [id], `과제 지정 부품 ${id} (${kind})가 필요합니다.`));
  if (doc.components.find(c => c.id === 'MC1_NO')?.linkId !== 'MC1') requirements.push(fault('CONTACT_LINK', ['MC1_NO', 'MC1'], '과제 보조접점은 MC1 코일에 연동해야 합니다.'));
  let state = initialState();
  const steps = structural.some(f => f.severity === 'error') ? [] : scenarios.map(s => {
    state = simulate(doc, state, s.input);
    const passed = state.stable && state.energized.MC1 === s.on && state.energized.PL1 === s.on && !state.faults.some(f => f.severity === 'error');
    return { ...s, passed, result: state, issues: passed ? [] : [fault('MISWIRE', s.affected, s.hint), ...state.faults] };
  });
  if (steps.length) {
    // The lesson requires high-side interruption, not merely an opened return.
    // Analyze connectivity with each guard open; never compare to example wires.
    for (const guard of ['STOP', 'F1']) {
      const closed = { ...steps[2].result.contactsClosed, START: true, [guard]: false };
      const network = compileCircuit(doc, closed);
      const live = reachable('PS1:L', network.edges);
      const affected = ['MC1:A1', 'PL1:X1'].filter(t => live.has(t));
      if (affected.length) requirements.push(fault(guard === 'F1' ? 'PROTECTION_BYPASS' : 'MISWIRE', [guard, ...affected], `${guard}을 열어도 부하 입력에 L이 도달합니다. 이 과제에서는 리턴 쪽이 아닌 모든 부하의 전원 앞쪽을 차단하세요.`));
    }
    const isolated = structuredClone(doc);
    isolated.wires = isolated.wires.filter(w => w.from.componentId !== 'F1' && w.to.componentId !== 'F1');
    const test = simulate(isolated, initialState(), { pressedButtons: ['START'], elapsedMs: 0 });
    if (test.energized.MC1 || test.energized.PL1) requirements.push(fault('PROTECTION_BYPASS', ['F1'], 'F1을 분리해도 부하가 동작합니다. 모든 부하 전원을 F1을 통해 공급하세요.'));
  }
  const safety = [...structural.filter(f => f.severity === 'error'), ...steps.flatMap(s => s.result.faults.filter(f => ['SHORT', 'OVERCURRENT', 'PROTECTION_BYPASS', 'OSCILLATION', 'REVERSED'].includes(f.code)))];
  const behaviorPassed = steps.length === scenarios.length && steps.every(s => s.passed);
  const requirementsPassed = requirements.length === 0;
  const safetyPassed = safety.length === 0 && !requirements.some(f => f.code === 'PROTECTION_BYPASS');
  return { passed: behaviorPassed && requirementsPassed && safetyPassed, behaviorPassed, requirementsPassed, safetyPassed, steps, requirements, safety };
}
export type GradeResult = ReturnType<typeof grade>;
