# Android Google Play 크레딧 개발 상태

## 이번에 구현한 코드

- Billing Library 8.0.0 `PlayCreditBilling`: 서버 카탈로그에 허용된 일회성 상품 조회, Google이 반환한 현지 가격 표시, 명시적 버튼에서만 구매창 실행.
- 구매 시 서버 발급 HMAC 계정 바인딩을 `setObfuscatedAccountId`에 지정. 대기 결제는 적립하지 않고, 구매 완료는 서버 검증에 전달.
- 기존 구매 복원, 검증 네트워크 실패 재시도, 중복 콜백 억제. 서버가 적립과 consume을 담당하며 앱이 성공 응답만으로 로컬 잔액을 임의 증가시키지 않음.
- `PlayCreditHttpBackend`: 같은 1차 계정의 인증 세션을 공급받는 HTTPS API 어댑터. 고정 API origin, 리디렉션 금지, 응답 크기/타임아웃, 계정 변경 감지. 토큰과 쿠키를 파일이나 로그에 쓰지 않음.
- `PlayCreditsPanel`: 네이티브 상품/가격/복원 화면. 현재 MainActivity에는 연결하지 않았음.
- 구매 준비 해제 시 기존 버튼·카탈로그를 즉시 비우고 오래된 비동기 응답을 무시. 과거 상품의 미완료 구매는 서버의 영구 영수증을 기준으로 복구 가능.

## 아직 안 된 것

**이 코드는 실제 결제 가능한 앱이 아닙니다.** 앱의 안전한 계정 로그인/세션 인계가 연결되지 않았으므로 MainActivity는 `CreditReadiness=false`를 유지하고 구매창을 열지 않습니다. 기존 웹뷰에서 결제창을 열거나, 구매 토큰·세션을 JavaScript에 전달하는 방식으로 임시 활성화하면 안 됩니다.

- 안전한 앱 로그인 및 계정 변경/로그아웃 수명주기 연결
- 앱 전용 유료 도구 카탈로그 및 웹 결제 UI 제거, 도구 소비 API 연결
- Play Console 앱/상품, Google API 권한·비밀정보·지속 DB 설정
- Voided Purchases 원장 정산의 실제 Google 테스트 (polling·차감 회수·소비 재시도 코드는 구현, RTDN 미구현)
- 실제 Play 내부 테스트 구매, 구매 대기·취소·중복·재설치·오프라인·계정 변경·환불 검증
- release APK/AAB 서명·설치 및 실기기 검증, 심사 자료 (debug APK 빌드 완료)

`PLAY_REFUND_RECONCILIATION_READY=true`는 구현을 대신하는 설정이 아닙니다. 실제 Google 환불·복구 흐름을 검증하기 전 켜지 마세요.

## 앱 웹뷰 결제 정책 (2026-11-17)

앱 UA(`ManytoolAndroidDev`)에서는 `public/payment-choices.js`(나이스페이 결제창)와 `public/credit-checkout.js`(개별구매 선택)가 개별결제·웹 PG·Polar 충전 링크를 노출하지 않고 크레딧 전용 안내만 보여준다. 실제 크레딧 사용·Play 충전은 위 "아직 안 된 것"(앱 로그인 인계 등) 완료 후 연결한다. 웹 사용자 흐름은 변경 없음.

## 구현 추가 (2026-11-17)

- 서버 `node-api/src/credits/play.js`: `GET /credits/play/catalog`, `POST /credits/play/verify`. 상품ID→크레딧은 서버 환경변수(`PLAY_PRODUCT_CREDITS_10/50/300`)로만 결정, 구매 토큰당 1회 적립, 계정 HMAC 바인딩·상품·수량 검증 후 consume. Voided Purchases 폴링(`PLAY_REFUND_RECONCILIATION_READY=true`일 때만)으로 환불 회수. 테스트 `play.test.js`는 Google API 대역 사용.
- 앱 `AppAccount`: 네이티브 Google 로그인(Credential Manager) → 기존 `/credits/google/*` 서버 흐름. 세션은 메모리에만 보관.
- `MainActivity`: 브리지 `openCredits`로 네이티브 크레딧 화면(`PlayCreditsPanel`)을 연다. 토큰·계정 정보는 JS로 전달하지 않는다. `CreditReadiness.PURCHASES_ENABLED=false`인 동안은 "준비 중" 안내만 나온다.
- 검증: 서버 테스트 24개 통과, Java 정책 테스트 통과, `assembleDebug`·`lintDebug` 통과. 실기기·Play 구매는 미검증.

### 켜기 전 사용자가 해야 할 일

1. Play Console에 앱 등록과 소모성 상품 3개(10/50/300 크레딧) 생성 → 상품 ID를 `PLAY_PRODUCT_CREDITS_*`에 설정.
2. Google Cloud: Android OAuth 클라이언트(패키지 `net.manytool.app` + 서명 SHA-1) 등록, 웹 클라이언트 ID는 `GOOGLE_CREDIT_CLIENT_ID`. Play Console API 접근에 서비스 계정을 연결하고 JSON을 `PLAY_SERVICE_ACCOUNT_JSON`에, 32자 이상 비밀값을 `PLAY_ACCOUNT_BINDING_SECRET`에 설정.
3. 내부 테스트 트랙에서 구매·대기·취소·환불·재설치를 확인한 뒤 `PLAY_BILLING_ENABLED=true`, `CREDITS_ENABLED`/`CREDITS_TOOLS_READY=true`, 앱 `CreditReadiness.PURCHASES_ENABLED=true`로 전환.
4. 앱에서 도구가 실제로 크레딧을 차감하려면 웹 도구의 `manytoolCreditCheckout`이 앱 세션 쿠키 없이도 동작하도록 하는 후속 작업이 필요(현재 웹뷰는 별도 쿠키 사용).

## 가격과 새 도구

나이스페이 웹 PG 승인과 Google Play 결제 개발은 독립입니다. 그러나 Play 출시에는 위 작업이 추가로 필요하므로 **가격만 정하면 출시되는 상태는 아닙니다**.

Play 상품 가격은 Play Console에서 설정하고 앱은 ProductDetails의 formattedPrice만 보여줍니다. 서버는 상품 ID→크레딧 양을 결정합니다. 이번 작업은 임의 가격이나 실제 상품을 만들지 않았습니다. 새 도구가 같은 지갑을 사용한다면 보통 웹/서버 도구와 차감량을 추가하면 되지만 새 기기 권한·네이티브 API는 앱 업데이트가 필요합니다.

## 검증 방법

- `node --test node-api/src/credits/*.test.js` (저장소 루트, Node 24)
- `mobile/android/test-policy.sh`
- `javac -d <out> app/src/main/java/net/manytool/app/PlayCreditPolicy.java tests/PlayPolicyTest.java` 후 `java -cp <out> PlayPolicyTest`
- `gradle :app:assembleDebug :app:lintDebug` 및 Android 실기기/Play 내부 테스트

debug APK Gradle 패키징·서명 검증과 lint(오류 0)를 완료했습니다. 실제 기기 실행과 Play 구매 검증은 하지 않았습니다.
