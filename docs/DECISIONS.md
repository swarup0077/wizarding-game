# Design decisions

Each entry: the decision, the alternatives, and why. Add new ones at the bottom as `D-<n>`.

## D-001: Browser game, Canvas 2D for Phase 0
- **Alternatives:** Unity; Three.js from day one.
- **Why:** It's playable from a link with no install. Phase 0 is about the feel of casting, so 2D keeps it simple. Three.js arrives in Phase 1, and only the presentation layer changes.

## D-002: Pinch to cast
- **Alternatives:** always tracing; a fist to start; dwell time.
- **Why:** Normal hand movement must never cast. A pinch is a clear, low-effort on/off switch that MediaPipe detects reliably.

## D-003: Wand point = midpoint of thumb tip and index tip
- **Alternatives:** index tip only; switching between the two on pinch.
- **Why:** A single definition means the point never jumps when a pinch starts or ends.

## D-004: Orientation-sensitive $1 recognizer (superseded by D-009)
- **Alternatives:** standard $1 (rotation-invariant); a trained ML classifier.
- **Why:** Direction carries meaning (a flick up is not a flick down). $1 needs no training data, runs in microseconds, and can learn personal templates from 5 samples.

## D-005: Trace collection lives in recognition, not perception
- **Alternatives:** perception builds traces.
- **Why:** Perception stays a dumb "where is the wand, is it pinched" layer, so the mouse source and any future input device produce traces for free.

## D-006: Browser speech recognition with a gesture-only fallback
- **Alternatives:** Whisper in the browser; a cloud speech API.
- **Why:** It costs nothing and needs no setup. It requires Chrome/Edge and internet; Whisper comes later for all browsers and offline play.

## D-007: Synthesized sound (Web Audio), no audio files
- **Alternatives:** CC0 sound packs.
- **Why:** No asset management in Phase 0, and every sound can be tuned in code. Packs can replace it later behind the same `SfxApi`.

## D-008: Talking alone never casts
- **Alternatives:** voice-only casting.
- **Why:** The game must ignore normal conversation. Casting needs a trace; voice confirms it and adds power.

## D-009: Protractor primary, $1 baseline, chosen by benchmark
- **Alternatives:** $1 only; $P point-cloud.
- **Why:** Protractor computes the best rotation in closed form instead of searching, so it stays fast as templates per spell and spell counts grow. Its original evaluation matched or beat $1, but our gestures and webcam noise are what matter. Both sit behind one interface, and the benchmark on real recorded samples decides in T14.

## D-010: $P rejected for v1
- **Alternatives:** $P / $Q point-cloud recognizers.
- **Why:** Point clouds throw away stroke order and direction, which our spells depend on (swish *then* flick). Multi-stroke runes aren't in the design; if they ever are, $P becomes another `GestureRecognizer` and the benchmark judges it.

## D-011: Interim speech confirms, never rejects
- **Alternatives:** act on interim results fully; finals only (slower).
- **Why:** Interim text keeps casts fast but changes as you speak. Letting it confirm a gesture that already agrees is safe; letting it trigger a mismatch fizzle is not.

## D-012: Power = precision, defined per spell as data
- **Alternatives:** mic volume (RMS) + gesture velocity as the main power input.
- **Why:**
  - It fits the game's idea that magic is a skill.
  - Raw volume depends on mic gain and distance, and makes the player shout, which is a problem in a hostel or late at night.
  - Rewarding speed encourages flailing, which also hurts recognition at 25–30 fps tracking.
  - Velocity is already logged; velocity, volume or hold-time can join later as extra signals with per-spell weights, without touching the quality logic.

## D-013: Smoothing only on the wand point; pinch uses raw landmarks
- **Alternatives:** filter everything.
- **Why:** The wand point needs smoothness; the pinch needs instant response. Hysteresis handles pinch noise without adding lag.

