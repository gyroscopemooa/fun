export const kinds = ['SUPPLY', 'PUSH_NO', 'PUSH_NC', 'COIL', 'AUX_NO', 'AUX_NC', 'LAMP', 'FUSE', 'JUNCTION', 'TERMINAL_BLOCK', 'TERMINAL4', 'THREE_PHASE', 'MC12', 'EOCR12', 'RELAY8', 'TIMER8', 'FLICKER8', 'FLS8', 'BREAKER3', 'FUSE2', 'SELECTOR', 'BUTTON4', 'BUZZER', 'WATER_SENSOR'] as const;
export type ComponentKind = typeof kinds[number];
export type TerminalRef = { componentId: string; terminalId: string };
export type Point = { x: number; y: number };
export type Component = {
  id: string; kind: ComponentKind; terminals: string[]; linkId?: string;
  params?: { resistance?: number; nominalVoltage?: number; ratingAmps?: number; voltage?: number; delayMs?: number; periodMs?: number };
};
export const wireColors = { yellow: '#b88900', brown: '#92400e', black: '#171717', gray: '#64748b', blue: '#2563eb', greenYellow: '#15803d' } as const;
export type WireColor = keyof typeof wireColors;
export type Wire = { id: string; from: TerminalRef; to: TerminalRef; route?: 'orthogonal' | 'straight'; bend?: number; waypoints?: Point[]; color?: WireColor };
export type CircuitDocument = { schemaVersion: 1; components: Component[]; wires: Wire[]; ui?: { positions?: Record<string, Point> } };
export type FaultCode = 'SHORT' | 'OPEN' | 'FLOATING' | 'INVALID_TERMINAL' | 'OSCILLATION' | 'MISWIRE' | 'CONTACT_LINK' | 'DUPLICATE_WIRE' | 'REVERSED' | 'OVERCURRENT' | 'INVALID_MODEL' | 'UNDERVOLTAGE' | 'PROTECTION_BYPASS' | 'EARTH' | 'PHASE';
export type Fault = { code: FaultCode; affected: string[]; detail: string; severity: 'error' | 'warning' };
export type PublicControls = { mode: 'M' | 'A'; water: 'low' | 'middle' | 'high'; breakerOn: boolean; overload: boolean; resetOverload?: boolean };
export type SimulationInput = { pressedButtons: string[]; elapsedMs: number; powerOn?: boolean; controls?: PublicControls };
export type SimulationResult = {
  energized: Record<string, boolean>; contactsClosed: Record<string, boolean>; faults: Fault[];
  stable: boolean; iterations: number; timeMs: number; powerOn: boolean;
  tripped: string[]; sourceTripped: boolean; latchedFaults: Fault[];
  voltages: Record<string, number | null>; loadVoltages: Record<string, number>; currents: Record<string, number>;
  supplyCurrent: number; activeWireIds: string[]; timers?: Record<string, number>; flsMemory?: Record<string, boolean>; eocrTrip?: boolean; phaseCurrents?: Record<string, number>;
};
export const terminalsFor = (kind: ComponentKind): string[] => ({
  SUPPLY: ['L', 'N'], PUSH_NO: ['13', '14'], PUSH_NC: ['21', '22'], COIL: ['A1', 'A2'],
  AUX_NO: ['13', '14'], AUX_NC: ['21', '22'], LAMP: ['X1', 'X2'], FUSE: ['1', '2'], JUNCTION: ['J'],
  TERMINAL4: Array.from({ length: 4 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat(),
  THREE_PHASE: ['L1', 'L2', 'L3', 'PE'], MC12: Array.from({ length: 12 }, (_, i) => String(i + 1)), EOCR12: Array.from({ length: 12 }, (_, i) => String(i + 1)),
  RELAY8: Array.from({ length: 8 }, (_, i) => String(i + 1)), TIMER8: Array.from({ length: 8 }, (_, i) => String(i + 1)), FLICKER8: Array.from({ length: 8 }, (_, i) => String(i + 1)), FLS8: Array.from({ length: 8 }, (_, i) => String(i + 1)),
  BREAKER3: ['1', '2', '3', '4', '5', '6'], FUSE2: ['1', '2', '3', '4'], SELECTOR: ['M1', 'M2', 'A1', 'A2'], BUTTON4: ['13', '14', '21', '22'], BUZZER: ['X1', 'X2'], WATER_SENSOR: ['E1', 'E2', 'E3'],
  TERMINAL_BLOCK: Array.from({ length: 10 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat(),
})[kind];
export const key = (r: TerminalRef) => `${r.componentId}:${r.terminalId}`;
export const terminalKeys = (c: Component) => c.terminals.map(t => `${c.id}:${t}`);
export const isLoad = (c: Component) => c.kind === 'COIL' || c.kind === 'LAMP';
export const fault = (code: FaultCode, affected: string[], detail: string, severity: Fault['severity'] = 'error'): Fault => ({ code, affected, detail, severity });
