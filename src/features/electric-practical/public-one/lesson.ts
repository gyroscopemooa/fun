import { component, ref } from '../model/fixtures.ts';
import type { CircuitDocument, ComponentKind, WireColor } from '../model/schema.ts';

export const PUBLIC_ONE_SOURCE = 'https://www.q-net.or.kr/cst006.do?artlSeq=5208377&brdId=Q006&gSite=Q&id=cst00602&page=1';
export const publicControls = { mode: 'M' as const, water: 'low' as const, breakerOn: true, overload: false };
export const publicKinds: ComponentKind[] = ['TERMINAL_BLOCK', 'TERMINAL4', 'MC12', 'EOCR12', 'RELAY8', 'TIMER8', 'FLICKER8', 'FLS8', 'BREAKER3', 'FUSE2', 'SELECTOR', 'BUTTON4', 'LAMP', 'BUZZER'];
export const isPublicOne = (d: CircuitDocument) => d.components.some(c => c.kind === 'THREE_PHASE');
export function publicOne(wired = true): CircuitDocument {
  const parts: [string, ComponentKind, number, number][] = [
    ['PS1', 'THREE_PHASE', 40, 30], ['TB1', 'TERMINAL4', 300, 30],
    ['TB5A', 'TERMINAL_BLOCK', 300, 210], ['TB5B', 'TERMINAL_BLOCK', 780, 210],
    ['F', 'FUSE2', 280, 420], ['EOCR', 'EOCR12', 460, 420], ['MCCB', 'BREAKER3', 680, 420], ['X', 'RELAY8', 900, 420], ['FR', 'FLICKER8', 1120, 420],
    ['T', 'TIMER8', 320, 710], ['FLS', 'FLS8', 580, 710], ['MC1', 'MC12', 840, 710], ['MC2', 'MC12', 1100, 710],
    ['TB6A', 'TERMINAL_BLOCK', 300, 1000], ['TB6B', 'TERMINAL_BLOCK', 780, 1000],
    ['TB2', 'TERMINAL4', 300, 1200], ['TB3', 'TERMINAL4', 560, 1200], ['TB4', 'TERMINAL4', 840, 1200], ['WATER', 'WATER_SENSOR', 1110, 1200],
    ['PB0', 'BUTTON4', 40, 420], ['PB1', 'BUTTON4', 40, 620], ['SS', 'SELECTOR', 40, 820],
    ['RL', 'LAMP', 300, 1400], ['GL', 'LAMP', 560, 1400], ['YL', 'LAMP', 840, 1400], ['BZ', 'BUZZER', 1100, 1400],
  ];
  const d: CircuitDocument = { schemaVersion: 1, components: parts.map(([id, kind]) => {
    const c = component(id, kind);
    if (['THREE_PHASE'].includes(kind)) c.params = { voltage: 220 };
    if (['MC12', 'EOCR12', 'RELAY8', 'TIMER8', 'FLICKER8', 'FLS8', 'LAMP', 'BUZZER'].includes(kind)) c.params = { resistance: kind === 'LAMP' || kind === 'BUZZER' ? 9680 : 4840, nominalVoltage: 220 };
    if (kind === 'TIMER8') c.params!.delayMs = 3000;
    if (kind === 'FLICKER8') c.params!.periodMs = 500;
    if (kind === 'FUSE2') c.params = { ratingAmps: 10 };
    return c;
  }), wires: [], ui: { positions: Object.fromEntries(parts.map(([id, , x, y]) => [id, { x, y }])) } };
  if (!wired) return d;
  const net = (terminals: string[], color: WireColor = 'yellow') => {
    for (let i = 1; i < terminals.length; i++) d.wires.push({ id: `W${d.wires.length + 1}`, from: ref(terminals[i - 1]), to: ref(terminals[i]), color, route: 'orthogonal' });
  };
  const external = (t: string, pole: string, color: WireColor = 'yellow') => { net([t, `${pole}A`], color); return `${pole}B`; };
  const ssM1 = external('SS:M1', 'TB5A:5'), ssM2 = external('SS:M2', 'TB5A:6'), ssA1 = external('SS:A1', 'TB5A:7'), ssA2 = external('SS:A2', 'TB5A:8');
  const pb0in = external('PB0:21', 'TB5B:1'), pb0out = external('PB0:22', 'TB5B:2'), pb1in = external('PB1:13', 'TB5B:3'), pb1out = external('PB1:14', 'TB5B:4');
  const rl1 = external('RL:X1', 'TB6B:4'), rl2 = external('RL:X2', 'TB6B:5'), gl1 = external('GL:X1', 'TB6B:6'), gl2 = external('GL:X2', 'TB6B:7');
  const yl1 = external('YL:X1', 'TB5B:5'), yl2 = external('YL:X2', 'TB5B:6'), bz1 = external('BZ:X1', 'TB5B:7'), bz2 = external('BZ:X2', 'TB5B:8');
  for (let i = 1; i <= 3; i++) {
    const color = (['brown', 'black', 'gray'] as const)[i - 1];
    net([`PS1:L${i}`, `TB1:${i}A`], color); net([`TB1:${i}B`, `TB5A:${i}A`], color); net([`TB5A:${i}B`, `MCCB:${2 * i - 1}`], color);
    net([`MCCB:${2 * i}`, `EOCR:${i}`, ...(i === 1 ? ['F:1'] : i === 3 ? ['F:3'] : [])], color);
    net([`EOCR:${i + 6}`, `MC1:${i}`, `MC2:${i}`], color);
    net([`MC1:${i + 6}`, `TB6A:${i}B`], color); net([`TB6A:${i}A`, `TB2:${i}A`], color);
    net([`MC2:${i + 6}`, `TB6A:${i + 4}B`], color); net([`TB6A:${i + 4}A`, `TB3:${i}A`], color);
  }
  net(['PS1:PE', 'TB1:4A'], 'greenYellow'); net(['TB1:4B', 'TB5A:4A'], 'greenYellow');
  net(['TB5A:4B', 'TB6A:4B', 'TB6A:8B', 'FLS:1'], 'greenYellow'); net(['TB6A:4A', 'TB2:4A'], 'greenYellow'); net(['TB6A:8A', 'TB3:4A'], 'greenYellow');
  net(['F:2', 'EOCR:6', 'EOCR:10']);
  net(['EOCR:4', ssM1, ssA1, 'X:1', 'MC1:4', 'MC2:4']);
  net([ssA2, 'FLS:5', 'FLS:4']); net(['FLS:3', 'X:2']);
  net([ssM2, pb0in]); net([pb0out, pb1in, 'T:1']);
  net([pb1out, 'T:3', 'X:8', 'MC1:6', 'T:8', 'X:3']); net(['X:5', 'T:2']); net(['T:6', 'MC2:6']);
  net(['MC1:10', rl1]); net(['MC2:10', gl1]);
  net(['EOCR:5', 'FR:2', 'FR:8']); net(['FR:6', yl1]); net(['FR:5', bz1]);
  net(['F:4', 'EOCR:12', 'FLS:6', 'X:7', 'T:7', 'MC1:12', 'MC2:12', 'FR:7', rl2, gl2, yl2, bz2]);
  for (const [i, pin] of [[1, 7], [2, 8], [3, 1]]) {
    net([`FLS:${pin}`, `TB6B:${i}B`]); net([`TB6B:${i}A`, `TB4:${i}A`]); net([`TB4:${i}B`, `WATER:E${i}`]);
  }
  return d;
}