## D-014: Shapes and distances are measured in square units (spec review A)
- **Decision:** Events keep normalized [0,1] coordinates. Anything that measures a shape, distance or speed first converts to square units (x × stage aspect). `trace:complete` carries the `aspect`.
- **Alternatives:** measure in raw normalized space; make the normalized space itself square (letterboxed); rely on $1's per-axis scaling.
- **Why:**
  - On a 16:9 screen, a circle that looks round is an ellipse 0.56 as wide as tall in normalized space. Protractor scores even a perfect on-screen circle only about 0.83 against the round template (threshold 0.80), which leaves no room for hand jitter.
  - $1 scales each axis separately, so it would be immune by accident and the benchmark would favour it for the wrong reason.
  - Hit radii (Leviosa reach, Incendio burst) would be ellipses on screen.
  - Carrying the aspect in the event keeps recognition free of screen code and lets recorded traces replay correctly.

## D-015: Pinch ratio from 3D world landmarks (provisional; spec review A)
- **Decision:** Compute distance(4, 8) / distance(0, 9) in 3D from MediaPipe's `worldLandmarks`. If that is too noisy, fall back to 2D landmarks with x scaled by the video's width / height. T5 decides from the debug bar, which shows both, and retunes the 0.28 / 0.40 thresholds.
- **Alternatives:** 2D normalized landmarks (the original spec); aspect-corrected 2D only.
- **Why:** In the 4:3 camera image, a 2D normalized ratio shifts by roughly 25–33% depending on hand angle, and it inflates when the hand points toward the camera (the palm looks shorter). That is a natural wand grip. World landmarks are metric 3D, so neither effect applies. They are model estimates and may be noisier, so real data decides.

## D-016: One tracked hand; the wrong hand counts as no hand (spec review B)
- **Alternatives:** `numHands: 2`, then pick the preferred hand.
- **Why:** Phase 0 needs one wand hand. With two hands allowed, MediaPipe keeps running palm detection to look for the second hand, which is costly on integrated graphics. The cost of this choice: if both hands are in view, tracking may lock onto the wrong one, and the player has to lower it. MediaPipe's handedness labels assume a mirrored image, so they are swapped for raw webcam frames.

## D-017: The stage is always dim; Lumos brightens it (spec review C)
- **Alternatives:** a normally lit stage that goes dark while Lumos is active; a fully dark stage.
- **Why:** A light spell that darkens everything else would feel backwards. A dim stage keeps the feather and cobweb visible for the other spells and leaves the hidden message for Lumos to reveal.

## D-018: Unrecognized shapes fizzle at once; a late spell name updates the hint (spec review D)
- **Decision:** `spell:miscast` `unrecognized-shape` fires immediately. If a spell is heard within the window afterwards, fusion emits the new `spell:miscastHeard` event and the result card names that spell in its hint. No second fizzle plays, and a hint never uses up the voice match. Gesture-only mode: immediate fizzle, no hint update.
- **Alternatives:** wait out the 1.5 s window before fizzling (the first proposal); ignore voice for unrecognized shapes.
- **Why:** Instant feedback matters more than a perfect hint, and a fizzle that arrives 1.5 s late feels laggy. A separate follow-up event keeps the hint useful without delaying the fizzle or playing a second effect. Leaving the voice match unused means a quick retry while saying the word can still cast.

## D-019: "No console errors" means errors from our code (spec review E)
- **Alternatives:** keep the strict wording; filter or patch MediaPipe's logging.
- **Why:** MediaPipe's wasm prints its own startup lines, some through `console.error`, and we don't control them. Filtering console methods could hide real errors. Instead, T4 lists the known lines in `PROGRESS.md` and AC-12 excludes them.

