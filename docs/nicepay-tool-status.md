# Manytool NICE tool-by-tool integration status

This is a code inventory, not a production-availability or pricing claim. Existing Polar routes and prices are unchanged. Public NICE checkout/return still return 503. There are no live NICE-enabled tools.

## Shared credit path

NICE topup -> verified receipt -> existing wallet/credit lot is implemented and tested with mocked PG. Existing credit purchases can consume these lots in code, but NICE checkout UI, keys, operational activation and real provider validation are not enabled. The existing credit allowlist is base, video_mkv_mp4, ai_name_premium, ai_pet_translator, calorie, ai_personal_color, ai_manseryeok and detail_page_5/7/10/15/20. This common-wallet work is NOT evidence that each direct NICE checkout/tool flow is complete.

## Direct tool status

| Existing paid function | Direct NICE code | Still missing |
| --- | --- | --- |
| AI manseryeok | Opt-in adapter to existing analyzeSaju; input validation + durable execution wrapper | Real AI output/browser tests, approved catalog, public wiring |
| Calorie analysis | Opt-in adapter to analyzeMealCalories; image/goal/locale validation | Actual analysis tests, non-food result/refund UX, public wiring |
| Personal color | Opt-in adapter to analyzePersonalColor; image/notes validation | Actual analysis tests, public wiring |
| Product detail pages 5/7/10/15/20 | Separate fixed-count adapters to generateCommerceDetailPage; count mismatch blocked | Actual output-size/render/export/browser tests, public wiring |
| ID / passport photo, AI Photoshop, headshot family | Shared-credit eligibility under base only; no direct NICE adapter | Candidate choice, persistent files/jobs, photo option rights and output ownership |
| AI image / product-model generation | Shared-credit eligibility under base only; no direct NICE adapter | Provider/mode rights, asynchronous file job/output delivery; base key ambiguity |
| Photo extras add2/add3/add7, passport_addon/headshot_addon | Existing Polar map only, not NICE direct or credit allowlist | Bind addon to owned photo job, exact extra-use allowance and recovery |
| Pet translator 30-day pass | Existing common-credit purchase support; no direct NICE adapter | Preserve 30-day access, daily limits, voice/text entitlement and renewal rules, not a one-use job |
| Name premium | Existing common-credit support; no direct NICE adapter | Preserve input-locked analysis + recommendation bundle, not a one-use response |
| MP4 conversion | Existing common-credit support; no direct NICE adapter | Upload ownership, asynchronous conversion job, durable completion/download and failure recovery |
| Donation | Existing Polar product; no NICE integration | Separate approved merchant category and non-tool receipt flow |

Opt-in image analysis/detail adapters currently accept single-frame PNG/JPEG/WebP images up to 550 KB each and 16 million pixels; detail page supports up to 30 images. The staging execution JSON limit is 24 MB. This is a deliberately bounded staging interface, not a promise to match every existing upload limit. Inputs are validated before entitlement consumption. Real user uploads/AI calls were not used in tests.

## Payment/recovery boundaries

- Receipt, wallet grant, replay safety and full unused-refund hold have offline tests.
- Inquiry status alone lacks amount proof and cannot grant credits.
- Full unused refunds are implemented as internal functions. Partial/used-credit exceptions and public refund flow remain incomplete.
- Direct adapter outputs have a 64 KB durable JSON result limit; large artifacts require private artifact storage integration.
- No Supabase login changes, live payments, paid AI calls or production deployment were performed.

## MP4 / donation implementation update

The separate `nicepay-video.js` service now implements private owner-bound upload registration, one-order asynchronous conversion jobs, remux then H.264/AAC fallback, private owner-checked downloads and persistent job status. Known conversion failure restores allowance with a three-attempt ceiling; interrupted jobs enter review rather than running automatically. Real local ffmpeg converted a synthetic 32×32 MKV fixture in tests, with no external service or charge. This service is opt-in and **not mounted in the public server**. Secure multipart-upload/controller wiring, resource quotas, restart queue operation and deployed end-to-end validation remain required. Existing public legacy video URLs are not reused as trusted owner-bound uploads.

Donation is now a distinct policy category requiring its own merchant approval, not inherited from direct/tool approval. It stores a verified fulfillment receipt without wallet credit or tool entitlement, supports the internal full-refund path, and does not claim tax-deductible charitable status. Only a trusted server catalog supplies amounts; no live donation price or existing Polar behavior changed. Public donation checkout remains disabled.

## Combined photo/pet/name modules

Photo `nicepay-photo-adapters.js` and pet/name `nicepay-bundle-access.js` are now included in the combined branch. They are **disabled internal integration boundaries, not completed live adapters**.

- Photo base/add2/add3/add7 preserve 3/2/3/7 generated candidate allowances and require immutable purchase options plus privately owned input/output artifacts. Generator/storage dependencies must still be wired. Unspecified passport/headshot addon policies fail closed.
- Pet keeps the 30-day paid pass, with repeat-request protection. Correction to earlier quota shorthand: the repository's five-per-day token quota is not applied to the existing paid-order/session path. No new paid-pass daily cap is introduced.
- Name preserves an input-locked analysis/recommendation bundle; actual dataset/report/options runners remain to be connected.
- Public routes, Supabase account mapping, browser/real provider validation and live activation remain unresolved. Passing the combined offline suite is not evidence that the public site supports NICE checkout for these tools.

Video recovery review correction: the stale threshold is 65 minutes, beyond the default copy+fallback pipeline's two 30-minute timeouts. Completion checks the state-update result; a job already quarantined retains its output for reconciliation and does not silently return its entitlement. Injected conversion runners must honor the documented per-phase time budget.

## Private MP4 staging HTTP and local recovery update

`nicepay-video-router.js` now implements disabled-by-default authenticated upload, conversion submission, job status and download endpoints. Authentication and same-origin checks run before multipart parsing; files have server-generated names and restricted permissions, filename extension and size are bounded (media bytes are interpreted only during FFmpeg conversion), public-storage roots are rejected and download access checks the owner. The router is **not mounted in server.js**. Tests exercise HTTP upload through private download using a synthetic file and fake conversion, including missing authentication, wrong Origin, oversized input and another user's access.

`runNicepayLocalRecovery` provides an explicit no-network maintenance pass for stale approvals, pending wallet fulfillment, refund holds and tool execution states (optionally video jobs). It requires the same persistent wallet/order file and does not schedule itself or trigger a payment/refund request. Production scheduling, upload storage quotas/rate limits/retention, disk/resource isolation, and abandoned-artifact cleanup still need deployment-specific implementation and review. No hosted UI or production site was updated.


## Upload quota/entitlement review correction

MP4 uploads now require a ready owned `video_mkv_mp4` entitlement via `X-Manytool-Order` before multipart parsing. Each upload reserves the maximum file bytes atomically; default limits are two retained orders/uploads per owner, six upload attempts/hour, 3 GiB input bytes per owner and 20 GiB globally, plus globally bounded retained output slots. Conversion requires the exact order bound to that reservation. Owners can remove completed/failed input/output artifacts; active/uncertain jobs cannot be removed. Removed reservations retain rate-limit history. An explicit cleanup method identifies abandoned reservations older than one hour and unused/terminal uploads older than one day; deployment must schedule it. Uploads have a ten-minute request timeout.

FFmpeg is restricted to one codec thread and a 2 GiB output cap per job; outputs near the cap are rejected rather than reported as complete. These application safeguards do not replace OS/container CPU/memory/disk isolation. Public mounting, cleanup scheduling and load tests remain disabled/pending.
