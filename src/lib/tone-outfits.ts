import type { Swatch, ToneInfo } from './personal-color-tones';

export type LookSlot = 'outer' | 'top' | 'bottom' | 'shoes' | 'bag';
export type Look = {
  id: 'daily' | 'office' | 'date';
  title: string;
  emoji: string;
  bottomType: 'pants' | 'skirt';
  items: Record<LookSlot, Swatch>;
  tip: string;
};

const NEUTRALS: Record<ToneInfo['season'], Swatch[]> = {
  '봄 웜': [{ name: '아이보리', hex: '#FFF6E5' }, { name: '웜 베이지', hex: '#E3CBA8' }, { name: '카멜', hex: '#C68E4E' }],
  '여름 쿨': [{ name: '소프트 화이트', hex: '#F7F7F5' }, { name: '라이트 그레이', hex: '#D9DCE1' }, { name: '소프트 네이비', hex: '#3C4F7A' }],
  '가을 웜': [{ name: '웜 베이지', hex: '#E3CBA8' }, { name: '카키', hex: '#8D8A5C' }, { name: '초콜릿', hex: '#5A3825' }],
  '겨울 쿨': [{ name: '퓨어 화이트', hex: '#FFFFFF' }, { name: '차콜', hex: '#36373B' }, { name: '블랙', hex: '#111111' }]
};

export const METAL_BY_SEASON: Record<ToneInfo['season'], { tone: 'gold' | 'silver' | 'rose'; label: string }> = {
  '봄 웜': { tone: 'gold', label: '라이트 골드' },
  '여름 쿨': { tone: 'silver', label: '실버 · 로즈골드' },
  '가을 웜': { tone: 'gold', label: '앤틱 골드 · 브론즈' },
  '겨울 쿨': { tone: 'silver', label: '실버 · 플래티넘' }
};

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255);
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const sat = (hex: string) => {
  const c = rgb(hex);
  return Math.max(...c) - Math.min(...c);
};

// Deterministic pick so the same shuffle number always gives the same board.
const pick = <T,>(list: T[], seed: number, offset = 0) => list[(seed + offset) % list.length];

export const buildLooks = (tone: ToneInfo, seed: number): Look[] => {
  const palette = [...tone.best];
  const byLight = [...palette].sort((a, b) => lum(b.hex) - lum(a.hex));
  const bySat = [...palette].sort((a, b) => sat(b.hex) - sat(a.hex));
  const neutrals = NEUTRALS[tone.season];
  const light = byLight.slice(0, 3);
  const deep = byLight.slice(-3);
  const vivid = bySat.slice(0, 3);
  const all = [...palette, ...neutrals];

  return [
    {
      id: 'daily',
      title: '데일리 룩',
      emoji: '☕',
      bottomType: seed % 2 ? 'skirt' : 'pants',
      items: {
        outer: pick(neutrals, seed, 1),
        top: pick(light, seed),
        bottom: pick(deep, seed, 1),
        shoes: pick(neutrals, seed),
        bag: pick(vivid, seed, 2)
      },
      tip: '밝은 상의로 얼굴 주변을 환하게, 하의는 한 톤 깊게 잡아 안정감을 줘요.'
    },
    {
      id: 'office',
      title: '오피스 룩',
      emoji: '💼',
      bottomType: 'pants',
      items: {
        outer: pick(deep, seed),
        top: pick(neutrals, seed, 0),
        bottom: pick([...deep, neutrals[2]], seed, 2),
        shoes: pick(deep, seed, 2),
        bag: pick(neutrals, seed, 2)
      },
      tip: '깊은 톤 아우터에 뉴트럴 이너를 받치면 차분하면서도 얼굴이 묻히지 않아요.'
    },
    {
      id: 'date',
      title: '데이트 룩',
      emoji: '💗',
      bottomType: seed % 2 ? 'pants' : 'skirt',
      items: {
        outer: pick(light, seed, 2),
        top: pick(vivid, seed),
        bottom: pick(light, seed, 1),
        shoes: pick(all, seed, 3),
        bag: pick(vivid, seed, 1)
      },
      tip: '가장 선명한 베스트 컬러를 상의 포인트로 써서 혈색과 생기를 살려요.'
    }
  ];
};