## D-020: Per-spell rotation tolerance (Lumos 180°)
- **Decision:** `SpellDef.rotationToleranceDeg`: Lumos 180, Leviosa 30, Incendio 30. Protractor clamps to each template's tolerance. $1 searches within it, with a coarse scan before golden-section search above 45°.
- **Alternatives:** one global ±30° (Lumos must start at 12 o'clock); fully rotation-invariant recognizers.
- **Why:** For a circle, starting at another clock position is the same as rotating it, so ±30° rejected a circle started at 3 o'clock. Direction still matters for the other spells. Rotation can never mirror a shape, so an anticlockwise circle still fails as Lumos, and a T7 test proves it. The tolerance is spell data, so each future spell picks its own.

## D-021: HTTPS static hosting from T1; Chrome on Mac supported (spec review F)
- **Decision:** From T1, deploy the static build over HTTPS on Vercel, connected to the GitHub repo, so each push to the main branch updates the production link. Supported: Chrome on Windows (development laptop) and Chrome on macOS (the reviewer's Retina MacBook, DPR 2). Edge on Windows is second; Safari is not supported. AC-15 checks the deployed link on a Mac before it is shared.
- **Alternatives:** deploy only at the end of Phase 0; local demos only.
- **Why:** The professor reviews from a link on a MacBook. Deploying from T1 makes every task reviewable and surfaces deploy problems (HTTPS, asset paths, macOS camera and mic permissions) early instead of at the end. DPR 2 means 4× the pixels per frame, so FR-17 caps the device pixel ratio with a tunable value.

## D-022: Commit the hand model
- **Alternatives:** download it at install or build time; load it from Google's CDN at runtime.
- **Why:** Deploys never depend on a third-party download succeeding, and builds are reproducible. About 8 MB in git is acceptable. FR-2 already rules out a runtime CDN. The wasm files stay generated from `node_modules`, whose version the lockfile pins.

## D-023: HUD text is HTML/CSS over the canvas, never canvas text
- **Decision:** The result card, spell cards, mic indicator, toasts, the PiP's labels and the debug overlay's text are HTML/CSS elements layered over the canvas. Spell-card shapes are inline SVG. Only world text, such as the notice board's message, is drawn on the canvas, because Lumos's light has to reveal it.
- **Alternatives:** draw HUD text on the canvas; a second, full-resolution canvas just for the HUD.
- **Why:**
  - The DPR cap (FR-17) renders the canvas below native resolution on a Retina Mac and on scaled Windows displays, so canvas text would be stretched and blurry. The browser draws HTML text at native resolution whatever the cap.
  - HTML gets proper font rendering, CSS styling for one consistent HUD look (T13), and text that screen readers can read.
  - A second full-resolution canvas would bring back the pixel cost the cap exists to avoid.
  - The cost: HUD updates go through the DOM rather than the render loop. That is fine for elements that change a few times per second, and the debug overlay throttles its text refresh for that reason.

## D-024: Tooling setup (T0)
- **Decision:**
  - ESLint uses `typescript-eslint` (type-aware `recommendedTypeChecked`) and `eslint-config-prettier`, so ESLint checks correctness and Prettier owns formatting.
  - `noUncheckedIndexedAccess` is on.
  - `npm run lint` also runs `prettier --check`, so formatting is enforced by the standard check.
  - Prettier skips Markdown, so hand-written docs are never rewritten.
  - `build` type-checks before bundling, so Vercel refuses a build with type errors.
  - Node ≥ 22.12, because Vitest 5 requires it.
- **Alternatives:** plain ESLint without type information; formatting rules in ESLint; letting Prettier format docs.
- **Why:**
  - Type-aware linting catches unhandled promises and unsafe `any` flows, which matter around camera, mic and model loading.
  - `noUncheckedIndexedAccess` makes `points[i]` possibly `undefined`, catching off-by-one bugs in landmark and trace code at compile time. It costs a few explicit checks in loops.

## D-025: Layer boundaries are enforced by lint (T0)
- **Decision:** ESLint's built-in `no-restricted-imports` and `no-restricted-globals` rules, set per folder, block:
  - core importing any layer;
  - perception importing presentation, scenes or spells;
  - recognition importing presentation, scenes or the effect registry;
  - scenes importing MediaPipe or the tracker/speech wrappers, or touching `SpeechRecognition`.
- **Alternatives:** rely on review; `eslint-plugin-boundaries` (another dependency).
- **Why:** The CLAUDE.md rules become a failing check instead of something to remember, with no new dependency. "Layers talk only through the bus" can't be fully checked this way, so review still covers it.

## D-026: Settings validated per field, storage injected (T0)
- **Decision:** Each settings field is checked on its own; a bad value falls back to that field's default, missing fields are filled in, and unknown fields are dropped. Corrupt JSON or a non-object gives all defaults. Storage is passed in (`KeyValueStore`); `browserStore()` falls back to memory if `localStorage` is blocked, and a failed save returns `false`.
- **Alternatives:** discard the whole saved object on any problem; read `localStorage` directly.
- **Why:** One bad value shouldn't reset the player's volume and language, and adding a setting later shouldn't wipe saved ones. Injected storage keeps the tests free of a browser (no jsdom), and blocked storage (privacy mode, quota) can never crash the app.

## D-027: Node 24.x pinned in `engines` (T1)
- **Decision:** `"engines": { "node": "24.x" }`.
- **Alternatives:** `22.x`; a range such as `^22.12.0 || >=24.0.0`.
- **Why:** 24 is the major version used locally, and Vercel supports 24.x (its default) and 22.x, with `engines.node` overriding the project setting. Pinning one major means local, CI and Vercel builds run the same Node. Vitest 5 also needs ≥ 22.12, which 24.x satisfies.

## D-028: `?dprCap=` URL override for measuring (T1)
- **Decision:** A `?dprCap=<0.5–3>` query parameter overrides the DPR cap in `tuning.ts`. It works in production too, and the debug overlay shows where the cap came from.
- **Alternatives:** rebuild with a different cap for each measurement; dev builds only.
- **Why:** Choosing the cap means comparing fps at several caps on two machines, and the Mac check happens on the deployed link. The override only changes sharpness, so leaving it in production is harmless.

## D-029: The background belongs to the practice stage and is cached (T1)
- **Decision:** The stone background is in `scenes/`, drawn once into an offscreen canvas and copied with one `drawImage` per frame. It is redrawn only after the stage size has been stable for `RENDER.resizeSettleMs`; until then, the old image is stretched. A fixed seed makes the wall identical on every load.
- **Alternatives:** draw the stones every frame; put the background in `presentation/`.
- **Why:** Drawing ~150 shaded stones with gradients every frame would waste integrated-GPU time for an image that never changes. Redrawing during a drag would stutter. The practice stage is throwaway (Phase 1 is 3D), so its art lives with the scene and is deleted with it.

## D-030: fps is measured up to "now" (T1)
- **Decision:** The fps meter counts frames in a sliding window and divides by the time from the oldest frame to *now*, not to the newest frame.
- **Alternatives:** average the last N frame intervals.
- **Why:** If frames stop (a stall or a freeze), an interval average keeps showing the last good number. Measuring up to now makes the reading fall, which is what the AC-2 measurement needs. The same meter will measure tracking fps in T4.

## D-031: The background has a brightness budget (T1 follow-up)
- **Decision:** Background changes must keep mean screen luma at or below the T1 level (17.4 / 255 at 1600×900), measured from a headless Chrome screenshot. After the polish pass it is 15.5.
- **Alternatives:** judge brightness by eye.
- **Why:** The trail and spell effects must be the brightest things on screen. Monitors and eyes differ, but a measured mean is repeatable, so later art changes can be checked against the same number.

## D-032: The final DPR cap is set after T11 (T1 follow-up)
- **Decision:** The cap stays at 1.5 (provisional). Render fps is re-measured with Chrome forced to DPR 2 in T2 (with the trail) and T11 (with Lumos and Incendio running), and the cap is set for good after T11.
- **Alternatives:** fix the cap in T1 from the empty stage.
- **Why:** The empty stage costs almost nothing per frame, so a T1 measurement says little. The trail (T2) and full-screen light effects (T11) are the real per-pixel costs, and the DPR-2 Retina reviewer is the worst case for pixel count.
