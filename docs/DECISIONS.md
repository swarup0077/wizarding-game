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

## D-048: Final fonts: IM Fell English, Pinyon Script, Cinzel Decorative throughout (T2b follow-up; updates D-042)
- **Decision:** Body text is IM Fell English, handwriting is Pinyon Script, and Cinzel Decorative is used for titles, spell names **and** small labels. EB Garamond, plain Cinzel and Petit Formal Script were removed with their licences (5 files, 187 KB remain).
- **Alternatives:** EB Garamond for body and plain Cinzel for labels (my recommendation, for legibility at HUD sizes).
- **Why:** Chosen by eye from the side-by-side comparison: IM Fell English's old-print texture and Cinzel Decorative's swash capitals give the strongest period feel. Legibility checked at DPR 2: body, italic hints, labels and the green address all read clearly. To keep it that way, labels stay bold, uppercase and at least 13 px, with ligatures off, and body text stays short. Cinzel Decorative's capitals give "THE" a joined look even with ligatures off; that is the font's design, accepted with the choice.

## D-049: Input reports a camera failure kind; presentation words it (T3)
- **Decision:** `input/cameraErrors.ts` turns a getUserMedia error plus the permission state into one `CameraFailureKind` (10 kinds, in `core/types.ts`). `presentation/hud/cameraCopy.ts` turns a kind and the platform (mac / windows / other) into a title, a body with the next step, and whether Retry can help. The camera toasts ("Using the mouse…", "Camera allowed…") are also chosen in presentation, from `camera:status` changes, not emitted by the controller.
- **Alternatives:** one function in input from error name to message; text carried on `camera:status` (as `voice:status.message` allows).
- **Why:** Input never knows how anything is shown, so wording can change (or be translated) without touching input, and a lint rule now enforces it. Both steps are pure, so every case is tested, including the full chain from a DOMException to the words.

## D-050: Telling the three NotAllowedErrors apart (T3)
- **Decision:** In order: Chrome's message contains "by system" → `denied-by-system`; it contains "dismissed" → `dismissed`; the Permissions API says `granted` → `denied-by-system` (the site is allowed, so something below Chrome refused); otherwise `denied-by-user`. The "you clicked Block" message on a Mac or Windows also mentions the system privacy page, in case the permission couldn't be read.
- **Alternatives:** the Permissions API alone; one message for every NotAllowedError.
- **Why:** Chrome's message text is the most direct signal of an OS block (macOS System Settings → Privacy & Security → Camera), and the permission state is the fallback. The fixes are in different places (the address-bar camera icon vs System Settings, plus a Chrome relaunch on macOS), so one message would send half the players to the wrong place. A dismissed prompt gets its own message because Retry really does ask again.

## D-051: Camera recovery is a pure state machine with attempt numbers (T3)
- **Decision:** `input/cameraFlow.ts` (idle → starting → live / failed / off) decides what every click, result and browser event does. Rules: a click while starting is ignored; a permission change to `granted` restarts the camera by itself only after the player asked and was refused; an ended track stops the camera and reports `ended` (or `denied-by-user` if access was revoked), with the mouse active meanwhile; each start has an attempt number, and a success from a stale attempt (for example after "Use the mouse") is stopped at once. The camera never starts on load, even when permission was granted on an earlier visit: it waits for the click.
- **Alternatives:** callbacks and flags inside the browser wrapper; auto-starting when the permission is already granted.
- **Why:** The races (a prompt still open while the player picks the mouse, a permission change arriving during a retry) are where camera code usually breaks. As a pure reducer they are unit-tested, and the browser wrapper stays thin. Waiting for the click matches the T13 letter flow and means the camera light never comes on unexpectedly.

## D-052: HUD buttons talk back through `ui:action` (T3)
- **Decision:** A new `ui:action` event `{ id: UiActionId; t }`, where `UiActionId` is a string union ('camera.enable' | 'camera.retry' | 'camera.useMouse'). `system:message.action.id` uses the same type, so a toast's button takes the same path.
- **Alternatives:** callbacks wired in `main.ts`; one event per button.
- **Why:** Layers talk only through the bus (CLAUDE.md). One typed event covers every HUD button, and a new action is one new member of the union.

