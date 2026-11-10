# Selection workbench

Local route: `/selection-workbench/`. No production push or deployment is part of this change.

## Works locally

- Text selection from the extension is imported once into a blank form through `listenForExtensionImport('text', callback)`; it never auto-runs a tool or charges credits.
- Deterministic extractive key sentences preserve source offsets and order. This is **not generative AI summarization** and may miss important information.
- Whitespace cleanup, rule-based error-code hints (not diagnosis).
- TSV/Markdown table parsing with preview and CSV download. Malformed rows are rejected rather than silently changed. Formula-like cells are prefixed with `'` before quoting to reduce spreadsheet injection risk, including negative/positive numeric values. Review before use.
- Text and results live in component memory, with Clear and unload protection. Copy/download requires a user action.

## Prepared but unavailable

AI explanations, generative summary, rewrite, reply drafts, image translation and image table recognition are explicitly disabled. `ai-contract.ts` defines a text-only future request boundary. It performs no network calls, charges nothing and has no API keys. It is not a functioning AI backend. Images are not part of its payload yet.

Before enabling AI, implement a server-owned capability endpoint, authenticated authorization, provider allowlist and secret storage, validated input limits, prompt/data separation, abuse controls, cancellation, idempotent credit reservation and failure restoration, privacy/retention policy and per-use selected-content consent. Never trust client-provided credit prices or readiness. Do not simply change the constant to true.

Existing OCR/translation remain at `/photo-to-document/` and `/text-translator/`; their local worker/model behavior is unchanged. Screenshot table recognition is not accomplished by parsing plain OCR text: users must review and delimit columns first.

## Integration

This commit depends on extension foundation commit `9a6fbe0` for `src/lib/extension/import.ts`. Cherry-pick the extension foundation first, then this commit. The AI worktree contains a temporary, untracked copy of that helper only to build/test against the same API.

The extension review's “글 도구로 보내기” action targets `/selection-workbench/`. No text is embedded in the URL. Repeated imports do not overwrite user edits. The helper remains owned by the extension foundation.

## Verification

- `node --test tests/selection-workbench.test.ts`: 14 passed.
- Focused strict TypeScript check of component/core/contract: passed.
- Astro build: 5,539 pages passed.
- Browser QA attempt: blocked before page launch by this executor's Chromium socket permission (`Operation not permitted`); no browser behavior or visual QA claimed.
- Browser test specification is provided at `tests/selection-workbench.browser.spec.ts`, with dedicated config. Run on a supported executor: `npx playwright test --config playwright.selection-workbench.config.ts`.

Unverified: extension-to-browser interaction, mobile layout, clipboard/download UX, full production deployment. Confirm source editing invalidates results, repeated imports preserve edits, Clear resets state, Back/Forward/unload prompts work, CSV result matches preview protections, and no AI request or credit charge is sent.
