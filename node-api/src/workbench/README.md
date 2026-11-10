# Selected-text AI provider boundary

Implemented and mock-tested server-side OpenAI Responses API requests for explanation, summary, rewrite, reply draft and error explanation. Only explicitly selected text is sent after per-request consent naming OpenAI. There are no tool calls, browsing, images, page URL, cookies or DOM upload. Responses have byte/text limits, a timeout and sanitized errors. `store: false` requests no Responses API storage; this is not a promise of zero provider retention.

## Release status

This module is **not mounted as a production HTTP route**. Web `AI_CAPABILITY` remains false. No credentials, paid price, live AI request or wallet debit were used in development. Image translation and image-table extraction are not implemented here.

`createGatedTextService()` is disabled by default. To integrate it, first provide server-authenticated context and a reviewed durable `creditTransaction` adapter. That adapter must determine prices server-side, enforce the enabled catalog and sufficient balance, atomically bind account + request key to action + content fingerprint, reject conflicting retries, serialize concurrent execution, persist results for replay, and refund/resume provider failures and crashes safely. A boolean environment flag is insufficient. The existing wallet store is not claimed to implement this AI transaction protocol.

Only after that work, expose a same-origin, rate-limited authenticated route with CSRF/origin checks and request body limits. Never derive trustedContext/configuration from the HTTP body. Return output as escaped text, never raw HTML. Show the selected content and provider to the user before each transmission. Validate configured model availability, pricing and live behavior before enabling billing. Do not log request text, provider bodies, credentials or complete response content.

## Tests

`node --test node-api/src/workbench/text-ai.test.js`

Seven offline tests cover supported actions, unsupported image operations, consent/input limits, fixed endpoint and request isolation, failure redaction, bounded response handling, disabled capability, and authenticated idempotency scope. These are not live-provider or wallet-transaction tests.