## D-053: One <video>, mirrored by CSS; T3's mouse mode lasts the session; no Retry where it can't help (T3)
- **Decision:**
  - `input/camera.ts` owns the session's single `<video>` element. The preview shows it now and the hand tracker (T4) will read it, so the stream is decoded once. It is mirrored with `transform: scaleX(-1)` and sits in a 4:3 window (`object-fit: cover`).
  - The preview, the card and the toast slots are built once and shown with opacity. The card also drops the kit's `wg-unroll` class when hidden, because that animation's fill mode holds it at full opacity, and it is `inert` while hidden.
  - "Use the mouse instead" is not saved to `settings.inputMode` in T3. T5 (the M key) starts saving it.
  - The insecure-page and no-camera-API cards have no Retry, only "Use the mouse instead".
- **Alternatives:** a second video element for the tracker; saving mouse mode now; Retry on every card.
- **Why:** Two elements would decode the stream twice. Saving the choice before there is a way back (no M key until T5, no settings panel until T13) would hide the camera for good. A Retry that cannot work misleads.

## D-054: Automated camera runs always use Chrome's fake camera (T3)
- **Decision:** Every scripted Chrome run that may touch the camera (`measure:fps` and screenshot scripts) passes `--use-fake-device-for-media-stream`. The real "no camera" path is checked through the dev trigger (`?dev=camera&fail=not-found`), not by launching Chrome without the fake device.
- **Alternatives:** a headless run without the fake device to get a real NotFoundError.
- **Why:** In T3 a headless run without the fake device (meant to produce NotFoundError) opened this laptop's real webcam for a few seconds and captured a frame. The image was deleted at once and never left the machine. The fake camera makes every scripted run private and repeatable.

## D-055: The webcam preview frame is a style setting; minimal by default (T3 follow-up)
- **Decision:** The kit's frame is now `pictureFrame(content, { style, plate })`, with one DOM for every style: the window, four corner flourishes and a name plate. Each style is one `.wg-frame--<name>` block in `src/ui/kit/frame.css` that decides what to show, and ornaments are hidden unless a style turns them on. Styles: `minimal` (the default: a faint parchment hairline, 6 px corners, a soft shadow, no ornaments, all from new theme tokens) and `portrait` (the T2b gilded frame, kept unchanged). The `previewFrame` setting picks one and can switch live (`setFrameStyle`, no rebuild). The names live in `PREVIEW_FRAMES` (core/settingsTypes.ts), so a new style is its CSS block plus its name in that list.
- **Alternatives:** replace the gilded frame outright; a separate component per style; a free-text setting so a style is CSS only.
- **Why:** You want to judge the frame against the real room backgrounds in Phase 1/2 (LATER.md), so both stay available and switching costs nothing. The name list is the one line beyond CSS: it lets the settings validator reject a typo, and gives T13's settings panel and the `?dev=ui` gallery the list of styles to offer (the gallery shows every style by itself).

