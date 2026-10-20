# Phase 0 spec: the wand prototype

## Goal
Prove that casting spells with your real hand and voice **feels magical and works reliably** before anything else is built. Phase 0 ends with a 2D practice stage where the player can cast Lumos, Wingardium Leviosa and Incendio, each with a visible, satisfying effect.

Every module built here (perception, recognition, fusion, spell data, trail, effects pipeline) is kept for the final game. Only the practice stage is throwaway.

## Player flow
1. **Intro screen.** Title, one line ("Your hand is your wand. Your voice is the spell."), a privacy line (see NFR-6), and a "Begin" button. The button click also unlocks audio.
2. **Permissions.** Camera, then microphone. Any failure → plain message + fallback (FR-1, FR-12).
3. **Calibration** (first run only): "Wave your hand around comfortably for 3 seconds."
4. **Practice stage.** Spell cards on the left, three props on the stage, mic indicator top-right, webcam PiP bottom-right.
5. **Cast loop.** Pinch → trace → release + say the word → effect + result card.
6. **Settings** (S or the gear icon) and **debug overlay** (D) are available at any time.

## Functional requirements

### Coordinates
Events carry normalized [0,1] coordinates: x is a fraction of the stage width, y a fraction of the stage height. On a non-square stage that space is stretched, so anything that measures a shape, a distance or a speed first converts to **square units**: x × aspect (aspect = stage width / stage height), y unchanged. One square unit is the stage height. Every distance in this spec (trace path length, the Leviosa reach, the Incendio burst radius) is in square units. See `ARCHITECTURE.md`.

### Input and perception
- **FR-1 Camera.**
  - Request a user-facing camera at 640×480 and 30 fps (both ideal) and show a mirrored PiP preview with the hand skeleton drawn on it.
  - Handle each failure (permission denied, blocked by the operating system, no camera, camera in use by another app, insecure context) with its own plain-language message and an offer to switch to mouse mode. "Blocked by the operating system" happens on macOS when Chrome has no camera access in System Settings → Privacy & Security → Camera; the message says where to turn it on.
