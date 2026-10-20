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

## D-033: Stroke playback demo and scripted measurement (T2)
- **Decision:**
  - `dev/strokeDemo.ts` plays the three spell shapes at slow and fast speed, through the same 30 Hz sampler as the mouse. It runs on a stepped clock (1/60 s per frame) and can freeze mid-stroke (`?demo=…&at=0.85`).
  - `?demo=loop` draws continuously on real time.
  - `?reportFps=1` logs fps, the longest frame gap and our work time once a second.
  - Screenshots and fps runs drive Chrome through its DevTools protocol (screenshots, device emulation, synthetic mouse events) from a throwaway script outside the repo.
  - DPR-2 measurements use device emulation at 1440×900 and DPR 2, not `--force-device-scale-factor=2`.
- **Alternatives:** judge only by hand; Puppeteer or Playwright (new dependencies); Chrome's `--screenshot` flag (it captures before any animation runs, and its virtual-time mode doesn't produce animation frames).
- **Why:**
  - The trail has to be judged at hand rate before a hand exists, and judged the same way after every tweak. A stepped clock makes screenshots repeatable.
  - Forcing the scale factor on a 1080p screen only halves the CSS size; emulation is the only way to put the Retina pixel count (2880×1800) on this laptop's GPU.
  - The demo code is downloaded only when `?demo=` is present.
  - Visible-window runs need Chrome's anti-throttling flags, because Chrome pauses rendering for windows hidden behind others.

## D-034: The trail is drawn slightly in the past, interpolated (T2)
- **Decision:** The trail head is drawn at `now − delay`, with the delay at 1.25 × the measured input interval: about 42 ms at 30 Hz, and the 4 ms minimum with a mouse. Positions between samples come from the spline. The rate estimate ignores gaps under 4 ms (a final position and the release arrive together) and over 200 ms (pauses).
- **Alternatives:** draw up to the newest sample (at hand rate the head jumps every 33 ms, which shows as stepping at 60 fps); predict ahead (overshoots on every change of direction).
- **Why:** With 30 Hz input there is always a next sample to slide toward, so motion is smooth at 60 fps. The 25% margin absorbs uneven camera frame timing. The cost is about 42 ms of extra delay at hand rate, inside NFR-2's 100 ms budget, and invisible with a mouse.

## D-035: Centripetal Catmull-Rom, in square units (T2)
- **Decision:** The spline is Catmull-Rom with α = 0.5 (centripetal), computed in square units.
- **Alternatives:** uniform Catmull-Rom; straight lines between samples.
- **Why:** At 30 Hz a fast stroke has very uneven sample spacing. Uniform Catmull-Rom loops and overshoots there; the centripetal version does not. Straight lines would show the 30 Hz polygon. Square units keep the curve's shape the same on any screen.

## D-036: Glow from pre-built sprites; core in age bands; sprites built at startup (T2)
- **Decision:**
  - Wide and inner glow are radial sprites stamped along the trail with additive blending, spaced in proportion to their size.
  - The thin core is stroked as continuous paths in 14 age bands, each with its own width and alpha.
  - Sprite colours come from inputs rounded to fixed grids (trail position 1/40, energy 1/8, release 1/16, sparkle warmth 1/32), and the full set (180 sprites) is built at startup.
- **Alternatives:** `shadowBlur` or `ctx.filter` (very slow on integrated graphics; ruled out); one stroke per segment (bright beads where additive line caps overlap); building sprites on first use.
- **Why:** Building sprites on first use caused 33–50 ms hitches the first time a new colour appeared, such as the first gold flash. Rounding the inputs makes the set exact, so a test can prove no sprite is ever built mid-stroke. Measured result: no frame gap over 18 ms while drawing.

## D-037: The M key moves to T5; release outcome is a dev preview until T7 (T2)
- **Decision:** M (mouse ↔ hand) is built in T5. Until T7, a released stroke uses the debug overlay's "Release preview" (fade, gold or grey); T7 sets it from `gesture:recognized`.
- **Alternatives:** an M key that toggles to nothing; a fake recognizer.
- **Why:** Neither has anything real to connect to yet. The renderer already supports all three outcomes, so their look can be judged now.

## D-038: The wand dot replaces the cursor over the stage (T2)
- **Decision:** The stage hides the system cursor (`cursor: none`); the glowing dot is the cursor.
- **Alternatives:** show both.
- **Why:** The dot is drawn a few milliseconds in the past (D-034), so an arrow would visibly lead it, and an arrow on a magic stage breaks the feel. The debug panel keeps a normal cursor.

## D-039: Tuning numbers in one file per layer, behind one index (T2 follow-up)
- **Decision:** The numbers live in `src/config/tuning/{input,perception,recognition,presentation,scenes,dev}.ts`. `src/config/tuning.ts` re-exports them all, and code always imports from `config/tuning`. Lint rejects imports from a layer file.
- **Alternatives:** keep one file (it had reached 329 lines and grows every task); let code import layer files directly.
- **Why:** Files stay under the 250-line guideline and a layer's numbers are found in one place. A single import path means a number can move between files without touching any code that uses it.

