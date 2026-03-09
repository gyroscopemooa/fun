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
- Upload pre-check now shows estimated scores before generation:
  - alignment
  - crop/spec fit estimate
  - retake need
- Candidate cards show recommendation, score, identity score, quality score, and regenerated safety badge.
- Upload guidance now includes live face box, center/eye lines, directional coaching, and retake CTAs.

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
- `/tools/ai-photo-ops` exists for recent job monitoring.
- Debug page shows:
  - original vs recommended slider
  - candidate compare switching
  - candidate list
  - candidate score bars
  - JSON copy / JSON download
  - retry history
  - pipeline meta
  - pipeline report text
- Ops page shows:
  - recent jobs
  - failed / low-quality / low-identity flags
  - provider / crop / pose / suit summaries
  - direct links to original / recommended / debug page
  - JSON export for the current filtered view

## Important Remaining Gaps
- External AI provider keys are still needed for real `remove.bg` / `PhotoRoom` calls.
- No true diffusion/generative beauty engine is attached.
- Identity scoring is heuristic, not ArcFace/FaceNet level.
- Suit overlay is template-based, not garment-aware.
- Pose correction and relighting are still rule-based.

## Recommended Next Steps
1. Add server-side persistence for job summaries/debug snapshots beyond in-memory lifetime.
2. When keys are available, enable external background removal and validate cache behavior.
3. Add stronger operator-facing reporting for failed/low-score generations over time.
4. Add a dedicated admin entry point linking debug and ops pages from the AI tools.

## Last Known Good Verification
- `npm run build` passed after the latest guidance and progress-save updates.