- **FR-2 Hand tracking.**
  - Use MediaPipe `HandLandmarker` (`@mediapipe/tasks-vision`) in `VIDEO` running mode with `numHands: 1`.
  - If a wand-hand preference is set (FR-22) and the tracked hand is the other one, treat it as no hand (FR-7). MediaPipe's handedness labels assume a mirrored image, so swap them for raw webcam frames before comparing.
  - Try the `GPU` delegate first and fall back to `CPU` automatically, recording which one is active in the debug overlay.
  - Serve the wasm files and model locally from `public/` (no CDN at runtime). Model source: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` (confirm against the official MediaPipe web guide).
  - The model file is committed to git, so builds and deploys never download it. The wasm files are copied from `node_modules` at install time (versions pinned by `package-lock.json`).
  - Run detection once per new video frame, decoupled from rendering.
  - If tracking fps stays below 20 for 3 s, show a tip: improve lighting, keep your hand 40–80 cm from the camera.
  - If average detection time blocks rendering below 55 fps, propose (don't silently do) moving detection to a Web Worker.
- **FR-3 Wand point.**
  - The wand point is always the midpoint of the thumb tip (landmark 4) and index tip (landmark 8), so it doesn't jump when a pinch starts.
  - Smooth it with a One Euro filter (parameters in `tuning.ts`).
  - Map it through the calibration box to [0,1] screen space, mirrored like a selfie.
  - Compute wand velocity from the **filtered** point (never from raw landmarks, which amplify jitter), in square units per second. Phase 0 only shows it in the debug overlay and records it with each trace; it becomes a power signal in later phases.
- **FR-4 Pinch.**
  - Pinch has its own signal path. The ratio is computed from **unfiltered** landmarks, so smoothing never makes a pinch feel delayed; hysteresis and 2-frame confirmation handle the noise instead.
  - Pinch ratio = distance(4, 8) / distance(0, 9), which normalizes by palm size.
  - Measure both distances in 3D from MediaPipe's `worldLandmarks` (metric, centred on the hand), so the ratio doesn't shift with the camera's 4:3 shape or when the hand points toward the camera. If that proves too noisy, fall back to 2D landmarks with x scaled by the video's width / height. T5 decides from the debug bar, which shows both ratios.
  - Pinch starts when the ratio is below 0.28 for 2 consecutive frames and ends when it is above 0.40 for 2 consecutive frames (hysteresis). These starting values assume 2D landmarks; T5 retunes them for the chosen method.
  - Both thresholds live in `tuning.ts` and are adjustable live from the debug overlay.
- **FR-5 Calibration.**
  - Record wand points for 3 s and take the 5th–95th percentile range on each axis.
  - Add an 8% margin and map that box to the full screen.
  - If either axis spans less than 0.25, ask the player to move more and repeat.
  - Save the result; settings has a "Recalibrate" button.
- **FR-6 Mouse fallback.** Holding the left button = pinch, moving = wand. It emits exactly the same `wand:*` events. Toggle with M, and offer it automatically when the camera fails.
- **FR-7 Hand lost.** If no hand is seen for 300 ms, emit `hand:lost`. Any trace in progress is cancelled (reason `hand-lost`) and the wand dot fades out. The PiP border turns red and shows "Hand lost" until the hand returns; the filter never pretends to track a hand that isn't there.

### Recognition
- **FR-8 Traces.** A trace is the points between `wand:pinchStart` and `wand:pinchEnd`. It is valid only if all three hold:
  - duration is 150–3000 ms;
  - path length is ≥ 0.12 (square units);
  - it has ≥ 12 points.

  Too short → cancel silently. Too long → cancel with the hint "Shorter and smoother".
- **FR-9 Gesture recognizers: Protractor (primary) and $1 (baseline), behind one interface.**
  - **Interface.** `GestureRecognizer` has `addTemplate(spellId, points, rotationToleranceDeg)` and `rank(points) → { spellId, score }[]`, where score is in [0,1] and higher is better. Points are in square units (the caller converts the trace using its `aspect`). The accept rule is shared and lives outside both recognizers:
    - accept the best spell only if its score is ≥ that recognizer's threshold (in `tuning.ts`, initial 0.80 for both);
    - **and** it beats the next different spell by ≥ 0.05;
    - otherwise the result is "unrecognized".
  - Both recognizers are **orientation-sensitive**, because direction matters (a flick up is not a flick down). Neither rotates the gesture to its indicative angle. Rotation is limited to the spell's `rotationToleranceDeg` (FR-16): ±30° for most spells, ±180° for Lumos, because a circle started at another clock position is just the circle rotated. Rotation can never turn a shape into its mirror image, so an anticlockwise circle is still not Lumos.
  - **Protractor:**
    1. Resample to 32 points (tunable) and translate the centroid to the origin.
    2. Flatten to a vector and normalize it to unit length.
    3. Compute the closed-form optimal rotation angle, then clamp it to ± the template's tolerance.
    4. Cosine similarity at the clamped angle gives the angular distance; score = 1 − distance / (π/2).
  - **$1:**
    1. Resample to 64 points, scale to a reference square, translate the centroid to the origin.
    2. Find the best angle within ± the template's tolerance with a golden-section search. Above ±45°, do a coarse scan first, because golden-section search assumes a single minimum.
    3. Score = 1 − d / (0.5 · √(2 · size²)).
  - A spell's score is its best-matching template.
  - Protractor is the default. A dev setting switches recognizers live. The final default is picked in T14 by the benchmark (FR-24).
  - Always emit the ranked list.
- **FR-10 Default gesture shapes.** Generate these programmatically in a unit box (y grows downward), plus 2 jittered variants each:
  - **Lumos: a clockwise circle.** It starts at the top (12 o'clock), heading right: θ from −90° to 270°, with x = 0.5 + 0.5·cos θ and y = 0.5 + 0.5·sin θ.
  - **Wingardium Leviosa: swish and flick.**
    - The swish is a quadratic Bézier from P0 (0, 0.25) through control point (0.35, 1.15) to P1 (0.7, 0.7).
    - The flick is a straight line from (0.7, 0.7) to (1.0, 0.05).
  - **Incendio: a rising zigzag, like a flame flickering up.** Polyline (0.5, 1.0) → (0.15, 0.7) → (0.85, 0.5) → (0.2, 0.3) → (0.6, 0.0).
- **FR-11 Template recorder** (dev tool, opened from settings). It records three kinds of sample:
  - **Templates:** what the recognizer learns from. At least 5 per spell are needed to use them.
  - **Test samples:** labeled attempts kept separate from templates, used only to measure accuracy.
  - **Negatives:** deliberate pinched scribbles that are *not* spells, used to measure false casts.

  You can see each sample overlaid on the default shape and delete bad ones. Templates save to `localStorage`, and everything exports or imports as JSON. The export format is the benchmark fixture format (`tests/fixtures/gestures/*.json`), so real webcam samples can be committed.

  Recorded templates are used alongside the defaults. A setting switches to "my templates only".
- **FR-12 Voice listener.**
  - Use `SpeechRecognition` / `webkitSpeechRecognition` with `continuous: true`, `interimResults: true`, `maxAlternatives: 3`.
  - Language comes from settings (default `en-US`, `en-IN` offered; test both).
  - Restart automatically on `end` while voice is enabled, with a short backoff (Chrome stops after silence).
  - Handle each error:
    - `not-allowed` → message + offer gesture-only mode. The message also covers macOS, where Chrome may lack microphone access in System Settings → Privacy & Security → Microphone.
    - `network` → "Voice needs internet" + offer gesture-only mode.
    - `no-speech` → restart quietly.
  - An unsupported browser (e.g. Firefox) gets a message and gesture-only mode.
- **FR-13 Voice matcher.**
  1. Normalize: lowercase, strip punctuation, collapse spaces, then simplify phonetically (collapse doubled letters; c/k/q → k; ph → f; z → s).
  2. Match only against an **allowlist of spells the player knows**, passed in from game state (all three in Phase 0). As the spell list grows, unknown spells can never be heard by mistake. For every alternative transcript and every allowed spell, compare the incantation and each alias against every 1–3-word window of the transcript. Similarity = 1 − Levenshtein / max length.
  3. The best score ≥ 0.70 is a match.
  4. Seed aliases from likely mis-hearings, e.g. lumos: *loomis, lumus, lumo*; leviosa: *win guardian leviosa, leviosa, levi osa, levioso*; incendio: *in send io, insendio, incendiary*.
  5. Unmatched transcripts are logged in the debug overlay so more aliases can be added from real data.
- **FR-14 Cast fusion** (pure state machine).
  - **Pairing:** a gesture and a voice match pair up if they occur within 1500 ms of each other, in either order.
  - **Interim vs final:** an interim voice match counts if its score is ≥ 0.85; a final match counts at ≥ 0.70. Each voice match is used at most once.
  - **Interim text is a candidate, never a verdict.** An interim match can *confirm* a cast when it agrees with the gesture. It can never cause a `voice-mismatch`: only a **final** result for a different spell can. If the window ends with only a disagreeing interim, the outcome is `no-voice`.

  | Gesture | Voice (within window) | Result |
  |---|---|---|
  | Spell X | Spell X | `spell:cast` X |
  | Spell X | Spell Y (final result) | `spell:miscast` `voice-mismatch` |
  | Spell X | Nothing | Voice required → `spell:miscast` `no-voice` after the window. Gesture-only mode → `spell:cast` X. |
  | Unrecognized | Anything | `spell:miscast` `unrecognized-shape`, immediately (see below) |
  | Nothing (no trace) | Anything | Nothing happens. Talking alone never casts. |

  - **Unrecognized shapes fizzle at once.** If a spell was already heard within the window, the miscast includes it (`spellId`, `heard`) so the hint can name it. If a spell is heard within the window *after* the fizzle, fusion emits `spell:miscastHeard` and the result card updates its hint to name that spell. No second fizzle plays. A hint never uses up a voice match, so it can still pair with a quick retry. Gesture-only mode ignores voice: the same immediate fizzle, with no hint update.
- **FR-15 Quality = skill.** Power comes from how *precisely* you cast, not how fast you wave or how loudly you shout.
  - shapeN = clamp((score − threshold) / (1 − threshold))
  - voiceN = clamp((score − 0.70) / 0.25)
  - speed = 1 inside the spell's `idealDurationMs` range, falling linearly to 0 at 150 ms and at 3000 ms. It rewards a controlled pace, not raw speed.
  - q is a weighted sum of these **signals**, with weights taken from the spell's `power` data (FR-16). The default is shape 0.6, voice 0.3, speed 0.1; in gesture-only mode it is shape 0.85, speed 0.15.
  - Tier: q < 0.35 → weak; q < 0.75 → normal; otherwise strong. Weak still casts; it is just smaller.
  - Later phases add new signals (velocity, mic volume) with per-spell weights, without changing this module's logic.
- **FR-16 Spells as data.** The three spells are `SpellDef` entries (see `ARCHITECTURE.md`), each with its own `power` weights (all three use the defaults in Phase 0). Effects are looked up by `effectId` in the effect registry. Use these values:
  - Lumos: ideal duration 400–1500 ms, rotation tolerance 180°
  - Leviosa: ideal duration 500–1600 ms, rotation tolerance 30°
  - Incendio: ideal duration 400–1400 ms, rotation tolerance 30°

### Presentation
- **FR-17 Practice stage.**
  - Full-window canvas, sharp on high-DPI screens and safe to resize. The device pixel ratio is capped by a value in `tuning.ts`, chosen in T1 by measuring on the Windows laptop and checking on a DPR-2 Retina MacBook, so integrated graphics keep ≥ 55 fps.
  - The look: deep night-blue background with a soft vignette and a procedural stone texture (no image assets).
  - The stage is always dimly lit: the props are visible but dim, and the notice board's message can't be seen.
  - Three props:
    1. A **notice board** in the dark, whose original hidden message ("The light reveals what the dark hides.") is visible only inside Lumos light.
    2. A **feather** resting on a ledge.
    3. A **cobweb** in the upper-right corner.
- **FR-18 Wand trail.**
  - While pinched, a glowing trail follows the wand, drawn as a Catmull-Rom spline through the trail points. It is layered: soft wide glow plus bright thin core, additive blending, tapering toward the tail.
  - Points fade over 350 ms. Small sparkles are emitted along the trail.
  - On release, the trail flashes gold if the gesture was recognized, or fades to grey if not.
  - When not pinched, the wand is a small glowing dot.
  - The renderer interpolates between tracking samples so motion is smooth at 60 fps even when tracking runs at 25–30 fps.
- **FR-19 Effects.** Size and intensity scale with tier.
  - **Lumos** (sustained):
    - A light orb attaches to the wand point and follows it for 10 s, or until another spell is cast.
    - The orb casts a warm, soft circle of light that brightens the dim stage around it and reveals the notice board's text where it passes. It never darkens the rest of the stage.
    - Orb radius by tier: small, medium or large.
  - **Wingardium Leviosa** (sustained):
    - If the wand point at cast time is within 0.12 square units of the feather, the feather lifts and follows the wand with a spring and a gentle bob.
    - It lasts up to 8 s (3 s on a weak cast), or until a quick pinch tap (under 250 ms) drops it. When dropped it falls and sways down.
    - A weak cast follows sluggishly.
    - A miss gives a soft sparkle and the hint "Nothing to lift there".
  - **Incendio** (instant):
    - A flame burst of particles appears at the wand point.
    - If the cobweb is within the burst radius (square units, in `tuning.ts`), it burns: a glowing edge eats inward over 1.2 s, embers rise, and then it's gone. It returns after 5 s, since this is practice.
    - A subtle warm pulse washes over the screen.
  - **Fizzle** (every miscast): a grey smoke puff and a sputter of sparks at the wand point.
- **FR-20 HUD.**
  - **Result card** (top centre, 2 s):
    - On a cast: spell name, quality %, and tier word (Weak / Good / Strong), with a small line showing shape · voice · speed.
    - On a miscast: a short friendly reason, e.g. "Shape unclear: try a rounder circle", "Heard 'loomis' but drew Incendio", "Say the spell as you cast".
  - **Mic indicator** (top-right): listening state, plus the last words heard (interim text in grey).
  - **Webcam PiP** (bottom-right, about 20% width): mirrored, with the hand skeleton and the pinch state shown. Hidden in mouse mode.
  - **Spell cards** (left): each spell's shape drawn from its template with a start dot and a direction arrow, the incantation, and a pronunciation hint (LOO-mos · win-GAR-dee-um lev-ee-OH-sa · in-SEN-dee-oh). A setting toggles a faint guide shape on the stage while tracing.
  - **Toasts** for `system:message`.
- **FR-21 Sound.** Synthesized with Web Audio; no audio files.
  - A soft shimmer while tracing, louder with speed.
  - A distinct cast sound per spell: a bright bell for Lumos, an airy whoosh for Leviosa, a roar for Incendio (noise with a low-pass sweep).
  - A "pfft" for a fizzle.
  - Master volume is in settings.
- **FR-22 Settings panel** (S key or gear icon). All settings persist.
  - Voice language
  - Voice required on/off
  - Input mode: hand / mouse
  - Wand hand: any / left / right (the other hand counts as no hand; FR-2)
  - Guide shapes on/off
  - Master volume
  - Recalibrate, record templates, reset everything
- **FR-23 Debug overlay** (D key).
  - **Performance:** tracking fps, render fps, average detection ms, active delegate.
  - **Wand and pinch:** a live pinch-ratio bar with both thresholds, raw vs filtered wand dot.
  - **Recognition:** the last trace's resampled points, ranked gesture scores from the active recognizer, the trace's peak and mean velocity, voice transcripts with alternatives, match scores.
  - **Fusion:** fusion state and timers, plus a log of the last 20 events.
  - When hidden, it costs under 1 ms per frame.
- **FR-24 Gesture benchmark.** `npm run bench:gestures` runs both recognizers over the recorded fixtures. It is a Vitest file under `bench/`, excluded from `npm test`, with no new dependency. It reports, for each recognizer and each template set (defaults only; defaults + personal):
  - accuracy per spell;
  - a confusion matrix;
  - the false-accept rate on negatives;
  - mean recognition time per trace.

  The default recognizer is the one with the best accuracy *while* keeping false accepts ≤ 5%. A tie goes to Protractor, which is faster.

## Non-functional requirements
- **NFR-1 Performance** (Chrome, on the target laptop):
  - tracking ≥ 25 fps;
  - rendering ≥ 55 fps;
  - average detection time recorded in `PROGRESS.md`.
- **NFR-2 Latency:**
  - The trail follows the hand with no visible lag (target under 100 ms).
  - An effect starts within 150 ms of the fusion decision.
- **NFR-3 Robustness.** No uncaught exceptions. Every permission, device or network failure shows a message and offers a fallback.
- **NFR-4 Tests.** Every pure module has unit tests, and `npm test` finishes in under 10 s.
- **NFR-5 Code.** Follows `CLAUDE.md`.
- **NFR-6 Privacy.** Our code never stores or sends video or audio. The intro screen says in one line that voice recognition is handled by the browser's speech service.
- **NFR-7 Deployment and browsers.**
  - The game is a static site served over HTTPS (camera and mic need a secure context). The host is chosen in T1 (default Vercel); from T1 on, every task can be reviewed from a link.
  - Builds never download anything: the hand model is committed and the wasm files come from `node_modules`.
  - Supported: Chrome on Windows (the development laptop, integrated graphics) and Chrome on macOS (the reviewer's Retina MacBook, DPR 2). Edge on Windows is second. Safari is not supported.

## Acceptance criteria
- **AC-1** On a fresh load in Chrome, getting from "Begin" to the practice stage (permissions + calibration) takes under 20 s with only on-screen instructions.
- **AC-2** While casting, the debug overlay shows tracking ≥ 25 fps and render ≥ 55 fps. Record the numbers.
- **AC-3** Moving the hand around for 60 s without pinching produces zero casts and zero fizzles.
- **AC-4** Reading a paragraph aloud for 60 s without pinching produces zero casts.
- **AC-5** Gesture accuracy, in gesture-only mode, 20 deliberate attempts per spell:
  - default templates: ≥ 17/20 recognized correctly;
  - after recording 5 personal templates: ≥ 19/20;
  - wrong-spell results: ≤ 1 per 20.
- **AC-6** Voice: 20 attempts per incantation in a quiet room → ≥ 17 matched. Record results for both `en-US` and `en-IN`.
- **AC-7** Full casts (shape + voice): 10 attempts per spell → ≥ 8 successful casts.
- **AC-8** Each effect behaves as in FR-19, including hit and miss for Leviosa and Incendio, and the three tiers are visibly different.
- **AC-9** Mouse mode can cast all three spells with no camera.
- **AC-10** Fallbacks work:
  - denying the camera gives a message and offers mouse mode;
  - denying the mic gives a message and offers gesture-only mode;
  - in Firefox, voice shows "unsupported" and gesture-only mode works.
- **AC-11** If the hand leaves the frame mid-trace, the trace is cancelled and nothing is cast.
- **AC-12** `typecheck`, `lint`, `test` and `build` pass with zero errors or warnings, and a 5-minute session produces no console errors from our code. Known startup lines that MediaPipe's wasm prints (some appear as errors) are listed in `PROGRESS.md` and don't count.
- **AC-13** A unit test registers a dummy 4th spell (data + template + effect) and runs it through recognition and fusion end to end, **without editing any recognition or fusion source file**.
- **AC-14** The benchmark runs on ≥ 20 real webcam test samples per spell and ≥ 30 negatives. The chosen recognizer meets AC-5's accuracy with a false-accept rate ≤ 5% on negatives. Results and the choice are recorded in `PROGRESS.md` and `DECISIONS.md`.
- **AC-15** The deployed link, opened in Chrome on a Mac, passes AC-1, AC-7, AC-9 and AC-10 (its camera and mic parts; the Firefox part is checked on Windows). Checked once, before the link is shared.

## Out of scope for Phase 0
- 3D and Three.js, physics engines, player movement
- Any scene other than the practice stage
- Nox, Alohomora, Reparo
- LLMs, a backend, multiplayer, Whisper
- Touch and mobile support (mouse is enough)
- Safari (Chrome on Mac is supported; see NFR-7)
- Mic-volume (RMS) power, velocity as a power signal, $P / multi-stroke gestures, Howler.js (see `docs/LATER.md`)