## D-040: A dependency-free fps measurement script (T2 follow-up)
- **Decision:** `scripts/measure-fps.mjs` (`npm run measure:fps`) turns the T2 measurement method (D-033) into a repeatable tool:
  - It starts `vite preview` (Vite's own script, run with Node, no shell).
  - It opens a visible Chrome with a throwaway profile and anti-throttling flags.
  - It runs native and emulated-Retina cases at caps 1.5 and 2, idle and drawing.
  - It prints a Markdown table, using Node's built-in `fetch` and `WebSocket` to talk to Chrome's DevTools protocol.
- **Alternatives:** Puppeteer or Playwright (a large dependency); reading the debug overlay by hand (slow, and it can't see frame gaps).
- **Why:** T4, T11 and T14 all need the same fps numbers, measured the same way. Frame gaps and work time per frame show what fps alone hides: stalls, and how much of the frame budget is left.

## D-041: One art direction and a UI kit before any HUD work (T2b)
- **Decision:** `docs/ART_DIRECTION.md` defines the look: palette, type, materials, motion, spell colours, sound, IP guardrails. `src/ui/` implements it as design tokens plus six components (parchment panel, wax-seal button, ink-note toast, gilded frame, spellbook page, grade badge). Every HUD element from T3 on is built from the kit.
- **Alternatives:** style each HUD element in its own task; a CSS framework.
- **Why:** HUD pieces built one task at a time drift into several styles. A kit built once, judged once in `?dev=ui`, and enforced by tokens keeps the game looking like one world, and later tasks only assemble.

## D-042: Fonts: Cinzel Decorative, Cinzel, EB Garamond, Pinyon Script, self-hosted (T2b)
- **Decision:** OFL fonts, latin subset woff2 in `public/fonts/` (163 KB) with their licences committed. Cinzel Decorative for titles and spell names; **plain Cinzel** for small labels and buttons; EB Garamond for body; Pinyon Script for handwriting. IM Fell English and Petit Formal Script sit in `public/fonts/compare/` for the side-by-side comparison in `?dev=ui`; the losers get deleted once you choose.
- **Alternatives:** Google Fonts CDN (third-party request on every load, and FR-2's no-CDN spirit); Cinzel Decorative everywhere.
- **Why:** Self-hosting keeps the game offline-capable and private. Cinzel Decorative's swashes blur below about 18 px, so labels use its plain sibling.

## D-043: Textures and ornaments are procedural and original (T2b)
- **Decision:** Paper grain and stains, gilt streaks and torn edges are SVG noise (inline data URIs and SVG filters); flourishes and seal marks are SVG paths drawn for this project. No image files.
- **Alternatives:** CC0 texture photos.
- **Why:** NFR-8 and the IP guardrails are easiest to keep when there is nothing to license. Procedural textures also scale to any DPR, and cost nothing per frame once rendered.

## D-044: Contrast is a unit test, not a review step (T2b)
- **Decision:** `src/ui/contrast.test.ts` reads the real colour values from `theme.css` and checks every text colour against every parchment shade: 4.5:1 for body, 3:1 for large text. The green handwriting is held to the body bar.
- **Alternatives:** check by eye; an accessibility audit at the end.
- **Why:** It caught a real problem straight away: the first gold for the O grade was only 1.75:1 on the darkest parchment. It is now an antique gilt (`#825f23`, 3.06:1); the badge's bright rim and glow carry the shine.

## D-045: Grades are a presentation mapping; tiers stay in the spell code (T2b)
- **Decision:** `src/ui/grades.ts` maps `strong / normal / weak` to O / E / A, and any miscast to P. Recognition, fusion and quality keep their tier names.
- **Alternatives:** rename tiers to grades everywhere.
- **Why:** Grades are a way of showing a result to the player. Keeping them in presentation means the look can change (or a later phase can show something else) without touching the scoring logic.

## D-046: HUD panels are built once and reused (T2b)
- **Decision:** A HUD panel is created once and shown or hidden with opacity, never rebuilt per use. Filters stay on static layers; animations change only transform and opacity.
- **Alternatives:** create panels on demand.
- **Why:** Measured at emulated Retina: a freshly created parchment panel costs one dropped frame (a 33 ms gap) while its filtered paper is first painted. That is fine for a rare camera message but not for the result card after every cast.

## D-047: The game title is a placeholder until T13 (T2b)
- **Decision:** Everything that shows the title uses `GAME_TITLE` from `src/ui/brand.ts` (now `[Game Title]`). Seals carry an original star or star-over-wand mark.
- **Alternatives:** pick a working title now.
- **Why:** The name is still to be decided. One constant means T13 changes one line, and nothing hints at an official name or logo in the meantime.
