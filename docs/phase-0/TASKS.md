# Phase 0 tasks

Work through these in order, one at a time, following the loop in `CLAUDE.md`:
1. Plan mode first, then wait for an OK.
2. Build.
3. Run checks.
4. Update `PROGRESS.md` and `DECISIONS.md`.
5. Commit.
6. Stop and tell me how to verify.

Each task lists what it covers, what to build, the tests, and how I check it by hand.

---

## T0: Scaffold and core
**Covers:** NFR-4, NFR-5, AC-12 (partly)
**Build:**
- **Project setup:** Vite + TypeScript (strict) project with Vitest, ESLint and Prettier, plus the scripts `dev`, `test`, `build`, `lint`, `typecheck`, and `bench:gestures` (runs `bench/` only; `npm test` excludes it).
- **Folders:** the folder skeleton from `ARCHITECTURE.md`.
- **Core:** `core/types.ts`, `core/events.ts` (the full `EventMap`), `core/eventBus.ts`, `core/clock.ts`.
- **Tuning:** `config/tuning.ts`, holding every number named in the spec.
- **Settings:** `settings/settings.ts` with versioned `localStorage` and a safe fallback on bad data.
- **Docs and git:** `.gitignore`, and `docs/PROGRESS.md` / `docs/DECISIONS.md` updated.

**Tests:**
- The event bus delivers events and supports unsubscribing.
- A throwing handler doesn't stop the other handlers.
- Settings load, save, migrate, and survive corrupt JSON.

**Manual check:** `npm run dev` shows a blank dark page, and all checks pass.

## T1: Stage, render loop, debug overlay skeleton
**Covers:** FR-17 (background only), FR-23 (fps only), NFR-1
**Build:**
- `presentation/canvasStage.ts`: full-window canvas, DPR-aware, resize-safe, one `requestAnimationFrame` loop.
- `View`: normalized ↔ pixel conversion.
- The background: night-blue, vignette, procedural stone texture rendered once to an offscreen canvas.
- `scenes/scene.ts` and an empty `practiceStage.ts`.
- `dev/debugOverlay.ts`, toggled with D, showing render fps.

**Tests:** `View` conversions round-trip.
**Manual check:** the background looks good, resizing stays crisp, and D shows render fps ≥ 55.

## T2: Mouse wand and the trail
**Covers:** FR-6, FR-18
**Build:**
- `input/wandSource.ts` (interface) and `mouseWandSource.ts`.
- `presentation/trailRenderer.ts`: Catmull-Rom spline, layered glow with additive blending, tapering, 350 ms fade.
- `presentation/particles.ts`: a pooled particle system for the sparkles.
- The idle wand dot.

**Tests:** the mouse source emits the correct `wand:*` sequence (simulate events). The particle pool reuses objects and never exceeds its cap.
**Manual check:** hold the mouse button and draw. The trail must look *magical*, not like a line tool. Send me a screenshot.

## T3: Camera and webcam PiP
**Covers:** FR-1, FR-20 (PiP), AC-10 (camera part)
**Build:**
- `input/camera.ts`, with a distinct error for each failure type.
- `hud/webcamPip.ts`: mirrored preview.
- `hud/toasts.ts`, driven by `system:message`.
- On camera failure, offer mouse mode.

**Tests:** the error-mapping function (pure) maps each DOMException name to the correct message.
**Manual check:** the preview is mirrored. Deny the camera → the message appears and mouse mode is offered.

## T4: Hand tracking
**Covers:** FR-2, FR-20 (skeleton), FR-23 (tracking fps, detection ms, delegate)
**Build:**
- `scripts/copy-mediapipe.mjs` (run from `postinstall`) and `scripts/fetch-model.mjs`.
- `perception/handTracker.ts`: GPU delegate with CPU fallback, detection via `requestVideoFrameCallback`, monotonic timestamps; emits `hand:landmarks`.
- Skeleton drawn in the PiP.
- The low-fps tip.

**Tests:** none for the browser wrapper. Keep it thin. Test any pure helper you extract (e.g. landmark mirroring).
**Manual check:**
- The skeleton tracks the hand.
- The debug overlay shows tracking fps, detection ms and the delegate.
- Record the numbers in `PROGRESS.md`.
- If render fps drops below 55, stop and propose a Web Worker.

