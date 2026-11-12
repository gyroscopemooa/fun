# Production NICE review-only rollout

Public entry: https://manytool.net/payment-review/
Product paths: /ai-calorie-calculator/, /ai-image-generator/, /ai-pet-translator/.
Credit status: https://manytool.net/credits/.

Only storefront, server-allowlisted review product metadata and a Cloudflare Pages function with no approval transport/DB/fulfillment were brought onto current main. Existing API and storage were not changed. Production review origin is exactly https://manytool.net; merchant key is configured as an encrypted runtime Secret, never in this repository. Prices remain undecided. The 1,000 KRW diagnostic amount is not a sale price. All callback and approval paths return 409 without payment processing.

Google sign-in was verified locally on the separate development branch; production API Google login and credit topup remain pending. The topup MID must not reuse the direct-payment MID. Point-topup usage PPT is a draft until real completion and usage evidence is available.

Render service root directory is node-api; changes outside that directory do not trigger its automatic deployment. This release contains no node-api changes.
