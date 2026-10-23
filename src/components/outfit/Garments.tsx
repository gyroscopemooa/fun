import { shade } from '@/components/lip-color/lipRenderer';

// Flat garment illustrations; each takes one fill colour and derives its own fold shading.
type GarmentProps = { color: string; className?: string };

const stroke = (color: string) => shade(color, -0.35);

export function Top({ color, className = '' }: GarmentProps) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      <path d="M38 8 Q60 22 82 8 L112 26 L100 50 L88 44 L88 104 Q60 110 32 104 L32 44 L20 50 L8 26 Z" fill={color} stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M44 9 Q60 26 76 9" fill="none" stroke={stroke(color)} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 70 Q60 76 80 70" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="3" />
    </svg>
  );
}

export function Outer({ color, className = '' }: GarmentProps) {
  return (
    <svg viewBox="0 0 120 130" className={className} aria-hidden="true">
      <path d="M36 6 L60 40 L84 6 L112 22 L104 120 L72 124 L60 60 L48 124 L16 120 L8 22 Z" fill={color} stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M36 6 L46 46 L60 40 M84 6 L74 46 L60 40" fill="none" stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="62" cy="78" r="2.6" fill={stroke(color)} />
      <circle cx="62" cy="94" r="2.6" fill={stroke(color)} />
      <path d="M22 84 L40 84" stroke={stroke(color)} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Pants({ color, className = '' }: GarmentProps) {
  return (
    <svg viewBox="0 0 100 130" className={className} aria-hidden="true">
      <path d="M18 6 L82 6 L90 124 L60 124 L50 44 L40 124 L10 124 Z" fill={color} stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 18 L82 18" stroke={stroke(color)} strokeWidth="2.5" />
      <path d="M30 26 L26 116 M70 26 L74 116" stroke="#000" strokeOpacity="0.08" strokeWidth="3" />
    </svg>
  );
}

export function Skirt({ color, className = '' }: GarmentProps) {
  return (
    <svg viewBox="0 0 110 110" className={className} aria-hidden="true">
      <path d="M28 8 L82 8 L104 100 Q55 110 6 100 Z" fill={color} stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M28 20 L82 20" stroke={stroke(color)} strokeWidth="2.5" />
      <path d="M42 24 L32 100 M55 24 L55 104 M68 24 L78 100" stroke="#000" strokeOpacity="0.08" strokeWidth="3" />
    </svg>
  );
}

export function Shoes({ color, className = '' }: GarmentProps) {
  return (
    <svg viewBox="0 0 120 50" className={className} aria-hidden="true">
      {[0, 60].map((x) => (
        <path key={x} d={`M${x + 6} 34 Q${x + 6} 16 ${x + 22} 14 L${x + 34} 14 Q${x + 40} 26 ${x + 54} 30 Q${x + 56} 40 ${x + 50} 42 L${x + 8} 42 Z`} fill={color} stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function Bag({ color, className = '' }: GarmentProps) {
  return (
    <svg viewBox="0 0 100 90" className={className} aria-hidden="true">
      <path d="M32 30 Q32 6 50 6 Q68 6 68 30" fill="none" stroke={stroke(color)} strokeWidth="5" strokeLinecap="round" />
      <path d="M12 30 L88 30 L80 84 L20 84 Z" fill={color} stroke={stroke(color)} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 42 L88 42" stroke="#000" strokeOpacity="0.1" strokeWidth="3" />
    </svg>
  );
}

export function Metal({ tone, className = '' }: { tone: 'gold' | 'silver' | 'rose'; className?: string }) {
  const stops = { gold: ['#FDE68A', '#D4A017', '#8C6A12'], silver: ['#F8FAFC', '#A8B0BA', '#5B6470'], rose: ['#FDE2E4', '#D99A86', '#8F5A4C'] }[tone];
  const id = `metal-${tone}`;
  return (
    <svg viewBox="0 0 100 60" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="20" fill="none" stroke={`url(#${id})`} strokeWidth="7" />
      <circle cx="72" cy="30" r="13" fill="none" stroke={`url(#${id})`} strokeWidth="6" />
    </svg>
  );
}
