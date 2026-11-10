# NICE pet/name bundle preparation (disabled)

`node-api/src/payments/nicepay-bundle-access.js` provides an opt-in internal entitlement coordinator, not public checkout or completed tool integration. It is deliberately separate from `executeNicepayTool`, whose single-use model cannot represent these products. No price, catalog, production route, login, or existing Polar/credit entitlement changes are made.

## Preserved rights

- Pet pass: 30 days from the durable verified-receipt timestamp, never first use or repeated login; no automatic renewal. Text and audio input and both analysis/command modes remain eligible. Each new purchase has its own period; no invented stacking rule.
- Existing `server.js` paid-session path bypasses token quota checks. The five/day and five-second cooldown checks belong to the fallback token path only. This coordinator therefore does **not** impose those token restrictions on paid passes. This is a repository finding, not verification of live deployed configuration.
- Name premium: analysis and recommendation are separate executions within one input-locked entitlement. A later operation cannot change the locked identity, and runners receive only that identity rather than a conflicting second surname/name payload.

## Safety properties

- Verified receipt, matching transaction, owner, product and entitlement status checked on every call.
- Refund-held and refunded entitlements cannot execute. First execution changes the entitlement to claimed, preventing the existing unused-only full refund path from refunding consumed access.
- Stable request IDs, input fingerprints, persisted results, durable identity locks and serialized claims prevent duplicate/replayed work. Unknown failures or a crashed running operation block further execution until explicit reconciliation; they do not automatically retry a paid provider.
- Default-off factory returns no methods. Callers must explicitly inject a private credit store and trusted runner. No runner or paid provider runs in the tests.

## Still missing before activation

Public checkout and authenticated route wiring, real paid provider tests, paid-plan quota policy review, production receipt-time reconciliation, explicit stale-operation recovery tooling and renewal UI remain unimplemented. Owner identity and clock come from trusted server context, never browser JSON. Existing email delivery is not triggered by these internal runners.

## Actual internal runners

`nicepay-bundle-runners.js` connects pet execution to the existing `analyzePetAudio` implementation (lazy import). Command audio is persisted as private SQLite blobs, up to 20 MB each, with random artifact IDs and SHA-256 integrity checks; bounded result metadata references the artifact. Retrieval verifies owner, product, order/entitlement state and a completed execution containing that artifact ID. No public file path or URL is produced. Operational storage quotas/retention and authenticated HTTP delivery must be added before activation.

Name execution uses the real existing CSV dataset, five-grid score/report and recommendation functions. Recommendation count (1–20) and given-name length (1–2) are fingerprinted per request without changing the identity lock. Offline tests exercise the actual dataset and both operations. Pet tests use injected fake output only; they verify persistence, replay, ownership and invalid-output quarantine, not provider quality.

Run isolated offline tests: `node --test node-api/src/payments/nicepay-bundle-access.test.js`.
