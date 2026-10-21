// 광고 플랫폼 설정. 플랫폼 교체·제거 시 이 파일과 src/components/ads/, src/pages/ads/ 만 정리하면 된다.
// ON/OFF 는 기존 광고 슬롯과 동일하게 빌드 환경변수(PUBLIC_*)로 제어하며 기본값은 OFF.

export type AdsterraUnit = {
  // Adsterra Publisher 대시보드에서 발급된 값. 임의 변경 금지.
  key: string;
  scriptSrc: string;
  width: number;
  height: number;
};

const units = {
  // Banner 728x90 (31846705) - 데스크톱·노트북
  leaderboard: {
    key: 'b95ec2301129a1bae9f8b167e6f23376',
    scriptSrc: 'https://bauval.org/22/b95ec2301129a1bae9f8b167e6f23376',
    width: 728,
    height: 90
  },
  // Banner 320x50 (31846706) - 모바일 등 728px 미만
  mobile: {
    key: 'ceb8b22c3d32a41d1b0ef043ccd845f4',
    scriptSrc: 'https://bauval.org/22/ceb8b22c3d32a41d1b0ef043ccd845f4',
    width: 320,
    height: 50
  }
} satisfies Record<string, AdsterraUnit>;

export type AdsterraUnitName = keyof typeof units;

// 페이지 내 광고 위치.
// - home: 메인 홈 카테고리 아래
// - top: 제목 카드와 본문 사이
// - bottom: 본문 바로 아래(사용 방법·참고 사항·추천 콘텐츠 위)
export type AdsterraPlacement = 'home' | 'top' | 'bottom';

// 광고를 넣지 않는 페이지(로케일 접두어 제외 경로). 접두어 일치(하위 경로 포함).
// 결제, 서버 업로드·카메라·얼굴 사진, 로그인, 정책·문의, 관리자 화면.
const excludedPaths = [
  '/ai-calorie-calculator',
  '/ai-id-photo',
  '/ai-passport-photo',
  '/ai-personal-color',
  '/ai-pet-translator',
  '/ai-photoshop',
  '/ai-manseryeok',
  '/ai-headshot',
  '/ai-image-generator',
  '/name-premium',
  '/tools/product-detail-studio',
  '/tools/video-to-mp4',
  '/tools/mkv-to-mp4',
  '/tools/ai-photo-admin',
  '/tools/ai-photo-debug',
  '/tools/ai-photo-ops',
  '/animal-test',
  '/personal-color',
  '/maps/fishbread',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/contact',
  '/content-disclaimer',
  '/editorial-policy',
  '/ads'
];

// 빠르게 반복 클릭하는 게임·퀴즈. 오클릭 방지를 위해 하단 광고 위 여백을 넓힌다.
const clickGamePaths = [
  '/fps-aim-sensitivity',
  '/fps-aim-trainer',
  '/reaction-test',
  '/typing-speed',
  '/balance-game',
  '/choseong-quiz',
  '/ideal-world-cup',
  '/korean-quiz',
  '/logo-quiz',
  '/song-initial-quiz',
  '/lol-terrain-quiz'
];

const matches = (paths: string[], path: string) =>
  paths.some((p) => path === p || path.startsWith(`${p}/`));

const normalize = (path: string) => path.replace(/\/+$/, '') || '/';

export const adsterra = {
  enabled: import.meta.env.PUBLIC_ADSTERRA_BANNERS === 'true',
  units,
  // 광고 스크립트를 격리 실행하는 같은 출처 iframe 문서 경로 (+ /{unit})
  framePath: '/ads/adsterra',
  // path 는 로케일 접두어를 제거한 경로
  shouldRender(placement: AdsterraPlacement, path: string) {
    if (!this.enabled) return false;
    if (placement === 'home') return true;
    const normalized = normalize(path);
    return normalized !== '/' && !matches(excludedPaths, normalized);
  },
  isClickGame(path: string) {
    return matches(clickGamePaths, normalize(path));
  }
};
