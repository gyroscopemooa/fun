# Manytool platform integration

Local release candidate on `feat/complete-platform-release`, based on `d2ab196`. No production deployment or store submission has been verified. Commit and artifact generation are not deployment.

## Included

- Chrome MV3 extension: selected-text actions, explicit opt-in floating menu, region capture, image-source extraction with capture fallback, image conversion/resizing, and handoff to web tools. No cookies or all-sites permission.
- Private web workbench and new text comparison, SRT/VTT editing/conversion, and browser-only image batch resize/target-size/redaction/ZIP tools. `/platform-tools/` links these tools. The shared private layout omits analytics and advertising scripts.
- Android hybrid development app with native document picker, storage/share bridge, bounded file validation, and tool navigation allowlist. Debug APK has been built; release signing, AAB, device verification and store submission remain unfinished.
- Disabled Play credit verification, encrypted durable consume retry, voided-purchase reconciliation and reversal. Production billing remains disabled pending credentials, configuration, real Play tests and native account integration.
- Disabled AI text provider module for explain, summarize, rewrite, reply draft and error explanation. No production HTTP route is mounted; authenticated durable credit charging and provider setup remain required.
- Isolated fixture-only remote-login experiment under `experiments/remote-login-poc`. This is not production authenticated-video or stories support.

## Verification

- Extension, local text tools and fixture prototype: 89 Node tests passed.
- TypeScript policy tests: 24 passed.
- Play backend: 53 passed.
- AI module and private-layout/native boundary regressions: 9 passed.
- Astro build: 5,543 pages generated.
- Image batch strict TypeScript check and `git diff --check`: passed.

Browser interaction and real device/payment tests have not been completed. Runtime restrictions prevented local browser smoke tests. The new Android routes require deployment of the corresponding web pages before they work against production. App/extension stores, live AI payment, iOS and authenticated third-party video downloads are not released by this integration.
