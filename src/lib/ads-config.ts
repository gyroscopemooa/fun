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
  },
  // Banner 160x600 (31846704) - 메인 홈 양쪽 여백, 넓은 화면 전용
  skyscraper: {
    key: '8b72351cdd6100b56412440f07995c64',
    scriptSrc: 'https://bauval.org/22/8b72351cdd6100b56412440f07995c64',
    width: 160,
    height: 600
  }
} satisfies Record<string, AdsterraUnit>;

export type AdsterraUnitName = keyof typeof units;

// 페이지 내 광고 위치.
// - home: 메인 홈 카테고리 아래
// - top: 제목 카드와 본문 사이
// - bottom: 본문 바로 아래(사용 방법·참고 사항·추천 콘텐츠 위)
export type AdsterraPlacement = 'home' | 'top' | 'bottom';

// 광고를 넣지 않는 페이지(로케일 접두어 제외 경로). 접두어 일치(하위 경로 포함).
// 로그인, 정책·문의, 관리자, 이동용 페이지.
// AI·업로드 도구는 결제 연동 전이라 광고를 허용한다. PG 결제 연동 후 결제 화면은 다시 검토.
const excludedPaths = [
  '/tools/mkv-to-mp4',
  '/tools/ai-photo-admin',
  '/tools/ai-photo-debug',
  '/tools/ai-photo-ops',
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
  // 페이지 전체에 붙는 형식. 각각 별도 플래그로 켜고 끄며 기본값은 OFF.
  // 대시보드 발급 주소. 임의 변경 금지.
  popunder: {
    enabled: import.meta.env.PUBLIC_ADSTERRA_POPUNDER === 'true',
    scriptSrc: 'https://abscloud.org/1/3a22868ab4b5cc35ecc4d9485b483b24'
  },
  socialBar: {
    enabled: import.meta.env.PUBLIC_ADSTERRA_SOCIALBAR === 'true',
    scriptSrc: 'https://bauval.org/14/f2905e5c7620ab85b06c432649543fc5'
  },
  smartlink: {
    enabled: import.meta.env.PUBLIC_ADSTERRA_SMARTLINK === 'true',
    url: 'https://araplhn.org/4/4df0e07ec46912aae86f312e3e3c3196'
  },
  // Native Banner (31846700), 위젯 레이아웃 4:1. 실시간 인기 콘텐츠 위에 표시.
  native: {
    enabled: import.meta.env.PUBLIC_ADSTERRA_NATIVE === 'true',
    key: 'b9207d0e3d06c0bc5f77c2189fd8e6fa',
    scriptSrc: 'https://bauval.org/21/b9207d0e3d06c0bc5f77c2189fd8e6fa'
  },
  // 홈 포함, 제외 목록이 아닌 페이지인지 (페이지 전체 형식용)
  allowsPage(path: string) {
    const normalized = normalize(path);
    return normalized === '/' || !matches(excludedPaths, normalized);
  },
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
