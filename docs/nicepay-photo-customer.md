# Photo/image customer staging forms

`createNicepayPhotoCustomer` is an independently default-off Express router. It does not change existing pages, prices, payment providers, or production routing. The main staging assembler supplies existing wallet authentication, the same persistent order/wallet database, reviewed `photo`/`image` runtimes and catalogs, and explicit display choices.

Each server-owned choice has `id`, `label`, `group` (`photo` or `image`), `productId`, an immutable checkout `input` template, optional `allowPrompt`, and `needsParent` for add2/add3/add7. Templates cannot supply a source ID, prompt or parent order. Those inputs are validated against the authenticated owner and then passed through the existing trusted checkout rights resolver. No tool/provider/style rights or prices are inferred by the form.

## Customer flow

- Choose an approved service, upload one private PNG/JPEG/WebP (20 MB maximum), optionally enter the existing bounded prompt, and prepare checkout.
- For photo addons, enter an owned completed base order. The original source is resolved server-side; a second upload cannot replace it.
- Display the server catalog amount, then open payment only through a separate user-clicked link. Preparation does not call the PG or AI provider.
- Explicitly check payment status, then click generation. Inputs used for execution come from the persisted purchase, not the new request body.
- Open a generated candidate and save the private image. Image bytes use authenticated no-store endpoints, never public paths.
- Reload or return via the authenticated recent-order list to recover status/results. The browser remembers only preparation metadata/order IDs in session storage, not uploaded image bytes.
- Cancel only an unpaid created request. Paid/refund handling is not silently mapped to that cancellation action.

Order preparation has a persistent request key and a separate binding state. Repeated or concurrent requests cannot create another order for the same input/key. A dropped response can be retried with that same key. An unresolved binding never exposes a payment link. A rejected binding abandons the unpaid order before allowing an editable retry. Unknown errors do not silently rotate request keys or start another payment. Paid work is never initiated on load/resume/status checks.

## Verification

Node HTTP regressions cover authenticated form delivery, same-key/concurrent order replay, unchanged prices, payment/immutable-input execution, one generation on replay, private downloads, status recovery, unpaid cancellation, and photo addon parent ownership. Client JavaScript syntax and safe rendering patterns are checked.

A separate Playwright test covers reload, repeated clicks, cross-session-storage resume through a recent-order link, preview/download and cancel/error recovery. Run `PHOTO_BROWSER_TEST=1 node --test node-api/src/payments/nicepay-photo-customer.test.js` on a browser-capable environment. This environment refused Chromium startup with `socket() failed: Operation not permitted`, including the reviewed escalated attempt, so visual/browser interaction QA has **not passed** here. The default Node run explicitly skips that browser case rather than claiming it ran.

No real payment, paid provider call, public deployment or price change was made. Final mounting in the existing default-off staging assembler remains separate from production activation.
