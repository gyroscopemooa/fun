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
