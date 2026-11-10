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

## Authenticated staging delivery and storage operations

`createNicepayBundleRouter` is a separate, unmounted default-off Express router. Its trusted `authenticate(req)` dependency determines the owner; body-supplied owner/runner/paths are ignored. Every endpoint requires the configured exact HTTPS Origin. Authentication runs before JSON body parsing. Staging routes cover pass status, pet execution, name analysis/recommendation, private audio download and owner-requested deletion. Audio input is canonical base64 up to 10 MB with server-selected filenames; JSON is capped at 15 MB for pet and 8 KB for name. Responses are no-store/nosniff. No public server route or checkout was activated.

Artifact storage defaults to 200 MB per owner and 1 GB total, configurable through trusted server configuration. Each command reserves its maximum 20 MB output space transactionally **before** entitlement claim/provider work; quota failure does not consume the request. Completed artifacts and outstanding reservations both count toward capacity. These are storage safety limits, not a new daily paid-use allowance. Owner-requested deletion frees storage without granting another payment entitlement; cached request IDs never regenerate deleted output automatically.

Retention is a read-only inventory of artifacts whose order has no recent/running execution. Successful output is never automatically expired or deleted: a retention duration changing users' download rights needs a separately approved policy. Crash recovery quarantines runs older than 30 minutes and rejects late completion from reviving them. It does not retry paid work or release crashed reservations, since the provider may still be running. Manual reconciliation of those cases is still required. No recovery/admin endpoint is exposed to customers.

## Existing-pass customer forms

`createNicepayBundleCustomer` exports a separate, default-off, authenticated customer page for `/customer-bundles`, with its API sibling at `/bundles`. It supports existing paid orders and explicit approved-catalog customer checkout preparation. The assembly must mount it only under its explicit customer flag. Pet controls cover pass expiry, animal/mode, text or audio file, result, playback and private download. Name controls cover locked identity and independent analysis/recommendation with options. No price or allowance defaults are introduced.

The client persists an unfinished request and stable request ID in tab-scoped storage before sending. Reload only offers same-request retry; it never starts a paid operation automatically. Repeated clicks are blocked while processing. Completed name identity is retained locally, while server enforcement remains authoritative. Browser storage capacity can be smaller than the 10 MB API upload maximum: if a recording cannot be safely retained for retry, the client refuses to start work and asks for a smaller file. Actual microphone recording is not included; existing audio files are supported.

Offline mocked client tests cover dropped response/reload/replay, double clicks, input lock across name operations, storage failure and authenticated page access. They are not visual/browser layout QA or live provider/payment validation. Customer checkout lists only explicitly configured direct pet/name products, with server-owned amounts and no price defaults. Stable owner-scoped purchase keys and a fixed entitlement descriptor hash deduplicate order creation. The customer preview checks owner, catalog product, merchant, state and expiry; operator privileges are not needed. Provider callbacks remain on the existing verified payment route. A polished dedicated customer return page and real browser/provider validation remain unfinished.

### Customer correction and new-purchase lifecycle

Known validation/expired-pass/identity-mismatch errors are editable only if the authenticated order has no execution for that request ID and no running/uncertain work. The client then clears only the unstarted request and unlocks correction. Provider errors cannot obtain that treatment after an execution row exists, even if they mimic a validation error.

An explicit confirmed new-purchase button is available after the server verifies an expired, still-unapproved checkout; an expired verified pet pass; or a verified name bundle already locked to an identity. Refund holds, approving/uncertain payments and running/uncertain tool work cannot reset purchase keys. A durable reset mapping returns the same next key across concurrent requests or lost responses. The browser keeps the old key on uncertainty, retains prior order numbers for retrieval, and never deletes prior entitlements or identity locks. New preparation/payment still requires separate user clicks.
