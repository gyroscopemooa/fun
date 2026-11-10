# Direct-login remote-browser experiment (mock only)

This is a **local workflow and isolation prototype** with two stages: an initial fully mocked workflow and a real-Chromium fixture adapter below. Neither is an external-provider login integration or production video downloader. It is not linked into ManyTool's public pages or deployment. It starts from commit d2ab196, separately from the cookies.txt branch; that implementation is not exposed here.

## Initial mock: run and verify

Node 22+; no dependencies, external credentials, environment secrets or network access needed:

```
node --test experiments/remote-login-poc/*.test.mjs
node --check experiments/remote-login-poc/app.js
node experiments/remote-login-poc/server.mjs
```

Open http://127.0.0.1:8789 on the same computer. Start a session, select mock login, enter https://media.example.test/stories/demo-story or https://media.example.test/videos/demo-video, download the clearly labeled test text, then close. Do not enter real credentials. The mock login button only changes isolated in-memory state. The `.test` media host is never requested.

## Initial mock: what is implemented

- A mobile-width-friendly web flow, without cookie-file uploads or password inputs.
- Separate 256-bit owner/session capabilities, owner-bound authorization on every operation, constant-time token checks.
- In-memory mock context per owner; repeat creation discards that owner's old context. Absolute five-minute expiration with periodic deletion, explicit deletion, shutdown deletion, and best-effort pagehide deletion. A browser crash is covered by TTL.
- Loopback-only listener; exact Host and Origin checks; JSON-only mutation endpoint; SameSite Strict HttpOnly browser identity cookie; no CORS; restrictive CSP; no-store responses. HTTP is permitted only for this loopback demo, so the cookie has no Secure attribute. This configuration must never be exposed publicly.
- No disk persistence of session state, no request logging, generic unexpected errors, no arbitrary URL fetch or redirects. Fixed mock URL allowlist, bounded body, capacity and timeout.
- Download is a text artifact marked MOCK ONLY; neither a real video nor proof of upstream access.

Reloading the home page preserves the browser owner identity. Starting a new session in another tab replaces the previous session for that owner; the previous tab then receives an expired-session response. Orphaned contexts expire in five minutes. This is intentionally a development harness, not a multi-tab account identity system. Do not treat the mock owner cookie as a production account login.

## Required next implementation before real accounts

The state machine is reusable, but replacing MockBrowserContext with Playwright alone is **not sufficient**. Build and review these boundaries first:

1. Verified ManyTool user identity and account-bound session ownership. Add CSRF protections, request throttling and per-user/concurrency/resource budgets. Never accept a caller-supplied owner ID as identity.
2. A dedicated ephemeral worker/container per user; an isolated browser context inside each worker; no persistent browser profiles, download directory reuse, traces, screenshots in logs, crash reports or credential instrumentation. Context isolation is not the same as OS/process isolation.
3. A browser display/control channel (e.g. WebRTC/VNC or bounded screenshots plus pointer/keyboard events), authenticated to the same owner, with expiry and revocation. Display the genuine destination origin. Validate coordinates/event size/rate. Avoid arbitrary evaluation or CDP access from clients. No real-login bridge exists in this prototype.
4. Egress enforced outside browser JavaScript: allow only reviewed provider and CDN endpoints, block loopback/private/link-local/metadata networks, validate DNS and redirects at connection time, block unsupported protocols, popups, extensions, service workers and WebRTC escape routes as appropriate. The current mock avoids SSRF by making no requests; it is not an egress firewall for a real browser.
5. User consent for remote processing of login/session data, provider terms review, platform-specific login support and permission checks. Never promise all stories or videos: private access, expiration, DRM, subscription/age gates, account challenges and platform restrictions remain. OAuth offers scoped platform API rights, not general browser session reuse.
6. Use media from the same authorized context; never export session cookies to unrelated services. Streaming/download requests need owner binding and short-lived single-use artifacts, content-type/size limits, safe filenames, download cleanup and cancellation. Verify actual allowed media against a user-authorized test account only after the above is approved.
7. HTTPS/WSS, Secure cookies, restricted trusted reverse proxy configuration, session-key rotation, user-visible logout, worker-kill and temporary-storage deletion on every exit/error path. Audit the hosting/logging pipeline before production. Memory deletion is best-effort language-runtime cleanup, not guaranteed cryptographic zeroization.

## Mobile/app reuse

The future authenticated session API and browser stream/control channel can serve both the web client and a native app. This mock page is responsive, but has no real streaming, mobile keyboard/IME, touch gesture, file-download compatibility or recovery verification. Android Custom Tabs cannot expose Chrome cookies/DOM to the app; ordinary Chrome/Instagram login does not transfer automatically. A native local-browser design would be a separate implementation with different security and provider constraints.

