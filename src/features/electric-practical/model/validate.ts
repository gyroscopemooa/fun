import { fault, key, kinds, terminalsFor, wireColors, type CircuitDocument, type Fault } from './schema.ts';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(v) && !['constructor', 'prototype', '__proto__'].includes(v);
const finite = (v: unknown, low: number, high: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;

/** The same bounded runtime contract is used by the engine and untrusted JSON import. */
export function validateDocument(value: unknown): Fault[] {
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.components) || !Array.isArray(value.wires) || value.components.length > 80 || value.wires.length > 240) {
    return [fault('INVALID_MODEL', [], 'schemaVersion 1, 부품 최대 80개, 전선 최대 240개가 필요합니다.')];
  }
  const errors: Fault[] = [];
  const componentIds = new Set<string>();
  const terminalIds = new Set<string>();
  for (const c of value.components) {
    if (!object(c) || !id(c.id) || !kinds.includes(c.kind as typeof kinds[number]) || !Array.isArray(c.terminals)) {
      return [fault('INVALID_MODEL', [], '부품 ID·종류·단자 배열이 올바르지 않습니다.')];
    }
    if (componentIds.has(c.id)) errors.push(fault('INVALID_MODEL', [c.id], '부품 ID가 중복되었습니다.'));
    componentIds.add(c.id);
    const expected = terminalsFor(c.kind as typeof kinds[number]);
    if (JSON.stringify(c.terminals) !== JSON.stringify(expected)) errors.push(fault('INVALID_TERMINAL', [c.id], `이 부품의 단자는 ${expected.join(', ')}입니다.`));
    expected.forEach(t => terminalIds.add(`${c.id}:${t}`));
    if (c.linkId !== undefined && !id(c.linkId)) errors.push(fault('INVALID_MODEL', [c.id], '연동 코일 ID가 잘못되었습니다.'));
    if (c.params !== undefined) {
      if (!object(c.params)) return [fault('INVALID_MODEL', [c.id], '부품 설정은 객체여야 합니다.')];
      for (const [name, v] of Object.entries(c.params)) {
        const bounds: Record<string, [number, number]> = { resistance: [1, 1e6], voltage: [24, 220], nominalVoltage: [24, 220], delayMs: [100, 60000], periodMs: [100, 10000], ratingAmps: [0.001, 100] };
        if (!bounds[name] || !finite(v, ...bounds[name])) errors.push(fault('INVALID_MODEL', [c.id], `설정 ${name} 범위가 잘못되었습니다. 정격과 시간 범위를 확인하세요.`));
      }
    }
  }
  const wireIds = new Set<string>();
  const pairs = new Set<string>();
  for (const w of value.wires) {
    if (!object(w) || !id(w.id) || !object(w.from) || !object(w.to) || !id(w.from.componentId) || !id(w.to.componentId) || typeof w.from.terminalId !== 'string' || typeof w.to.terminalId !== 'string') return [fault('INVALID_MODEL', [], '전선 끝점 형식이 올바르지 않습니다.')];
    if (wireIds.has(w.id)) errors.push(fault('INVALID_MODEL', [w.id], '전선 ID가 중복되었습니다.'));
    if (componentIds.has(w.id)) errors.push(fault('INVALID_MODEL', [w.id], '전선 ID와 부품 ID는 서로 달라야 합니다.'));
    wireIds.add(w.id);
    const a = `${w.from.componentId}:${w.from.terminalId}`, b = `${w.to.componentId}:${w.to.terminalId}`;
    if (!terminalIds.has(a) || !terminalIds.has(b)) errors.push(fault('INVALID_TERMINAL', [w.id, a, b], '존재하지 않는 단자에 연결되어 있습니다.'));
    if (a === b) errors.push(fault('MISWIRE', [w.id, a], '동일 단자끼리 연결할 수 없습니다.'));
    const pair = [a, b].sort().join('|');
    if (pairs.has(pair)) errors.push(fault('DUPLICATE_WIRE', [w.id, a, b], '동일한 단자 쌍에 중복 전선이 있습니다.', 'warning'));
    pairs.add(pair);
    if ((w.route !== undefined && !['straight', 'orthogonal'].includes(String(w.route))) || (w.bend !== undefined && !finite(w.bend, -2000, 4000))) errors.push(fault('INVALID_MODEL', [w.id], '전선 경로 설정이 잘못되었습니다.'));
    if (w.color !== undefined && !Object.hasOwn(wireColors, String(w.color))) errors.push(fault('INVALID_MODEL', [w.id], '지원하지 않는 전선 색상입니다.'));
    if (w.waypoints !== undefined && (!Array.isArray(w.waypoints) || w.waypoints.length > 64 || w.waypoints.some(p => !object(p) || !finite(p.x, 0, 4000) || !finite(p.y, 0, 4000)))) errors.push(fault('INVALID_MODEL', [w.id], '전선 꺾임점은 0~4000 좌표, 최대 64개입니다.'));
  }
  if (value.ui !== undefined) {
    if (!object(value.ui) || (value.ui.positions !== undefined && !object(value.ui.positions))) return [fault('INVALID_MODEL', [], '화면 좌표 형식이 올바르지 않습니다.')];
    for (const [name, p] of Object.entries(value.ui.positions ?? {})) {
      if (!componentIds.has(name) || !object(p) || !finite(p.x, 0, 2000) || !finite(p.y, 0, 2000)) errors.push(fault('INVALID_MODEL', [name], '부품 좌표는 0~2000 범위여야 합니다.'));
    }
  }
  if (value.components.filter(c => c.kind === 'SUPPLY' || c.kind === 'THREE_PHASE').length !== 1) errors.push(fault('INVALID_MODEL', [], '가상 전원은 1개여야 합니다.'));
  const publicCircuit = value.components.some(c => c.kind === 'THREE_PHASE');
  for (const c of value.components) {
    if (publicCircuit && !['THREE_PHASE', 'MC12', 'EOCR12', 'RELAY8', 'TIMER8', 'FLICKER8', 'FLS8', 'BREAKER3', 'FUSE2', 'SELECTOR', 'BUTTON4', 'LAMP', 'BUZZER', 'WATER_SENSOR', 'TERMINAL_BLOCK', 'TERMINAL4'].includes(c.kind)) errors.push(fault('INVALID_MODEL', [c.id], '공개 1번 모델에서 지원하지 않는 기기입니다.'));
    if (!publicCircuit && !['SUPPLY', 'PUSH_NO', 'PUSH_NC', 'COIL', 'AUX_NO', 'AUX_NC', 'LAMP', 'FUSE', 'JUNCTION', 'TERMINAL_BLOCK', 'TERMINAL4'].includes(c.kind)) errors.push(fault('INVALID_MODEL', [c.id], '이 기기는 공개 1번 전원 모델에서 사용하세요.'));
    if (!publicCircuit && c.params && ((c.params.voltage !== undefined && c.params.voltage !== 24) || (c.params.nominalVoltage !== undefined && c.params.nominalVoltage !== 24))) errors.push(fault('INVALID_MODEL', [c.id], '기초 모델은 24V 정격입니다.'));
    if ((c.kind === 'AUX_NO' || c.kind === 'AUX_NC') && !value.components.some(other => other.kind === 'COIL' && other.id === c.linkId)) errors.push(fault('CONTACT_LINK', [c.id], '보조접점의 연동 코일을 지정하세요.'));
  }
  return errors;
}

export function openTerminals(doc: CircuitDocument): Fault[] {
  const connected = new Set(doc.wires.flatMap(w => [key(w.from), key(w.to)]));
  return doc.components.filter(c => c.kind !== 'JUNCTION' && c.kind !== 'TERMINAL_BLOCK' && c.kind !== 'TERMINAL4').flatMap(c => c.terminals.filter(t => !connected.has(`${c.id}:${t}`)).map(t => fault('OPEN', [`${c.id}:${t}`], `${c.id} ${t} 단자에 전선이 없습니다.`, 'warning')));
}
