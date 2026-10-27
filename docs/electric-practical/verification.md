> 후속 작업: 공개 1번 완성 배선 및 단자대/클릭 배선 확장은 [추가 검증 기록](public-one-verification.md)을 확인하세요. 아래는 최초 24V 자기유지 P0 검증 당시 기록입니다.

# 전기기능사 자기유지 MVP 검증 기록

검증일: 2026-10-27. 작업 대상: `C:\3.manytool`. 첨부 개발 명령서의 P0와 자기유지 과제를 기준으로 구현했다.
최종 판정: **지정 자기유지 P0 MVP 검증 통과**. 코어/편집기 46개, 프로덕션 빌드 브라우저 E2E 8개 모두 실패 0개다. 아래에 적은 물리 모델·브라우저 검증 범위의 판정이며 실물 전기안전 인증을 의미하지 않는다.
운영 배포·DNS·도메인·유료 서비스·전역 Git 설정은 변경하지 않았다.

## 조사와 변경 범위

초기 상태: `main`, 미추적 `.claude/`, `ads.txt`, `image.png`. 이 세 항목은 수정하지 않았다.
저장소는 Astro 정적 사이트 + React islands + TypeScript + Tailwind, npm/package-lock을 사용한다.
실제 설치 버전은 Astro 5.18.0, React 19.2.4, TypeScript 5.9.3, 실행 Node 24.15.0이다.
설정의 canonical 도메인은 `https://manytool.net`이며 도메인 소유권/실제 호스팅 계정은 변경하거나 확인 완료로 주장하지 않는다.
기존 Node API·Supabase·광고/분석 코드가 있으나 새 도구의 계산/저장에 서버나 인증을 추가하지 않았다.

새 기능은 `src/features/electric-practical/` 아래 모델·엔진·채점·편집기·화면·저장·테스트로 격리했다.
ManyTool 어댑터는 `src/pages/tools/electric-practical.astro` 하나다.
기존 파일 변경은 다음 추가분에 한정한다.

| 파일 | 이번 작업의 변경 |
| --- | --- |
| `src/pages/index.astro` | 검색 가능한 도구 카드 1개 |
| `src/pages/tools/index.astro` | 도구 목록 링크 1개 |
| `src/layouts/Layout.astro` | 사이드바 링크와 breadcrumb 이름 |
| `src/components/Header.astro` | 기본 동작은 유지하는 선택적 `preserveCurrentRoute` prop; 새 한국어 전용 페이지의 번역 URL 404 예방 |
| `src/pages/sitemap.xml.ts` | 도구 경로 1개 |
| `package.json`, `package-lock.json` | 고정 버전 개발용 검사 패키지와 실행 명령 |
| `.gitignore` | 로컬 검사 캐시/Playwright 임시 산출물 제외 |

새 설정: `tsconfig.electric.json`, `eslint.electric.config.mjs`, `playwright.electric.config.ts`.
재현 스크립트: `scripts/create-electric-fixtures.ts`, `scripts/electric-demo.ts`.
작업 중 별도 작업에서 AI 모델컷·AI 사진 관련 변경이 나타났으며 이를 되돌리거나 이번 작업 결과로 포함하지 않았다.

## 단계별 실행 결과

| 게이트 | 실제 실행 및 증거 |
| --- | --- |
| Gate 0 | 초기 `git status`, 브랜치, 기술/도메인/라우트/광고/기존 테스트 확인. 사전 빌드의 PDF worker 누락을 `evidence/baseline-build.log`에 기록. 의존성 설치 복구 후 해결 |
| Gate 1 | UI 작성 전에 순수 엔진 38개 테스트 통과·0실패, TypeScript 통과. `evidence/gate1-engine.log` |
| Gate 2 | 빈 회로 단자 결선, 삭제/복원, Undo/Redo, 좌표 독립성 포함 43개 통과·0실패. `evidence/gate2-check.log` |
| Gate 3–4 | 최초 브라우저 검사에서 직접 결선/유지/수리/단락/모바일 동작 성공. 상태 알림과 선 모양 선택자의 접근성 이름 문제를 발견하여 수정. 초기 실패는 `evidence/gate3-e2e.log`에 보존 |
| 최종 코어 | 단자 충돌·전원 앞쪽 차단 규칙 보강 후 **46개 통과·0실패**. 타입·lint 통과. `evidence/final-check.log` |
| 전체 빌드 | `npm run build`: **5,509개 페이지, 성공**. `evidence/final-build.log` |
| 최종 브라우저/통합 | **8개 통과·0실패, 33.9초**, 로컬 프로덕션 빌드 + Edge 126.0.2592.102. `evidence/final-e2e.log`, `evidence/e2e-results.json` |

타입·lint의 통과 범위는 새 기능의 TypeScript/React, 해당 테스트와 실행 설정이다. 기존 프로젝트 전체의 타입/lint가 통과했다고 주장하지 않는다. Astro 변경은 전체 프로덕션 빌드로 검증했다.

