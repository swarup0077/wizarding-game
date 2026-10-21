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
| AC-10 Fallbacks | Camera part done (T3) | Deny → card + mouse offered. Mic part: T9. Firefox part: T9/T13 |
| AC-11 Hand lost cancels trace | – | |
| AC-12 Checks pass, no console errors | – | |
| AC-13 Dummy 4th spell test | – | |
| AC-14 Benchmark on real samples, false accepts ≤ 5% | – | |
| AC-15 Deployed link passes AC-1, 7, 9, 10 in Chrome on a Mac | – | |

## How to measure render fps
`scripts/measure-fps.mjs` measures render fps on this machine's real GPU and prints a Markdown table to paste into a task entry. It has no dependencies (D-040).

1. Plug the laptop in and turn off Chrome's Energy Saver; both cap frame rates.
2. `npm run build`
3. `npm run measure:fps`. It starts `vite preview`, opens a **visible** Chrome window with a throwaway profile, runs each case for 20 s after startup, then closes everything. Don't minimize the window. It may sit behind other windows, but a minimized window isn't rendered.
4. Copy the printed table into the task's **Numbers**.

The cases:

| Run | What it measures |
|---|---|
| `native-idle` / `native-drawing` | This screen as it is (here: DPR 1.25), stage only / continuous drawing with the 30 Hz preview |
| `retina-cap1.5-…` / `retina-cap2-…` | Chrome device emulation at 1440×900 CSS px and DPR 2 (the reviewer's MacBook, 2880×1800 device px) at each DPR cap |

Options: `--seconds 30` (longer runs), `--only retina-cap2-drawing` (selected runs), `--query "demo=loop&handRate=1"` (extra URL query for every run, e.g. a spell demo in later tasks), `--url https://wizarding-game.vercel.app` (measure the deployed site; nothing is started). `CHROME_PATH` overrides where Chrome is found.
Since T4: `--clip local/clips/hand.y4m` feeds the private hand clip to Chrome's fake camera (it is always the fake camera, never the webcam), and the `*-tracking*` runs add a tracking table (delegate, tracking and video fps, detection mean / p95, first detection, hand seen). Both tables now show the **longest real gap** and **late frames per second** (D-063). A run is flagged INCOMPLETE if the page stopped rendering (display asleep, window minimized); the display must stay awake while measuring.

Reading the table:
- **fps** is capped by the display (60 here), so it can't show headroom.
- **Longest frame gap** shows stalls: anything above about 25 ms is a visible hitch. It compares rAF timestamps, which hide a late callback; **longest real gap** and **late frames per s** (T4) don't.
- **Our work per frame** is the headroom: our update and draw time out of the 16.7 ms frame budget.

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

## T2 follow-up: tuning per layer, fps script, T7 note (2026-10-21)
**Done:**
- `src/config/tuning.ts` split into `src/config/tuning/` (input, perception, recognition, presentation, scenes, dev). `tuning.ts` now only re-exports them. A one-off check confirmed every export and value is identical. Lint rejects imports from a layer file (D-039). CLAUDE.md rule updated.
- `scripts/measure-fps.mjs` and `npm run measure:fps` (see "How to measure render fps" at the top). A full run reproduced the T2 numbers: 60 fps, no frame gap over 18.1 ms, work 0.7–0.9 ms per frame while drawing at DPR 2.
- TASKS.md: T7 tests and the T8 benchmark now include hand-rate traces (30 Hz, fast end of each spell's ideal duration; 25 Hz reported too). T7 opens with a question about FR-8's 12-point minimum.

**Verify:** `npm run typecheck && npm run lint && npm test` pass; `npm run build && npm run measure:fps` prints the table.

**Open issues:** FR-8 `minPoints` vs hand-rate traces (decide at the start of T7).

## T2b: Art direction and UI kit (2026-10-21)
**Done:**
- `docs/ART_DIRECTION.md`: palette, typography, materials, motion rules, spell colour identities, sound direction, IP guardrails and a pre-commit checklist.
- Fonts (OFL, self-hosted, licences committed): Cinzel Decorative, Cinzel, EB Garamond, Pinyon Script (163 KB); IM Fell English and Petit Formal Script for comparison only.
- `src/ui/`: `theme.css` (tokens, house pairs, `--house-primary/secondary` neutral gold), `materials.css` (procedural paper grain, stains, gilt), `filters.ts`, `ornaments.ts` (original corner flourish, star and star-over-wand seal marks), `brand.ts` (`GAME_TITLE` placeholder), `grades.ts`, `contrast.ts`, and the kit: parchment panel, wax-seal button (+ ink link), ink-note toast, gilded frame, spellbook page, grade badge. Reduced motion respected.
- `?dev=ui` gallery: every component in every state over the stage, the palette with contrast ratios, a type specimen and the font comparison.
- Lint: core, perception and recognition may not import `ui`. CLAUDE.md rule added. SPEC (letter intro, FR-20 grades, NFR-8), TASKS (T2b; T3, T7, T9, T10, T13 use the kit), ARCHITECTURE, VISION updated.

**Verify:**
1. `npm run dev`, open http://localhost:5173/?dev=ui and scroll through: palette, type, panels and the acceptance letter, seal buttons (normal, hover, pressed, disabled), ink notes, the gilded frame, grade badges, spellbook pages. Click "Replay entrances" to see unroll, ink-bleed and quill.
2. Hover a real seal button: it tilts and glints. Press it: it stamps down.

**Numbers:**
- 147 tests (~0.8 s), including the contrast checks (every text colour on every parchment shade) and the token check.
- Visual iteration: 3 rounds (the agreed cap).
- `measure:fps` with the gallery open, 10 s per run after startup:

| Run | Canvas (device px) | fps mean / min | Longest frame gap | Seconds with a gap > 25 ms | Our work per frame |
|---|---|---|---|---|---|
| native-idle | 1920×970 | 60.0 / 60 | 17.6 ms | 0 of 11 | 0.15 ms |
| native-ui-gallery | 1920×970 | 59.0 / 49 | 199.9 ms | 1 of 11 | 0.11 ms |
| retina-cap2-ui-gallery | 2880×1800 | 59.7 / 57 | 50.3 ms | 2 of 11 | 0.13 ms |

A follow-up run with timestamps showed every long gap inside the first 2.2 s after load: the stage background, every gallery component, fonts, filters and entrance animations all paint for the first time at once. After that, no gap over 17.1 ms. One parchment panel added mid-session at emulated Retina costs a single dropped frame (a 33.1 ms gap), so HUD panels are built once and reused (D-046).

**Font choice (follow-up):** body IM Fell English, handwriting Pinyon Script, small labels Cinzel Decorative. Unchosen fonts and their licences deleted; 5 files, 187 KB (D-048). Checked at DPR 2: body, italic hints, labels and the green address all legible.

**Open issues:**
- The gallery's "SPELLBOOK" heading still shows Cinzel Decorative's joined "OO" even with ligatures off; it is a glyph variant of the font. If it bothers you in spell names or titles, those can use plain Cinzel.

## T3: Camera and webcam preview (2026-10-21)
**Done:**
- `input/`: `cameraErrors.ts` (pure: error + permission → one of 10 failure kinds), `cameraFlow.ts` (pure recovery state machine with attempt numbers), `camera.ts` (thin: getUserMedia with an unconstrained retry on OverconstrainedError, the Permissions API and its change event, track `ended`, `getSettings()`; owns the one `<video>`), `cameraController.ts` (bus glue).
- New events `camera:status` and `ui:action`; `CameraFailureKind`, `CameraActual` and `UiActionId` in `core/types.ts`.
- `presentation/hud/`: `cameraCopy.ts` (every camera line, per platform), `platform.ts`, `toastQueue.ts` (all pure), and `webcamPip.ts` (gilded-frame portrait, mirrored, bottom-right, 20% width clamped to 200–360 px, `pointer-events: none`, shown only while live), `cameraCard.ts` (one parchment panel, wax-seal Enable/Retry, ink link "Use the mouse instead"), `toasts.ts` (3 reused ink-note slots for `system:message`), `mountHud.ts`, `hud.css`.
- Recovery without a reload: Retry on every card except insecure and unsupported; the camera starts by itself when the permission changes to granted after a denial; a track that ends mid-session shows "The camera stopped", hides the preview and leaves the mouse drawing.
- Debug overlay (D): **Camera** (state or failure kind), **Camera actual** (`getSettings()`, with "asked 640×480 @ 30" when different), **Camera device**.
- Dev trigger `?dev=camera`: `&fail=<kind>` (with `&platform=mac|windows|other`), `&enable=1`, `&simulate=ended`. It works on the deployed link too.
- Lint: input may not import perception, recognition, spells, scenes, presentation, ui or dev (checked with a throwaway violating file).
- `measure:fps`: new `native-camera` and `retina-cap2-camera` runs on Chrome's fake camera.
- LATER: camera picker for several cameras.

**Verify:**
1. `npm run dev`, open http://localhost:5173: the "Your wand hand" card. Click **Enable camera** and choose Allow in Chrome's prompt. The card closes and your mirrored picture appears in the gilded frame bottom-right: raise your right hand and it shows on the right, like a mirror. Draw a stroke across the frame: it draws (the frame never takes clicks).
2. Press D: the **Camera actual** row shows what your webcam really delivers (often less than 640×480 @ 30 on a laptop) and its name.
3. Blocked: click the camera icon at the right end of the address bar → Block, reload and click Enable camera. You get "The camera is blocked". Now set it back to Allow from the same icon, with no reload: the toast "Camera allowed. Waking it now." appears and the preview comes back.
4. Busy: open the Windows Camera app (or Teams with video), then reload and click Enable camera. You get "The camera is busy". Close the other app and press Retry: live.
5. Ended: with the camera live, open `?dev=camera&enable=1&simulate=ended` (or unplug a USB camera). After 2 s you get "The camera stopped", the preview hides and the mouse still draws. Press Retry: live again.
6. **Use the mouse instead** on any card: the card closes, the camera light goes off, and the toast "Using the mouse: hold the left button and draw." appears.
7. Every card: `?dev=camera&fail=<kind>&platform=mac`, with kind one of denied-by-user, denied-by-system, dismissed, not-found, in-use, insecure, unsupported, aborted, ended, unknown.
8. On the Mac (AC-15, later): Chrome → System Settings → Privacy & Security → Camera, switch Chrome off, open the deployed link and click Enable camera. You should get "Your Mac is keeping the camera from Chrome".

**Numbers:**
- 200 tests in 29 files (~0.9 s); new: cameraErrors 14, cameraFlow 13, cameraController 7, cameraCopy 12, toastQueue 4, platform 3.
- Build: 45 kB JS main (18 kB gzip); `cameraSim` is a separate 1 kB chunk.
- Chrome's fake camera delivers 640×480 @ 20 fps when asked for 30, and the debug row shows "(asked 640×480 @ 30)": that is the case the row exists for.
- `measure:fps` (Iris Xe, 15 s per run after startup; the camera runs use the fake camera):

| Run | Canvas (device px) | fps mean / min | Longest frame gap | Seconds with a gap > 25 ms | Our work per frame (mean / max) |
|---|---|---|---|---|---|
| native-idle | 1920×900 | 60.0 / 60 | 17.8 ms | 0 of 16 | 0.18 / 0.25 ms |
| retina-cap2-idle | 2880×1800 | 60.0 / 60 | 17.6 ms | 0 of 16 | 0.19 / 0.53 ms |
| native-camera | 1920×900 | 60.0 / 60 | 18.1 ms | 0 of 16 | 0.14 / 0.17 ms |
| retina-cap2-camera | 2880×1800 | 60.0 / 60 | 17.6 ms | 0 of 16 | 0.10 / 0.13 ms |

- Checked automatically in headless Chrome on the fake camera, with no console errors or exceptions in any run:
  - the real live preview (mirrored, 324×252 at 1440 wide, 24 px from the corner, the stage under it receives clicks);
  - a real denial (`--deny-permission-prompts`) giving the blocked card;
  - granting the permission afterwards (DevTools `Browser.grantPermissions`) starting the camera by itself;
  - `simulate=ended`, then Retry, back to live;
  - Use the mouse, which stops the track and hides the preview.

**Open issues:**
- The macOS "blocked by the system" path was checked only through the dev trigger. Chrome's "by system" wording and the relaunch behaviour need one real check on the Mac (AC-15).
- Real NotFoundError and NotReadableError were not reproduced on this laptop (it has a camera, and nothing was holding it). Their cards are covered by the unit tests and the dev trigger; step 4 above checks "busy" by hand.
- A kit note for later HUD panels: `.wg-unroll` keeps its last frame (fill mode `both`), so a hidden panel must drop the class, or it stays visible (D-053).
- Headless Chrome stalls when capturing DPR-2 screenshots of filtered parchment; DPR-2 screenshots use a visible Chrome (GPU).

## T3 follow-up: minimal preview frame, frame styles, hide the preview (2026-10-21)
**Done:**
- The preview's default frame is now **minimal**: a faint parchment hairline (`--line-hairline`, parchment-300 at 32%), 6 px corners (`--radius-soft`), a soft shadow (`--shadow-soft`), no ornaments. These are new theme tokens.
- Frame styles: `pictureFrame` (replaces `gildedFrame`) has one DOM for every style. Each style is one `.wg-frame--<name>` block in `frame.css`; the gilded portrait is kept as `portrait`. The `previewFrame` setting picks one (names in `PREVIEW_FRAMES`). The `?dev=ui` gallery shows every style.
- **P** toggles the preview (`showPreview`, saved, so it survives a reload). Only the picture hides: the camera and video keep running. A small **status tag** (new kit component) takes its place: "Camera on", then "hand seen" or "hand lost" in red ink once T5 emits hand events. Hiding shows one toast: "Preview hidden. The camera still follows your hand; press P to show it again."
- `input/keyboardActions.ts` (keys → `ui:action`), `settings/settingsStore.ts` (update → save → `settings:changed`), the `Settings` type moved to `core/settingsTypes.ts`, and the new `settings:changed` event.
- The camera card no longer covers the `?dev=ui` gallery.
- Docs:
  - TASKS: T5's hand-lost indicator works with the preview hidden; T13's settings panel gets the preview toggle and frame style.
  - SPEC: FR-7, FR-20 and FR-22 updated.
  - LATER: choose the final frame in Phase 1/2.
  - ART_DIRECTION: the hairline frame.
  - ARCHITECTURE: files, events and two new extension points.

**Verify:**
1. `npm run dev`, Enable camera: the preview has a thin, faint border with soft corners and no gold.
2. Press P: the picture fades out, a small "Camera on" tag appears bottom-right, and a toast explains that the camera is still running. Reload and Enable: still hidden. Press P again: the picture is back.
3. P does nothing while typing in a field, and Ctrl+P still opens Print.
4. Gilded style (until T13's settings panel exists), in the DevTools console: `localStorage.setItem('wg.settings.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('wg.settings.v1') ?? '{}'), previewFrame: 'portrait' }))`, then reload. Use `'minimal'` to switch back.
5. `?dev=ui`: "Preview frames, status tags and grade badges" shows both frames and both chip tones.

**Numbers:**
- 217 tests in 32 files (~1 s). New: settings preview fields 5, settingsStore 5, keyboardActions 3, previewState 4.
- Hidden preview in headless Chrome on the fake camera:
  - the frame's opacity is 0 and the track is still live;
  - `requestVideoFrameCallback` counted 21 frames in 1 s (the fake camera runs at 20 fps), so the tracker will keep getting frames;
  - `showPreview: false` is saved, and the preview is still hidden after a reload.
- No console errors in any run.

**Open issues:**
- The minimal frame's hairline is deliberately faint; against a real webcam picture it may need a touch more opacity. That's one token (`--line-hairline`), and the final frame is chosen in Phase 1/2 anyway.
- Until T5 emits `hand:found` / `hand:lost`, the chip only says "Camera on".


## T4: Hand tracking (2026-10-21) — IN PROGRESS: paused at the FR-2 stop rule
**Done:**
- **Assets** (D-058):
  - `@mediapipe/tasks-vision` 1.1.1, pinned exactly.
  - `scripts/copy-mediapipe.mjs` (postinstall and prebuild): 4 files, 26.8 MB, into git-ignored `public/mediapipe/wasm/`.
  - `scripts/fetch-model.mjs`: the model is committed at `public/models/hand_landmarker.task`, 7,819,105 bytes, SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`. The MD5 matches Google's storage.
  - `vite preview` serves the wasm as `application/wasm`. Vercel: not checked yet (needs a push).
  - The MediaPipe JS is its own 154 kB chunk; the main bundle is 58 kB.
