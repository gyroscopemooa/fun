import { publicOne, publicControls, isPublicOne, publicKinds, PUBLIC_ONE_SOURCE } from '../public-one/lesson.ts';
import { useEffect, useReducer, useRef, useState } from 'react';
import { component, correctLesson, emptyLesson, emptyPanelLesson, panelLesson, ref } from '../model/fixtures.ts';
import { key, kinds, terminalsFor, type CircuitDocument, type ComponentKind, type Point, type SimulationResult, wireColors, type WireColor, type PublicControls } from '../model/schema.ts';
import { initialState, simulate } from '../engine/simulate.ts';
import { grade, type GradeResult } from '../grading/grade.ts';
import { commit, connect, history, redo, removeSelection, undo, type History } from '../editor/history.ts';
import Canvas, { colorLabels, labels, type Selection } from '../editor/Canvas.tsx';
import { deserialize, serialize, STORAGE_KEY } from '../storage/document.ts';
import './simulator.css';

type State = { controls: PublicControls; history: History; simulation: SimulationResult; running: boolean; power: boolean; pressed: string[]; report: GradeResult | null; log: string[]; message: string };
type Action = { type: 'control'; controls: Partial<PublicControls> } | { type: 'edit'; doc: CircuitDocument; message?: string } | { type: 'undo' | 'redo' | 'run' | 'power' | 'reset' | 'grade' } | { type: 'button'; id: string; down: boolean } | { type: 'release' } | { type: 'tick'; ms: number } | { type: 'message'; message: string };
const initial = (): State => ({ controls: { ...publicControls }, history: history(publicOne()), simulation: initialState(), running: false, power: true, pressed: [], report: null, log: [], message: '공개 1번 완성 배선을 불러왔습니다. 실행 후 PB1을 눌러 MC1 → 3초 뒤 MC2 동작을 확인하세요.' });
function reducer(state: State, action: Action): State {
  if (action.type === 'message') return { ...state, message: action.message };
  if (action.type === 'grade') return { ...state, report: grade(state.history.present), message: '현재 결선으로 독립 시나리오 검수를 완료했습니다.' };
  if (action.type === 'reset') return { ...state, simulation: initialState(), controls: { ...publicControls }, running: false, pressed: [], power: true, log: [], report: null, message: '시뮬레이션·보호 차단을 초기화했습니다. 배선은 유지됩니다.' };
  if (action.type === 'edit' || action.type === 'undo' || action.type === 'redo') {
    if (state.running) return state;
    const h = action.type === 'edit' ? commit(state.history, action.doc) : action.type === 'undo' ? undo(state.history) : redo(state.history);
    return { ...state, history: h, simulation: initialState(), controls: { ...publicControls }, pressed: [], report: null, log: [], message: action.type === 'edit' ? action.message ?? '결선을 변경했습니다. 실행 또는 검수로 확인하세요.' : action.type === 'undo' ? '이전 편집을 복원했습니다.' : '편집을 다시 적용했습니다.' };
  }
  const controls = action.type === 'control' ? { ...state.controls, ...action.controls } : state.controls;
  if (action.type === 'control' && !state.running) return { ...state, controls };
  let running = state.running, power = state.power, pressed = state.pressed, elapsedMs = 0;
  if (action.type === 'run') { running = !running; if (!running) pressed = []; }
  if (action.type === 'power') { power = !power; pressed = []; }
  if (action.type === 'release') { if (!pressed.length) return state; pressed = []; }
  if (action.type === 'button') {
    if (!running) return state;
    pressed = action.down ? [...new Set([...pressed, action.id])] : pressed.filter(id => id !== action.id); elapsedMs = 1;
  }
  if (action.type === 'tick') { if (!running) return state; elapsedMs = action.ms; }
  const simulation = simulate(state.history.present, state.simulation, { pressedButtons: pressed, elapsedMs, powerOn: power, controls });
  const changed = JSON.stringify([simulation.energized, simulation.faults, pressed]) !== JSON.stringify([state.simulation.energized, state.simulation.faults, state.pressed]);
  const entry = `${simulation.timeMs}ms · ${pressed.join('+') || '버튼 해제'} · MC1 ${simulation.energized.MC1 ? '여자' : '소자'} / ${isPublicOne(state.history.present) ? `MC2 ${simulation.energized.MC2 ? '여자' : '소자'} · RL ${simulation.energized.RL ? 'ON' : 'OFF'} · GL ${simulation.energized.GL ? 'ON' : 'OFF'} · YL ${simulation.energized.YL ? 'ON' : 'OFF'} · BZ ${simulation.energized.BZ ? 'ON' : 'OFF'}` : `PL1 ${simulation.energized.PL1 ? '점등' : '소등'}`}${simulation.faults.filter(f => f.severity === 'error').map(f => ` · ${f.code}`).join('')}`;
  return { ...state, simulation, running, power, pressed, controls: { ...controls, overload: false, resetOverload: false }, log: changed || action.type === 'run' || action.type === 'power' ? [entry, ...state.log].slice(0, 60) : state.log };
}

