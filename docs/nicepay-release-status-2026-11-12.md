# NICEPAY 재확인 및 출시 차단 사항 — 2026-11-12

이 문서는 이번 세션에서 직접 확인한 최신 상태다. 이전 준비 문서의 테스트 통과나 Cloudflare 프리뷰 배포를 실제 NICE 결제·운영 API 배포 완료로 해석하지 않는다.

## 확인한 가맹점 상태

- 사용자가 Edge에서 로그인한 NPG 계정의 MID는 `000000002m`, 기본정보 홈페이지는 `manytool.net`이다. 다른 서비스 MID를 사용하지 않았다.
- NPG KEY관리에서 해당 MID의 마스킹된 가맹점 키가 존재함을 확인했다. 키 보기 인증·키 추출·키 변경·서버 주입은 하지 않았다. 키가 있다는 사실만으로 무과금 테스트용이라고 판단하지 않는다.
- 온라인등록현황: 발급일 2026/11/09, 서비스상태 **중지**. 계약완료·홈페이지 심사 칸은 화면에서 완료 여부를 확인할 수 없었다.
- 신용카드심사현황: **조회 결과가 없습니다**. 심사 승인 완료가 아니다.
- 기본정보에는 신용카드·계좌이체가 사용으로 표시되지만, 상품별 승인이나 서비스 개통 증거가 아니다. 크레딧 충전에서 계좌이체를 활성화하지 않는다.
- MID/MerchantKey NPG 계약 화면과 기존 `legacy` 구현이 대응한다. 이 MID의 구체적인 테스트 권한·거래조회 API/IP 등록·부분취소 권한은 추가 확인이 필요하다.
- 해외카드·간편결제는 확인되지 않았다. 가격 및 기존 Polar 상품은 변경하지 않는다.

## 직접 확인한 운영 상태

- Cloudflare Pages `fun`: 운영 main `ef8cab4`, 기존 NICE 브랜치 프리뷰 `144d802`.
- Render `fun`: 마지막 성공 배포 `880b561`, main 연결, 무료 인스턴스. `https://api.manytool.net/config`는 paymentMode=polar를 반환했다.
- `GET /credits/config`: enabled=false, 모든 충전팩 available=false, tools={}.
- `GET /payments/nicepay/config`: 404. NICE API 코드는 운영에 배포되지 않았다.
- Render 환경변수 목록에서 NICE·크레딧·PostgreSQL 설정은 확인되지 않았다. 비밀값을 표시하거나 수정하지 않았다.
- Render Disk 화면은 무료 인스턴스에서 영구 디스크·웹 셸·SSH를 사용할 수 없다고 안내한다. 무료 서비스 재배포로 임시 저장 파일과 메모리 주문이 사라질 수 있어 기존 데이터 보존을 검증하기 전 API 재배포를 보류한다. 유료 플랜으로 임의 변경하지 않는다.
- 기존 매니툴 Supabase 프로젝트에 인증서 검증 TLS로 `BEGIN READ ONLY` 조회: 공개 커뮤니티 테이블 6개, `manytool_payments` 테이블 없음. 잔액이 없다는 뜻이 아니며 운영 SQLite 백업을 대신하지 않는다. 스키마 생성·이관·데이터 변경은 하지 않았다.

## 이번 코드 보완

기존 연동 코드에서 네 가지 검증/처리 누락만 수정했다.

1. 망취소는 서명·MID·TID·금액뿐 아니라 `RemainAmt`가 문자열 0인지 검증한다. 누락·비정상 잔액은 uncertain으로 남기며 재시도하지 않는다.
2. 카드 승인 응답이 명시적으로 해외카드, 간편결제 또는 복합결제를 나타내면 지급하지 않는다. 이 검사는 MID 결제수단 설정을 대체하지 않으며 옵션 필드 누락이 국내카드임을 증명하지 않는다. 이미 승인된 불일치 결과는 운영 대조·취소 대상이다.
3. 스테이징 세션 조회가 비동기 인증 결과를 기다리며, 인증 실패를 성공으로 응답하지 않는다.
4. 결제 전 입력 바인딩 실패 시 주문 폐기 저장이 끝난 뒤 오류를 응답한다.

기존 전액 미사용 환불·중복 승인 방지·원자적 크레딧 지급·불명확 상태 격리 코드를 재사용했다. 공개 NICE 결제창·승인·취소는 계속 비활성이다. PostgreSQL 직접구매 실행 모듈은 존재하지만 전체 도구 HTTP 연결과 미디어 영속성이 완료됐다는 뜻은 아니다.

## 검증

