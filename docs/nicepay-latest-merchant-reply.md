# NICE merchant reply recheck — 2026-11-13

Source: NICE message 1a1cf2667594427b received 2026-11-12 18:44 KST, thread 1a1bf400ea768576. No credentials are included in this record.

NICE explicitly confirmed the Manytool direct-payment module was visible/connected. This is not approval of the merchant review, production approvals, or overseas cards. It said the point-topup MID would be separately announced after issuance; no later issuance message was found in the current search. It also reiterated that a point-topup business on the website restricts overseas payments and recurring billing, and that point topups require a separate operation scope.

The reply requires terms to say that card cancellations are processed back to the original card and an example of 2–3 business days for reflection. The site wording now states that the actual reflection time can vary by issuer and transaction state. Historical purchase/refund terms are preserved; new commercial prices remain undecided.

An earlier outbound merchant reply already supplied direct-payment module URLs. Do not resend mail automatically. A later outbound message asks for merchant-admin consolidation and clarifications; it is not proof of a NICE response or additional MID issuance.

User decision: prioritize direct purchases and continue domestic-card point-topup development in parallel. Do not treat this as approval of overseas cards: NICE's current response restricts overseas payments when point topups are present, and the separate-MID coexistence question remains unanswered. Commercial prices remain undecided. Actual money tests still need the user to approve the exact amount and method. No charge or production payment activation has been performed.

## Live recheck on 2026-11-13

- Public credit-review and refund-policy pages return HTTP 200.
- Production API `/credits/config` returns `enabled:false`, all packs unavailable and no configured tools. Its historical numeric defaults are not approved commercial prices.
- Production API `/payments/nicepay/config` returns HTTP 404. The prepared NICE backend has not been rolled out to production; public payment-window integration does not imply that backend deployment.
- Existing public-flow tests: 6 passed. Existing approval, callback, cancellation and recovery regression tests: 52 passed, with no external payment calls. These do not prove a real NICE approval or refund.
- The latest matching inbound NICE email remains the November 12 reply cited above; no subsequent topup MID issuance notice was found.
- Whale has the NICE dashboard open and the user reports login complete. Native UI binding fails with `window id 30936538 no longer belongs to Naver_Whale; current owner is Naver_Whale`, including after resetting the tool. Merchant identity, newly issued MIDs and current review status could not be re-read. Other-service Chrome/Edge sessions were not reused.
- Do not redeploy the existing Render API until its current wallet/order storage has a verified backup and durable storage plan. Do not replace it with an empty database or enable historic default prices.
