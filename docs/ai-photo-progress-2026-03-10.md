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
- `/tools/ai-photo-admin` exists as the admin entry point.
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
  - period filtering (`1h / 24h / 7d / all`)
  - provider filtering (`all / local_sharp / remove_bg / photoroom`)
  - tool/provider trend cards
  - quick presets (`all / flagged / fallback / failed`)
  - clickable drill-down cards that apply tool/provider filters
  - current-filter debug jump link
  - representative debug links from tool/provider drill-down groups
  - hour-slot mini trend cards for failure / warning / fallback hotspots
  - inline representative preview panel when clicking tool/provider drill-down cards
  - representative preview panel now shows retry delta before/after quality score
  - ops summary copy/download
  - original vs recommended side-by-side compare
  - recommended/generated/rejected variant trace
  - recommended vs rejected score bars
  - final retry before/after score cards
  - tool/provider flag drill-down summaries
  - insight cards for most common issues and fallback ratio
  - direct links to original / recommended / debug page
  - JSON export for the current filtered view
- Job snapshots are persisted to disk and recovered after server restart.
- AI pages now include:
  - admin links
  - debug links
  - pre-generate score summary
  - live alignment overlay
  - retake coaching CTA

## Important Remaining Gaps
- External AI provider keys are still needed for real `remove.bg` / `PhotoRoom` calls.
- No true diffusion/generative beauty engine is attached.
- Identity scoring is heuristic, not ArcFace/FaceNet level.
- Suit overlay is template-based, not garment-aware.
- Pose correction and relighting are still rule-based.

## Recommended Next Steps
1. Add debug deep-linking from grouped ops summaries to a representative job in that group.
2. When keys are available, enable external background removal and validate cache behavior.
3. Add stronger provider/tool aggregate reporting with exportable summaries.
4. Add more robust suit/template asset management and versioning.

## Last Known Good Verification
- `npm run build` passed after ops provider filtering, drill-down filters, insight cards, retry score cards, and current-filter debug link updates.

## Latest Commits
- `8a17e5e` `feat: add ai photo ops fallback filter and retry insights`
- `8d47c8b` `feat: add ai photo ops insight cards`
- `85b75b1` `feat: add ai photo ops quick presets`
- `c4c2d05` `feat: add ai photo ops drilldown summaries`
- `7d74225` `feat: add clickable ai photo ops drilldown filters`
