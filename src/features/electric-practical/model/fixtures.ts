import { terminalsFor, type CircuitDocument, type Component, type ComponentKind, type TerminalRef } from './schema.ts';
export function component(id: string, kind: ComponentKind, linkId?: string): Component {
  return { id, kind, terminals: terminalsFor(kind), ...(linkId ? { linkId } : {}),
    ...(kind === 'COIL' ? { params: { resistance: 240, nominalVoltage: 24 } } : {}),
    ...(kind === 'LAMP' ? { params: { resistance: 480, nominalVoltage: 24 } } : {}),
    ...(kind === 'FUSE' ? { params: { ratingAmps: 0.5 } } : {}),
    ...(kind === 'SUPPLY' ? { params: { voltage: 24 } } : {}),
  };
}
export const ref = (s: string): TerminalRef => { const [componentId, terminalId] = s.split(':'); return { componentId, terminalId }; };
export function emptyLesson(): CircuitDocument {
  return { schemaVersion: 1, components: [component('PS1', 'SUPPLY'), component('F1', 'FUSE'), component('STOP', 'PUSH_NC'), component('START', 'PUSH_NO'), component('MC1', 'COIL'), component('MC1_NO', 'AUX_NO', 'MC1'), component('PL1', 'LAMP'), component('J1', 'JUNCTION')], wires: [],
    ui: { positions: { PS1: { x: 40, y: 60 }, F1: { x: 250, y: 60 }, STOP: { x: 470, y: 60 }, START: { x: 470, y: 240 }, MC1_NO: { x: 700, y: 240 }, J1: { x: 700, y: 60 }, MC1: { x: 250, y: 450 }, PL1: { x: 700, y: 450 } } } };
}
export const correctPairs = [
  ['PS1:L', 'F1:1'], ['F1:2', 'STOP:21'], ['STOP:22', 'START:13'], ['START:13', 'MC1_NO:13'],
  ['START:14', 'J1:J'], ['MC1_NO:14', 'J1:J'], ['J1:J', 'MC1:A1'], ['J1:J', 'PL1:X1'], ['MC1:A2', 'PS1:N'], ['PL1:X2', 'PS1:N'],
];
export function correctLesson(): CircuitDocument {
  const d = emptyLesson();
  d.wires = correctPairs.map(([a, b], i) => ({ id: `W${i + 1}`, from: ref(a), to: ref(b), route: 'orthogonal' }));
  return d;
}

/** TB5/TB6 use the public drawing's 10P+10P arrangement; this is still the self-hold lesson. */
export function emptyPanelLesson(): CircuitDocument {
  const d = emptyLesson();
  d.components.push(...['TB5A', 'TB5B', 'TB6A', 'TB6B'].map(id => component(id, 'TERMINAL_BLOCK')));
  d.ui = { positions: {
    TB5A: { x: 40, y: 40 }, TB5B: { x: 520, y: 40 }, TB6A: { x: 40, y: 800 }, TB6B: { x: 520, y: 800 },
    PS1: { x: 40, y: 230 }, F1: { x: 250, y: 230 }, STOP: { x: 470, y: 230 }, J1: { x: 700, y: 230 },
    START: { x: 470, y: 410 }, MC1_NO: { x: 700, y: 410 }, MC1: { x: 250, y: 610 }, PL1: { x: 700, y: 610 },
  } };
  return d;
}
export const panelPairs = [
  ['PS1:L', 'TB5A:1A'], ['TB5A:1B', 'F1:1'], ['F1:2', 'TB5A:3B'], ['TB5A:3A', 'STOP:21'],
  ['STOP:22', 'START:13'], ['START:13', 'MC1_NO:13'], ['START:14', 'TB6A:2A'], ['MC1_NO:14', 'TB6A:2A'],
  ['TB6A:2B', 'MC1:A1'], ['TB6A:2B', 'PL1:X1'], ['MC1:A2', 'TB5A:2B'], ['PL1:X2', 'TB5A:2B'], ['TB5A:2A', 'PS1:N'],
];
export function panelLesson(): CircuitDocument {
  const d = emptyPanelLesson();
  d.components = d.components.filter(c => c.id !== 'J1');
  delete d.ui!.positions!.J1;
  d.wires = panelPairs.map(([a, b], i) => ({ id: `W${i + 1}`, from: ref(a), to: ref(b), route: 'orthogonal', color: 'yellow' }));
  return d;
}
