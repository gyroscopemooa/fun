import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { correctLesson, ref, component } from '../model/fixtures.ts';
import { type CircuitDocument, type FaultCode } from '../model/schema.ts';
import { initialState, simulate, MAX_ITERATIONS } from '../engine/simulate.ts';
import { grade } from '../grading/grade.ts';
import { deserialize, serialize } from '../storage/document.ts';
const directory = new URL('./fixtures/', import.meta.url);
const fixtures = readdirSync(directory).filter(n => n.endsWith('.json')).map(name => JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as { name: string; document: CircuitDocument; expected: { passed: boolean; codes: FaultCode[]; failedStep?: string } });
for (const f of fixtures) test(`fixture ${f.name}`, () => {
  const result = grade(f.document);
  assert.equal(result.passed, f.expected.passed, JSON.stringify(result));
  const codes = [...result.requirements, ...result.safety, ...result.steps.flatMap(s => s.result.faults)].map(f => f.code);
  for (const code of f.expected.codes) assert.ok(codes.includes(code), `Expected ${code}; got ${codes}`);
  if (f.expected.failedStep) assert.equal(result.steps.find(s => s.name === f.expected.failedStep)?.passed, false);
  assert.ok(result.steps.every(s => s.result.iterations <= MAX_ITERATIONS));
});
test('self hold actual output: off → start → held → stop → off', () => {
  const d = correctLesson(); let state = initialState();
  for (const [pressed, on] of [[[], false], [['START'], true], [[], true], [['STOP'], false], [[], false]] as [string[], boolean][]) {
    state = simulate(d, state, { pressedButtons: pressed, elapsedMs: 10 });
    assert.equal(state.energized.MC1, on); assert.equal(state.energized.PL1, on); assert.equal(state.contactsClosed.MC1_NO, on); assert.ok(state.stable);
    assert.ok(Math.abs(state.supplyCurrent - (on ? 0.15 : 0)) < 1e-9);
  }
});
test('100 identical executions of EVERY fixture are deterministic', () => {
  for (const f of fixtures) { const expected = JSON.stringify(grade(f.document)); for (let i = 0; i < 100; i++) assert.equal(JSON.stringify(grade(f.document)), expected, `${f.name} iteration ${i}`); }
});
test('power loss clears coil memory, contacts and current paths', () => {
  const d = fixtures.find(f => f.name.startsWith('12-'))!.document;
  let s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 10 });
  assert.ok(s.energized.MC1);
  s = simulate(d, s, { pressedButtons: [], elapsedMs: 10, powerOn: false });
  assert.equal(s.energized.MC1, false); assert.equal(s.contactsClosed.MC1_NO, false); assert.deepEqual(s.activeWireIds, []);
  s = simulate(d, s, { pressedButtons: [], elapsedMs: 10, powerOn: true }); assert.equal(s.energized.MC1, false);
});
test('rapid sequential and simultaneous input respects STOP', () => {
  const d = fixtures.find(f => f.name.startsWith('13-'))!.document; let s = initialState();
  for (let i = 0; i < 100; i++) for (const [buttons, on] of [[['START'], true], [[], true], [['START', 'STOP'], false], [['STOP'], false], [[], false]] as [string[], boolean][]) {
    s = simulate(d, s, { pressedButtons: buttons, elapsedMs: 1 }); assert.equal(s.energized.MC1, on);
  }
  assert.equal(s.timeMs, 500);
});
test('serialization roundtrip preserves each correct AND wrong circuit behavior', () => {
  for (const f of fixtures.filter(f => !f.name.startsWith('21-'))) assert.deepEqual(grade(deserialize(serialize(f.document))), grade(f.document));
});
test('equivalent geometry/order and true rewiring have same electrical outputs', () => {
  const expected = grade(correctLesson()).steps.map(s => s.result.energized);
  for (const prefix of ['15-', '23-']) assert.deepEqual(grade(fixtures.find(f => f.name.startsWith(prefix))!.document).steps.map(s => s.result.energized), expected);
});
test('short trips and stays latched; loads never energize on that step', () => {
  const d = fixtures.find(f => f.name.startsWith('24-'))!.document;
  let s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 1 });
  assert.ok(s.tripped.includes('F1')); assert.equal(s.energized.MC1, false); assert.deepEqual(s.activeWireIds, []);
  s = simulate(correctLesson(), s, { pressedButtons: ['START'], elapsedMs: 1 }); assert.equal(s.energized.MC1, false); assert.ok(s.faults.some(f => f.code === 'SHORT'));
});
test('series loads are solved, not treated as parallel or ideal wires', () => {
  const d = fixtures.find(f => f.name.startsWith('22-'))!.document;
  const s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 1 });
  assert.ok(Math.abs(s.loadVoltages.MC1 - 8) < 1e-8); assert.ok(Math.abs(s.loadVoltages.PL1 - 16) < 1e-8); assert.equal(s.energized.MC1, false); assert.equal(s.energized.PL1, false);
});
test('an added parallel load changes real supply current and trips fuse', () => {
  const d = correctLesson(); d.components.push(component('PL2', 'LAMP')); d.components.at(-1)!.params!.resistance = 48;
  d.wires.push({ id: 'Extra1', from: ref('J1:J'), to: ref('PL2:X1') }, { id: 'Extra2', from: ref('PL2:X2'), to: ref('PS1:N') });
  const s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 1 }); assert.ok(s.faults.some(f => f.code === 'OVERCURRENT')); assert.equal(s.energized.PL2, false);
});
test('dangling wire receives no fabricated current highlight', () => {
  const d = correctLesson(); d.components.push(component('J2', 'JUNCTION')); d.wires.push({ id: 'DeadEnd', from: ref('J1:J'), to: ref('J2:J') });
  const s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 1 }); assert.ok(s.energized.MC1); assert.ok(!s.activeWireIds.includes('DeadEnd'));
});
test('duplicate wire is identified without doubling current', () => {
  const d = correctLesson(); d.wires.push({ ...d.wires[0], id: 'Duplicate' });
  const s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 1 }); assert.ok(s.faults.some(f => f.code === 'DUPLICATE_WIRE')); assert.ok(Math.abs(s.supplyCurrent - 0.15) < 1e-9);
});
test('malformed/oversized imports fail closed; contact mistakes remain editable', () => {
  for (const text of ['null', '{}', '{', JSON.stringify({ ...correctLesson(), schemaVersion: 2 }), JSON.stringify({ ...correctLesson(), ui: { positions: { PS1: { x: 'x', y: 0 } } } }), ' '.repeat(500001)]) assert.throws(() => deserialize(text));
  const d = correctLesson(); d.components[0].id = 'constructor'; assert.throws(() => deserialize(serialize(d)));
  assert.doesNotThrow(() => deserialize(serialize(fixtures.find(f => f.name.startsWith('04-'))!.document)));
});
test('engine never mutates document or previous state', () => {
  const d = correctLesson(), s = initialState(); const before = JSON.stringify([d, s]); simulate(d, s, { pressedButtons: ['START'], elapsedMs: 10 }); assert.equal(JSON.stringify([d, s]), before);
});
test('wire/component ID collisions cannot mask fuse or current-path edges', () => {
  const d = correctLesson(); d.wires[0].id = 'F1';
  assert.throws(() => deserialize(serialize(d)));
  const s = simulate(d, initialState(), { pressedButtons: ['START'], elapsedMs: 0 });
  assert.equal(s.stable, false); assert.ok(s.faults.some(f => f.code === 'INVALID_MODEL')); assert.deepEqual(s.activeWireIds, []);
});
