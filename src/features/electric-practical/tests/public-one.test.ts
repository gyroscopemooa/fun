import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicOne, publicControls } from '../public-one/lesson.ts';
import { gradePublic, publicScenarios } from '../public-one/grade.ts';
import { simulate, initialState } from '../engine/simulate.ts';
import { ref } from '../model/fixtures.ts';
import { connect } from '../editor/history.ts';
import { serialize, deserialize } from '../storage/document.ts';
import { terminalOffset } from '../editor/geometry.ts';
import type { CircuitDocument } from '../model/schema.ts';
const advance = (d: CircuitDocument, s = initialState(), pressedButtons: string[] = [], elapsedMs = 0) => simulate(d, s, { pressedButtons, elapsedMs, controls: publicControls });

test('public 1 complete wiring passes all 22 scenarios without a layout comparison', () => {
  const r = gradePublic(publicOne()); assert.equal(r.passed, true, JSON.stringify(r)); assert.equal(r.steps.length, 22);
  assert.ok(r.steps.every(s => s.passed && s.result.stable));
});

test('3-phase RMS coil voltage is 220V; timer switches exactly at configured delay', () => {
  const d = publicOne(); let s = advance(d); assert.equal(s.energized.EOCR, true);
  s = advance(d, s, ['PB1']); assert.equal(s.energized.MC1, true); assert.equal(s.energized.MC2, false);
  assert.ok(Math.abs(s.loadVoltages.MC1 - 220) < 1e-8);
  s = advance(d, s, [], 2999); assert.equal(s.energized.MC2, false);
  s = advance(d, s, [], 1); assert.equal(s.energized.MC2, true); assert.equal(s.energized.M2, true);
  s = advance(d, s, ['PB0']); assert.equal(s.energized.MC1, false); assert.equal(s.timers?.T, 0);
});

test('socket visual positions use actual 12P and 8P pin arrangements', () => {
  const d = publicOne(), mc = d.components.find(c => c.id === 'MC1')!, t = d.components.find(c => c.id === 'T')!;
  assert.ok(terminalOffset(mc, '1').y < terminalOffset(mc, '7').y); assert.equal(terminalOffset(mc, '6').x, terminalOffset(mc, '12').x);
  assert.ok(terminalOffset(t, '6').x < terminalOffset(t, '3').x); assert.ok(terminalOffset(t, '7').x < terminalOffset(t, '2').x);
  assert.equal(terminalOffset(t, '1').x, terminalOffset(t, '4').x);
});

test('public 1 all scenarios repeated 100 times are deterministic; save/load and layout do not change behavior', () => {
  const d = publicOne(), r = gradePublic(d);
  for (let i = 0; i < 100; i++) assert.deepEqual(gradePublic(d), r);
  assert.deepEqual(gradePublic(deserialize(serialize(d))), r);
  const moved = structuredClone(d); moved.ui = {}; moved.wires.reverse();
  const rr = gradePublic(moved); assert.equal(rr.passed, true); assert.deepEqual(rr.steps.map(s => s.result.energized), r.steps.map(s => s.result.energized));
});

const removeAt = (d: CircuitDocument, terminal: string) => { d.wires = d.wires.filter(w => `${w.from.componentId}:${w.from.terminalId}` !== terminal && `${w.to.componentId}:${w.to.terminalId}` !== terminal); };
const wrong: [string, (d: CircuitDocument) => CircuitDocument | void][] = [
  ['timer coil return open', d => removeAt(d, 'T:7')],
  ['MC2 coil open', d => removeAt(d, 'MC2:6')],
  ['self-hold instant contact open', d => removeAt(d, 'T:3')],
  ['timed NC used instead of NO', d => { d.wires = d.wires.map(w => ({ ...w, from: w.from.componentId === 'T' && w.from.terminalId === '6' ? ref('T:5') : w.from })); }],
  ['EOCR normal guard bypass', d => connect(d, ref('EOCR:10'), ref('EOCR:4'))],
  ['FLS E1 open', d => removeAt(d, 'WATER:E1')],
  ['FLS E2 open', d => removeAt(d, 'WATER:E2')],
  ['PE return removed', d => removeAt(d, 'PS1:PE')],
  ['motor output phase open', d => removeAt(d, 'MC1:7')],
  ['motor output phase sequence swapped', d => { d.wires = d.wires.map(w => ({ ...w, from: w.from.componentId === 'MC1' && ['7', '8'].includes(w.from.terminalId) ? { ...w.from, terminalId: w.from.terminalId === '7' ? '8' : '7' } : w.from })); }],
  ['sensor E1 and E2 swapped', d => { d.wires = d.wires.map(w => ({ ...w, from: w.from.componentId === 'FLS' && ['7', '8'].includes(w.from.terminalId) ? { ...w.from, terminalId: w.from.terminalId === '7' ? '8' : '7' } : w.from })); }],
  ['phase short', d => connect(d, ref('TB5A:1B'), ref('TB5A:2B'))],
  ['buzzer open', d => removeAt(d, 'BZ:X1')],
  ['yellow lamp open', d => removeAt(d, 'YL:X1')],
  ['low resistance overload', d => { d.components.find(c => c.id === 'RL')!.params!.resistance = 1; }],
];
for (const [name, mutate] of wrong) test(`public 1 rejects ${name}`, () => { const d = publicOne(), changed = mutate(d) ?? d; const result = gradePublic(changed); assert.equal(result.passed, false, name); for (let i = 1; i < 100; i++) assert.deepEqual(gradePublic(changed), result, name); });

test('external wires cannot bypass panel strips even when electrical behavior works', () => {
  const d = publicOne(); removeAt(d, 'TB5B:1A'); removeAt(d, 'TB5B:1B');
  const bypass = connect(d, ref('PB0:21'), ref('TB5A:6B')); const r = gradePublic(bypass);
  // A direct external-to-external strip still reaches the panel; direct device bypass is caught.
  const direct = connect(bypass, ref('PB0:21'), ref('T:1')); const rr = gradePublic(direct);
  assert.equal(rr.requirementsPassed, false); assert.ok(r.steps.length > 0);
});

test('powered-off and disconnected FLS cannot be driven by water input alone', () => {
  const d = publicOne(); removeAt(d, 'FLS:5');
  const s = simulate(d, initialState(), { pressedButtons: [], elapsedMs: 10000, controls: { ...publicControls, mode: 'A', water: 'high' } });
  assert.equal(s.energized.FLS, false); assert.equal(s.energized.MC1, false);
});

test('virtual timer steps and one large elapsed step have the same electrical result', () => {
  const d = publicOne(); let a = advance(d, initialState(), ['PB1']); let b = structuredClone(a);
  a = advance(d, a, [], 3000); for (let i = 0; i < 30; i++) b = advance(d, b, [], 100);
  assert.deepEqual(a.energized, b.energized); assert.deepEqual(a.timers, b.timers);
  assert.equal(publicScenarios(d).length, 22);
});