브라우저에서 빈 작업판 직접 결선, 자기유지/STOP/정전, 유지 배선 누락 후 수리, 단락 후 삭제/Undo/Redo, 로컬/JSON 저장 복원 및 손상 파일 보존, 키보드·부품 드래그·확대·끝점 재배선·카탈로그 추가/삭제·NO/NC 변경, 모바일 터치, ManyTool 검색/목록/복귀와 기존 퍼스널컬러 smoke, 영어 브라우저 URL 유지까지 실행했다.
프로덕션 URL의 끝 슬래시 때문에 발생했던 테스트 비교 실패는 정규화하여 해결했으며 초기 실행 로그 `evidence/production-e2e-first.log`도 남겼다.

화면 증거(자동 조작 결과를 직접 시각 검토):

- [자기유지 ON](evidence/self-hold-on.png)
- [9단계 검수 합격](evidence/grade-pass.png)
- [직접 단락 검출](evidence/short-detected.png)
- [모바일 읽기·검수](evidence/mobile-readonly.png)

기본 성능: 로컬 프로덕션 빌드에서 DOMContentLoaded 85.5ms, load 294.1ms, 페이지 이동부터 hydration 확인까지 616ms. 신규 SimulatorPage 청크 39.61KB, gzip 14.35KB(공유 React/사이트 자산 제외).
이는 해당 컴퓨터의 로컬 측정이며 외부 광고를 차단한 테스트 환경이다. 운영 네트워크·실제 기기의 성능 보장은 아니다. `evidence/browser-performance.json`, `evidence/final-build.log` 참조.

## 핵심 테스트 증거

27개 전체 회로 JSON 중 정상/동등/상태 회귀 6개, 의도적인 오답 21개다. 각 JSON은 실제 엔진 결과와 기대 오류/실패 단계를 대조한다.
27개 모두 같은 입력을 각각 100회 실행하여 결과 JSON 일치를 확인했다(2,700회 채점).
500개의 빠른 버튼 입력과 START+STOP 동시 입력도 순차적으로 실행했다.

| 입력/변형 | 확인한 결과 |
| --- | --- |
| 정상 START 누름 | MC1·PL1 ON, 각각 24V, 총 0.150A |
| START 해제 | MC1_NO 닫힘, MC1·PL1 ON 유지 |
| STOP 누름·해제 | MC1·PL1 OFF, 유지 접점 해제 |
| 재시작 → 정전 → 복전 | 정전 시 코일 기억/통전 경로 해제, 복전만으로 재시작하지 않음 |
| START+STOP 동시 입력 | STOP 우선, 두 부하 OFF |
| 자기유지 없음·분기 단선·교차만 존재 | START 해제 또는 해당 부하 동작 단계 실패 |
| STOP 누락·STOP 우회·NO/NC 오사용 | 해당 동작 실패, 접점 오류/발진 검출 |
| 잘못된 linkId | CONTACT_LINK |
| 램프 같은 전위 | MISWIRE, 램프 OFF |
| L–N 직결·START 후 발생하는 단락 | SHORT, 보호 차단 래치, 부하 OFF |
| 코일 A1·리턴 단선 | OPEN 또는 동작 실패, 가짜 점등 없음 |
| 코일 극성 반전 | REVERSED, 여자하지 않음 |
| 퓨즈 0.12A 또는 추가 과부하 | OVERCURRENT, 보호 차단 |
| 퓨즈 우회·리턴에 설치한 보호/STOP | 보호/과제 규칙 불합격 |
| 코일·램프 직렬 | 실제 계산 8V/16V, 둘 다 동작 문턱 미달 |
| 중복 전선·미존재 단자·ID 충돌 | DUPLICATE_WIRE / INVALID_TERMINAL / INVALID_MODEL |
| 좌표·선 모양·순서·방향 변경, 추가 분기점 | 정상 회로와 동일 동작, 합격 |
| 모든 유효 fixture 저장/복원 | 원래 정상/오답 판정과 실제 동작 유지 |
| 떠 있는 도선 가지 | 가짜 통전 경로 하이라이트 없음 |

`evidence/actual-scenario-output.json`에는 정상 회로 9단계의 입력, 실제 코일·접점·램프 상태, 전압, 전류, 수렴 횟수, 오류가 있다.
생성 명령: `node scripts/electric-demo.ts`.

## P0 완료 기준 대응

| 필수 항목 | 구현/검증 근거 |
| --- | --- |
| 전원·퓨즈·PB NO/NC·코일·보조접점·램프·분기 | 종류별 단자 계약, 열린/닫힌 접점 그래프, 부하 전위차, 소스/리턴 계산 |
| 임의 결선/수정 | SVG 단자 드래그·두 번 클릭·키보드 연결, 전선 끝점 재선택, 삭제 |
| 이동/스냅/확대/Undo/Redo | 부품 제목 드래그·방향키 20px 스냅, 40–190% 확대, 50단계 기록 |
| 저장/불러오기 | 명시적 localStorage 및 JSON 파일 입출력, 잘못된 파일의 현재 작업 보존 |
| 실행/일시정지/초기화 | 입력 이벤트별 순수 상태 전이, 가상 시계, 코일 기억/접점, 보호 래치 초기화 |
| 과제/검수/최종 결과 | 9단계 행동, 안전 규칙, 지정 부품·단자·전원 앞쪽 차단을 별도로 판정 |
| 오류 설명/위치 | 오류 코드·관련 단자·재현 단계·수정 힌트, 클릭 시 작업판 강조 |
| 통전 경로 | 계산된 비영 전류 부하의 대표 전원·리턴 경로만 표시 |
| 모바일/접근성 | 모바일 읽기/실행/불러오기, 터치 버튼, 키보드 편집, 텍스트 상태 |
| ManyTool 통합 | 도구 목록·검색 카드·사이드바·sitemap·공통 Layout/Header/Footer/광고 유지 |
| 분리 가능성 | 코어에 DOM/React/ManyTool/서버/API 의존성 없음, React 화면은 단일 Astro 래퍼로 연결 |

