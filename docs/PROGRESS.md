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

## T0: Scaffold and core (2026-10-21)
**Done:**
- Vite + TypeScript (strict, `noUncheckedIndexedAccess`) + Vitest + ESLint + Prettier. Scripts: `dev`, `build`, `preview`, `test`, `bench:gestures`, `lint` (ESLint + Prettier check), `typecheck`, `format`.
- Folder skeleton from `ARCHITECTURE.md` (`.gitkeep` in empty folders).
- `src/core/`: `types.ts`, `events.ts` (full `EventMap`, including `aspect` and `spell:miscastHeard`), `eventBus.ts`, `clock.ts`.
- `src/config/tuning.ts`: every number in the spec, grouped by layer; guesses are marked with the task that tunes them.
- `src/settings/settings.ts`: `wg.settings.v1`, per-field validation, injected storage.
- Lint enforces the CLAUDE.md layer boundaries and bans default exports (checked with throwaway violating files: all 4 rules fired).
- `.gitattributes` forces LF; `.gitignore` ignores `public/mediapipe/` but not `public/models/`.

**Verify:**
1. `npm run dev`, open http://localhost:5173 in Chrome: a blank dark page; DevTools console shows no errors.
2. `npm run typecheck && npm run lint && npm test && npm run build`: all pass, zero warnings.
3. `npm run bench:gestures`: exits cleanly (no benchmark until T8).

**Numbers:** 26 tests in 3 files, ~0.2 s. Build output 2 kB JS.
Installed: Node 24.15, vite 8.3.4, typescript 6.0.3, vitest 5.0.5, eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0, eslint-config-prettier 10.1.8, prettier 3.9.10.

**Open issues:** Vitest 5 needs Node ≥ 22.12 (`engines` set; KICKOFF_PROMPT.md updated from "Node 20").

## T1: Stage, render loop, debug overlay, hosting (2026-10-21)
**Done:**
- `presentation/view.ts` (normalized ↔ CSS px, square units → px, aspect), `canvasSize.ts` (DPR cap, backing size, `?dprCap=` override), `canvasStage.ts` (full-window canvas, resize- and DPR-change-safe, single rAF loop with a clamped time step).
- `core/fpsMeter.ts` (sliding window; stalls lower the reading) and `core/seededRandom.ts`.
- `scenes/scene.ts`, `practiceStage.ts`, `stoneLayout.ts`, `practiceBackground.ts`: dim night-blue castle stone with per-stone shading, mottling, grain, faint moonlight from above and a vignette. Drawn once to an offscreen canvas; redrawn only after a resize settles (150 ms).
- `dev/debugOverlay.ts`: HTML panel (D key) with render fps (green ≥ 55, red below), canvas size and pixel ratio. Text refreshes 4×/s; hidden, it only records a timestamp.
- `engines.node` pinned to `24.x` (D-027).
- Hosting: Vercel, connected to GitHub. Production: https://wizarding-game.vercel.app (public; preview URLs need a Vercel login under Standard Protection).

**Verify:**
1. `npm run dev`, open http://localhost:5173: the stone stage fills the window; DevTools console has no errors.
2. Press D: the panel shows render fps ≥ 55 (green). Press D again: it hides.
3. Drag-resize the window and move it between monitors if you have two: no gaps or blur after the resize settles.
4. DPR cap: open `?dprCap=1`, `?dprCap=1.5`, `?dprCap=2` and note render fps for each on the laptop (record below). Keep the highest cap that stays ≥ 55 fps.
5. After pushing: https://wizarding-game.vercel.app shows the same page. On the Mac (DPR 2) if available, check sharpness and fps.

**Numbers:** 60 tests in 8 files, ~0.35 s. Build 8 kB JS + 0.5 kB CSS.
Render fps, idle stage (measured in T2; see the T2 table): native DPR 1.25 = 60; emulated Retina (1440×900 at DPR 2) at cap 1.5 = 60 and cap 2 = 60. The cap stays 1.5 (provisional) until it is set after T11 (D-032). Real Mac: not yet checked.

**Open issues:** The final cap is set after T11.

## T1 follow-up: practice background polish (2026-10-21)
**Done:** All in the once-drawn background image (no per-frame cost):
- Depth: each stone has a lit top/left edge and a shadowed bottom/right edge.
- Irregular: row heights vary ±15%, corners move 1–2 px inward, 12% of corners are chipped, and 3 stones carry cracks.
- Light: a soft, cool moonlight shaft runs from the upper left and fades across the wall. The vignette is deeper, so the corners sink into darkness.
- Colour: small per-stone hue shifts, about a quarter of the stones a cooler grey, faint moss on some stones near the bottom.
- New pure module `scenes/stoneShape.ts` (outline with jitter and chips, crack paths), lighting split into `scenes/practiceLighting.ts`.
- T2 and T11 now include a DPR-2 fps re-measure; the final cap is set after T11.

