# AI image, product model and Photoshop NICE integration

No production routes or prices are changed. No live calls are made by importing or constructing disabled factories.

## Existing semantics preserved

- AI image generator: existing `generateAiImage` modes, OpenAI/xAI provider choice and the existing maximum 50-character sanitized prompt. One final image per paid base order. Most modes retain the two-stage portrait/edit pipeline. OpenAI body mode retains its existing text-to-image path; this integration does not claim that mode uses source-face identity.
- Product model: `modelcut`, which edits the garment upload directly and intentionally skips the portrait stage. It receives distinct server variant rights despite sharing the legacy `base` product key.
- AI Photoshop: the existing page calls the photo API with `toolType: headshot`. It remains in the dedicated portrait/photo runtime with three candidates and bound outfit options. Regression tests execute this mapped path; no new Photoshop provider or entitlement was invented.

## Dedicated immutable checkout

`createNicepayImageStaging` assembles private upload/delete/download, payment checkout/callback/execution, and owner-only job status. Use a dedicated `/image` namespace alongside `/photo`. Never register its base adapter in the generic checkout catalog or overwrite the portrait base adapter.

Supply a base-only direct price catalog separately. `createNicepayImageRightsPolicy` builds a frozen server policy from explicit named variants (tool, mode, provider). The browser selects a known variant, owned photo ID and bounded prompt; it cannot override tool, mode or provider. Immutable image snapshots and portrait snapshots reject binding the same order to both families. Addons remain portrait-only.

Private storage, source retention, output ownership, durable completion, quota preflight/recovery and authenticated delivery are reused. Image generation reserves one output plus working capacity. All photo/image stores sharing a wallet must use **the same private root**; a durable root binding now rejects a second root, preventing one store's cleanup from deleting another store's records. Image snapshot references also protect purchased sources from cleanup/deletion.

## Provider execution and safety boundaries

The opt-in `generateAiImageOnce` bridge uses the existing implementation with per-async-call safeguards: OpenAI SDK retries off, stage-two retries off, body fallback off, bounded request timeout, and inline output required. A timeout or ambiguous provider result never triggers an automatic paid retry. Normal legacy callers retain their existing behavior. The intended multi-stage image pipeline still makes multiple provider requests when its mode requires them; it is not collapsed into a different service.

Outputs are validated and copied from a private temporary workspace into owned raster artifacts, with no public paths returned. Unknown failures remain quarantined. Email delivery was not added or sent; the authenticated private download is the delivery mechanism.

Offline tests cover image/model/Photoshop rights, actual private file lifecycle, shared-base cross-use rejection, signed mocked callback through download, all strict transport retry boundaries and representative OpenAI/xAI pipelines. No real payments, AI calls, production activation or browser QA occurred. The main server must explicitly mount the factory with reviewed variant/catalog values and its existing wallet authenticator; prices remain a separate decision. Passport/headshot legacy named addon semantics remain unimplemented until defined.
