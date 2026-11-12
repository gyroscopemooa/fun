# NICE review submission status

Reviewer entry: https://feat-nicepay-test-adapter.fun-7hn.pages.dev/credits/
Direct-payment module: https://feat-nicepay-test-adapter.fun-7hn.pages.dev/payment-review/

These are publicly accessible branch previews, not the manytool.net production release. The credits page links to the module review and explicitly distinguishes direct-payment MID from the pending topup MID. No approval or credit delivery runs in the review function. Its 1,000 KRW amount is diagnostic, not a product price. Prices, service period, topup MID, product credit costs and the use-path PPT remain incomplete.

Google sign-in was verified against the isolated local wallet. The production API still needs existing-balance preservation and storage verification before rollout. A public preview of the storefront must not be described as a successful public Google-wallet deployment.

Proposed reply text (not sent):

안녕하세요. 매니툴 NICE 결제창 연결 확인 경로를 준비했습니다.
- 크레딧 안내: https://feat-nicepay-test-adapter.fun-7hn.pages.dev/credits/
- 직접결제 결제창 확인: https://feat-nicepay-test-adapter.fun-7hn.pages.dev/payment-review/
현재는 실제 승인·충전·크레딧 지급을 차단한 연동 확인 상태입니다. 결제창의 1,000원은 연결 확인용이며 판매 가격은 미정입니다. 크레딧 충전 전용 MID는 발급 안내 대기 중이며 직접결제 MID를 충전에 사용하지 않았습니다. 가격·제공기간·상품 사용 경로 자료를 보완할 예정입니다. 이 단계에서 결제창 연동 확인이 가능한지, 심사 진행 전 추가로 필요한 항목을 안내 부탁드립니다.

Send only after user authorizes the reply; do not claim full review readiness or attach fabricated successful credit flows.

## Product-level module connection

Actual product pages AI calorie analysis, AI image generation and AI pet translator now POST a server-allowlisted product identifier into the review-only order summary. The summary displays the product, existing service period, undecided sale price and diagnostic amount before opening NICE. Arbitrary client product names/prices are ignored. Calorie/image products provide one result after payment verification and processing, as already stated in terms; the pet pass lasts 30 days from payment with no auto-renewal. No approval or delivery occurs.

The PPT remains a disclosure draft while the topup MID, actual topup completion and credit-to-product usage screens are unavailable. This cannot be reported as completed point-topup review evidence.