**Verify:** `npm run dev`: the shaft is visible as a slightly brighter diagonal band from the upper left; cracks are near the top centre and lower left of centre; the corners are darker than before.

**Numbers (1600×900 screenshot, 0–255 luma):**

| | Mean | 99th percentile | Corners | Centre |
|---|---|---|---|---|
| Before | 17.4 | 37 | 9.8 | 27.4 |
| After | 15.5 | 41 | 7.9 | 27.4 |

Overall brightness is lower. The 99th percentile rose slightly because a few stones inside the shaft are lit.
73 tests, ~0.3 s.

## T2: Mouse wand and the trail (2026-10-21)
**Done:**
- `input/`: `WandSource` interface; `mouseWandSource.ts` (Pointer Events, pointer capture, coalesced events, context menu blocked, no text selection while drawing); `handRateSampler.ts` (30 Hz hand-rate preview).
- `presentation/`: `wandTimeline.ts` (render-time interpolation along a centripetal Catmull-Rom spline), `trailModel.ts`, `trailColors.ts`, `glowSprites.ts`, `trailDraw.ts`, `trailLayer.ts`, `particles.ts` (pooled), `sparkles.ts`, `wandDot.ts`, `layer.ts`. `canvasStage.ts` gained layers, an injectable frame clock and a per-frame work time.
- Look: a warm gold-white head that fades to amber and thins toward the tail; wide and inner glow from stamped sprites; a thin core stroked in 14 age bands. Energy comes from head speed: calm strokes are thin and gold with gentle sparkles; fast strokes are brighter and wider, with more sparkles thrown further. Sparkles drift up, twinkle, shrink and fade to zero. The idle dot glows, pulses about once a second, and replaces the cursor over the stage.
- Debug overlay (D): frame work, input rate, render delay, trail points, sparkles, glow sprites, a **Hand-rate preview (30 Hz)** toggle (also `?handRate=1`), and a **Release preview** choice (fade / gold / grey).
- Dev: `?demo=circle|zigzag|swish&speed=slow|fast&at=0.85` stroke playback on a stepped clock (repeatable screenshots), `?demo=loop`, and `?reportFps=1` (fps, longest frame gap and work time, logged once a second).

**Verify:**
1. `npm run dev`, open http://localhost:5173. Move the mouse: the cursor is a softly pulsing gold dot.
2. Hold the left button and draw a circle, a zigzag and a swish-and-flick, slowly and then fast. Slow should look calm and gold; fast should look brighter, with more sparkles. Sparkles drift and fade; none vanish abruptly.
3. Press D, tick **Hand-rate preview (30 Hz)**, and draw again. "Input rate" reads about 30 Hz, and the trail must still be smooth (no corners or stepping).
4. Set **Release preview** to gold, then grey, and release a stroke: gold flashes with a burst of sparkles; grey drains to ash and fades.
5. Drag out of the window while drawing: the stroke continues (pointer capture). Right-click the stage: no menu.
6. Send a screenshot of a real mouse stroke.

**Numbers:** 123 tests, ~0.6 s. Render fps was measured in a visible Chrome on the laptop (Intel Iris Xe, on AC power, Balanced plan), 19 s per run after startup, using the loop demo for continuous drawing (30 Hz preview on) and `?reportFps=1`:

| Run | Canvas (device px) | fps mean / min | Longest frame gap | Our work per frame (mean / max) |
|---|---|---|---|---|
| Native DPR 1.25, idle (T1 baseline) | 1920×970 | 59.8 / 57 | 50 ms (once; desktop) | 0.29 / 0.78 ms |
| Native DPR 1.25, drawing | 1920×970 | 60 / 60 | 17.9 ms | 0.63 / 1.04 ms |
| Emulated Retina, cap 1.5, idle | 2160×1350 | 60 / 60 | 18.0 ms | 0.11 / 0.13 ms |
| Emulated Retina, cap 1.5, drawing | 2160×1350 | 60 / 60 | 17.9 ms | 0.59 / 1.02 ms |
| Emulated Retina, cap 2, idle | 2880×1800 | 60 / 60 | 18.0 ms | 0.10 / 0.14 ms |
| Emulated Retina, cap 2, drawing | 2880×1800 | 60 / 60 | 17.7 ms | 0.65 / 1.09 ms |

"Emulated Retina" is Chrome's device emulation at 1440×900 CSS px and DPR 2 (the professor's MacBook pixel count), rendered on this laptop's GPU. Forcing `--force-device-scale-factor=2` on a 1080p screen would only halve the CSS size, not add pixels. Startup has one 200–230 ms gap while the background is drawn once; after that, no frame took longer than 18 ms while drawing.

**Open issues:**
- The M key moved to T5 (no hand source to switch to yet).
- Gold and grey releases are a dev preview until T7 connects recognition.
- Your real-mouse screenshot is still the judge of "magical".
