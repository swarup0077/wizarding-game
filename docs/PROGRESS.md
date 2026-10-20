# Progress log

One entry per task. Newest at the bottom.

<!-- Template:
## T<n>: <title> (YYYY-MM-DD)
**Done:** what was built
**Verify:** exact steps to check it in the browser
**Numbers:** tracking fps / render fps / detect ms / accuracy counts (when relevant)
**Open issues:** anything left for later
-->

## Acceptance tracker
| AC | Result | Notes |
|---|---|---|
| AC-1 Begin → stage < 20 s | – | |
| AC-2 Tracking ≥ 25 fps, render ≥ 55 fps | – | |
| AC-3 No casts from waving (60 s) | – | |
| AC-4 No casts from talking (60 s) | – | |
| AC-5 Gesture accuracy (default ≥ 17/20, personal ≥ 19/20) | – | |
| AC-6 Voice ≥ 17/20 (en-US and en-IN) | – | |
| AC-7 Full casts ≥ 8/10 | – | |
| AC-8 Effects and tiers | – | |
| AC-9 Mouse mode casts all 3 | – | |
| AC-10 Fallbacks | – | |
| AC-11 Hand lost cancels trace | – | |
| AC-12 Checks pass, no console errors | – | |
| AC-13 Dummy 4th spell test | – | |
| AC-14 Benchmark on real samples, false accepts ≤ 5% | – | |
| AC-15 Deployed link passes AC-1, 7, 9, 10 in Chrome on a Mac | – | |

## Spec review before T0 (2026-10-21)
**Done:** Reviewed the Phase 0 docs and applied fixes A–F: square units for shapes and distances, a 3D pinch ratio (provisional), the wand-hand rule, a dim stage, immediate fizzles with a late hint, the AC-12 wording, per-spell rotation tolerance, and HTTPS hosting from T1 with Chrome on Mac supported (new NFR-7 and AC-15), and HUD text as HTML over the canvas. Hosting: Vercel connected to GitHub. Moved the git repo into the project folder.
**Verify:** Read D-014 to D-023 in `DECISIONS.md`; `git log` shows the repo rooted in this folder.
**Open issues:** Pinch method and thresholds (T5).
