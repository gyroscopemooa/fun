# Production NICE review-only rollout

Public entry: https://manytool.net/payment-review/
Product paths: /ai-calorie-calculator/, /ai-image-generator/, /ai-pet-translator/.
Credit status: https://manytool.net/credits/.

Only storefront, server-allowlisted review product metadata and a Cloudflare Pages function with no approval transport/DB/fulfillment were brought onto current main. Existing API and storage were not changed. Production review origin is exactly https://manytool.net; merchant key is configured as an encrypted runtime Secret, never in this repository. Prices remain undecided. The 1,000 KRW diagnostic amount is not a sale price. All callback and approval paths return 409 without payment processing.

Google sign-in was verified locally on the separate development branch; production API Google login and credit topup remain pending. The topup MID must not reuse the direct-payment MID. Point-topup usage PPT is a draft until real completion and usage evidence is available.

Render service root directory is node-api; changes outside that directory do not trigger its automatic deployment. This release contains no node-api changes.

## Public Google credit review

https://manytool.net/credit-review/ provides a separate public review flow: actual Google Identity Services sign-in, temporary demo balance, simulated topup 10, sample use 2, remaining 8, and visible history. It does not use the production API, real credit ledger, NICE approval, fulfillment, or paid AI. /credits/ links to it. Prices remain undecided. The diagnostic counts are not a commercial catalog.

Authentication uses jose with Google JWKS, RS256 issuer/audience/expiration verification, a nonce challenge tied to an HttpOnly Secure SameSite cookie, and separate HS256 review session cookies. Google subject is the demo identity. CREDIT_REVIEW_SESSION_SECRET is an independent encrypted Cloudflare production Secret. No credentials are stored in code.

State lives only in a signed 1-hour browser-session fixture. It is reset by logout/expiry and has no transferable or redeemable value. It is not a durable financial ledger. Repeated topup/use actions return the same finite fixture state. Replaying an old review cookie can replay a demo state; this cannot grant production value. Do not use this architecture for actual money or entitlements.

Only /challenge, /session, /me, /topup, /use, /logout and /config are supported. No approval, cancellation, refund or live fulfillment route exists. All mutations require exact Origin https://manytool.net. Production API Google wallet deployment remains a separate task, and the topup MID is still required before any actual NICE topup test.

PPT must identify captured public review balances as simulation, not proof of PG approval. Source: Google server ID-token validation guide and jose jwtVerify documentation.

Observed on 2026-11-13: actual Google login completed on https://manytool.net/credit-review/; browser displayed test balance 0, simulated topup to 10, sample use to 8, history and disabled completed buttons. Reload preserved test balance 8. Actual PG approval remains blocked. PPT screenshots now reference this public URL, not localhost.
