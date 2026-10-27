import type { SimulationInput } from '../model/schema.ts';
export type Scenario = { name: string; input: SimulationInput; on: boolean; hint: string; affected: string[] };
export const scenarios: Scenario[] = [
  { name: '초기 정지', input: { pressedButtons: [], elapsedMs: 0 }, on: false, hint: 'START를 누르기 전에 여자됩니다. START 우회와 NC 오사용을 확인하세요.', affected: ['START', 'MC1_NO'] },
  { name: 'START 누름', input: { pressedButtons: ['START'], elapsedMs: 10 }, on: true, hint: '전원 → F1 → STOP → START → 코일·램프 → N 경로를 확인하세요.', affected: ['START:13', 'START:14', 'MC1:A1', 'MC1:A2', 'PL1:X1', 'PL1:X2'] },
  { name: 'START 해제·자기유지', input: { pressedButtons: [], elapsedMs: 10 }, on: true, hint: 'MC1 NO를 START 양단에 병렬 연결하고 MC1과 연동하세요.', affected: ['MC1_NO:13', 'MC1_NO:14', 'START'] },
  { name: 'STOP 누름', input: { pressedButtons: ['STOP'], elapsedMs: 10 }, on: false, hint: 'STOP은 START와 자기유지 경로를 모두 차단해야 합니다.', affected: ['STOP:21', 'STOP:22', 'MC1_NO'] },
  { name: 'STOP 해제', input: { pressedButtons: [], elapsedMs: 10 }, on: false, hint: 'STOP 해제만으로 재시작하면 안 됩니다.', affected: ['STOP', 'MC1_NO'] },
  { name: '재시작', input: { pressedButtons: ['START'], elapsedMs: 10 }, on: true, hint: '재시작 경로를 확인하세요.', affected: ['START', 'MC1'] },
  { name: '전원 차단', input: { pressedButtons: [], elapsedMs: 10, powerOn: false }, on: false, hint: '전원 차단 시 코일과 램프는 모두 꺼져야 합니다.', affected: ['PS1', 'MC1', 'PL1'] },
  { name: '전원 복구', input: { pressedButtons: [], elapsedMs: 10, powerOn: true }, on: false, hint: '전원 복구만으로 자동 재시작하면 안 됩니다.', affected: ['MC1_NO', 'START'] },
  { name: 'START·STOP 동시 누름', input: { pressedButtons: ['START', 'STOP'], elapsedMs: 1 }, on: false, hint: '동시 누름에서도 STOP이 우선하여 회로를 차단해야 합니다.', affected: ['STOP', 'START'] },
];