- **`perception/`:**
  - `handTracker.ts`: the only MediaPipe import, enforced by lint (D-061). GPU, then CPU, both at start and mid-session.
  - `videoFrameLoop.ts`: rVFC with a rAF fallback.
  - Pure modules: `detectScheduler.ts`, `delegateFallback.ts` (+ `?delegate=cpu|gpu`), `landmarks.ts`, `slowTrackingWatch.ts`.
- **`core/`:** `handTopology.ts`, `rollingStats.ts`.
- **Events:** `tracker:status` and `tracker:slow` (D-059).
- **Preview:**
  - The candle-gold skeleton in the frame's new overlay slot, with `coverFit` for wide webcams (D-062). It is not drawn while the preview is hidden.
  - "Readying your wand…" on the status chip while the tracker loads.
  - An error ink note offering the mouse if tracking can't start.
  - The low-fps tip as a warn ink note.
- **Debug overlay:** Tracker, Delegate, Tracking fps (with the video fps), Detection mean / p95, First detection, Hand.
- **`measure-fps`:**
  - Tracking runs and `--clip <file>`.
  - Real-gap and late-frame columns (D-063).
  - Every other console line.
  - An INCOMPLETE flag when the page stopped rendering.

**Numbers so far** (Iris Xe, on AC power, Chrome 155, Chrome's built-in fake camera at 640×480 @ 20 fps, **no hand in view**, so palm detection runs every frame):

| | GPU delegate | CPU delegate |
|---|---|---|
| Detection, mean / p95 | 19–25 / 24–30 ms | 28–31 / 30–42 ms |
| First detection, fresh Chrome profile | **2.8–3.4 s** (main thread blocked) | 50–130 ms |
| First detection, same profile, later page loads | about 200 ms | about 55–95 ms |
| Late frames (real gap > 25 ms) | about 20 per second: one per detection | about 20 per second |
| Longest real frame gap | 47–57 ms | 47–51 ms |
| rAF-timestamp fps (the T2 metric) | 59.5–60 | 56–60 |

- The old metric reads about 60 fps while every detection makes a frame late. That is the stutter D-063 exists to catch.
- The full table is incomplete: the laptop's display went to sleep mid-measurement, and Chrome stops rendering when nothing is on screen. Retina runs and hand-present numbers are still to be measured.
- Tests: 39 files, 257 tests (~1.2 s).

**MediaPipe's own console lines** (AC-12: known, not from our code):
- Both delegates:
  - `I… gl_context.cc:408] GL version: 3.0 (OpenGL ES 3.0 (WebGL 2.0 …)), renderer: WebKit WebGL`
  - `W… gl_context.cc:1135] OpenGL error checking is disabled` (warning)
  - `Graph successfully started running.`
  - `W… landmark_projection_calculator.cc:81] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI…` (warning)
- CPU only:
  - `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` (logged through console.error)
  - `W… inference_feedback_manager.cc:121] Feedback manager requires a model with a single signature inference…` (warning, twice)
- Not MediaPipe: a 404 for `/favicon.ico`. The site has none; it predates T4.

**Observed in automation only:** Chrome's fake camera sometimes ends its track a few seconds in (about 1 launch in 5, with either delegate), which shows "The camera stopped". It's a fake-device quirk under repeated launches. Rerun if a table shows it.

**Blocked on:**
1. The stop rule. **Decided: (b) the Web Worker**, planned next. The fresh-profile freeze would hit a first-time visitor, and Phase 1's 3D rendering tightens the main-thread budget. Option (a) (a reduced rate while no hand is seen) moved to LATER.md as a heat and battery option.
2. The hand-only clip, for hand-present numbers and the skeleton screenshots.
3. A push, for the Vercel MIME check.

**The hand-only test clip** (private; `local/` is git-ignored; automated runs never use the real webcam, D-054):
1. **Record** with the Windows Camera app in Video mode. Frame only your hand: tilt the screen down or sit to one side, so your face is never in view. A plain wall behind is ideal, in normal room lighting.
2. **What to do, about 12 s:**
   - 1 s with no hand;
   - your hand enters at 40–80 cm;
   - 2 pinch-and-release cycles;
   - 2 clockwise circles while pinched;
   - a zigzag;
   - a swish-and-flick;
   - an open-hand wave;
   - the hand leaves for 1 s.
3. **Check** the whole clip. If any frame shows your face, delete it and record again.
4. **Move** it from `Pictures\Camera Roll` to `local\clips\hand-raw.mp4`.
5. **Install ffmpeg** once: `winget install Gyan.FFmpeg`.
6. **Convert:** `ffmpeg -i local\clips\hand-raw.mp4 -an -vf "fps=30,scale=640:480:force_original_aspect_ratio=increase,crop=640:480" -pix_fmt yuv420p local\clips\hand.y4m`.
   - A raw webcam picture shows your right hand on the **left**. If `hand-raw.mp4` shows it on the right, the app saved it mirrored: start the filter with `hflip,`.
   - The crop keeps the centre 4:3, so keep your hand away from the far left and right edges while recording.
7. **Use:** `npm run build && npm run measure:fps -- --only native-tracking,retina-cap2-tracking,retina-cap2-tracking-drawing,native-tracking-cpu --clip local/clips/hand.y4m`, with the display awake.

## T4 part 2: Detection in a Web Worker (2026-10-21) — paused for one decision (delegate order in the worker)
**Done:**
- **Vercel:** the part 1 checkpoint (`629006d`) is pushed, and Vercel serves both wasm files as `application/wasm` (13,519,922 and 12,627,509 bytes, the same as local). The model is served as `application/octet-stream`.
- **The worker (D-064):**
  - `perception/worker/handWorker.ts`, a classic worker with its own tsconfig;
  - `detectors/workerBackend.ts`: VideoFrame plus a clone handle per frame, one in flight, newest-skipped catch-up, capture time echoed back;
  - `detectors/mainThreadBackend.ts`, the fallback;
  - `landmarkerFactory.ts`: the only MediaPipe import (lint), with the warm-up detection inside "Readying your wand…";
  - pure modules `workerProtocol.ts`, `trackerPolicy.ts`, `trackerMetrics.ts`, plus tests.
  - `handTracker.ts` is now the façade. Events and the `WandSource` contract are unchanged.
  - One other perception file changed: `videoFrameLoop.ts` now passes rVFC's `captureTime`, which exists only inside that callback.
- **Failure handling (D-067):** restart the worker once, then the main thread. Our in-flight handle is always closed. Rehearsals: `?simulateTracker=worker-crash | worker-hang | worker-crash-always | worker-missing`, all four checked.
- **Build (D-066):** `vite/handWorkerPlugin.ts`.
  - Dev: watch build served at `/workers/hand-worker.js`; an edit rebuilt it (checked).
  - Production: `workers/hand-worker.bb09af3785.js`, its URL injected through `virtual:hand-worker`.
  - Checked in `npm run dev` and `vite preview`: Worker · GPU, frames flowing, no console errors. Vercel is checked after the next push.
  - `tsconfig.node.json` plus `@types/node` 24.x for build tooling.
- **Debug overlay:** Delegate shows "Worker · GPU" or "Main thread · … (worker failed: …)". New rows: Start load / warm-up, First detection, Capture → result, Skeleton skew.
- **Frame transfer chosen by data** (D-064): VideoFrame plus catch-up. The processor route is impossible in a worker in Chrome 155, except as a transferred stream on another clock.
- **`measure-fps`:**
  - the tracking matrix ({laptop, Retina emulation} × {worker, main} × {GPU, CPU}, all drawing continuously);
  - `--fresh-each`, the delayed camera start, exact start-up window;
  - PASS/FAIL for the new bar (D-065);
  - INCOMPLETE and CAMERA STALLED flags;
  - the Windows occlusion flag;
  - helpers split into `devtools.mjs` and `fps-report.mjs`.
- **Docs:**
  - SPEC: FR-2 (worker plus fallback), NFR-1 and AC-2 (the new bar).
  - TASKS: T4's build list, and T5's arrival-lag compensation for the trail.
  - ARCHITECTURE, LATER (the worker row is now done; reduced-rate detection is a heat/battery option).
- **Clip:** `local/clips/hand-limited.y4m`, re-converted from your full-range `hand.y4m` to limited range (what a webcam delivers and Chrome's Y4M reader assumes). 681 frames, 30 fps. Yours is untouched.

**Numbers** (i5-1340P with Iris Xe, on AC power, Balanced power plan, Chrome 155; a **fresh profile per run**; continuous drawing in every run; 20 s steady state). "Start gap" is the longest real frame gap from Enable camera to 1 s after ready, on a first visit. Bar = the render half of NFR-1 (D-065).

| Screen | Runs on | Hand | Tracking fps (camera) | Detection mean / p95 | Capture → result | Skeleton skew | Render fps | Late frames per s | Longest real gap | Start gap | Bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| laptop | main · GPU | no | 20.0 (20) | 21.7 / 26.9 ms | 30 ms | 0 | 59.8 | 19.9 | 45 ms | 2798 ms | FAIL |
| laptop | main · CPU | no | 20.0 (20) | 27.3 / 32.2 ms | 36 ms | 0 | 59.2 | 20.3 | 61 ms | 321 ms | FAIL |
| laptop | worker · GPU | no | 19.6 (20) | 27.5 / 32.7 ms | 37 ms | 0 | 60.0 | 0.0 | 24 ms | 507 ms | FAIL (start) |
| laptop | worker · CPU | no | 19.6 (20) | 30.3 / 36.0 ms | 39 ms | 0 | 60.0 | 0.0 | 18 ms | 33 ms | PASS |
| Retina | main · GPU | no | 20.0 (20) | 19.5 / 25.4 ms | 26 ms | 0 | 59.9 | 20.3 | 60 ms | 2932 ms | FAIL |
| Retina | main · CPU | no | 20.1 (20) | 30.9 / 45.6 ms | 38 ms | 0 | 53.2 | 20.3 | 57 ms | 226 ms | FAIL |
| Retina | worker · GPU | no | 19.5 (20) | 25.1 / 35.0 ms | 34 ms | 0 | 60.0 | 0.0 | 23 ms | 476 ms | FAIL (start) |
| Retina | worker · CPU | no | 19.4 (20) | 36.3 / 44.9 ms | 44 ms | 5 ms | 60.0 | 0.0 | 21 ms | 29 ms | PASS |
| laptop | main · GPU | yes | 30.0 (30) | 25.2 / 37.5 ms | 38 ms | 0 | 46.1 | 25.3 | 65 ms | 2832 ms | FAIL |
| laptop | main · CPU | yes | 29.6 (30) | 29.2 / 48.6 ms | 41 ms | 0 | 40.1 | 23.9 | 76 ms | 282 ms | FAIL |
| laptop | worker · GPU | yes | **15.4** (30) | **62.5 / 100 ms** | 80 ms | 63 ms | 60.0 | 0.0 | 28 ms | 522 ms | FAIL (start) |
| laptop | worker · CPU | yes | **19.2** (30) | 50.5 / 70.5 ms | 77 ms | 51 ms | 60.0 | 0.0 | 24 ms | 37 ms | PASS |
| Retina | main · GPU | yes | 29.6 (30) | 28.9 / 40.9 ms | 42 ms | 0 | 41.0 | 25.5 | 67 ms | 2753 ms | FAIL |
| Retina | main · CPU | yes | 29.4 (30) | 30.8 / 49.4 ms | 42 ms | 0 | 36.2 | 29.9 | 67 ms | 253 ms | FAIL |
| Retina | worker · GPU | yes | **15.4** (30) | **62.4 / 99.8 ms** | 84 ms | 63 ms | 60.0 | 0.1 | 38 ms | 704 ms | FAIL (start) |
| Retina | worker · CPU | yes | 28.5 (30) | 34.2 / 54.2 ms | 61 ms | 34 ms | 60.0 | 0.0 | 18 ms | 24 ms | PASS |

"No hand" = Chrome's built-in fake camera (20 fps); "yes" = the hand clip (30 fps; a hand is seen in 75–96% of frames).

**The 60 s bar runs** (the clip, drawing, a fresh profile):

| Run | Tracking fps | Detection mean / p95 | Late frames per s (worst s) | Longest real gap | Start gap | Render bar | Tracking ≥ 25 |
|---|---|---|---|---|---|---|---|
| laptop · worker · CPU | 19.0 | 50.6 / 70.9 ms | 0.1 (3) | 27.8 ms | 39 ms | PASS | FAIL |
| Retina · worker · CPU | 28.3 | 34.4 / 55.6 ms | 0.0 (0) | 19.6 ms | 22 ms | PASS | PASS |
| laptop · worker · GPU | 15.4 | 62.4 / 100 ms | 0.0 (3) | 33.9 ms | 514 ms | FAIL (start) | FAIL |
| Retina · worker · GPU | 15.4 | 62.7 / 100 ms | 0.1 (5) | 33.1 ms | 522 ms | FAIL (start) | FAIL |

**What the numbers say:**
1. **The worker removes the stutter.** Late frames fall from 20–30 per second (one per detection; render 36–46 fps with a hand) to 0.0–0.1. On the main thread, the first-visit GPU warm-up froze the page for 2.8–2.9 s.
2. **The worker's GPU delegate is the wrong default here.**
   - With a hand, it detects in 62 ms (100 ms p95) against 25–29 ms on the main thread: tracking 15 fps.
   - Its warm-up (2.9–3.1 s, a shader compile in Chrome's GPU process, which also composites the page) still makes a 0.5–0.7 s visible stall on a first visit. The main thread itself stays free; the GPU process doesn't.
   - The input type isn't the cause: an ImageBitmap gave the same numbers.
3. **The worker's CPU delegate passes the render bar everywhere**, with no first-load stall: there is no GPU compile. Its detection takes 34 or 50 ms, depending on start-up, steady across two loops of the clip and unrelated to hand content.
   - The 50 ms state happens when the camera starts 2.5 s after load (reproduced 4 times; 34 ms when it starts at once).
   - My best explanation, **unproven**: on this hybrid CPU (4 performance plus 8 efficiency cores), Windows sometimes places the worker thread on an efficiency core.
   - In that state tracking is 19 fps, below the NFR-1 floor of 25.
4. **Skeleton skew** (how far the live picture is ahead of the skeleton) is 34–63 ms in the worker: **more than one camera frame (33 ms)**, your revisit trigger. On the main thread it is 0.
5. **Capture → result** is 61–84 ms with a hand in the worker, against 38–42 ms on the main thread. This is the input to T5's trail-delay compensation and NFR-2's 100 ms budget.

**Screenshots** (the clip, in the scratchpad):
- `t4-skeleton-minimal-debug.png`: the skeleton, the debug rows, and the low-fps ink note, which fired correctly at 13–15 fps.
- `t4-portrait-8.png`: the skeleton in the gilded portrait.
- From headless Chrome: `t4-readying.png` (the readying chip above the preview) and `t4-debug-headless.png`.

**Console lines (AC-12):**
- MediaPipe's lines are as listed in part 1, now marked `(worker info/warning/error)`.
- `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` comes through console.error.
- Still the pre-existing `/favicon.ico` 404.
- No errors from our code in any measured run.
- One "VideoFrame was garbage collected without being closed" appears only in the worker-hang rehearsal (D-067).

**Tests:** 42 files, 273 tests (~1.3 s); typecheck (3 configs), lint and build pass.

**Decisions after these numbers:**
1. **The worker tries the CPU first; the main thread keeps the GPU first** (D-068). The default is now "Worker · CPU". AC-15 compares the two delegates on the Mac.
2. **The 50 ms CPU-worker case** gets a time-boxed check: the Windows power mode, and sending smaller frames (T4 part 3).
3. **The skeleton skew** (over one camera frame) is fixed with a synchronized preview (T4 part 3).
