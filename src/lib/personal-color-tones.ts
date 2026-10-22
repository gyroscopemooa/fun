// 12-tone personal color reference data. Tone ids/labels must stay in sync with
// node-api/src/commerce/personalColorAnalyzer.js.

export type Swatch = { name: string; hex: string; note?: string };

export type ToneId =
  | 'spring-light' | 'spring-true' | 'spring-bright'
  | 'summer-light' | 'summer-true' | 'summer-mute'
  | 'autumn-mute' | 'autumn-true' | 'autumn-deep'
  | 'winter-true' | 'winter-bright' | 'winter-deep';

export type ToneInfo = {
  id: ToneId;
  season: '봄 웜' | '여름 쿨' | '가을 웜' | '겨울 쿨';
  sub: '라이트' | '트루' | '브라이트' | '뮤트' | '딥';
  label: string;
  english: string;
  tagline: string;
  best: Swatch[];
  avoid: Swatch[];
  lip: Swatch;
  blush: Swatch;
  eye: Swatch;
  hair: Swatch[];
};

const s = (name: string, hex: string, note?: string): Swatch => ({ name, hex, note });

const tone = (info: Omit<ToneInfo, 'label'>): ToneInfo => ({ ...info, label: `${info.season} ${info.sub}` });

export const TONES: ToneInfo[] = [
  tone({
    id: 'spring-light', season: '봄 웜', sub: '라이트', english: 'Light Spring',
    tagline: '맑고 가벼운 웜 파스텔이 얼굴을 환하게 띄우는 타입',
    best: [s('피치', '#FFC8A8'), s('라이트 코랄', '#F9A290'), s('버터 옐로', '#FBE7A1'), s('민트 그린', '#B5E3C6'), s('아쿠아', '#9ED8E0'), s('라이트 카멜', '#D9B48F'), s('아이보리', '#FFF6E5'), s('살구 핑크', '#F7B5A5')],
    avoid: [s('블랙', '#111111'), s('버건디', '#6D1A36'), s('차콜', '#36373B'), s('다크 네이비', '#1B2240')],
    lip: s('코랄 핑크', '#F28B82'), blush: s('피치', '#F8B195'), eye: s('라이트 브라운', '#C9A27E'),
    hair: [s('밀크 브라운', '#A47551'), s('골드 베이지', '#C79A6B')]
  }),
  tone({
    id: 'spring-true', season: '봄 웜', sub: '트루', english: 'True Spring',
    tagline: '노란 기 도는 생기와 따뜻한 채도가 가장 잘 사는 타입',
    best: [s('코랄', '#FF7F61'), s('웜 레드', '#E8503A'), s('골든 옐로', '#F6C142'), s('애플 그린', '#8CC63F'), s('터콰이즈', '#2EC4B6'), s('카멜', '#C68E4E'), s('크림', '#FFF1D0'), s('살몬', '#FA8072')],
    avoid: [s('쿨 그레이', '#9AA0A8'), s('푸시아', '#C2185B'), s('블랙', '#111111'), s('버건디', '#6D1A36')],
    lip: s('웜 코랄 레드', '#F2674F'), blush: s('살구 코랄', '#F7926F'), eye: s('골드 브라운', '#B07B4F'),
    hair: [s('골드 브라운', '#9C6B3E'), s('오렌지 브라운', '#A9592E')]
  }),
  tone({
    id: 'spring-bright', season: '봄 웜', sub: '브라이트', english: 'Bright Spring',
    tagline: '쨍하고 선명한 웜 컬러에서 이목구비가 또렷해지는 타입',
    best: [s('비비드 코랄', '#FF5E4D'), s('망고', '#FFA62B'), s('레몬', '#FFE14D'), s('클리어 그린', '#2FBF71'), s('브라이트 아쿠아', '#00B8C8'), s('핫 피치', '#FF8A65'), s('웜 화이트', '#FFFAF0'), s('클리어 블루', '#2D8CF0')],
    avoid: [s('더스티 로즈', '#C49A9A'), s('카키 그레이', '#8A8A70'), s('다크 브라운', '#4A3226'), s('쿨 그레이', '#9AA0A8')],
    lip: s('비비드 코랄', '#FF5A4E'), blush: s('클리어 피치', '#FF8A73'), eye: s('브라운', '#A0603A'),
    hair: [s('브라이트 브라운', '#8E5A34'), s('골드 오렌지', '#B8692D')]
  }),
  tone({
    id: 'summer-light', season: '여름 쿨', sub: '라이트', english: 'Light Summer',
    tagline: '희고 맑은 쿨 파스텔이 피부를 투명하게 보이게 하는 타입',
    best: [s('베이비 핑크', '#F7C6D3'), s('라벤더', '#CDB8E6'), s('파우더 블루', '#B8D4EE'), s('민트', '#BFE6DA'), s('라이트 그레이', '#D9DCE1'), s('소프트 화이트', '#F7F7F5'), s('라일락', '#D7B9DA'), s('스카이 블루', '#A8C8E8')],
    avoid: [s('오렌지', '#F57C00'), s('머스타드', '#C9A227'), s('블랙', '#111111'), s('카키', '#6B6B3A')],
    lip: s('로즈 핑크', '#EE9AB0'), blush: s('베이비 핑크', '#F4B6C6'), eye: s('모브 그레이', '#A18A96'),
    hair: [s('애쉬 브라운', '#7D6A5E'), s('라이트 애쉬', '#9C8C82')]
  }),
  tone({
    id: 'summer-true', season: '여름 쿨', sub: '트루', english: 'True Summer',
    tagline: '푸른 기 도는 로즈와 블루 계열이 혈색을 살리는 타입',
    best: [s('로즈 핑크', '#E08AA6'), s('라즈베리', '#B9456A'), s('스카이 블루', '#7FB2E0'), s('페리윙클', '#8C9DE0'), s('쿨 민트', '#8FD3C3'), s('블루 그레이', '#8A9BB0'), s('라벤더', '#B59FD8'), s('소프트 네이비', '#3C4F7A')],
    avoid: [s('오렌지', '#F57C00'), s('골드', '#D4A017'), s('카멜', '#C68E4E'), s('올리브', '#6B6B2A')],
    lip: s('쿨 로즈', '#D0607F'), blush: s('로즈 핑크', '#E99AB1'), eye: s('모브 브라운', '#8C7A8E'),
    hair: [s('애쉬 브라운', '#6E5A4E'), s('쿨 다크 브라운', '#4A3B35')]
  }),
  tone({
    id: 'summer-mute', season: '여름 쿨', sub: '뮤트', english: 'Soft Summer',
    tagline: '회색 기가 섞인 부드러운 쿨 컬러에서 분위기가 사는 타입',
    best: [s('더스티 로즈', '#C9969B'), s('모브', '#B391A4'), s('그레이시 블루', '#8FA3B8'), s('세이지', '#A7B8A8'), s('로즈 베이지', '#D6B8AE'), s('라벤더 그레이', '#B4ADC4'), s('소프트 네이비', '#4F5D7A'), s('쿨 그레이지', '#B9B3AD')],
    avoid: [s('비비드 오렌지', '#FF6D00'), s('레몬', '#FFE14D'), s('블랙', '#111111'), s('코발트', '#0047AB')],
    lip: s('MLBB 로즈', '#C07A87'), blush: s('더스티 핑크', '#D9A3A8'), eye: s('그레이시 브라운', '#8E7B7A'),
    hair: [s('애쉬 브라운', '#6F5F56'), s('모카 애쉬', '#7D6A61')]
  }),
  tone({
    id: 'autumn-mute', season: '가을 웜', sub: '뮤트', english: 'Soft Autumn',
    tagline: '차분하고 톤 다운된 웜 뉴트럴이 고급스럽게 받는 타입',
    best: [s('카키 베이지', '#B8A98A'), s('소프트 올리브', '#8D8A5C'), s('테라코타 로즈', '#C07A65'), s('모카', '#9C7A63'), s('웜 그레이지', '#B5A898'), s('더스티 피치', '#D9A68A'), s('소프트 머스타드', '#C2A25A'), s('틸 그레이', '#6E8A86')],
    avoid: [s('비비드 핑크', '#FF3EA5'), s('아이시 블루', '#CFE8FF'), s('블랙', '#111111'), s('퓨어 화이트', '#FFFFFF')],
    lip: s('말린 장미 코랄', '#B96A5A'), blush: s('누드 피치', '#D49A80'), eye: s('카키 브라운', '#8B6A50'),
    hair: [s('모카 브라운', '#6B4E3A'), s('소프트 카키 브라운', '#7A6347')]
  }),
  tone({
    id: 'autumn-true', season: '가을 웜', sub: '트루', english: 'True Autumn',
    tagline: '깊이 있는 흙빛·단풍 컬러에서 얼굴이 단단해 보이는 타입',
    best: [s('머스타드', '#D4A017'), s('테라코타', '#C65D3B'), s('카멜', '#C19A6B'), s('올리브 그린', '#708238'), s('브릭 레드', '#A23B2A'), s('펌킨', '#E07B39'), s('딥 틸', '#2F6F6A'), s('웜 베이지', '#E3CBA8')],
    avoid: [s('쿨 핑크', '#F4A6C8'), s('라벤더', '#C8B6E2'), s('아이시 그레이', '#D9DEE5'), s('푸시아', '#C2185B')],
    lip: s('브릭', '#B5523B'), blush: s('테라코타', '#D7835E'), eye: s('딥 브라운', '#7B4F2C'),
    hair: [s('카퍼 브라운', '#8A4B2A'), s('골드 브라운', '#8C5E34')]
  }),
  tone({
    id: 'autumn-deep', season: '가을 웜', sub: '딥', english: 'Deep Autumn',
    tagline: '진하고 묵직한 웜 다크 컬러가 이목구비를 선명하게 잡는 타입',
    best: [s('초콜릿', '#5A3825'), s('와인', '#722F37'), s('딥 올리브', '#4F5A2A'), s('포레스트 그린', '#2E4A35'), s('딥 테라코타', '#9A3F2A'), s('다크 카멜', '#A6763F'), s('딥 틸', '#1F5552'), s('앤틱 골드', '#B8892D')],
    avoid: [s('파스텔 핑크', '#F8C8DC'), s('베이비 블루', '#BFDFFF'), s('라일락', '#D7B9DA'), s('아이시 화이트', '#F4F8FF')],
    lip: s('딥 브릭', '#8E3B2F'), blush: s('시나몬', '#B86B50'), eye: s('다크 초콜릿', '#5A3A24'),
    hair: [s('다크 초콜릿', '#3E2A1E'), s('딥 카퍼', '#6A3420')]
  }),
  tone({
    id: 'winter-true', season: '겨울 쿨', sub: '트루', english: 'True Winter',
    tagline: '흑백 대비와 쨍한 쿨 원색이 가장 잘 어울리는 타입',
    best: [s('퓨어 화이트', '#FFFFFF'), s('블랙', '#111111'), s('트루 레드', '#D0021B'), s('로열 블루', '#2541B2'), s('에메랄드', '#009B77'), s('푸시아', '#C2185B'), s('아이시 그레이', '#D9DEE5'), s('네이비', '#1B2240')],
    avoid: [s('카멜', '#C68E4E'), s('머스타드', '#D4A017'), s('오렌지', '#F57C00'), s('카키', '#8A8A4A')],
    lip: s('블루 레드', '#B0173A'), blush: s('쿨 핑크', '#E58BAA'), eye: s('차콜', '#3A3A40'),
    hair: [s('블루 블랙', '#1A1A22'), s('쿨 다크 브라운', '#3A2E2A')]
  }),
  tone({
    id: 'winter-bright', season: '겨울 쿨', sub: '브라이트', english: 'Bright Winter',
    tagline: '고채도 비비드 쿨 컬러에서 존재감이 폭발하는 타입',
    best: [s('비비드 푸시아', '#E6007E'), s('일렉트릭 블루', '#1F4FFF'), s('체리 레드', '#E0115F'), s('에메랄드', '#00A86B'), s('아이시 핑크', '#F9D5E5'), s('쿨 레몬', '#F5F06E'), s('퓨어 화이트', '#FFFFFF'), s('블랙', '#111111')],
    avoid: [s('더스티 로즈', '#C9969B'), s('카멜', '#C68E4E'), s('올리브', '#708238'), s('베이지', '#D6C3A5')],
    lip: s('체리 레드', '#E0115F'), blush: s('비비드 핑크', '#F06AA0'), eye: s('블랙 브라운', '#2E2E36'),
    hair: [s('블루 블랙', '#15151C'), s('다크 애쉬', '#33302E')]
  }),
  tone({
    id: 'winter-deep', season: '겨울 쿨', sub: '딥', english: 'Deep Winter',
    tagline: '깊고 차가운 다크 컬러가 시크하고 또렷하게 받는 타입',
    best: [s('와인', '#6D1A36'), s('딥 네이비', '#1B2240'), s('차콜', '#36373B'), s('블랙', '#111111'), s('딥 에메랄드', '#00563F'), s('플럼', '#5E2750'), s('버건디', '#800020'), s('아이시 블루', '#DCEBFA')],
    avoid: [s('피치', '#FFC8A8'), s('살몬', '#FA8072'), s('카멜', '#C68E4E'), s('머스타드', '#D4A017')],
    lip: s('딥 플럼 레드', '#7D1F3A'), blush: s('쿨 로즈', '#C0657E'), eye: s('블랙 플럼', '#2B2226'),
    hair: [s('블랙', '#111111'), s('다크 쿨 브라운', '#2E2420')]
  })
];

