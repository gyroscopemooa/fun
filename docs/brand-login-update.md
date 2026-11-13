# 로고·사이드바·Google 로그인 변경 (2026-11-13)

아래는 초기 로컬 작업 기록이다. 운영 배포 구현과 현재 범위는 `brand-login-production.md`를 기준으로 한다. 운영 계정 로그인은 초기 `/credits/` 방식 대신 Pages `/api/auth/`와 별도 계정 DB를 사용한다.

## 반영한 코드

- 사용자 첨부 PNG 원본: `public/brand/manytool-master.png`. 이 이미지에서 웹 헤더/사이드바 로고, 구조화 데이터용 logo.png, PNG/ICO/SVG 파비콘, Apple touch icon, Android 밀도별 런처 아이콘을 생성했다. 원본 형태를 재생성하거나 변경하지 않았다.
- 사이드바 상단: 자기소개서 첨삭 → https://mooaresume.com/ (원 사이트 CSS의 #176b4a, #eaf5ef), 스트리머 방송 번역 → https://transtream.app/ (기존 패밀리 서비스의 #b7ff3c와 어두운 배경). 새 탭·noopener/noreferrer·외부 이동 표시를 사용한다.
- `/account/` 로그인 화면과 헤더 로그인 진입, `/credits/`에도 Google 버튼을 연결했다. 기존 이메일 인증과 같은 서버 지갑 세션을 사용한다. Google의 서명·audience 검증, 서버 발급 단회 nonce, Origin 검증, 검증된 Google 소유 이메일만 기존 지갑에 연결한다. 결과 보관 기능이나 계정 데이터 구조를 새로 만든 것은 아니다.
- 기존 작업 폴더의 Android Java 개발판을 현재 `mobile/android`에 가져와 승인된 아이콘과 앱 이름을 반영했다. 이 소스는 아직 제한된 도구 목록·로그인/결제 비활성 상태다. 전체 웹 앱 구현 완료로 간주하지 않는다.

## 운영 활성화에 필요한 사항

Google Cloud의 웹 OAuth 클라이언트에 운영 JS origin `https://manytool.net`을 등록하고 서버 `GOOGLE_CREDIT_CLIENT_ID`를 설정한다. 서버 `CREDITS_DB_PATH`에는 기존 지갑을 보존하는 영구 저장소가 필요하다. Google 로그인 때문에 유료 크레딧을 활성화하지 않는다. 서버 API·웹 배포와 실제 Google 계정 로그인은 아직 이 변경에서 수행하지 않았다. 기존 운영 DB 백업·지속 저장소 확인 없이 API를 재배포하지 않는다.

Android는 브라우저 Google 세션이 자동 공유되지 않는다. 앱 전용 안전한 로그인 복귀와 계정 연결·결제 연결·전체 웹 동작 검증이 추가로 필요하다. `/account/`를 웹뷰에서 열었다고 앱 인증이 완성되는 것이 아니며, 현재 UI는 앱 내 Google OAuth 실행을 차단한다.

## 검증

Google 인증/기존 크레딧 테스트 16개 통과. 수정 Astro 4개 구문 검사·git diff --check 통과. 아이콘 크기: logo 512, favicon 64, Apple 180, Android 48/72/96/144/192.

사용자 요청에 따라 앱 빌드·APK 생성·배포·실결제 활성화는 수행하지 않았다. 이전 작업 폴더 README의 debug APK 기록은 과거 개발판 기록이며 이번 소스의 빌드/실기기 검증 결과가 아니다.