## 실행·재현

```powershell
npm run check:electric
npm run build
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:ELECTRIC_PREVIEW='1'
npm run e2e:electric
```

일반 Chromium 환경에서는 `npx playwright install chromium` 후 `PLAYWRIGHT_CHANNEL` 설정 없이 실행한다.
E2E는 외부 분석/광고 요청을 차단하고 실제 로컬 사이트와 회로 UI를 조작한다. 회로 엔진/결과를 mock하거나 UI에 주입하지 않는다.
프로덕션 빌드 로컬 확인: `npm run preview -- --host 127.0.0.1 --port 4337`.
접속 경로: `http://127.0.0.1:4337/tools/electric-practical` (운영 배포 URL이 아님).

빠른 수동 재현: 학습 예제 불러오기 → 실행 → START 누름/해제 → 유지 확인 → STOP 누름/해제 → 소자 확인 → 과제 검수.
직접 작업: 빈 과제로 시작 후 아래 10개 단자 쌍을 연결한다. 전선의 위치/경로는 자유다.

| 시작 | 끝 |
| --- | --- |
| PS1:L | F1:1 |
| F1:2 | STOP:21 |
| STOP:22 | START:13 |
| START:13 | MC1_NO:13 |
| START:14 | J1:J |
| MC1_NO:14 | J1:J |
| J1:J | MC1:A1 |
| J1:J | PL1:X1 |
| MC1:A2 | PS1:N |
| PL1:X2 | PS1:N |

오답 재현: 일시정지 → MC1_NO:14–J1:J 전선을 삭제 → 실행 → START를 놓으면 유지 실패. Undo로 복원 후 검수한다.
단락 재현: 빈 과제에서 PS1:L–PS1:N 연결 → 실행 → SHORT 및 보호 차단 확인.

## 보안·한계·미지원

`npm audit` 실행 결과: 기존 잠금파일 **36건** → 현재 **35건**(critical 3, high 26, moderate 4, low 2).
신규 보고 항목 0건, js-yaml 1건 해소. 기존 취약점 35건을 해결했다고 주장하지 않는다.
근거: `evidence/dependency-audit-baseline.json`, `evidence/dependency-audit.json`, `evidence/audit-comparison.json`.
기존 기능을 바꾸는 강제 일괄 업그레이드는 수행하지 않았다. 운영 배포 검토에서 기존 의존성 대응을 별도로 다뤄야 한다.

이 MVP는 24V 디지털 제어 + 정적 저항 모델이다. 코일 극성과 19.2V 동작 문턱은 명시적인 과제 가정이며 실물 제품 보증이 아니다.
퓨즈는 브리지 전류를 계산하며 보호 동작 시 전체 가상 전원을 차단한다. 실제 퓨즈 시간곡선/선택차단을 구현하지 않았다.
AC 파형, 접지, 절연, 열, 아크, 인덕턴스, 접점 바운스, 실물 안전/공인 시험 채점은 미지원이다.
타이머·인터록·복수 릴레이 과제(P1), 제한시간·클라우드/계정/결제(P2)는 미구현이다.
실제 공인 도면을 복제하지 않은 자체 제작 학습 문제다. 공식 공개문제/실물 부품 사양과의 대응 및 전기안전은 전기제어 전문가 검토가 필요하다.
브라우저 검증은 로컬 Edge(Chromium)와 모바일 터치 에뮬레이션 범위이며 실제 iOS Safari/Android 기기 검증은 별도다.
기존 전체 도구를 하나씩 테스트한 것은 아니다. 전체 정적 빌드와 기존 퍼스널컬러 smoke 회귀를 범위로 삼았다.

## 독립 서비스 전환 추정

model/engine/grading/storage/editor/screens는 그대로 재사용할 수 있다. 기존 ManyTool 인증/DB에 연결하지 않아 데이터 이관이 필요 없다.
단일 React 진입점, 페이지 셸/SEO/광고, 빌드·호스팅 구성을 분리하는 데 약 1–2 개발일, 분리 환경 회귀/기기 검수 약 1일을 예상한다.
이는 작업량 추정이며 도메인 구매·DNS·실제 배포·결제·클라우드 저장 비용은 포함하지 않는다. 해당 외부 변경은 승인 후 진행한다.