## D-056: Hiding the preview hides only the picture (T3 follow-up)
- **Decision:** P (and later T13's settings toggle) sends `ui:action` `preview.toggle`. The settings store flips `showPreview`, saves it and emits `settings:changed`. The preview fades its frame to opacity 0. The `<video>` keeps playing and the camera stays on, and a small status chip (a new kit **status tag**) shows "Camera on", then "hand seen" or "hand lost" in red ink, from `hand:found` / `hand:lost`. Hiding it shows one toast saying the camera still follows the hand.
- **Alternatives:** stop the camera when hidden; `display: none` on the video; no chip.
- **Why:** The hand is the wand, so hiding the picture must never stop tracking. With opacity, the browser still presents every frame: measured with `requestVideoFrameCallback` on the hidden preview, 21 frames in 1 s from the 20 fps fake camera, so T4's tracker keeps its input. `display: none` risks the browser skipping frames for an element it doesn't render. The chip keeps the feedback that the picture gave, which matters most for "hand lost".

## D-057: Shortcut keys and a live settings store (T3 follow-up)
- **Decision:**
  - `input/keyboardActions.ts` maps shortcut keys to `UiActionId`s. Pure: `actionForKey` ignores repeats, modifier combinations (Ctrl+P still prints) and typing in fields.
  - `settings/settingsStore.ts` holds the session's settings. `update()` validates field by field, saves, and emits `settings:changed` with the changed field names; `settingsPatchForAction` turns actions into setting changes.
  - The `Settings` type moved to `core/settingsTypes.ts`, because core may not import `settings/` and the event has to carry the type.
  - The camera controller stays off on `?dev=ui`, so the live camera card no longer covers the gallery.
- **Alternatives:** each HUD module handling its own key and writing localStorage itself; untyped settings events.
- **Why:** A key and a settings checkbox now share one path. T5's M key and T13's S key are one line each, and T13's panel only calls `update()`. The debug overlay's D key stays in the dev tool.

## D-058: MediaPipe assets: pinned package, classic wasm copied at install and build, model URL "/1/" (T4)
- **Decision:**
  - `@mediapipe/tasks-vision` is pinned to exactly `1.1.1` (no caret), because the wasm and the JavaScript must match.
  - `scripts/copy-mediapipe.mjs` copies the four classic wasm files (SIMD and no-SIMD) into the git-ignored `public/mediapipe/wasm/`. It runs from `postinstall` **and** `prebuild`.
  - The `_module_` variant (13.5 MB) is left out until something uses it.
  - `scripts/fetch-model.mjs` downloads `…/float16/1/hand_landmarker.task` once. It is committed: 7,819,105 bytes, SHA-256 `fbc2a300…07cde1`.
- **Alternatives:**
  - a caret range;
  - copying every wasm file;
  - the official guide's `…/float16/latest/…` URL.
- **Why:**
  - `prebuild` guarantees a build never ships without the wasm, even if a host restores a cached `node_modules` and skips `postinstall`.
  - On 2026-10-21 `/1/` and `/latest/` served the same file (same size, same MD5, which matched our download). The versioned URL means a rerun can never silently fetch a different model.
  - `vite preview` serves `.wasm` as `application/wasm`. Vercel is checked after the push.

## D-059: The tracker loads on "Enable camera" and says so (T4)
- **Decision:**
  - The tracker starts loading on the first `camera:status` `starting`, so the download (about 13 MB wasm plus 7.8 MB model) overlaps the permission prompt.
  - While it loads, the preview corner's status chip reads "Readying your wand…": above the picture, or in its place when the preview is hidden.
  - It reports through two new events: `tracker:status` (loading / ready / failed, with the delegate and the GPU's failure reason) and `tracker:slow`.
  - Presentation turns them into words (`trackingCopy.ts`). A failure becomes an error ink note offering the mouse. The slow tip is a warn ink note, at most once a minute.
- **Alternatives:**
  - load on page load;
  - text carried on the event;
  - one event with a "slow" state.
- **Why:**
  - Mouse-only players never download 20 MB.
  - Perception reports facts and presentation words them, the same split as D-049.
  - Lifecycle and slowness are separate facts. A tracker can be ready and slow.

## D-060: Detection is per video frame, gated, with strictly increasing timestamps (T4)
- **Decision:**
  - `requestVideoFrameCallback` drives detection, with a rAF loop that polls the frame count as a fallback.
  - A pure `detectScheduler` skips frames it has seen, never starts a detection while one is running, and hands out `max(round(now), last + 1)` as the timestamp. The timestamp never resets, even across camera restarts or a delegate swap.
  - If the GPU throws mid-session, the scheduler stays busy while the landmarker is recreated on the CPU, so no frame can use a half-built one.
  - `hand:landmarks` is emitted for every analysed frame, with `[]` when no hand is found.
- **Alternatives:**
  - detect from the render loop;
  - emit landmarks only when a hand is found, and time out the skeleton.
- **Why:**
  - MediaPipe's VIDEO mode rejects non-increasing timestamps.
  - Detecting on the camera's schedule means no frame is analysed twice and none is waited for.
  - An explicit empty frame is simpler and more honest than a timeout.
  - The 300 ms "hand lost" grace is T5's job, in one place.

## D-061: Only handTracker.ts may import MediaPipe (T4)
- **Decision:** a lint rule (`no-restricted-imports`) bans `@mediapipe/*` everywhere except `src/perception/handTracker.ts`. Checked with a throwaway violating file.
- **Alternatives:** the scenes-only ban from T0.
- **Why:** if detection moves to a Web Worker, exactly one file changes. ESLint's rule can't see dynamic `import()`, so review covers that case.

## D-062: The skeleton is candle gold, drawn per detection, never while hidden (T4)
- **Decision:**
  - The skeleton is a canvas in the picture frame's new overlay slot (`.wg-frame__overlay`, every frame style). It is drawn when each frame's landmarks arrive, not from the render loop.
  - Bones are a thin `--gold-400` line over a wider faint `--gold-600` glow: two plain strokes, no `shadowBlur`.
  - Joints are `--gold-200` dots. The thumb and index tips are larger `--parchment-100` beads with a gilt halo.
  - Colours are read from the theme tokens at first draw.
  - Points go through `coverFit`, the same `object-fit: cover` crop as the picture.
  - Nothing is drawn while the picture is hidden (P), and the canvas is cleared, so it never reappears showing an old hand.
- **Alternatives:**
  - MediaPipe's `DrawingUtils` with debug colours;
  - drawing from the render loop with interpolation.
- **Why:**
  - The skeleton belongs to the art direction.
  - Drawing per detection keeps it in step with the picture frame it came from.
  - Without `coverFit`, a 16:9 webcam's skeleton would drift sideways, because the picture crops its sides.

## D-063: Jank is measured with real time, not only rAF timestamps (T4)
- **Decision:** `?reportFps=1` also logs `wallGapMs` (the longest real gap between rAF callbacks) and `late` (callbacks more than 25 ms after the previous one). `measure-fps` shows them as "Longest real gap" and "Late frames per s".
  - It also flags a run as INCOMPLETE, and exits with code 2, when the page logged far fewer seconds than it ran. That happens when the display sleeps or the window is minimized.
- **Alternatives:** keep the T2 metric (gaps between rAF timestamps).
- **Why:**
  - Chrome aligns rAF timestamps to vsync. A frame whose callback ran 20–30 ms late, because a hand detection ran just before it in the same rendering step, still shows a 16.7 ms timestamp gap.
  - In T4's first runs the old metric read 60 fps and a 17.5 ms longest gap, while real gaps reached 47–57 ms about 20 times a second: one per detection.
  - Measured on the idle stage, the two metrics agree (18 ms), so earlier tables stay valid.

## D-064: Hand detection runs in a Web Worker; frames go as VideoFrames with their capture time (T4 part 2)
- **Decision:**
  - Detection runs in a classic dedicated worker. `handTracker.ts` stays the only module other layers know, and the events are unchanged. It drives one of two backends behind one interface:
    - `detectors/workerBackend.ts` (main side) plus `worker/handWorker.ts`;
    - `detectors/mainThreadBackend.ts`, the fallback.
  - MediaPipe is imported only by `landmarkerFactory.ts`, which both backends share. Lint enforces it.
  - **Frame transfer:**
    - Per new camera frame (rVFC), the main thread makes `new VideoFrame(video)`, keeps a `clone()` handle and transfers the frame. That costs 0.12 ms mean / 0.30 ms p95 on the main thread.
    - One frame is in flight at most. Frames that arrive while the worker is busy are skipped: no VideoFrame is made.
    - The newest skipped frame is sent the moment the result arrives (catch-up).
  - **Timing:** each frame carries its rVFC `captureTime` (main-thread clock). The worker echoes it back, and MediaPipe's timestamp, `HandFrame.t` and `hand:landmarks.t` all use it. The worker never touches a clock, so the two threads' time origins never mix.
  - **Warm-up:** the landmarker runs one detection on a blank frame before reporting ready. The first-use cost then falls inside "Readying your wand…", and a GPU that creates fine but fails its first detection falls back to the CPU at start.
- **Alternatives (measured in a scratch harness: Chrome 155, Iris Xe, the hand clip, a worker simulating a 25 ms detection, a full-window canvas redrawn every frame):**

  | Way | Render fps | Late frames per s | Results per s | Main-thread cost per frame | Capture → result |
  |---|---|---|---|---|---|
  | No transfer (baseline) | 59.0 | 0.06 | – | – | – |
  | VideoFrame | 58.9–59.1 | 0.06 | 24.9–28.4 | 0.12 / 0.30 ms | 34–36 ms |
  | **VideoFrame + catch-up (chosen)** | 59.1 | 0.13 | **29.4** | 0.12 / 0.30 ms | 35 ms |
  | Processor stream transferred to the worker | 59.0 | 0.06 | 29.5 | no JS (stream plumbing on the main thread) | can't be measured: other clock |

  - `MediaStreamTrackProcessor` doesn't exist inside workers in Chrome 155, and a `MediaStreamTrack` can't be transferred (`DataCloneError`). Only a processor made on the main thread, with its readable stream transferred, works. Its frames are stamped on Chrome's internal monotonic clock (µs since boot), so capture times would have to be estimated.
  - `createImageBitmap(video)` costs 1.6 ms. In T4's experiment it detected no faster than a VideoFrame (GPU 61.8 against 62.8 ms; CPU 50.2 against 50.8 ms).
- **Why:**
  - The VideoFrame route equals the stream route on render impact and throughput.
  - It keeps exact capture times on the page clock.
  - It reads the same `<video>` the preview shows (one decode, D-053).
  - It needs no Chrome-only API.
  - The worker removes the main-thread stutter entirely: from about 20 late frames per second (one per detection) to 0.0–0.1 per second (PROGRESS.md, T4 part 2).

## D-065: The render bar counts late frames and real gaps, over 60 s of drawing with the camera on (T4 part 2)
- **Decision:**
  - **NFR-1 and AC-2:** during a 60 s run of continuous drawing with the camera on, render ≥ 55 fps, at most 1 late frame (a real gap over 25 ms) per second, and no real gap over 50 ms. The tracker's first load, in a fresh profile, causes no gap over 50 ms either.
  - **"Per second" means the rate over the run** (at most 60 late frames in 60 s). The worst single second is reported next to it, so a bad stretch can't hide in the average.
  - **`measure-fps` reports the bar per tracking run as PASS / FAIL with the reasons:**
    - `--fresh-each` gives a new Chrome and profile per run, so every run is a first visit;
    - tracking runs press Enable 2.5 s after load, so page load isn't counted as tracker start-up;
    - the start-up window runs from the exact moment loading began to 1 s after ready (logged by the tracker).
  - **A run is flagged and the exit code is 2:**
    - INCOMPLETE, if the page stopped rendering (a sleeping display, a minimized or covered window; the launch flags now include `--disable-features=CalculateNativeWinOcclusion`);
    - or CAMERA STALLED, if Chrome's fake camera stopped delivering frames (an intermittent automation-only quirk, seen in a few runs in T4).
- **Alternatives:** render fps ≥ 55 alone (the old bar); rAF-timestamp gaps (D-063).
- **Why:** the old bar passed the main-thread tracker at 56–60 fps while every detection made a frame late. These three numbers fail it, and pass the worker, for the reason the eye sees.

## D-066: The worker is a separate classic build from a Vite plugin, content-hashed in production (T4 part 2)
- **Decision:**
  - `vite/handWorkerPlugin.ts` builds `src/perception/worker/handWorker.ts` with Vite's own `build()` as one IIFE script (`codeSplitting: false`).
  - **In dev:** built in watch mode into Vite's cache and served at `<base>workers/hand-worker.js` (no-cache). Edits rebuild by themselves (checked).
  - **In production:** emitted as `workers/hand-worker.<sha256 prefix>.js`. The main bundle gets that exact URL from `virtual:hand-worker`.
  - The worker has its own tsconfig (WebWorker globals). Build tooling has `tsconfig.node.json` (Node types, `@types/node` 24.x, approved), so Node's globals never reach the game. `typecheck` checks all three.
- **Alternatives:**
  - Vite's `new Worker(new URL(…))`: dev serves it as a module, and MediaPipe needs a classic worker (the constraint from the first spec review, confirmed in T4);
  - a pre-script writing into `public/workers/` (no rebuild on edit);
  - an unhashed name (a cached old worker could pair with a newer main bundle).
- **Why:**
  - It works the same in `npm run dev`, `vite preview` and on Vercel.
  - A changed worker always gets a new URL, and an unchanged worker keeps its hash (`hand-worker.bb09af3785.js` across rebuilds), so the cache still helps.

## D-067: A failed worker is restarted once, then detection falls back to the main thread; in-flight frames are always released (T4 part 2)
- **Decision:**
  - **Order:**
    1. Worker GPU → worker CPU (inside the worker: at start, and mid-session if the GPU throws).
    2. The worker restarted once (`TRACKING.workerRestarts`), only if it had been running. A worker that never started is not retried: a missing script or no wasm won't fix itself.
    3. Main-thread GPU → main-thread CPU.
    4. Give up, with an ink note offering the mouse.
  - **What counts as failing:** the worker can't be created, its script throws or fails to load, it reports that no delegate works, `ready` doesn't arrive within 30 s, or a result is more than 2 s late (tunable).
  - **Frames:** the main thread closes its own clone handle on each in-flight frame when the result arrives, or the moment it gives up on the worker, so the camera buffer is released even if the worker dies holding its copy.
  - **Rehearsals:** `?simulateTracker=worker-crash | worker-hang | worker-crash-always | worker-missing` rehearses each path. All four were checked:
    - crash → Worker · GPU (restarted ×1);
    - hang → Worker · GPU (restarted ×1), the camera still live;
    - crash-always → Main thread · GPU;
    - missing → Main thread · GPU, because the "script" was the HTML page.
- **Alternatives:** fall back to the main thread at once (your first wording); retry forever.
- **Why:**
  - A worker on the CPU never delays a frame. The main thread on the GPU makes about 20 frames late every second.
  - One restart covers a one-off crash without looping.
- **Known cost:** when a worker hangs or crashes with a frame queued, Chrome logs "A VideoFrame was garbage collected without being closed" once, for the copy the dead worker held (seen in the hang rehearsal). Our own handle is closed at once, and the camera keeps running.

## D-068: The hand worker tries the CPU delegate first; the main-thread fallback keeps the GPU first (T4 part 2; updates FR-2)
- **Decision:**
  - In the worker, the order is CPU, then GPU. On the main thread it stays GPU, then CPU.
  - `?delegate=cpu|gpu` forces one delegate on both threads.
  - AC-15 compares the worker's two delegates on the reviewer's Mac. If the GPU wins clearly there, a per-platform default is proposed.
- **Alternatives:** GPU first everywhere (the original FR-2).
- **Why (measured in T4 on Iris Xe, a fresh profile per run, the hand clip):**
  - **The GPU is slow in the worker:** 62 ms per detection with a hand (100 ms p95), against 25–29 ms on the main thread. Tracking reached only 15 fps.
  - **Its first-visit shader compile still stalls the screen**, for 0.5–0.7 s. It runs in Chrome's GPU process, which also composites the page.
  - **The CPU in the worker is clean:** 34–50 ms per detection, 19–28 fps tracking, and no stall (start gap 22–39 ms). It passes the NFR-1 render bar on the laptop and on Retina.
  - **On the main thread the GPU stays faster**, so the fallback keeps it first.
  - The GPU's slowness in a worker may be specific to this machine (Intel graphics through ANGLE/D3D11), so the Mac re-checks it.

## D-069: The preview shows each analysed frame with its own skeleton (T4 part 3)
- **Decision:**
  - **The handover:** the worker backend's `clone()` of each sent frame, which it already kept, now goes up with the result instead of being closed. The tracker hands it to the preview through a sink that `main.ts` wires (`tracker.setPreviewSink`), because a VideoFrame can't travel on the bus.
  - **The drawing:** `presentation/hud/syncedPreview.ts` draws the frame, mirrored with the same cover crop as the video, plus its skeleton on one canvas, then closes it. Every handed frame is closed, drawn or not.
  - **At most 2 frames are held:** the in-flight clone and the one being drawn.
  - **The live `<video>` stays under the canvas,** so the picture shows while the tracker readies, and again 500 ms after results stop (`HUD.previewStaleMs`).
  - **Hidden preview (P):** frames are closed unseen, nothing is drawn, and tracking continues.
  - **The main-thread fallback** makes a frame per detection only while a preview wants one.
  - **Measuring override:** `?preview=live` shows the live video with no pictures, the part 2 behaviour.
- **Alternatives:** the live `<video>` with the skeleton drawn on top. That was part 2's design; the skeleton lagged the picture by 34–63 ms, more than one 33 ms camera frame.
- **Why:** the skeleton always matches the picture under it (skew 0 by construction).
- **Measured cost (Iris Xe, the hand clip):**

  | Detection on | Main-thread time per picture | Picture behind the camera |
  |---|---|---|
  | Worker · CPU | 0.25–0.58 ms mean, 0.30–2.2 ms p95 | 53–88 ms mean |
  | Main-thread fallback | 0.39 / 0.60 ms | 36 / 53 ms |

  The picture now moves at the tracking rate (15–30 fps), not the camera's.
- **A/B against the live preview:** no measurable difference in frame gaps over 60 s (see D-070 for the gaps themselves).

## D-070: The slow CPU-worker state and the frame-gap hitches: what was tried, and what remains (T4 part 3)
- **The slow state:** on this laptop (i5-1340P: 4 performance and 8 efficiency cores), the CPU worker starts in one of two states for the whole session: about 31–35 ms per detection (28–30 fps tracking) or about 49–53 ms (18–19 fps).
  - Seen with either power mode, and with either delayed or immediate camera start.
  - **Tried, none kept (minimal runs each):**
    - **"Best performance" power mode** (it was already active): 2 of 4 runs still slow.
    - **480×360 frames to the worker:** no help. Slow state 49.3 against 49.7 ms; fast state 41.6 against 35.3 ms, so slower. Hands found in 85–100% of frames either way.
    - **Restarting a slow-started worker once** (mean over 42 ms in the first 3 s): it fired in 3 of 4 runs, and all 3 replacements were slow again (50–53 ms). The state belongs to the browser session, not the worker thread.
  - **What remains:** a known laptop-specific deviation from NFR-1's tracking floor (25 fps) in slow sessions. Recorded in PROGRESS.md. NFR-1 is unchanged.
- **The frame-gap hitches:** what the trace showed (30 s at Retina, the CPU worker):
  - all 8 gaps over 40 ms lined up with a 27–52 ms task on Chrome's GPU-process main thread (`GPUTask → WebGL → CommandBuffer::Flush`);
  - 47 such flushes, 1067 ms in total, all WebGL: MediaPipe's image work in the worker, which uses WebGL even on the CPU delegate;
  - the page's main thread stayed free (tasks of 4–14 ms).
- **Tried, not kept:** giving MediaPipe RGBA pixels in memory (`VideoFrame.copyTo` → `ImageData`). One 20 s trace was clean, but over four 60 s runs the gaps were no better (44–116 ms against 51–78 ms with frames).
- **Control (no camera, no tracker, drawing only), same afternoon:** longest gap 50–52 ms, with 1–4 seconds per minute over 25 ms. In T2 it was about 18 ms. So background load on the machine (another browser, editors) also produces hitches. A traced control run was clean, so they come and go.
- **Status:** re-measured on a quiet machine, with the control run first, the 60 s bar **passes**, laptop and Retina: longest gaps 31.2 / 19.8 ms, 0.0 late frames per second, start-up gaps 37.8 / 22.1 ms. The earlier hitches came mostly from background load. The measurement procedure in PROGRESS.md now requires a quiet machine and a clean control first. The MediaPipe WebGL flushes are real and get longer under load; AC-15 re-checks the Mac.