## T5: Wand point, pinch, hand lost
**Covers:** FR-3, FR-4, FR-7, AC-3, AC-11
**Build:**
- `perception/oneEuroFilter.ts` and `pinchDetector.ts`.
- `perception/handWandSource.ts`:
  - The One Euro filter is applied to the wand point only. The pinch ratio uses unfiltered landmarks (FR-4).
  - Velocity is computed from the filtered point.
  - Emits `wand:*`, `hand:found` and `hand:lost`.
- Hand-lost indicator: red PiP border plus a "Hand lost" label.
- Debug overlay: the pinch-ratio bar with live threshold sliders, live One Euro sliders (min cutoff, beta), the raw vs filtered dot, and current velocity.

**Tests:**
- One Euro: a stationary noisy signal gets smoothed; a fast step is followed with little lag.
- Pinch detector: hysteresis and 2-frame confirmation.
- Hand lost: emitted after 300 ms of no hand.
- Velocity: computed from filtered points, and stays near zero for a still, noisy hand.

**Manual check:**
- The wand dot is steady when the hand is still, with no visible drag when you move fast. Tune the One Euro sliders and record the final values.
- Pinch and release feel crisp.
- 60 s of waving without pinching starts no traces.

## T6: Calibration
**Covers:** FR-5, AC-1 (partly)
**Build:**
- `perception/calibration.ts` (pure): percentiles, margin, minimum span.
- The calibration UI step, saved to `wg.calibration.v1`.
- A Recalibrate action.

**Tests:** the percentile box, the margin, rejection when the span is too small, and the mapping clamps to [0,1].
**Manual check:** after calibrating, a comfortable arm movement reaches all four screen edges.

## T7: Gesture recognition and spell data
**Covers:** FR-8, FR-9, FR-10, FR-16, FR-20 (spell cards), AC-5 (defaults)
**Build:**
- **Recognition:**
  - `recognition/traceCollector.ts`, `traceValidator.ts`, `defaultTemplates.ts`.
  - `gestureRecognizer.ts`: the interface and the shared accept rule.
  - `protractor.ts` (primary) and `dollarOne.ts` (baseline), both orientation-sensitive with rotation clamped to ±30°.
- **Spells:** `spells/spellTypes.ts` (including `PowerRule`), `spells.ts` (3 spells, effects not yet implemented), `spellRegistry.ts`.
- **HUD:** `hud/spellCards.ts`, drawing each shape from its template.
- **Debug:** ranked gesture scores, plus a dev toggle to switch recognizer live.

**Tests:** run every recognizer test against **both** recognizers through the interface.
- Each default shape, with noise added (±3%), random scale, small rotation (±10°) and different speeds, is recognized correctly ≥ 98% of 200 synthetic runs.
- A mirrored or reversed shape is *not* accepted as the original.
- Rotation beyond ±30° is not "corrected" into a match.
- The accept rule's threshold and margin.
- Validator edge cases.

**Manual check:** with the mouse, then with the hand, draw each shape 20 times. Record the counts (AC-5, default templates).

## T8: Recorder and gesture benchmark
**Covers:** FR-11, FR-24, AC-5 (personal templates), AC-14
**Build:**
- `recognition/templateStore.ts` (versioned, with import/export).
- `recognition/gestureDataset.ts`: one fixture format for templates, test samples and negatives.
- `dev/templateRecorder.ts` UI with three modes: template / test sample / negative. Export writes fixture JSON.
- The "my templates only" setting.
- `bench/gestures.bench.test.ts`: both recognizers × both template sets. It reports accuracy per spell, a confusion matrix, the false-accept rate on negatives, and mean time per trace.

**Tests:**
- Store round-trip, and rejection of malformed JSON.
- The recognizer uses user templates.
- Dataset parsing.
- The benchmark runs on a small synthetic fixture.

**Manual check:**
1. Record 5 templates per spell, 20 test samples per spell, and 30 negatives.
2. Export them into `tests/fixtures/gestures/` and commit them.
3. Run `npm run bench:gestures` and paste the table into `PROGRESS.md`.