export const TONE_MAP = Object.fromEntries(TONES.map((item) => [item.id, item])) as Record<ToneId, ToneInfo>;

export const SEASONS = ['봄 웜', '여름 쿨', '가을 웜', '겨울 쿨'] as const;

export const isToneId = (value: unknown): value is ToneId => typeof value === 'string' && value in TONE_MAP;

const seasonPrefix: Record<string, string> = { '봄 웜': 'spring', '여름 쿨': 'summer', '가을 웜': 'autumn', '겨울 쿨': 'winter' };
const legacySub: Record<string, string> = { 라이트: 'light', 브라이트: 'bright', 클리어: 'bright', 뮤트: 'mute', 소프트: 'mute', 딥: 'deep', 트루: 'true' };

// Older (v1) results only stored a 4-season label plus a free sub tone; map them to the closest 12-tone id.
export const resolveToneId = (toneId?: string, season?: string, secondaryTone?: string): ToneId => {
  if (isToneId(toneId)) return toneId;
  const prefix = seasonPrefix[season?.trim() ?? ''] ?? 'summer';
  const candidate = `${prefix}-${legacySub[secondaryTone?.trim() ?? ''] ?? 'true'}`;
  return isToneId(candidate) ? candidate : (`${prefix}-true` as ToneId);
};

export const readableText = (hex: string) => {
  const raw = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#0f172a' : '#ffffff';
};