- 이번 변경의 직접 회귀: 44개 통과, 실패 0.
- 기존 Windows 전체 결제·지갑 테스트에는 사진 저장소의 POSIX 소유자 전용 권한 검사 실패가 남는다. 보안 검사를 제거하지 않았다.
- Linux에서 기존 테스트를 실행하도록 NICE 작업 브랜치 전용 GitHub Actions를 추가했다. 예약 실행·실결제·운영 DB·유료 AI 호출은 포함하지 않는다. 실제 실행은 GitHub 계정 결제 문제로 시작 전에 차단됐다. 테스트 실패가 아니라 실행 환경 장애다. 오류 원문: The job was not started because your account is locked due to a billing issue. 실행: https://github.com/gyroscopemooa/fun/actions/runs/43148829081
- 실제 NICE 결제창·인증·승인·취소: 미실행. 가맹점 테스트 자격과 무과금 여부가 확인되지 않았다.
- 운영 DB 변경·운영 API 재배포·실결제 활성화: 미실행.

## 다음 진행에 필요한 외부 확인

NICE에 확인할 내용(이 문서를 작성하며 문의를 발송하지는 않았다):

> manytool.net / MID 000000002m의 온라인등록현황이 중지이고 카드 심사 결과가 조회되지 않습니다. 개통·심사에 남은 요건, NPG MID/MerchantKey 인증결제용 무과금 테스트 MID/키 또는 테스트 전환 가능 여부, 테스트 카드/승인/취소 방법을 확인해 주세요. 크레딧 충전과 개별 상품 직접결제의 허용 수단·한도, 해외카드·간편결제 답변, 부분취소 및 거래조회 API/IP 등록 요건도 구분해 안내 부탁드립니다. 키는 보안 채널로 전달해 주세요.

운영 전 순서:

1. 기존 Render 결제·주문·파일 보존 방법과 일관된 SQLite 백업 확보. API 재시작 전에 원본을 확보해야 하며 빈 DB를 만들고 대체하지 않는다.
2. 백업에서 기존 이관 스크립트 dry-run으로 행 수·원장·잔액·멱등키 검증. 쓰기 중단 후 명시적으로 이관하고 대조하며 public 테이블은 변경하지 않는다.
3. 별도 HTTPS 테스트 서비스에 확인된 테스트 자격만 비밀 환경변수로 설정. test라고 적힌 화면만으로 무과금이라 판단하지 않는다.
4. 미정 상품 가격은 빈 카탈로그/비활성 유지. 크레딧 충전과 직접결제 계약·테스트를 각각 검증.
5. PC/모바일 실제 NICE 결제창 → 인증 → 서버 승인 → 지급 → 동일 콜백 재전송 → 취소와 불명확 결과 복구 검증. 부분사용 충전 환불·직접구매 전체 도구·미디어 복구는 별도 완료 필요.
6. 금전이 청구되는 시험은 금액·수단을 사용자에게 먼저 제시하고 확인 후 진행.
7. 심사·MID 설정·실제 테스트·데이터 보존 검증 후에만 운영 활성화.

공식 대조 문서:
- https://developers.nicepay.co.kr/docs/pg/auth/payment-window/
- https://developers.nicepay.co.kr/docs/pg/auth/authorization/
- https://developers.nicepay.co.kr/docs/pg/auth/net-cancel/
- https://developers.nicepay.co.kr/docs/pg/auth/payment-cancel/

## 커밋·배포 확인 결과

- 코드 수정과 위 점검 기록: `1caf7ceb0af25a64a7f74b99b38b9f6519f3c2c6`, 기존 `feat/nicepay-test-adapter`에 정상 fast-forward 푸시. 강제 푸시하지 않았다.
- Cloudflare Pages 프리뷰: 2026-11-12 12:35 KST 성공, 소요 3분 42초, 배포 `25d01b0a-806b-4f8a-891b-aa2e13f49dac`. URL: https://25d01b0a.fun-7hn.pages.dev/credits/
- 이 배포는 정적 웹 프리뷰다. Render API나 결제 서버 스테이징 배포가 아니며 실제 NICE 승인·취소 검증을 포함하지 않는다.
- main 운영 웹과 Render API를 변경하지 않았다. 실제 백업·저장소 전환·가맹점 개통·실결제는 여전히 미완료다.
- GitHub Actions 결제 잠금 해소 후 위 기존 실행을 다시 실행하고 Linux 전체 결과를 확인해야 한다.


## Follow-up: technical checkout access restriction

The assembled staging server now restricts technical checkout creation at
`/payment/checkout`, `/photo/payment/checkout`, and `/image/payment/checkout`
to explicitly listed operators authenticated through the wallet session. An empty
operator list denies access. This closes a path around the separate customer
consent and rate-limit flow. Customer routes and signed provider callbacks retain
their existing validation. Both storage assembly branches share this restriction.

Validation: 5 targeted server assembly tests and 43 existing NICE receipt,
transport, and callback tests passed on Windows. The new regression checks denied
customer access (including case/trailing-slash variations), zero orders on denial,
allowed operator creation, and callback reachability without a wallet cookie.
These are local regression checks, not a real NICE payment test or full Linux suite.
No production API deployment, database mutation, merchant key change, or live
payment activation was performed for this follow-up. The prior merchant/test
eligibility, backup, and Linux CI blockers remain unresolved.
