# AI Photo Progress - 2026-03-10

## Current Product State
- Polar checkout flow is integrated for base purchase and add-on purchases.
- AI photo pages:
  - `ai-id-photo`
  - `ai-passport-photo`
  - `ai-photoshop`
- Mobile UX includes mirrored camera preview, live face box, center line, eye line, and directional coaching.
- Blocking upload states show retry CTAs.
- Good upload states show a positive "ready to generate" badge.
- Candidate cards show recommendation, score, identity score, quality score, and regenerated safety badge.

## Backend Pipeline State
- Portrait pipeline provider is the main generation path.
- Pipeline stages:
  1. detect
  2. align
  3. pose correction
  4. background removal
  5. background replace
  6. relight
  7. quality validation
  8. final quality retry
  9. variant generation
  10. identity scoring
  11. low-identity regenerate / reject
  12. ranking
- Tool-specific crop rules:
  - `id_photo`
  - `passport_photo`
  - `headshot`
- Suit overlay templates are split into asset files:
  - `business_suit`
  - `casual_jacket`
  - `female_blazer`
- Suit selection reasoning is exposed in `pipelineReport`.
- `pipelineReport` is shown in both main UI and debug page.

## Debug / Admin State
- `/tools/ai-photo-debug?jobId=...` exists.
- Debug page shows:
  - original vs recommended slider
  - candidate list
  - retry history
  - pipeline meta
  - pipeline report text

## Important Remaining Gaps
- External AI provider keys are still needed for real `remove.bg` / `PhotoRoom` calls.
- No true diffusion/generative beauty engine is attached.
- Identity scoring is heuristic, not ArcFace/FaceNet level.
- Suit overlay is template-based, not garment-aware.
- Pose correction and relighting are still rule-based.

## Recommended Next Steps
1. Add stronger pre-generate summary near the main CTA.
2. Improve debug page with per-variant diff cards.
3. Add admin-friendly export or snapshot of pipeline reports.
4. When keys are available, enable external background removal and validate cache behavior.

## Last Known Good Verification
- `npm run build` passed after the latest guidance and progress-save updates.
