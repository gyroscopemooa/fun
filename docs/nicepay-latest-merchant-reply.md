# NICE merchant reply recheck — 2026-11-13

## Latest reply superseding the issuance-pending status below

NICE message `1a1d42965856d56a`, received 2026-11-13 18:06 KST, was independently read through Gmail. Manytool direct MID is `000000002m`; point-topup MID is now issued as `000000004m`. The issuer explicitly states that offering point topups and direct purchases on the same website does not permit overseas payments, even with distinct MIDs. MID issuance is not proof of card review approval, merchant activation or no-charge test authority. Key and settlement views still require the corresponding MID account; no authentication information is recorded here.

The user previously requested direct-payment priority with continued point-topup development. A new launch-scope question is pending after this explicit overseas restriction; no credit activation or foreign-card capability should be inferred. Public credit operation remains disabled. Verify the newly issued merchant account, contract and permitted testing before configuring its key or routing topups. The UI/key binding tool for Whale remains unavailable; other services' Chrome/Edge sessions must not be substituted.

Public frontend deployment `8f09aaf` was verified on manytool.net: the image product loads `/payment-choices.js`, the script exposes the choice dialog, and payment-review displays the provisional KRW 100,000 diagnostic amount. This is HTTP/script verification, not a successful real transaction or native Whale screenshot check. Backend/result-recovery changes `c39264f` remain on the NICE branch and are not deployed by that frontend release. Existing PPT captures are historical and do not show this amount or an actual credit payment.

## Earlier reply and earlier live recheck

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
