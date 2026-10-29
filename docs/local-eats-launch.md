# 혼밥가능 / 맛집추천 지도 출시

- 경로: `/maps/local-eats`
- 홈 카드, 지도 모음, SEO 제목 및 사이트맵에 반영.
- 혼밥 가능 / 조건부 / 어려움 / 확인 필요 필터, 지역·메뉴 검색, 지도 위치 선택 및 식당 제보.
- 별점 1~5점과 방문 후기, 방문 당시 혼밥 여부를 Supabase에 공유 저장.
- 최신 후기의 확인된 혼밥 여부를 표시하고 후기가 없으면 최초 제보 사용.
- 임의의 식당이나 평점은 초기 데이터로 넣지 않음.

## 배포 순서

1. 기존 Supabase 프로젝트 `pzqlzomrvondxikyafvy`에서 `supabase/local_eats_schema.sql` 적용.
2. 비회원에게 새 두 테이블의 조회·등록만 허용. 수정·삭제 정책은 없음. 기존 붕어빵 테이블은 변경하지 않음.
3. DB 권한 적용 승인 및 저장 검증 후 `PUBLIC_LOCAL_EATS_LAUNCHED=true`를 설정. 기존 `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`와 함께 빌드. 플래그가 없으면 운영에서는 준비 중 화면만 제공하고 홈 링크·사이트맵 노출은 보류한다. 개발 서버에서는 구현 화면을 미리 볼 수 있다.
4. `npm run build` 후 기존 GitHub main → Cloudflare Pages fun 배포 절차 사용.
5. 운영 페이지에서 빈 목록 정상 표시 및 제보/후기 저장 연결 확인.

## 검증

- `node scripts/test-local-eats.mjs` (PUBLIC_LOCAL_EATS_LAUNCHED=true로 만든 테스트 빌드 및 로컬 preview 포트 4341 필요): 테스트 서버 응답으로 별점·댓글, HTML 문자열 안전 표시, 혼밥 필터, 검색, 위치 필수, 실패 시 입력 보존, 새로고침, 모바일 폭, 연결 실패 확인.
- `npx tsc --noEmit --jsx react-jsx --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom --types vite/client --esModuleInterop --skipLibCheck src/components/LocalEats.tsx`
- 테스트는 운영 DB에 데이터를 작성하지 않음.

## 현재 상태

운영 SQL 실행은 자동 승인 검토에서 차단됨: 새 테이블에 비회원 공개 조회·등록 권한을 추가하는 작업에 명시적 승인이 필요함. SQL은 관리 화면에 준비되었으나 실행되지 않음. 홈 개선 배포에는 준비 중 화면만 포함하며 실제 맛집·후기 등록은 공개하지 않음.

최종 검증: 5,513개 페이지 전체 빌드 성공, 컴포넌트 TypeScript 검사 성공, 위 Playwright 시나리오 전체 통과. 테스트 환경의 외부 네트워크 제한으로 OSM 배경 타일의 실제 로딩은 확인하지 못함. 지도 라이브러리와 핀·위치 선택은 번들 내장으로 검증 완료.
