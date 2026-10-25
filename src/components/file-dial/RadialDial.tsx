import type { DialAction, DialMode } from '@/lib/file-dial/actions';

export const DIAL_COLORS: Record<DialMode, { fill: string; ring: string; text: string }> = {
  convert: { fill: '#4f46e5', ring: '#e0e7ff', text: '#312e81' },
  tools: { fill: '#0d9488', ring: '#ccfbf1', text: '#134e4a' }
};

const INNER = 0.36;
const OUTER = 0.96;
const GAP_DEG = 2.2;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

const petalPath = (cx: number, cy: number, r1: number, r2: number, start: number, end: number): string => {
  if (end - start >= 359.9) {
    // Single action: a full ring drawn as two halves.
    return `${petalPath(cx, cy, r1, r2, 0, 180)} ${petalPath(cx, cy, r1, r2, 180, 360)}`;
  }
  const large = end - start > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r2, start);
  const [x2, y2] = polar(cx, cy, r2, end);
  const [x3, y3] = polar(cx, cy, r1, end);
  const [x4, y4] = polar(cx, cy, r1, start);
  return `M${x1},${y1} A${r2},${r2} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 ${large} 0 ${x4},${y4} Z`;
};

/** Which petal a point falls on, relative to the wheel centre. null = centre (cancel) or outside. */
export const petalAt = (count: number, dx: number, dy: number, radius: number) => {
  const dist = Math.hypot(dx, dy);
  if (count === 0 || dist < radius * INNER || dist > radius * 1.9) return null;
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  const span = 360 / count;
  return Math.floor(((deg + span / 2) % 360) / span);
};

type Props = {
  actions: DialAction[];
  mode: DialMode;
  size: number;
  highlighted: number | null;
  centerTitle: string;
  centerSub?: string;
  onHover?: (index: number | null) => void;
  onSelect?: (index: number) => void;
  interactive?: boolean;
};

export function RadialDial({ actions, mode, size, highlighted, centerTitle, centerSub, onHover, onSelect, interactive = false }: Props) {
  const c = size / 2;
  const r1 = c * INNER;
  const r2 = c * OUTER;
  const span = 360 / Math.max(actions.length, 1);
  const colors = DIAL_COLORS[mode];
  const labelSize = Math.max(10, Math.round(size / 26));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none drop-shadow-xl" role={interactive ? 'group' : 'img'} aria-label={`${mode === 'convert' ? '포맷 변환' : '파일 도구'} 다이얼`}>
      <circle cx={c} cy={c} r={c - 1} fill="#f8fafc" stroke="#e2e8f0" />
      {actions.map((action, i) => {
        const start = i * span - span / 2 + (actions.length > 1 ? GAP_DEG / 2 : 0);
        const end = (i + 1) * span - span / 2 - (actions.length > 1 ? GAP_DEG / 2 : 0);
        const on = highlighted === i;
        const [lx, ly] = polar(c, c, (r1 + r2) / 2, i * span);
        const words = action.label.split(' ');
        return (
          <g
            key={action.id}
            onPointerEnter={interactive ? () => onHover?.(i) : undefined}
            onPointerLeave={interactive ? () => onHover?.(null) : undefined}
            onClick={interactive ? () => onSelect?.(i) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(i); } } : undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'button' : undefined}
            aria-label={interactive ? action.hint : undefined}
            className={interactive ? 'cursor-pointer outline-none' : undefined}
            style={{ transition: 'transform 120ms ease', transformOrigin: `${c}px ${c}px`, transform: on ? 'scale(1.035)' : undefined }}
          >
            <path d={petalPath(c, c, r1, r2, start, end)} fill={on ? colors.fill : '#ffffff'} stroke={on ? colors.fill : '#e2e8f0'} strokeWidth={1.2} />
            <text x={lx} y={ly - ((words.length - 1) * labelSize) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize} fontWeight={800} fill={on ? '#ffffff' : '#334155'}>
              {words.map((word, w) => (
                <tspan key={word} x={lx} dy={w === 0 ? 0 : labelSize * 1.1}>{word}</tspan>
              ))}
            </text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={r1 - 6} fill="#ffffff" stroke={colors.ring} strokeWidth={4} />
      <text x={c} y={centerSub ? c - labelSize * 0.45 : c} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize * 1.2} fontWeight={900} fill={colors.text}>{centerTitle}</text>
      {centerSub ? <text x={c} y={c + labelSize * 0.95} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize * 0.85} fontWeight={600} fill="#94a3b8">{centerSub}</text> : null}
    </svg>
  );
}

export default RadialDial;