## Verification status

Automated Node tests exercise isolation, unauthorized cross-owner operations, login requirements, replacement, expiry, destruction, capacity, URL rejection, Host/Origin/content-type enforcement, payload limits and an in-process HTTP handler flow. A separate test starts a real loopback HTTP listener and verifies owner reuse, the mock download flow and Origin rejection. These tests do not start a real browser. Visual UI and real browser execution must be reported separately. No deployment, real account login, video download or provider compatibility claim is made.

Initial mock check: 22 tests pass (11 VM-based UI lifecycle regressions, 10 core/handler tests, 1 real loopback HTTP integration). UI tests simulate DOM/event handling and are not visual browser or mobile device tests. No production app files or build configuration were changed.

## Real Chromium fixture adapter (second development stage)

`browser-server.mjs` uses installed Playwright to launch a **separate Chromium process and incognito context for every session**, with Chromium sandbox enabled. It serves a built-in test page through request interception, transmits JPEG screenshots through owner-authorized POST requests, and forwards bounded click coordinates. The web UI polls screenshots once a second and supports pointer/touch clicks. Login state comes from the real fixture DOM/sessionStorage, not the earlier boolean mock. A second session receives a separate browser process. After fixture login, the browser fetches a bundled 761-byte, one-second blue WebM test video from an intercepted same-origin route. The API relays those bytes to the web client for download. This is a real media file but not external-platform media.

Run after normal repository dependency setup and an authorized Chromium installation:

```
POC_CHROMIUM_EXECUTABLE=/usr/bin/chromium node experiments/remote-login-poc/browser-server.mjs
# Open http://127.0.0.1:8790
POC_CHROMIUM_EXECUTABLE=/usr/bin/chromium node experiments/remote-login-poc/browser-smoke.mjs
```

Omit POC_CHROMIUM_EXECUTABLE if the matching Playwright Chromium is already installed. The real smoke script fails instead of silently skipping if Chromium cannot start.

### Explicit restrictions

- No general URL navigation API, keyboard/password input, clipboard, real account login, cookies export, storage export, CDP endpoint, or external media download.
- Only the exact built-in https://media.example.test/ document and its fixed /media/demo.webm subresource are fulfilled; all other browser page requests are aborted. The page is never fetched from the network. Service workers and native browser downloads are disabled; unexpected pages and dialogs are closed.
- Browser request interception is **not an OS-level egress firewall**. Separate Chromium processes are **not per-user containers**. Production needs the stronger isolation, external provider review and network controls listed above. Do not expose this server or use real secrets.
- Screenshots are returned in memory without saving them. Session close/expiry attempts context and browser teardown; process crashes or OS-level failure still require a deployment supervisor and cleanup policy before production.
- No actual third-party login or media compatibility is claimed. Streaming is low-frame-rate JPEG polling, not WebRTC/video streaming. Text entry and mobile keyboard/IME are intentionally absent in this fixture-only version.

### Current execution blocker

The available `/usr/bin/chromium` fails before a page opens with `socket() failed: Operation not permitted` (Chromium process-singleton startup). The expected Playwright bundled Chromium executable is absent. The installed Chromium was attempted with its sandbox enabled; no sandbox-disabling or OS-security workaround was used. Consequently real screenshots, browser login and actual browser isolation have **not been verified in this environment**. Use a development environment that permits sandboxed Chromium's normal process/socket operations, and run the real smoke check before claiming those stages pass.

The automated suite adds fake-driver tests for real-adapter configuration, exact fixture routing, owner-bound controls, separate launch calls, bounded frame/click rates, startup/crash cleanup, replacement, expiry and parallel capacity. Passing these tests verifies control logic, not successful real Chromium execution.

The WebM fixture was generated locally with the installed ffmpeg, not retrieved from a third party: `ffmpeg -f lavfi -i color=c=blue:s=160x90:d=1:r=10 -an -c:v libvpx-vp9 -b:v 30k demo.webm`. The fixture route is not a provider adapter. Real platform integration is still absent.

Second-stage final check: 44 automated tests pass, including 12 browser-UI VM tests, fixture WebM decoding, failed setup/teardown retention, all-session shutdown and bounded queues. Syntax and whitespace checks pass. ffprobe verifies the bundled VP9 WebM is 160×90 and 1.000 seconds. The explicit real-browser smoke run exits 1 at Chromium startup because of the socket restriction above, so no real-browser success is claimed.