export default function SimulatorPage() {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const [selection, setSelection] = useState<Selection>(null), [zoom, setZoom] = useState(0.7), [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false), [highlighted, setHighlighted] = useState<string[]>([]), [hydrated, setHydrated] = useState(false);
  const [wireColor, setWireColor] = useState<WireColor>('yellow'), [wiring, setWiring] = useState(true);
  const [wireView, setWireView] = useState<'all' | 'yellow' | 'power' | 'selected'>('all');
  const [sound, setSound] = useState(false);
  const soundContext = useRef<AudioContext | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const doc = state.history.present, publicMode = isPublicOne(doc), locked = state.running || mobile;
  useEffect(() => {
    setHydrated(true);
    const media = matchMedia('(max-width: 767px)'); const update = () => setMobile(media.matches); update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => dispatch({ type: 'tick', ms: 100 }), 100); return () => clearInterval(timer);
  }, [state.running]);
  useEffect(() => {
    const release = () => dispatch({ type: 'release' });
    const hidden = () => { if (document.hidden) release(); };
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); window.addEventListener('blur', release); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!sound || !state.simulation.energized.BZ || !soundContext.current) return;
    const context = soundContext.current, oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = 650; gain.gain.value = 0.035; oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
    return () => { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); };
  }, [sound, state.simulation.energized.BZ]);
  useEffect(() => () => { void soundContext.current?.close(); }, []);
  const message = (text: string) => dispatch({ type: 'message', message: text });
  const edit = (next: CircuitDocument, message?: string) => { dispatch({ type: 'edit', doc: next, message }); setHighlighted([]); };
  const attempt = (fn: () => void) => { try { fn(); } catch (error) { message(`오류: ${error instanceof Error ? error.message : String(error)}`); } };
  const move = (id: string, point: Point) => edit({ ...doc, ui: { positions: { ...doc.ui?.positions, [id]: point } } });
  const selectedComponent = selection?.type === 'component' ? doc.components.find(c => c.id === selection.id) : undefined;
  const selectedWire = selection?.type === 'wire' ? doc.wires.find(w => w.id === selection.id) : undefined;
  const allTerminals = doc.components.flatMap(c => c.terminals.map(t => `${c.id}:${t}`));
  const remove = () => { if (selection && !locked) { edit(removeSelection(doc, selection)); setSelection(null); } };
  const add = (kind: ComponentKind) => {
    if (doc.components.length >= 80) { message('부품은 최대 80개입니다.'); return; }
    const prefix = ({ SUPPLY: 'PS', FUSE: 'F', COIL: 'MC', LAMP: 'PL', JUNCTION: 'J', PUSH_NO: 'PB_NO', PUSH_NC: 'PB_NC', AUX_NO: 'AUX_NO', AUX_NC: 'AUX_NC', TERMINAL_BLOCK: 'TB' } as Record<string, string>)[kind] ?? kind;
    let n = 1; while (doc.components.some(c => c.id === `${prefix}${n}`)) n++;
    const id = `${prefix}${n}`, c = component(id, kind, kind.startsWith('AUX') ? doc.components.find(c => c.kind === 'COIL')?.id : undefined);
    if (publicMode) { const template = publicOne(false).components.find(x => x.kind === kind); if (template?.params) c.params = { ...template.params }; }
    edit({ ...doc, components: [...doc.components, c], ui: { positions: { ...doc.ui?.positions, [id]: { x: 40 + (doc.components.length % 4) * 220, y: Math.min(1800, Math.max(0, 640 + Math.floor((doc.components.length - 8) / 4) * 160)) } } } }); setSelection({ type: 'component', id });
  };
  const changeKind = (kind: ComponentKind) => {
    if (!selectedComponent) return; const c = selectedComponent, ts = terminalsFor(kind);
    edit({ ...doc, components: doc.components.map(x => x.id === c.id ? { ...x, kind, terminals: ts } : x), wires: doc.wires.map(w => ({ ...w, from: w.from.componentId === c.id ? { ...w.from, terminalId: ts[c.terminals.indexOf(w.from.terminalId)] } : w.from, to: w.to.componentId === c.id ? { ...w.to, terminalId: ts[c.terminals.indexOf(w.to.terminalId)] } : w.to })) });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([serialize(doc)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = publicMode ? 'public-one-circuit.json' : 'self-hold-circuit.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('회로 JSON을 내보냈습니다.');
  };
  const controlButton = (id: string) => <button key={id} data-testid={`press-${id}`} className={id === 'STOP' || id === 'PB0' ? 'ep-stop' : 'ep-start'} disabled={!state.running} aria-pressed={state.pressed.includes(id)}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); dispatch({ type: 'button', id, down: true }); }}
    onPointerUp={() => dispatch({ type: 'button', id, down: false })} onPointerCancel={() => dispatch({ type: 'button', id, down: false })}
    onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); dispatch({ type: 'button', id, down: true }); } }}
    onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'button', id, down: false }); } }} onBlur={() => dispatch({ type: 'button', id, down: false })}>{id === 'PB0' ? 'PB0 · STOP' : id === 'PB1' ? 'PB1 · START' : id} {state.pressed.includes(id) ? '누르는 중' : '누르기'}</button>;
  return <section className={`ep-simulator ${publicMode ? 'ep-public' : ''}`} data-testid="simulator-ready" data-hydrated={hydrated}>
    <div className="ep-task"><label>실습 과제 <select aria-label="실습 과제" disabled={state.running} value={publicMode ? 'public1' : doc.components.some(c => c.kind === 'TERMINAL_BLOCK') ? 'panel' : 'basic'} onChange={e => { edit(e.target.value === 'public1' ? publicOne() : e.target.value === 'panel' ? emptyPanelLesson() : emptyLesson()); setSelection(null); setZoom(e.target.value === 'basic' ? 0.85 : 0.7); }}><option value="public1">공개 1번 · 완성 배선과 동작</option><option value="panel">단자대 결선 · 자기유지</option><option value="basic">기초 · MC 자기유지</option></select></label><span>{publicMode ? '3상 220V 실효값 모델 · 12P/8P 기기' : '24V 가상 제어전원 · 자체 제작 학습 과제'}</span></div>
    {publicMode ? <div className="ep-public-intro"><strong>공개 1번 완성 예제</strong><p>① 실행 → ② SS 수동 M → ③ PB1 START → MC1·RL 동작 → 3초 후 MC2·GL 동작. PB0 STOP으로 정지합니다.</p><p>자동 A에서는 수위를 바꿔 FLS·X·MC1을 시험하세요. EOCR 시험 트립은 FR을 켜고 BZ·YL을 0.5초마다 교대로 동작시킵니다.</p><a href={PUBLIC_ONE_SOURCE} target="_blank" rel="noreferrer">기준: 큐넷 공개문제 2025-08-04 · 1번</a><small>원본 도면의 기기 핀 배열·시퀀스를 바탕으로 작성한 결선 예제입니다. TB5/TB6 세부 번호 배정과 SS/PB 접점 표기는 이 도구의 결선표를 사용합니다.</small></div> : <p>START → MC 여자·표시등 점등 → 손을 놓아도 유지 → STOP으로 해제. 전원 복구 시 자동 재시작이 없어야 합니다.</p>}
    <div className="ep-toolbar">
      <button onClick={() => dispatch({ type: 'run' })} data-testid="run">{state.running ? '일시정지 · 편집' : '실행'}</button>
      <button onClick={() => dispatch({ type: 'reset' })}>시뮬레이션 초기화</button>
      <button onClick={() => dispatch({ type: 'grade' })} data-testid="grade">과제 검수</button>
      <button disabled={locked} onClick={() => attempt(() => { localStorage.setItem(STORAGE_KEY, serialize(doc)); message('이 브라우저에 회로를 저장했습니다.'); })}>로컬 저장</button>
      <button disabled={state.running} onClick={() => attempt(() => { const value = localStorage.getItem(STORAGE_KEY); if (!value) throw new Error('저장된 회로가 없습니다.'); edit(deserialize(value), '저장된 회로를 불러왔습니다. 실행 상태는 초기화됩니다.'); setSelection(null); })}>로컬 불러오기</button>
      <button onClick={download}>JSON 내보내기</button>
      <button disabled={state.running} onClick={() => file.current?.click()}>JSON 가져오기</button>
      <input ref={file} type="file" accept=".json,application/json" className="ep-file" aria-label="회로 JSON 가져오기" onChange={async e => { const input = e.currentTarget, selected = input.files?.[0]; if (!selected) return; try { if (selected.size > 500000) throw new Error('파일은 500 KB 이하만 지원합니다.'); const next = deserialize(await selected.text()); edit(next, 'JSON 회로를 불러왔습니다.'); setSelection(null); } catch (error) { message(`불러오기 실패: ${error instanceof Error ? error.message : String(error)}`); } finally { input.value = ''; } }} />
      <button onClick={() => setHelp(!help)} aria-expanded={help}>도움말</button>
    </div>
    {help && <div className="ep-help"><strong>결선 방법</strong><p>시작 단자를 클릭하고 빈 곳을 클릭해 선을 꺾은 뒤 끝 단자를 클릭하세요. 두 단자 클릭이나 드래그도 가능합니다. Esc는 취소, Backspace는 마지막 꺾임점 취소입니다. 완성한 선을 선택하면 꺾임점을 드래그하거나 방향키로 수정할 수 있습니다. Tab·Enter로도 연결할 수 있습니다. 한 단자에 여러 전선을 연결하면 분기가 됩니다. 선끼리 교차해도 접속되지 않습니다. J 분기 부품 또는 같은 단자를 사용하세요.</p><p>부품 제목을 드래그하거나 선택 후 방향키로 이동합니다. 전선 선택 후 끝점 선택으로 재배선하고 Delete 또는 삭제 버튼으로 끊습니다. 편집은 일시정지 상태에서 가능합니다. 실행 상태의 START/STOP은 누르고 있는 동안만 동작하며 마우스를 놓거나 창을 벗어나면 해제됩니다.</p><p>전선 피복 색은 실행해도 유지됩니다. 초록 테두리는 계산된 통전 부하의 대표 전원·리턴 경로입니다. 병렬 도선 사이의 전류 분배량이나 AC 파형을 나타내지 않습니다. 퓨즈 동작 시 가상 전원도 보호 차단되며 결선 수정 후 초기화해야 합니다. 모든 단자는 여러 전선 연결을 허용합니다.</p></div>}
    {mobile && <p className="ep-notice" data-testid="mobile-readonly">모바일 읽기 모드: 회로 열람·불러오기·실행·START/STOP·검수만 지원합니다. 전체 결선 편집은 데스크톱에서 사용하세요.</p>}
    <p className="ep-message" role="status" aria-label="회로 작업 알림">{state.message}</p>
    <div className="ep-workspace">
      <aside className="ep-palette"><h2>부품 카탈로그</h2>{(publicMode ? publicKinds : kinds.filter(k => ['SUPPLY', 'PUSH_NO', 'PUSH_NC', 'COIL', 'AUX_NO', 'AUX_NC', 'LAMP', 'FUSE', 'JUNCTION', 'TERMINAL_BLOCK'].includes(k))).map(kind => <button key={kind} disabled={locked || (kind === 'SUPPLY' && doc.components.some(c => c.kind === 'SUPPLY'))} onClick={() => add(kind)}>＋ {labels[kind]}</button>)}
        <hr /><button disabled={locked} onClick={() => { edit(publicMode ? publicOne(false) : doc.components.some(c => c.kind === 'TERMINAL_BLOCK') ? emptyPanelLesson() : emptyLesson(), '과제 부품만 남기고 전선을 비웠습니다. Undo로 복원할 수 있습니다.'); setSelection(null); }}>빈 과제로 시작</button>
        {!publicMode && <button disabled={state.running} onClick={() => { edit(correctLesson(), '예제 결선을 불러왔습니다. 실제 엔진으로 실행·검수합니다.'); setSelection(null); setZoom(0.85); }}>학습 예제 불러오기</button>}
        {!publicMode && <button disabled={state.running} onClick={() => { edit(panelLesson(), '상·하단 단자대를 실제로 경유하는 자기유지 예제입니다.'); setSelection(null); setZoom(0.7); }}>단자대 경유 예제</button>}
        {publicMode && <button disabled={state.running} onClick={() => { edit(publicOne(), '공개 1번 완성 배선을 불러왔습니다. 실행 후 PB1을 누르세요.'); setSelection(null); setZoom(0.7); }}>공개 1번 완성 배선 불러오기</button>}
        <p>정답 모양이 아닌 실제 동작과 과제 규칙을 검사합니다.</p>
      </aside>
      <div className="ep-editor">
        <div className="ep-wire-tools"><button disabled={locked} aria-pressed={wiring} onClick={() => { setWiring(true); setSelection(null); }}>배선 그리기</button><button disabled={locked} aria-pressed={!wiring} onClick={() => setWiring(false)}>선택 · 이동</button><label>새 전선 색 <select aria-label="새 전선 색" disabled={locked} value={wireColor} onChange={e => setWireColor(e.target.value as WireColor)}>{Object.keys(wireColors).map(c => <option key={c} value={c}>{colorLabels[c as WireColor]}</option>)}</select></label><span className="ep-color-sample" style={{ background: wireColors[wireColor] }} /><label>배선 보기<select aria-label="배선 보기" value={wireView} onChange={e => setWireView(e.target.value as typeof wireView)}><option value="all">전체 전선</option><option value="yellow">황색선 강조</option><option value="power">주회로 색상 강조</option><option value="selected">선택한 선/기기 강조</option></select></label></div>
        <div className="ep-toolbar ep-editor-tools">
        <button disabled={locked || !state.history.past.length} onClick={() => { dispatch({ type: 'undo' }); setSelection(null); }}>Undo</button><button disabled={locked || !state.history.future.length} onClick={() => { dispatch({ type: 'redo' }); setSelection(null); }}>Redo</button>
        <button disabled={locked || !selection} onClick={remove}>선택 삭제</button><button aria-label="축소" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.15).toFixed(2)))}>−</button><output>{Math.round(zoom * 100)}%</output><button aria-label="확대" onClick={() => setZoom(z => Math.min(1.9, +(z + 0.15).toFixed(2)))}>＋</button>
        <button onClick={() => { const board = document.querySelector<SVGSVGElement>('.ep-board'), scroll = document.querySelector<HTMLElement>('.ep-board-scroll'); if (board && scroll) setZoom(Math.max(0.25, Math.min(1, (scroll.clientWidth - 20) / board.viewBox.baseVal.width, 590 / board.viewBox.baseVal.height))); }}>전체 보기</button><span data-testid="wire-count">전선 {doc.wires.length}개</span><span>{locked ? '읽기 / 실행 모드' : '편집 · 20px 스냅'}</span>
      </div>
        <Canvas key={`${state.running}-${mobile}`} doc={doc} simulation={state.simulation} readonly={locked} selection={selection} onSelect={setSelection} onConnect={(a, b, points) => attempt(() => { const next = connect(doc, a, b, points, wireColor); if (next !== doc) edit(next); else message('동일 단자 또는 이미 연결한 단자 쌍입니다.'); })} onMove={move} onDelete={remove} zoom={zoom} highlighted={highlighted} wireColor={wireColor} wiring={wiring} wireView={wireView} onRoute={(id, points) => edit({ ...doc, wires: doc.wires.map(w => w.id === id ? { ...w, waypoints: points } : w) })} />
        {selectedWire && <div className="ep-inspector"><strong>전선 {selectedWire.id} 재배선</strong><label>피복 색<select aria-label="선택 전선 색" disabled={locked} value={selectedWire.color ?? 'yellow'} onChange={e => edit({ ...doc, wires: doc.wires.map(w => w.id === selectedWire.id ? { ...w, color: e.target.value as WireColor } : w) })}>{Object.keys(wireColors).map(c => <option key={c} value={c}>{colorLabels[c as WireColor]}</option>)}</select></label><button disabled={locked || !selectedWire.waypoints?.length} onClick={() => edit({ ...doc, wires: doc.wires.map(w => w.id === selectedWire.id ? { ...w, waypoints: [] } : w) })}>꺾임점 초기화</button>{(['from', 'to'] as const).map(end => <label key={end}>{end === 'from' ? '시작 단자' : '끝 단자'}<select disabled={locked} value={key(selectedWire[end])} onChange={e => edit({ ...doc, wires: doc.wires.map(w => w.id === selectedWire.id ? { ...w, [end]: ref(e.target.value) } : w) })}>{allTerminals.map(t => <option key={t}>{t}</option>)}</select></label>)}<label>선 모양<select aria-label="선 모양" disabled={locked} value={selectedWire.route ?? 'orthogonal'} onChange={e => edit({ ...doc, wires: doc.wires.map(w => w.id === selectedWire.id ? { ...w, route: e.target.value as 'straight' | 'orthogonal' } : w) })}><option value="orthogonal">직각</option><option value="straight">직선</option></select></label></div>}
        {selectedComponent && <div className="ep-inspector"><strong>{selectedComponent.id} · {labels[selectedComponent.kind]}</strong>
          {selectedComponent.kind.startsWith('AUX') && <label>연동 코일<select aria-label="연동 코일" disabled={locked} value={selectedComponent.linkId ?? ''} onChange={e => edit({ ...doc, components: doc.components.map(c => c.id === selectedComponent.id ? { ...c, linkId: e.target.value || undefined } : c) })}><option value="">미지정</option>{doc.components.filter(c => c.kind === 'COIL').map(c => <option key={c.id}>{c.id}</option>)}</select></label>}
          {(selectedComponent.kind.startsWith('AUX') || selectedComponent.kind.startsWith('PUSH')) && <label>접점 형식<select aria-label="접점 형식" disabled={locked} value={selectedComponent.kind} onChange={e => changeKind(e.target.value as ComponentKind)}>{(selectedComponent.kind.startsWith('AUX') ? ['AUX_NO', 'AUX_NC'] : ['PUSH_NO', 'PUSH_NC']).map(k => <option key={k} value={k}>{labels[k]}</option>)}</select></label>}
          {publicMode && <small>{selectedComponent.kind === 'MC12' ? '코일 6–12 · 주접점 1–7 / 2–8 / 3–9 · NO 4–10 · NC 5–11' : selectedComponent.kind === 'TIMER8' ? '코일 2–7 · 순간 NO 1–3 · 시간 NO 8–6 / NC 8–5' : selectedComponent.kind === 'RELAY8' ? '코일 2–7 · NO 1–3 / 8–6 · NC 1–4 / 8–5' : selectedComponent.kind === 'EOCR12' ? '전원 6–12 · COM 10–11 · 정상 NC 4–10 · 트립 NO 5–11' : selectedComponent.kind === 'FLS8' ? '전원 5–6 · COM 4 / NO 3 / NC 2 · E1=7, E2=8, E3=1' : selectedComponent.kind === 'FLICKER8' ? '전원 2–7 · COM 8 / NO 6 / NC 5' : ''}</small>}
          {(selectedComponent.kind === 'TIMER8' || selectedComponent.kind === 'FLICKER8') && <label>{selectedComponent.kind === 'TIMER8' ? '타이머 설정' : '교대 간격'}<select aria-label="기기 시간 설정" disabled={locked} value={selectedComponent.kind === 'TIMER8' ? selectedComponent.params?.delayMs ?? 3000 : selectedComponent.params?.periodMs ?? 500} onChange={e => edit({ ...doc, components: doc.components.map(c => c.id === selectedComponent.id ? { ...c, params: { ...c.params, [c.kind === 'TIMER8' ? 'delayMs' : 'periodMs']: Number(e.target.value) } } : c) })}>{[500, 1000, 2000, 3000, 5000].map(ms => <option key={ms} value={ms}>{ms / 1000}초</option>)}</select></label>}
          {selectedComponent.kind === 'FUSE' && <label>퓨즈 정격<select aria-label="퓨즈 정격" disabled={locked} value={selectedComponent.params?.ratingAmps ?? 0.5} onChange={e => edit({ ...doc, components: doc.components.map(c => c.id === selectedComponent.id ? { ...c, params: { ...c.params, ratingAmps: Number(e.target.value) } } : c) })}>{[0.1, 0.12, 0.2, 0.5, 1].map(n => <option key={n} value={n}>{n} A</option>)}</select></label>}
        </div>}
      </div>
      <aside className="ep-results"><h2>실시간 상태</h2>{publicMode && <div className="ep-public-controls"><label>SS 운전 모드<select aria-label="SS 운전 모드" value={state.controls.mode} onChange={e => dispatch({ type: 'control', controls: { mode: e.target.value as 'M' | 'A' } })}><option value="M">수동 M</option><option value="A">자동 A</option></select></label><label>수위 입력<select aria-label="수위 입력" value={state.controls.water} onChange={e => dispatch({ type: 'control', controls: { water: e.target.value as PublicControls['water'] } })}><option value="low">하한 아래 · 정지</option><option value="middle">중간 · 기존 상태 유지</option><option value="high">상한 도달 · 감지</option></select></label><button onClick={() => dispatch({ type: 'control', controls: { breakerOn: !state.controls.breakerOn } })}>MCCB {state.controls.breakerOn ? 'ON → OFF' : 'OFF → ON'}</button><button disabled={!state.running} onClick={() => dispatch({ type: 'control', controls: { overload: true } })}>EOCR 시험 트립</button><button disabled={!state.running} onClick={() => dispatch({ type: 'control', controls: { resetOverload: true } })}>EOCR RESET</button><button aria-pressed={sound} onClick={() => { if (!sound) { soundContext.current ??= new AudioContext(); void soundContext.current.resume(); } setSound(!sound); }}>부저 소리 {sound ? 'ON' : 'OFF'}</button><small>과부하 신호를 주입하는 시험 버튼입니다. 전동기 열·과전류 곡선은 모델링하지 않습니다.</small></div>}<div className="ep-controls"><button onClick={() => dispatch({ type: 'power' })} data-testid="power">가상 전원 {state.power ? 'ON → OFF' : 'OFF → ON'}</button>{doc.components.filter(c => c.kind === 'PUSH_NO' || c.kind === 'PUSH_NC' || c.kind === 'BUTTON4').map(c => controlButton(c.id))}</div>
        {publicMode ? <><div className="ep-output-grid">{['MC1', 'MC2', 'M1', 'M2', 'RL', 'GL', 'YL', 'BZ', 'X', 'FLS', 'T', 'FR'].map(id => <div key={id} data-testid={`public-state-${id}`} data-on={!!state.simulation.energized[id]} className={state.simulation.energized[id] ? 'ep-on' : ''}><span>{id}{id === 'M1' || id === 'M2' ? ' 출력' : ''}</span><strong>{state.simulation.energized[id] ? 'ON' : 'OFF'}</strong></div>)}</div><dl><dt>T 경과 / 설정</dt><dd data-testid="timer-status">{((state.simulation.timers?.T ?? 0) / 1000).toFixed(1)} / {(doc.components.find(c => c.id === 'T')?.params?.delayMs ?? 3000) / 1000}s</dd><dt>EOCR</dt><dd>{state.simulation.eocrTrip ? '트립' : '정상'}</dd><dt>입력선 최대 RMS 전류</dt><dd>{state.simulation.supplyCurrent.toFixed(3)} A</dd><dt>MC1 / MC2 코일</dt><dd>{(state.simulation.loadVoltages.MC1 ?? 0).toFixed(1)} / {(state.simulation.loadVoltages.MC2 ?? 0).toFixed(1)} V</dd></dl></> : <dl><dt>MC1 코일</dt><dd data-testid="coil-status">{state.simulation.energized.MC1 ? '여자 ON' : '소자 OFF'}</dd><dt>PL1 표시등</dt><dd data-testid="lamp-status">{state.simulation.energized.PL1 ? '점등 ON' : '소등 OFF'}</dd><dt>계산 전원 전류</dt><dd>{state.simulation.supplyCurrent.toFixed(3)} A</dd><dt>코일 / 램프 전압</dt><dd>{(state.simulation.loadVoltages.MC1 ?? 0).toFixed(1)} / {(state.simulation.loadVoltages.PL1 ?? 0).toFixed(1)} V</dd></dl>}
        <h3>현재 오류 / 주의</h3><div className="ep-fault-list" data-testid="live-faults">{state.simulation.faults.length ? state.simulation.faults.map((f, i) => <button key={i} className="ep-fault" onClick={() => setHighlighted(f.affected)}><strong>{f.code}</strong> {f.detail}<small>{f.affected.join(', ')}</small></button>) : <p>현재 감지된 오류 없음</p>}</div>
        <h3>이벤트 로그</h3><ol className="ep-log">{state.log.map((entry, i) => <li key={`${i}-${entry}`}>{entry}</li>)}</ol>
      </aside>
    </div>
    <div className="ep-statusbar"><span>L/N: {!state.power ? '전원 OFF' : state.simulation.sourceTripped ? '보호 차단' : publicMode ? '3상 220V 가상 전원' : '24V 가상 전원'}</span><span>누름: {state.pressed.join(', ') || '없음'}</span><span>MC1 {state.simulation.energized.MC1 ? 'ON' : 'OFF'} · {publicMode ? `MC2 ${state.simulation.energized.MC2 ? 'ON' : 'OFF'}` : `PL1 ${state.simulation.energized.PL1 ? 'ON' : 'OFF'}`}</span><span>{state.simulation.timeMs} ms (가상 시각)</span><span>{state.simulation.stable ? '안정' : '계산 오류 / 불수렴'} · {state.simulation.iterations}회</span></div>
    {state.report && <section className="ep-report" data-testid="grade-report"><h2 data-testid="grade-result">{state.report.passed ? publicMode ? '합격 · 공개 1번 동작 시나리오 통과' : '합격 · 자기유지 과제 통과' : '불합격 · 결선을 수정하세요'}</h2><p>동작 {state.report.behaviorPassed ? '통과' : '실패'} / 단락·보호 규칙 {state.report.safetyPassed ? '통과' : '실패'} / 지정 부품·단자 {state.report.requirementsPassed ? '통과' : '실패'}</p>
      {state.report.requirements.map((f, i) => <button className="ep-fault" key={i} onClick={() => setHighlighted(f.affected)}>{f.code} · {f.detail} <small>{f.affected.join(', ')}</small></button>)}
      <div className="ep-step-grid">{state.report.steps.map((step, i) => <div key={step.name} className={step.passed ? 'ep-pass' : 'ep-fail'}><strong>{i + 1}. {step.name} · {step.passed ? '통과' : '실패'}</strong><p>{'expected' in step ? Object.entries(step.expected as Record<string, boolean>).map(([id, on]) => `${id}: ${step.result.energized[id] ? 'ON' : 'OFF'} (기대 ${on ? 'ON' : 'OFF'})`).join(' · ') : `MC ${step.result.energized.MC1 ? 'ON' : 'OFF'} / PL ${step.result.energized.PL1 ? 'ON' : 'OFF'} · 기대 ${step.on ? 'ON' : 'OFF'}`}</p>{step.issues.map((f, j) => <button className="ep-fault" key={j} onClick={() => setHighlighted(f.affected)}>{f.code} · {f.detail}<small>{f.affected.join(', ')}</small></button>)}</div>)}</div>
    </section>}
    {publicMode && <details className="ep-connection-list"><summary>어떻게 연결했나요? · 현재 결선표 {doc.wires.length}개</summary><p>행을 누르면 해당 전선을 선택합니다. A/B는 같은 극의 위/아래 나사이며 서로 내부 연결됩니다. TB5A/TB6A는 1–10, TB5B/TB6B는 11–20번 극입니다. 기기의 단자는 12P/8P 소켓에 인쇄된 번호입니다.</p><ol><li>전원: TB1 → TB5 → MCCB → EOCR 주회로 → MC1/MC2 → TB6 → TB2/TB3 출력.</li><li>수동: SS M → PB0 NC → PB1 NO와 T 순간 NO 병렬 → MC1. X NC를 통해 T에 전원이 들어오고 T 시간 접점이 MC2를 켭니다.</li><li>자동: SS A → FLS 전원·수위 전극 → X → MC1. 자동 운전 중 X NC가 타이머 회로를 차단합니다.</li><li>고장: EOCR NC가 운전을 끊고 NO가 FR에 전원을 공급합니다. FR의 NC/NO가 BZ와 YL을 교대 동작시킵니다.</li></ol><table><thead><tr><th>전선</th><th>시작 단자</th><th>끝 단자</th><th>피복 색</th></tr></thead><tbody>{doc.wires.map(w => <tr key={w.id}><td><button onClick={() => { setSelection({ type: 'wire', id: w.id }); setHighlighted([w.id, key(w.from), key(w.to)]); setWireView('selected'); document.querySelector('.ep-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{w.id} 보기</button></td><td>{key(w.from)}</td><td>{key(w.to)}</td><td>{colorLabels[w.color ?? 'yellow']}</td></tr>)}</tbody></table></details>}
    <p className="ep-disclaimer">비공식 학습 도구입니다. 자체 제작 과제이며 공인 시험의 채점과 동일하지 않습니다. 24V 기본 모델과 공개 1번의 3상 220V RMS 모델은 정적 저항 부하로 계산하며 AC 파형·접지·절연·열·실물 안전 판정은 지원하지 않습니다. 실제 장비 제작·전원 인가 판단을 대신하지 않습니다.</p>
  </section>;
}
