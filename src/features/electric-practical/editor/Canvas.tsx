import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { key, wireColors, type CircuitDocument, type Point, type SimulationResult, type TerminalRef, type WireColor } from '../model/schema.ts';
import { ref } from '../model/fixtures.ts';
import { snap } from './history.ts';
import { dimensions, terminalOffset, orthogonalPoints, pathData, wirePoints, automaticCorners, socketKind, terminalBlock } from './geometry.ts';

export type Selection = { type: 'wire' | 'component'; id: string } | null;
export const labels: Record<string, string> = { SUPPLY: '24V 가상 전원', FUSE: '퓨즈 / 보호 차단', PUSH_NO: '누름 버튼 · NO', PUSH_NC: '정지 버튼 · NC', COIL: '24V 극성 코일', AUX_NO: '보조접점 · NO', AUX_NC: '보조접점 · NC', LAMP: '표시등', JUNCTION: '분기 접속점', TERMINAL_BLOCK: '단자대 · 독립 10극', TERMINAL4: '단자대 · 독립 4극', THREE_PHASE: '3상 220V 가상 전원', MC12: '전자접촉기 · 12P', EOCR12: '과전류 계전기 · 12P', RELAY8: '릴레이 · 8P', TIMER8: '타이머 · 8P', FLICKER8: '플리커 · 8P', FLS8: '플로트레스 · 8P', BREAKER3: '3극 배선용 차단기', FUSE2: '2극 퓨즈 · 10A', SELECTOR: '수동 M / 자동 A', BUTTON4: '푸시버튼 · 1a1b', BUZZER: '부저', WATER_SENSOR: '수위 전극 · 외부 입력' };
export const colorLabels: Record<WireColor, string> = { yellow: '황색', brown: '갈색', black: '흑색', gray: '회색', blue: '청색', greenYellow: '녹색·황색' };
type Props = { doc: CircuitDocument; simulation: SimulationResult; readonly: boolean; selection: Selection; onSelect: (s: Selection) => void; onConnect: (a: TerminalRef, b: TerminalRef, points: Point[]) => void; onMove: (id: string, p: Point) => void; onDelete: () => void; zoom: number; highlighted: string[]; wireColor: WireColor; wiring: boolean; wireView: 'all' | 'yellow' | 'power' | 'selected'; onRoute: (id: string, points: Point[]) => void };
export default function Canvas({ doc, simulation, readonly, selection, onSelect, onConnect, onMove, onDelete, zoom, highlighted, wireColor, wiring, wireView, onRoute }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [pending, setPending] = useState<TerminalRef | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [preview, setPreview] = useState<{ id: string; point: Point } | null>(null);
  const drag = useRef<{ id: string; origin: Point; start: Point } | null>(null);
  const routeDrag = useRef<{ id: string; index: number; points: Point[] } | null>(null);
  const [routePreview, setRoutePreview] = useState<{ id: string; points: Point[] } | null>(null);
  const pendingRef = useRef<TerminalRef | null>(null), cornersRef = useRef<Point[]>([]);
  const pos = (id: string): Point => preview?.id === id ? preview.point : doc.ui?.positions?.[id] ?? { x: 60 + doc.components.findIndex(c => c.id === id) % 4 * 220, y: 80 + Math.floor(doc.components.findIndex(c => c.id === id) / 4) * 180 };
  const terminal = (r: TerminalRef): Point => {
    const c = doc.components.find(c => c.id === r.componentId), p = pos(r.componentId);
    const offset = c ? terminalOffset(c, r.terminalId) : { x: 0, y: 0 };
    return { x: p.x + offset.x, y: p.y + offset.y };
  };
  const point = (e: { clientX: number; clientY: number }): Point => {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix); return { x: p.x, y: p.y };
  };
  const snapped = (p: Point): Point => ({ x: snap(p.x), y: snap(p.y) });
  const cancel = () => { pendingRef.current = null; cornersRef.current = []; setPending(null); setCorners([]); setCursor(null); drag.current = null; setPreview(null); routeDrag.current = null; setRoutePreview(null); };
  useEffect(() => { cancel(); }, [doc, readonly, wiring]);
  const addCorner = (p: Point) => {
    if (!pendingRef.current || readonly || cornersRef.current.length >= 64) return;
    const next = snapped(p), last = cornersRef.current.at(-1);
    if (last?.x === next.x && last.y === next.y) return;
    cornersRef.current = [...cornersRef.current, next]; setCorners(cornersRef.current); setCursor(next);
  };
  const choose = (r: TerminalRef) => {
    if (readonly) return;
    if (!wiring) { onSelect({ type: 'component', id: r.componentId }); return; }
    if (pendingRef.current && key(pendingRef.current) !== key(r)) { onConnect(pendingRef.current, r, cornersRef.current); cancel(); }
    else { onSelect(null); pendingRef.current = r; setPending(r); setCursor(terminal(r)); }
  };
  const pointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (routeDrag.current) { const d = routeDrag.current; onRoute(d.id, d.points); routeDrag.current = null; setRoutePreview(null); return; }
    if (drag.current) { if (preview) onMove(preview.id, preview.point); drag.current = null; setPreview(null); return; }
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-terminal]')?.getAttribute('data-terminal');
    if (target && pendingRef.current && key(pendingRef.current) !== target) { onConnect(pendingRef.current, ref(target), cornersRef.current); cancel(); }
  };
  const keyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') { cancel(); onSelect(null); }
    if (readonly) return;
    if (e.key === 'Backspace' && pendingRef.current) { e.preventDefault(); cornersRef.current = cornersRef.current.slice(0, -1); setCorners(cornersRef.current); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) { e.preventDefault(); onDelete(); }
    if (selection?.type === 'component' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); const p = pos(selection.id); onMove(selection.id, { x: snap(p.x + (e.key === 'ArrowLeft' ? -20 : e.key === 'ArrowRight' ? 20 : 0)), y: snap(p.y + (e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0)) });
    }
  };
  const width = Math.max(1000, ...doc.components.map(c => pos(c.id).x + dimensions(c).width + 40), ...doc.wires.flatMap(w => (w.waypoints ?? []).map(p => p.x + 40)));
  const height = Math.max(660, ...doc.components.map(c => pos(c.id).y + 140), ...doc.wires.flatMap(w => (w.waypoints ?? []).map(p => p.y + 40)));
  const connectedCounts = new Map<string, number>();
  doc.wires.forEach(w => [w.from, w.to].forEach(r => connectedCounts.set(key(r), (connectedCounts.get(key(r)) ?? 0) + 1)));
  const hint = pending ? `${key(pending)} → 빈 곳을 클릭하면 꺾임점 (${corners.length}/64) · 끝 단자 클릭: 완성 · Backspace: 한 점 취소 · Esc: 전체 취소` : readonly ? '실행 중에는 편집이 잠깁니다. 일시정지 후 단자를 클릭하세요.' : '① 시작 단자 클릭 → ② 빈 곳을 클릭하며 꺾기 → ③ 끝 단자 클릭. 선을 따로 만들 필요가 없습니다.';
  return <><div className="ep-wiring-guide" aria-live="polite" data-testid="wiring-guide">{hint}{pending && <button onClick={cancel}>배선 취소</button>}</div><div className="ep-board-scroll" data-testid="board-scroll">
    <svg ref={svg} className="ep-board" data-testid="wiring-canvas" aria-label="단자 결선 작업판" role="group" tabIndex={0} width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`} onKeyDown={keyDown}
      onPointerMove={e => {
        if (readonly) return; const p = point(e);
        if (routeDrag.current) { const d = routeDrag.current; d.points = d.points.map((v, i) => i === d.index ? snapped(p) : v); setRoutePreview({ id: d.id, points: d.points }); }
        else if (drag.current) setPreview({ id: drag.current.id, point: { x: snap(drag.current.origin.x + p.x - drag.current.start.x), y: snap(drag.current.origin.y + p.y - drag.current.start.y) } });
        else if (pendingRef.current) setCursor(snapped(p));
      }} onPointerUp={pointerUp} onPointerCancel={cancel}>
      <defs><pattern id="ep-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#aab9c9" /></pattern></defs>
      <rect data-testid="board-background" width={width} height={height} fill="url(#ep-grid)" onPointerDown={e => { if (pendingRef.current) { e.preventDefault(); svg.current?.focus({ preventScroll: true }); addCorner(point(e)); } else onSelect(null); }} />
      {doc.components.map(c => {
        const p = pos(c.id), selected = selection?.type === 'component' && selection.id === c.id, size = dimensions(c), block = terminalBlock(c), socket = socketKind(c), large = dimensions(c).height > 108;
        const active = !!simulation.energized[c.id], closed = simulation.contactsClosed[c.id];
        const status = c.kind === 'MC12' || c.kind === 'RELAY8' ? active ? '● 여자' : '○ 소자' : c.kind === 'TIMER8' ? `${((simulation.timers?.[c.id] ?? 0) / 1000).toFixed(1)} / ${(c.params?.delayMs ?? 3000) / 1000}s · ${closed ? '시간 접점 ON' : '대기'}` : c.kind === 'FLICKER8' ? active ? closed ? 'YL 접점 ON' : 'BZ 접점 ON' : '정지' : c.kind === 'EOCR12' ? simulation.eocrTrip ? '트립 · 95–98 닫힘' : '정상 · 95–96 닫힘' : c.kind === 'FLS8' ? closed ? '수위 감지 ON' : '수위 감지 OFF' : c.kind === 'SELECTOR' ? simulation.contactsClosed[`${c.id}:A1-A2`] ? '자동 A' : '수동 M' : c.kind === 'BUTTON4' ? simulation.contactsClosed[`${c.id}:13-14`] ? '누름 · NO 닫힘 / NC 열림' : '해제 · NO 열림 / NC 닫힘' : c.kind === 'BUZZER' ? active ? '● 동작' : '○ 정지' : c.kind === 'THREE_PHASE' ? simulation.powerOn ? 'L1/L2/L3 · 선간 220V' : '전원 OFF' : c.kind === 'COIL' ? active ? '● 여자' : '○ 소자' : c.kind === 'LAMP' ? active ? '● 점등' : '○ 소등' : c.kind === 'SUPPLY' ? simulation.powerOn && !simulation.sourceTripped ? 'L +24V / N 0V' : '전원 OFF' : c.kind === 'JUNCTION' ? '● 전기적 접속' : simulation.tripped.includes(c.id) ? '⚠ 차단됨' : closed ? '닫힘 ━' : '열림 ┄';
        const error = highlighted.some(x => x === c.id || x.startsWith(`${c.id}:`));
        const title = /^TB[56][AB]$/.test(c.id) ? `${c.id.slice(0, 3)} · ${c.id.endsWith('A') ? '1–10' : '11–20'} (${c.id})` : c.id;
        return <g key={c.id} transform={`translate(${p.x},${p.y})`} className={active ? 'ep-component-active' : ''}>
          <rect width={size.width} height={size.height} rx="9" fill={block ? '#e2e8f0' : active ? '#dcfce7' : '#fff'} stroke={selected ? '#7c3aed' : error ? '#dc2626' : '#94a3b8'} strokeWidth={selected || error ? 3 : 1.5} />
          <g data-header={c.id} onKeyDown={e => { if (e.key === 'Enter') onSelect({ type: 'component', id: c.id }); }} onPointerDown={e => {
            e.stopPropagation(); if (pendingRef.current) return; onSelect({ type: 'component', id: c.id }); if (readonly) return;
            drag.current = { id: c.id, origin: p, start: point(e) }; svg.current?.setPointerCapture(e.pointerId);
          }}>
            <rect width={size.width} height={block ? 24 : 38} rx="7" fill={selected ? '#ede9fe' : '#eaf0f6'} />
            <text x="10" y="16" fontSize="13" fontWeight="700">{title}</text>{!block && <text x="10" y="31" fontSize="11">{labels[c.kind]}</text>}
            {block && <text x={size.width - 12} y="16" textAnchor="end" fontSize="10">같은 번호 A↕B만 연결 · 옆 극은 절연</text>}
          </g>
          {socket && <g pointerEvents="none"><circle cx={size.width / 2} cy="86" r="24" fill="#e2e8f0" stroke="#64748b" /><circle cx={size.width / 2} cy="86" r="12" fill={active ? '#86efac' : '#94a3b8'} /><path d={`M${size.width / 2 - 4},107 v8 h8 v-8`} fill="#475569" /></g>}
          {block ? Array.from({ length: c.terminals.length / 2 }, (_, i) => <g key={i}>
            <rect x={13 + i * 42} y="26" width="36" height="78" rx="3" fill="#475569" stroke="#334155" />
            <path d={`M${31 + i * 42},38 V94`} stroke="#c4a66a" strokeWidth="5" />
            <rect x={14 + i * 42} y="54" width="34" height="22" fill="#fff" />
            <text x={31 + i * 42} y="70" textAnchor="middle" fontSize="13" fontWeight="700">{i + 1 + (/^TB[56]B$/.test(c.id) ? 10 : 0)}</text>
          </g>) : <>
            {c.kind === 'LAMP' && <circle data-testid={`lamp-bulb-${c.id}`} data-on={active} cx="80" cy="57" r="17" fill={active ? c.id === 'RL' ? '#ef4444' : c.id === 'GL' ? '#22c55e' : '#facc15' : '#cbd5e1'} stroke={active ? '#854d0e' : '#64748b'} strokeWidth="3" />}
            {c.kind === 'COIL' && <path d="M48,50 h10 v16 h12 V50 h12 v16 h12 V50 h18" stroke={active ? '#047857' : '#94a3b8'} strokeWidth="4" fill="none" />}
            {(c.kind.startsWith('AUX') || c.kind.startsWith('PUSH')) && <g stroke={closed ? '#047857' : '#64748b'} strokeWidth="3" fill="none"><path d={`M45,58 H65 M95,58 H115 M65,58 L95,${closed ? 58 : 43}`} /><circle cx="65" cy="58" r="3" /><circle cx="95" cy="58" r="3" /></g>}
            <text x={size.width / 2} y={large ? 131 : 86} textAnchor="middle" fontSize={large ? 10 : 12} fontWeight="700" data-testid={`node-status-${c.id}`}>{status}</text>
            <text x={size.width / 2} y={large ? 97 : 101} textAnchor="middle" fontSize="10">{socket ? '' : c.linkId ? `연동: ${c.linkId}` : c.params?.ratingAmps ? `${c.params.ratingAmps} A` : c.params?.resistance ? `${c.params.resistance} Ω` : ''}</text>
          </>}
        </g>;
      })}
      {/* Wires remain visible above the panel bodies; the last terminal layer stays clickable. */}
      {doc.wires.map(w => {
        const a = terminal(w.from), b = terminal(w.to), points = routePreview?.id === w.id ? routePreview.points : w.waypoints;
        const route = points?.length || w.bend !== undefined ? points : automaticCorners(a, b, doc.components.find(c => c.id === w.from.componentId)!, doc.components.find(c => c.id === w.to.componentId)!, w.from.terminalId, w.to.terminalId);
        const d = pathData(wirePoints({ ...w, waypoints: route }, a, b));
        const selected = selection?.type === 'wire' && selection.id === w.id, error = highlighted.includes(w.id), active = simulation.activeWireIds.includes(w.id);
        const emphasized = selected || highlighted.includes(w.id) || (selection?.type === 'component' && [w.from.componentId, w.to.componentId].includes(selection.id));
        const faded = wireView === 'selected' ? !!selection && !emphasized : wireView === 'yellow' ? (w.color ?? 'yellow') !== 'yellow' : wireView === 'power' ? !['brown', 'black', 'gray', 'greenYellow'].includes(w.color ?? 'yellow') : false;
        return <g opacity={faded ? 0.1 : 1} key={w.id} data-testid={`wire-${w.id}`} data-color={w.color ?? 'yellow'} data-active={active} role="button" tabIndex={0} aria-label={`전선 ${w.id} ${key(w.from)} ↔ ${key(w.to)}${active ? ' 통전 경로' : ''}`} onPointerDown={e => { e.stopPropagation(); if (pendingRef.current) addCorner(point(e)); else onSelect({ type: 'wire', id: w.id }); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ type: 'wire', id: w.id }); } }}>
          <path d={d} stroke="transparent" strokeWidth="16" fill="none" />
          <path d={d} stroke={selected ? '#c4b5fd' : error ? '#fca5a5' : active ? '#6ee7b7' : '#ffffff'} strokeWidth={selected || error || active ? 9 : 6} fill="none" pointerEvents="none" />
          <path data-testid={`wire-path-${w.id}`} d={d} stroke={wireColors[w.color ?? 'yellow']} strokeWidth="3" strokeLinejoin="round" fill="none" pointerEvents="none" />
          {w.color === 'greenYellow' && <path d={d} stroke="#facc15" strokeWidth="1.5" strokeDasharray="7 7" fill="none" pointerEvents="none" />}
          {error && <path d={d} stroke="#dc2626" strokeWidth="2" strokeDasharray="5 7" fill="none" pointerEvents="none" />}
          {selected && !readonly && w.route !== 'straight' && points?.map((p, i) => <rect key={i} data-testid={`bend-${w.id}-${i}`} x={p.x - 6} y={p.y - 6} width="12" height="12" fill="white" stroke="#7c3aed" strokeWidth="2" role="button" tabIndex={0} aria-label={`${w.id} 꺾임점 ${i + 1} 이동`} onPointerDown={e => { e.stopPropagation(); routeDrag.current = { id: w.id, index: i, points: [...points] }; svg.current?.setPointerCapture(e.pointerId); }} onKeyDown={e => {
            const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key];
            if (delta) { e.stopPropagation(); e.preventDefault(); onRoute(w.id, points.map((v, j) => j === i ? snapped({ x: v.x + delta[0], y: v.y + delta[1] }) : v)); }
          }} />)}
        </g>;
      })}
      {pending && cursor && <g pointerEvents="none"><path data-testid="wire-preview" d={pathData(orthogonalPoints([terminal(pending), ...corners, cursor]))} fill="none" stroke={wireColors[wireColor]} strokeWidth="4" strokeDasharray="7 4" />{corners.map((p, i) => <rect key={i} x={p.x - 4} y={p.y - 4} width="8" height="8" fill="#7c3aed" />)}</g>}
      {doc.components.map(c => { const p = pos(c.id); return <g key={`drag-${c.id}`} transform={`translate(${p.x},${p.y})`}><rect data-testid={`node-${c.id}`} role="button" tabIndex={0} aria-label={`부품 ${c.id} 선택 및 이동`} onKeyDown={e => { if (e.key === 'Enter') onSelect({ type: 'component', id: c.id }); }} width={dimensions(c).width} height={terminalBlock(c) ? 24 : 38} fill="transparent" onPointerDown={e => {
        e.stopPropagation(); if (pendingRef.current) return; onSelect({ type: 'component', id: c.id }); if (readonly) return;
        drag.current = { id: c.id, origin: p, start: point(e) }; svg.current?.setPointerCapture(e.pointerId);
      }} /></g>; })}
      {doc.components.flatMap(c => c.terminals.map((t, i) => {
        const r = { componentId: c.id, terminalId: t }, p = terminal(r), count = connectedCounts.get(key(r)) ?? 0, block = terminalBlock(c), large = dimensions(c).height > 108;
        return <g key={key(r)}>
          {!block && <text x={large ? p.x : p.x + (c.kind === 'JUNCTION' ? 15 : i === 0 ? 14 : -14)} y={p.y + (large && terminalOffset(c, t).y > dimensions(c).height / 2 ? 15 : -12)} textAnchor={large ? 'middle' : i === 1 ? 'end' : 'start'} fontSize="12" fontWeight="700" pointerEvents="none">{t}</text>}
          <circle cx={p.x} cy={p.y} r={block ? 11 : 10} fill={pending && key(pending) === key(r) ? '#7c3aed' : block ? '#f1f5f9' : count ? '#334155' : '#fff'} stroke={count ? '#0f766e' : '#334155'} strokeWidth="2" data-terminal={key(r)} data-testid={`terminal-${c.id}-${t}`} role="button" tabIndex={readonly ? -1 : 0} aria-label={`${c.id} 단자 ${t}, 연결 ${count}개`} onPointerDown={e => { e.stopPropagation(); choose(r); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); choose(r); } }}><title>{`${c.id}:${t} · ${count}개 연결${block ? ' · 같은 번호 A–B는 내부 연결' : ''}`}</title></circle>
          {block && <path d={`M${p.x - 5},${p.y - 5} l10,10 M${p.x - 5},${p.y + 5} l10,-10`} stroke="#475569" strokeWidth="1.5" pointerEvents="none" />}
          {count > 1 && !block && <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fill="white" pointerEvents="none">{count}</text>}
          {block && count > 0 && <circle cx={p.x + 9} cy={p.y - 9} r="3" fill="#047857" pointerEvents="none" />}
        </g>;
      }))}
    </svg>
    <p className="ep-board-hint">전선 색 = 선택한 피복 색 · 초록 테두리 = 계산된 통전 경로 · 교차한 선은 연결되지 않음 · 단자대 A/B = 같은 극의 위/아래 나사</p>
  </div></>;
}