## T9: Voice
**Covers:** FR-12, FR-13, FR-20 (mic indicator), AC-4, AC-6, AC-10 (mic part)
**Build:**
- `perception/speechListener.ts`: auto-restart with backoff, and per-error handling.
- `recognition/voiceMatcher.ts`: phonetic normalization, word windows, aliases, and matching only against the allowlist of known spells.
- `hud/micIndicator.ts`.
- Unmatched-transcript log in the debug overlay.

**Tests:**
- Every seeded alias matches its spell.
- Extra words around the spell still match.
- Unrelated sentences score below threshold.
- Interim vs final thresholds.
- A spell missing from the allowlist is never matched.

**Manual check:** say each incantation 20 times in `en-US` and in `en-IN`, and record both. Read a paragraph aloud and confirm no false matches with high scores.

## T10: Cast fusion and quality
**Covers:** FR-14, FR-15, FR-20 (result card), AC-4, AC-7
**Build:**
- `recognition/castFusion.ts`, a pure state machine driven by events plus the injectable clock.
- `recognition/quality.ts`: a weighted sum over the signals named in each spell's `PowerRule`.
- `hud/resultCard.ts`.
- Gesture-only mode.

**Tests:**
- Every row of the FR-14 table, in both orders: voice before the gesture and after it.
- A disagreeing **interim** result never causes `voice-mismatch`. Only a final result does.
- Window expiry.
- A voice match is used at most once.
- Quality formula and tier boundaries.
- A spell with custom `power` weights scores differently, with no change to `quality.ts`.
- **The AC-13 dummy-spell test.**

**Manual check:** 10 full casts per spell (AC-7). Talking without pinching never casts.

## T11: Effects
**Covers:** FR-17 (props), FR-19, AC-8
**Build:**
- `spells/effectRegistry.ts`.
- `scenes/props.ts` and the three props.
- `presentation/effects/`: `fizzle.ts`, `lumos.ts` (darkness overlay with a light cut-out revealing the hidden message), `leviosa.ts` (spring follow, bob, tap-to-drop, fall and sway), `incendio.ts` (flame burst; cobweb burn-away and respawn).
- Tier scaling for all of them.

**Tests:**
- Registry lookup and an error for an unknown `effectId`.
- Leviosa's hit test.
- Leviosa's state machine: lifted → dropped → resting.
- Cobweb burn timing.

**Manual check:** cast each spell at all three tiers (gesture-only mode helps control this), and at hit and miss targets. Send me screenshots or a short screen recording.

## T12: Sound
**Covers:** FR-21
**Build:** `presentation/audio/sfx.ts` with the trace shimmer, three cast sounds, the fizzle, master volume, and audio unlocked on the first click.
**Tests:** none needed beyond a smoke test that the API calls don't throw when `AudioContext` is mocked.
**Manual check:** the sounds feel good and match each spell, with no clicks or pops.

## T13: Intro flow, settings, polish
**Covers:** FR-20 (toasts), FR-22, NFR-3, NFR-6, AC-1, AC-10
**Build:**
- The intro screen and permission sequence.
- `dev/settingsPanel.ts`, wiring every setting live.
- Wand-hand preference: ignore the other hand.
- A consistent visual style for all HUD panels.

**Tests:** the settings schema, defaults and migration.
**Manual check:** a fresh profile (clear site data) reaches the stage in under 20 s. Then work through every fallback in AC-10.

## T14: Playtest and acceptance
**Covers:** all AC
**Do:**
1. Run the full AC checklist, recording every number and pass/fail in `PROGRESS.md`.
   - Re-run `npm run bench:gestures` and pick the default recognizer by FR-24's rule.
   - Log the choice and the numbers behind it in `DECISIONS.md`.
   - If you can, add test samples from a second person and from different lighting before deciding.
2. Tune thresholds in `tuning.ts` based on the results, logging each change in `DECISIONS.md`.
3. Fix anything that fails.
4. Profile a 5-minute session: no console errors, no memory growth.
5. Write `docs/phase-0/REPORT.md`:
   - what works;
   - the measured numbers;
   - what felt magical and what didn't;
   - the recommended changes before Phase 1.
