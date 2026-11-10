# Google Play credit backend (development, disabled)

No NICE approval is needed to develop Google Play Billing. This does not waive Google Play account, product, policy, testing and review requirements.

## Implemented

- Authenticated `GET /credits/play/catalog`: `{enabled, recoveryAvailable, accountBinding, products:[{productId,credits}]}`. Native client uses `accountBinding` with BillingFlowParams.setObfuscatedAccountId. Prices must come from Play ProductDetails, never from the credit catalog.
- Authenticated `POST /credits/play/verify`: `{productId,purchaseToken}`; same-origin header is mandatory alongside the existing HttpOnly wallet session cookie. Response `{credited,consumptionPending,balance}`. Do not expose cookies or purchase tokens through a generic WebView JavaScript bridge. The secure native-session adapter is not completed by this backend work.
- Google Android Publisher product purchase lookup scoped by server-configured package and allowed product. Settled, single-quantity purchase and exact obfuscated user binding are mandatory. Pending/cancelled, unknown/mismatched/previously consumed unrecorded purchases cannot grant credits.
- Transactional SQLite receipt + top-up lot + ledger grant, deduplicated by SHA-256 token hash and Google order ID. Plaintext purchase tokens are never persisted or logged by this module. An AES-256-GCM encrypted token job is committed in the same transaction as the grant. Server consumes after the durable grant; a failed consume returns `consumptionPending:true`. A one-minute background worker retries independently of the client and product catalog, with bounded exponential backoff up to one hour. Success or void deletes the ciphertext. Database restart preserves pending jobs.
- Existing shared wallet allocation works with Play lots. Play top-ups are marked currency `play` and amount `0` as an internal unknown-price sentinel, NOT as a free purchase. The history API returns provider `google_play` and amount `null`; the web history labels the purchase as Google Play and does not format it as 0 KRW. Exact localized receipt price must be obtained through authorized Play financial records if required.
- Play lots cannot use the Polar/web refund calculator or refund request path. Google Play refunds/revocations use their own Voided Purchases reconciliation.

## Configuration and release blocks

Defaults remain disabled. `PLAY_CREDITS_ENABLED`, `CREDITS_ENABLED`, `CREDITS_TOOLS_READY`, `PLAY_WORKER_ENABLED`, and `PLAY_REFUND_RECONCILIATION_READY` must all be `true`, with valid package, product map, service-account file, stable binding secret and separate 32-byte AES key (`PLAY_TOKEN_ENCRYPTION_KEY`, 64 lowercase hex characters). `PLAY_REFUND_RECONCILIATION_READY` is a manual launch gate, not proof of production readiness: do not enable it until real Voided Purchases polling, clawback and refund scenarios are verified. Polling is implemented; RTDN is not.

`PLAY_CREDIT_PRODUCTS_JSON` is an object of Play product ID to integer credits. Empty by default. Changing an existing product's grant affects new purchases; keep product semantics stable. Recorded purchases keep their original credit count. The catalog supports up to 20 products. `recoveryAvailable` only requires configured credentials, valid package and binding secret; it is not proof credentials work. With new purchases disabled or products retired, the client may still retry already credited purchases. Recovery always rechecks Google and account binding, never adds a grant, and only completes consumption for an existing matching receipt. Unknown receipts are rejected when new purchases are disabled. Keep credential access, binding secret and package stable while recovery is needed.

The private service-account file uses RSA signed JWT to obtain an Android Publisher access token from Google's fixed OAuth endpoint. Credentials and HMAC secret must be provisioned through an authorized private storage workflow. Access token caches in memory. Never put private material in app bundles, docs or Git.

Before release: wire app authentication safely; confirm app package/product IDs, active consumable products and country prices; configure API access and private persistent database backups; verify refund/revocation reconciliation against Google; review proxy/APM logging so raw purchase-token URLs and bodies are redacted; test licensed accounts on an installed Play track; test pending purchase, cancellation, duplicate delivery, restart, consume retry and refund; validate history display; then enable tools and billing deliberately. A successful build/unit test is not payment readiness.

## Tests

`node --test node-api/src/credits/play.test.js` (Node 24 recommended). Google calls are mocked; no live purchases, consumption or credentials were used.

## Durable recovery and refunds

The worker starts only when explicitly configured. Every minute it polls all pages of Google Voided Purchases before retrying consume jobs. It uses a durable completion timestamp and one-day overlap; a partial/failed page never advances the timestamp. A tombstone prevents a voided token from being granted later. Existing credits are reversed once in the same transaction, including a negative balance when already spent; ordinary tool charging then refuses insufficient balance. Only quantity-one purchases are supported. Other partial-refund quantities stop synchronization for operator review.

New purchases and catalog visibility fail closed if successful synchronization is older than 15 minutes. First startup covers the last 29 days; an existing receipt older than this without a cursor, or a later cursor gap over 29 days, stops synchronization rather than claiming Google's limited history is complete. Resolve such gaps using verified financial records and controlled reconciliation, not by manually advancing the cursor. Periodic jobs log only generic failures/counts, never receipt/token contents. Alert on these failures and stale synchronization before launch.

The encryption key must be provisioned separately from the DB and its backups. Losing or rotating it without re-encrypting pending jobs prevents retry; preserve the old key through controlled migration. Legacy receipts created before this queue existed require client receipt recovery to backfill the token; tokens cannot be reconstructed from hashes. No credentials or keys were created in this development work. Multi-process retries are safe to replay, but the service should run one recovery scheduler per database to avoid duplicate Google requests.

Tests include actual SQLite close/reopen, atomic grant/job failure, retry backoff, authenticated ciphertext, pagination/loop failure, idempotent reversal/debt, pre-grant tombstones, and stale/history-gap launch blocks. These are mocked provider tests, not a production refund test.
