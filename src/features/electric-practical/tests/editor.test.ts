import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commit, connect, history, redo, removeSelection, snap, undo } from '../editor/history.ts';
import { correctLesson, emptyLesson, correctPairs, ref } from '../model/fixtures.ts';
import { grade } from '../grading/grade.ts';
test('build working circuit from an empty board using only terminal connections', () => {
  let h = history(emptyLesson());
  for (const [a, b] of correctPairs) h = commit(h, connect(h.present, ref(a), ref(b)));
  assert.ok(grade(h.present).passed); assert.equal(h.past.length, 10);
  h = undo(h); assert.equal(grade(h.present).passed, false);
  h = redo(h); assert.ok(grade(h.present).passed);
});
test('wire removal changes behavior and undo restores actual topology', () => {
  const d = correctLesson(); let h = history(d);
  h = commit(h, removeSelection(d, { type: 'wire', id: 'W6' })); assert.equal(grade(h.present).passed, false);
  h = undo(h); assert.ok(grade(h.present).passed);
  h = commit(h, removeSelection(h.present, { type: 'component', id: 'MC1' }));
  assert.ok(!h.present.wires.some(w => w.to.componentId === 'MC1' || w.from.componentId === 'MC1'));
  assert.equal(h.future.length, 0); assert.equal(grade(h.present).passed, false);
});
test('duplicate and self connections do not mutate topology', () => {
  const d = correctLesson(); assert.equal(connect(d, ref('PS1:L'), ref('F1:1')), d); assert.equal(connect(d, ref('F1:1'), ref('PS1:L')), d); assert.equal(connect(d, ref('PS1:L'), ref('PS1:L')), d);
});
test('geometry changes and grid snapping cannot change grading', () => {
  const d = correctLesson(); const before = grade(d);
  d.ui = { positions: Object.fromEntries(d.components.map((c, i) => [c.id, { x: snap(i * 37), y: snap(i * 43) }])) };
  assert.deepEqual(grade(d), before); assert.equal(snap(-10), 0); assert.equal(snap(2010), 1800); assert.equal(snap(31), 40);
});
test('history is bounded and edits invalidate redo', () => {
  let h = history(emptyLesson()); for (let i = 0; i < 100; i++) h = commit(h, correctLesson());
  assert.equal(h.past.length, 50); h = undo(h); assert.equal(h.future.length, 1); h = commit(h, emptyLesson()); assert.equal(h.future.length, 0);
});

import { emptyPanelLesson, panelLesson } from '../model/fixtures.ts';
import { compileCircuit } from '../engine/compile.ts';
import { simulate, initialState } from '../engine/simulate.ts';
import { serialize, deserialize } from '../storage/document.ts';
import { orthogonalPoints } from '../editor/geometry.ts';

test('four 10P strips provide 40 isolated poles, each with two electrically common screws', () => {
  const doc = emptyPanelLesson(), graph = compileCircuit(doc, {});
  const blocks = doc.components.filter(c => c.kind === 'TERMINAL_BLOCK');
  assert.equal(blocks.length, 4);
  const nets = blocks.flatMap(c => Array.from({ length: 10 }, (_, i) => {
    assert.equal(graph.net.get(`${c.id}:${i + 1}A`), graph.net.get(`${c.id}:${i + 1}B`));
    return graph.net.get(`${c.id}:${i + 1}A`);
  }));
  assert.equal(new Set(nets).size, 40);
});

test('terminal-block self hold passes all scenarios and repeats deterministically 100 times', () => {
  const doc = panelLesson(), expected = grade(doc);
  assert.ok(expected.passed, JSON.stringify(expected));
  for (let i = 0; i < 100; i++) assert.deepEqual(grade(doc), expected);
  assert.equal(expected.steps[1].result.voltages['TB5A:1A'], expected.steps[1].result.voltages['TB5A:1B']);
  assert.ok(Math.abs(expected.steps[1].result.supplyCurrent - 0.15) < 1e-9);
});

test('moving a supply wire to the adjacent isolated pole opens the actual circuit', () => {
  const doc = panelLesson(); doc.wires[1].from = ref('TB5A:4B');
  assert.equal(grade(doc).passed, false);
  const state = simulate(doc, initialState(), { elapsedMs: 0, pressedButtons: ['START'] });
  assert.equal(state.energized.MC1, false); assert.equal(state.supplyCurrent, 0);
});

test('terminal-block bridge between L and N detects real short and latches protection', () => {
  const doc = connect(panelLesson(), ref('TB5A:1B'), ref('TB5A:2A'));
  const state = simulate(doc, initialState(), { elapsedMs: 0, pressedButtons: [] });
  assert.ok(state.faults.some(f => f.code === 'SHORT')); assert.ok(state.sourceTripped);
  assert.equal(state.energized.MC1, false);
});

test('waypoints and wire colors survive undo/redo and JSON without changing circuit calculations', () => {
  const doc = correctLesson(), expected = grade(doc);
  const next = { ...doc, wires: doc.wires.map(w => ({ ...w, color: 'brown' as const, waypoints: [{ x: 80, y: 20 }, { x: 340, y: 20 }, { x: 340, y: 300 }] })) };
  let h = commit(history(doc), next); h = redo(undo(h));
  assert.deepEqual(deserialize(serialize(h.present)), next); assert.deepEqual(grade(next), expected);
  const points = orthogonalPoints([{ x: 15, y: 23 }, ...next.wires[0].waypoints, { x: 140, y: 90 }]);
  assert.ok(points.slice(1).every((p, i) => p.x === points[i].x || p.y === points[i].y));
});

test('malformed waypoint and color imports are rejected; existing schema-1 files remain valid', () => {
  for (const props of [{ waypoints: [{ x: NaN, y: 10 }] }, { waypoints: Array(65).fill({ x: 10, y: 20 }) }, { color: '__proto__' }, { waypoints: [{ x: -1, y: 100 }] }]) {
    const d = correctLesson(); Object.assign(d.wires[0], props); assert.throws(() => deserialize(JSON.stringify(d)));
  }
  assert.ok(grade(deserialize(serialize(correctLesson()))).passed);
});
