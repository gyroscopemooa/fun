# Google credit login

Uses Google Identity Services and google-auth-library verifyIdToken. Only the verified Google-authoritative email is used to access an existing wallet; Google subject and basic profile are not persisted. Non-Gmail addresses without a verified hosted domain use the existing email link flow. No wallet migration or balance change is required.

Server environment: GOOGLE_CREDIT_CLIENT_ID=265717233884-lna24m7pac95087fc3rhv1ijdc2ga69h.apps.googleusercontent.com (public identifier, no client secret required by this ID-token flow).

Local PowerShell:

    $env:GOOGLE_CREDIT_CLIENT_ID='265717233884-lna24m7pac95087fc3rhv1ijdc2ga69h.apps.googleusercontent.com'
    npm run dev:wallet --prefix node-api

Open http://127.0.0.1:4321/credits/. This uses an in-memory local wallet, not production balances. Payments remain disabled. Google app is in testing; registered test account must complete consent. Real login completion must be observed before reporting end-to-end success.

Registered JavaScript origins: https://manytool.net, https://feat-nicepay-test-adapter.fun-7hn.pages.dev, http://127.0.0.1:4321, http://localhost:4321. The local launcher itself uses 127.0.0.1 consistently. Google configuration propagation may take time.

Authentication rejects a wrong Origin, incorrect/expired/reused nonce, invalid signature/audience/issuer/expiry, unverified email and non-authoritative external email. Sessions reuse the existing HttpOnly credit cookie. Credit prices remain undecided on the storefront. Existing historic purchase and refund calculations are preserved.

Validation: 17 tests passed (Google session safety plus existing credit suite). Production API rollout remains pending verification of durable storage and existing balances; do not replace an existing wallet with an empty store. Existing API dependencies have audit findings unrelated to google-auth-library and require a separate patch review before production rollout.

## Observed local Google sign-in

2026-11-12: user completed the real Google account consent flow. Browser displayed successful Google login, account email, local wallet balance 0 and empty history. This verifies actual Google ID-token validation and issuance of the existing wallet session. Only the isolated in-memory local wallet was used; no production balances, payment approvals or database migration occurred. Production API deployment and public Google app launch remain pending.
