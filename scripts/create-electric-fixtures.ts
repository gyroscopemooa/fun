import { mkdirSync, writeFileSync } from 'node:fs';
import { correctLesson, component, ref } from '../src/features/electric-practical/model/fixtures.ts';
import type { CircuitDocument, FaultCode } from '../src/features/electric-practical/model/schema.ts';
const directory = new URL('../src/features/electric-practical/tests/fixtures/', import.meta.url);
mkdirSync(directory, { recursive: true });
function fixture(name: string, change: (d: CircuitDocument) => void, passed: boolean, codes: FaultCode[] = [], failedStep?: string) {
  const document = correctLesson(); change(document);
  writeFileSync(new URL(`${name}.json`, directory), JSON.stringify({ name, document, expected: { passed, codes, failedStep } }, null, 2) + '\n');
}
const remove = (d: CircuitDocument, id: string) => { d.wires = d.wires.filter(w => w.id !== id); };
const wire = (d: CircuitDocument, a: string, b: string) => d.wires.push({ id: `Extra${d.wires.length}`, from: ref(a), to: ref(b) });
fixture('01-correct', () => {}, true);
fixture('02-no-hold', d => remove(d, 'W4'), false, ['OPEN'], 'START 해제·자기유지');
fixture('03-stop-missing', d => remove(d, 'W2'), false, ['OPEN'], 'START 누름');
fixture('04-wrong-coil-link', d => { d.components.find(c => c.id === 'MC1_NO')!.linkId = 'MISSING'; }, false, ['CONTACT_LINK']);
fixture('05-nc-instead-of-no', d => {
  const c = d.components.find(c => c.id === 'MC1_NO')!; c.kind = 'AUX_NC'; c.terminals = ['21', '22'];
  for (const w of d.wires) for (const r of [w.from, w.to]) if (r.componentId === c.id) r.terminalId = r.terminalId === '13' ? '21' : '22';
}, false, ['OSCILLATION']);
fixture('06-lamp-same-potential', d => { d.wires.find(w => w.id === 'W10')!.to = ref('J1:J'); }, false, ['MISWIRE'], 'START 누름');
fixture('07-direct-short', d => wire(d, 'PS1:L', 'PS1:N'), false, ['SHORT']);
fixture('08-coil-a1-open', d => remove(d, 'W7'), false, ['OPEN'], 'START 누름');
fixture('09-branch-open', d => remove(d, 'W8'), false, ['OPEN'], 'START 누름');
fixture('10-crossing-without-junction', d => {
  remove(d, 'W6'); d.components.push(component('J2', 'JUNCTION'));
  d.ui!.positions!.J2 = { ...d.ui!.positions!.J1 }; wire(d, 'MC1_NO:14', 'J2:J');
}, false, [], 'START 해제·자기유지');
fixture('11-stop-bypassed-by-hold', d => { d.wires.find(w => w.id === 'W4')!.from = ref('F1:2'); }, false, [], 'STOP 누름');
fixture('12-power-loss-reset', () => {}, true);
fixture('13-rapid-input-order', () => {}, true);
fixture('14-save-load-roundtrip', () => {}, true);
fixture('15-equivalent-layout', d => {
  for (const p of Object.values(d.ui!.positions!)) { p.x += 130; p.y += 70; }
  d.wires.forEach(w => { [w.from, w.to] = [w.to, w.from]; w.route = 'straight'; w.bend = 50; }); d.wires.reverse();
}, true);
fixture('16-no-return', d => { remove(d, 'W9'); remove(d, 'W10'); }, false, ['OPEN'], 'START 누름');
fixture('17-lamp-always-on', d => { d.wires.find(w => w.id === 'W8')!.from = ref('F1:2'); }, false, [], '초기 정지');
fixture('18-reversed-coil', d => {
  d.wires.find(w => w.id === 'W7')!.to = ref('MC1:A2'); d.wires.find(w => w.id === 'W9')!.from = ref('MC1:A1');
}, false, ['REVERSED']);
fixture('19-overcurrent', d => { d.components.find(c => c.id === 'F1')!.params!.ratingAmps = 0.12; }, false, ['OVERCURRENT']);
fixture('20-fuse-bypass', d => wire(d, 'F1:1', 'F1:2'), false, ['PROTECTION_BYPASS']);
fixture('21-invalid-terminal', d => { d.wires[0].from.terminalId = 'BOGUS'; }, false, ['INVALID_TERMINAL']);
fixture('22-loads-in-series', d => {
  remove(d, 'W8'); remove(d, 'W9'); wire(d, 'MC1:A2', 'PL1:X1');
}, false, ['UNDERVOLTAGE']);
fixture('23-equivalent-extra-junction', d => {
  d.components.push(component('J2', 'JUNCTION')); d.wires.find(w => w.id === 'W7')!.to = ref('J2:J'); wire(d, 'J2:J', 'MC1:A1');
}, true);
fixture('24-protected-short', d => wire(d, 'J1:J', 'PS1:N'), false, ['SHORT']);
fixture('25-no-instead-of-stop-nc', d => {
  const c = d.components.find(c => c.id === 'STOP')!; c.kind = 'PUSH_NO'; c.terminals = ['13', '14'];
  for (const w of d.wires) for (const r of [w.from, w.to]) if (r.componentId === c.id) r.terminalId = r.terminalId === '21' ? '13' : '14';
}, false, [], 'START 누름');
fixture('26-stop-on-return-side', d => {
  d.wires.find(w => w.id === 'W2')!.to = ref('START:13');
  d.wires.find(w => w.id === 'W3')!.to = ref('PS1:N');
  d.wires.find(w => w.id === 'W9')!.to = ref('STOP:21');
  d.wires.find(w => w.id === 'W10')!.to = ref('STOP:21');
}, false, ['MISWIRE']);
fixture('27-fuse-on-return-side', d => {
  d.wires.find(w => w.id === 'W1')!.to = ref('STOP:21');
  d.wires.find(w => w.id === 'W2')!.to = ref('PS1:N');
  d.wires.find(w => w.id === 'W9')!.to = ref('F1:1');
  d.wires.find(w => w.id === 'W10')!.to = ref('F1:1');
}, false, ['PROTECTION_BYPASS']);
console.log('Wrote 27 reviewable full-circuit JSON fixtures.');
