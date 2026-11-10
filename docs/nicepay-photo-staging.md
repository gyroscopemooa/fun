# Private NICE photo staging integration

No production listener, checkout UI, merchant catalog, pricing or deployment is enabled by this code. Existing Polar paths and ownerless legacy uploads are unchanged and are never imported into the private NICE store.

## Components

- `createPrivatePhotoStorage`: private owner-only directory outside every supplied static root, SQLite ownership and digest records, real raster validation/EXIF removal, bounded files, no public filenames/URLs. The deployment must supply **all** public roots. Newly created source images use fresh opaque IDs. Authenticated upload code must derive owner from the session, not the upload JSON.
- `createPhotoPurchaseSnapshots`: binds a private source to an owned, unexpired, created (unpaid) direct order. Product, tool, provider, styling and addon parent are immutable. The staging checkout calls the adapter's `bindCheckout` before rendering the payable form. Failed binding exposes no form, creates no receipt, and grants no rights; its unused order expires normally.
- `createNicepayPhotoRuntime`: opt-in composition of purchase snapshots, private storage and the existing OpenAI portrait provider. The caller must supply a trusted `resolveCheckoutRights` function that checks selected options against the server catalog. It must not blindly forward the browser body. This policy remains unconfigured because the approved tool/option catalog is not supplied.
- `createPrivatePhotoGenerator`: materializes temporary inputs/outputs under the private storage root, calls the existing generator with the exact purchased count, imports output files to owned durable artifacts, and removes temporary files. A separate explicit `allowPaidGeneration` argument is required for real provider work. Offline tests instead inject a mocked provider. Provider failures and partial results are quarantined by the durable photo adapter; do not automatically resubmit a paid image request.
- `createNicepayPrivatePhotoRouter`: separately opt-in, unmounted authenticated upload/download HTTP endpoints with origin checks, no-store responses, bounded bodies and attachment delivery. It derives ownership from the injected authentication function.
- `runtime.download`: checks authenticated ownership and candidate membership against the completed job before returning bytes. A future authenticated HTTP endpoint must use no-store headers and an attachment content disposition, never expose the storage directory or pass caller-controlled filesystem paths.

## Rights preserved

`base` generates 3 candidates; `add2`, `add3`, and `add7` generate exactly 2, 3, and 7 candidates tied to a completed owned base job with identical source/tool/options. ID photo, passport photo and headshot (the existing AI Photoshop tool's provider type) are supported. The optional generator count leaves existing production calls at their original default of 3.

`passport_addon` and `headshot_addon` remain unavailable: existing source only maps these Polar product IDs and does not establish their allowance or behavior. No semantics or prices were invented.

## Verification boundaries

Offline tests cover actual private files, SQLite reopening, exact count propagation through mocked OpenAI HTTP transport, invalid uploads/ownership/tampering, checkout snapshot timing, rejected options/late binding, addon parent rights, download ownership and provider failure reconciliation. No real user files, live PG requests, paid AI calls, production deploy or browser checkout was exercised. The unmounted HTTP upload/download endpoints and the approved checkout-rights policy still need explicit staging assembly before end-to-end browser testing.

## Quotas, retention, and assembly

`createNicepayPhotoStaging` now assembles `/files/upload`, `/files/delete-source`, `/files/download`, `/payment/checkout`, `/payment/return`, `/payment/execute`, and owned `/jobs/:orderId` under a single **unmounted** router. Disabled construction creates no storage or provider client. Enabled construction requires the same persistent wallet/order database, HTTPS origin, injected verified-account authentication, explicit photo-only catalog, trusted rights resolver and injected payment client. It never starts a listener, selects prices, constructs live PG access, or schedules cleanup.

Storage defaults are safeguards, not purchase terms: 20 MB per file/reservation, 200 MB and 100 live files per owner, 2 GB and 10,000 files globally, and 30 source attempts per hour. Invalid/deleted uploads still count against the hourly limit. Atomic reservations include unfinished writes and generation capacity; a generation reserves all output slots plus input/copy working space before calling the provider. Reservations remain charged until successful deletion. HTTP upload admission limits concurrent body parsing/work to 2 per owner and 8 for this router instance; multi-process ingress must also enforce shared connection/body limits.

Explicit `cleanup()` removes unbound source uploads older than 24 hours and abandoned writing/workspace reservations older than 15 minutes. It does not run automatically. A cleanup claim and checkout snapshot insertion use the same SQLite transaction boundary, so deleted uploads cannot be newly bound. Generated results and sources referenced by any checkout snapshot are retained, including uncertain work, rather than guessing paid-output retention/refund rights. `delete-source` only removes an authenticated owner's unbound source. Deployers must choose an approved paid-output/closed-checkout retention policy separately; storage caps fail closed in the meantime.

A proven storage-capacity refusal before provider invocation restores the entitlement to ready, removes the photo running marker, and preserves the execution-attempt budget. This uses a process-local trusted preflight marker, not provider-supplied error properties. Other photo execution errors remain conservatively quarantined and require reconciliation; do not automatically retry them. Live authentication/browser QA and the actual approved rights/catalog configuration remain outstanding. Automated tests cover the assembled HTTP flow with a signed fixture callback and mocked PG/AI, ownership, concurrent quotas, retention, restart accounting and private file delivery.
