# ManyTool 브랜드·웹 Google 로그인 운영 구현

2026-11-13. 승인된 PNG에서 웹 로고·파비콘·Apple touch icon을 만들었다. 사이드바에는 무아레쥬메(짙은 초록/민트), 트랜스트림(검정/라임) 링크를 추가했다.

`/account/`는 실제 Google Identity Services 인증 화면이다. `/api/auth/` Pages Functions는 Google RS256/JWKS 서명, issuer/audience/만료, 이메일 인증 여부, 일회용 nonce 및 Origin을 검사한다. 최대 16KB 요청과 IP 해시 기반 요청 제한을 적용한다. Google 토큰·비밀번호는 저장하지 않는다.

Google sub를 계정 ID로 사용한다. Cloudflare D1 `manytool-accounts`와 Pages production `ACCOUNT_DB` 바인딩에 계정과 해시된 세션을 보관한다. 원시 세션은 Secure/HttpOnly/host-only 쿠키에만 둔다. 로그아웃은 해당 세션을 취소하고 계정 삭제는 사용자의 모든 웹 세션과 계정 정보를 제거한다. 개인정보 처리방침도 갱신했다.

웹 계정은 기존 Render 결제 지갑과 아직 연결되지 않는다. 기존 결제 DB·심사용 Google 로그인·NICE 경로를 변경하지 않았다. 이 세션만으로 크레딧 지급·유료 기능 권한을 허용하지 않는다. 앱은 별도 인증 복귀·계정 연결·Play 결제·실기기 검증이 필요하다. 이 배포에는 Android 소스나 앱 빌드가 포함되지 않는다.

스키마 `migrations/account-0001.sql`은 신규 계정 전용 DB에만 적용한다. 기존 Pages 바인딩을 보존하고 ACCOUNT_DB만 추가했다.

`node --test scripts/test-account-auth.mjs` 4개 검사 통과: nonce 재사용/오류, Origin, 로그인 조회, 로그아웃 취소, 계정 삭제, 만료, 요청 크기와 빈도 제한. Google 검증 함수를 주입한 서버 테스트이며 실제 Google 계정 로그인 완료를 증명하지 않는다. Wrangler Pages Functions 번들 검증 통과.
