# ManyTool public review handoff — 2026-11-13

## Verified public flow

- Entry: https://manytool.net/credits/ (public test link)
- Google + credit simulation: https://manytool.net/credit-review/
- Actual Google sign-in succeeded on the public origin; test balance 0 -> simulated topup 10 -> sample use 2 -> remaining 8. Reload retained 8. Completed actions are disabled.
- Direct product review: https://manytool.net/payment-review/ and actual calorie/image/pet product pages -> server-owned order summary -> official NICE card selection.
- Six automated tests passed covering Google binding/invalid token/Origin/session tampering/demo balances, alongside NICE review approval blocking.
- Production implementation commit: 2bd4b38 (main), deployed and HTTP/UI verified.

## Actual vs simulated

Google authentication and NICE card-window display are real. Credit topup/use are publicly accessible simulation with a signed 1-hour isolated browser cookie; no real-money payment, production credit ledger, paid AI or production entitlement was created. The simulation cannot prove actual NICE approval. The dedicated topup MID and approved test procedure are still required for that. Existing wallet balances/API were untouched. Actual NICE approval/callback/fulfillment remain blocked (409).

## PPT

Final updated file: C:/3.manytool/output/nicepay-review/Manytool-NICE-public-credit-review-20261113.pptx
Validation receipt: C:/3.manytool/.codex-nice-review/public-credit-validation.json
10 slides. Direct-product evidence captured 2026-11-12; public Google/demo evidence captured 2026-11-13. Local credit screenshots were replaced. It is a public-review intermediate deck, not proof of an actual topup approval. No email sent or review submitted.

## Still pending

Topup MID/contract conditions and test credentials; actual topup approval/cancellation; commercial price and tool credit costs; actual paid-tool execution and durable production-wallet rollout. Google was verified with the registered owner test account; access for unregistered external reviewer accounts has not been independently verified.

## Price administration follow-up

Existing development code already calculates trusted server prices and snapshots NICE intent/amount into orders. It does not yet provide the requested administrator price editor, versioned publication workflow or full price-change audit UI. Historic pricing constants in the disabled development credit code are not newly approved commercial prices. Do not activate those defaults. Separate direct product price, topup quantity/price and tool-credit costs. Real-price admin rollout still requires durable storage, authentication and audit validation and must preserve historical order/refund snapshots.

## Intermediate mail text — not sent

안녕하세요. 매니툴 NICE 연동 진행 상황 공유드립니다.
정식 사이트 https://manytool.net/payment-review/ 에서 실제 상품과 제공기간을 확인하고 NICE 카드 선택 창까지 연결할 수 있습니다.
크레딧 경로는 https://manytool.net/credit-review/ 에서 Google 로그인 후 모의 충전·샘플 사용·잔액 변화를 확인할 수 있도록 준비했습니다. 해당 화면의 크레딧은 심사용 임시 테스트 상태이며 실제 NICE 승인이나 유료 상품 지급은 아닙니다.
판매 가격은 미정이며 실제 결제 승인은 차단했습니다. 직접결제 창의 1,000원은 연결 확인용 표시액입니다. 충전 전용 MID 및 허용되는 테스트 조건 안내를 부탁드립니다.
첨부 자료는 실제 공개 화면과 모의 검증을 구분한 중간 확인 자료입니다. 현재 경로로 사전 확인이 가능한지와 최종 보완에 필요한 사항을 안내 부탁드립니다. 감사합니다.
