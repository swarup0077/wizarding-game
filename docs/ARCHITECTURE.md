# Architecture

## Layers
A spell cast flows top to bottom. Layers talk **only** through the typed event bus.

```
Input            webcam frames, mic, mouse, keyboard
  ↓
Perception       hand landmarks → smoothed wand point + pinch; audio → transcripts
  ↓
Recognition      trace → which shape (score); transcript → which incantation (score); fusion → cast
  ↓
Spell engine     spell data + effect registry; finds the target
  ↓
World            props with tags, scene state            (Phase 0: a 2D practice stage)
  ↓
Presentation     canvas rendering, trail, effects, HUD, sound

Shared services (later phases): AI characters, saves and multiplayer
```

What exists in Phase 0: Input, Perception, Recognition, a minimal Spell engine, a 2D practice stage, Presentation (Canvas 2D), dev tools.

## Folder structure (Phase 0)
```
src/
  main.ts                    bootstrap: bus, settings, sources, scene, loop
  config/tuning.ts           re-exports every tunable number (import from here)
  config/tuning/             one file per layer: input, perception, recognition,
                             presentation, scenes, dev
  core/
    eventBus.ts              typed pub/sub
    events.ts                EventMap (all event names + payloads)
    types.ts                 Vec2, TracePoint, SpellId, Tier...
    clock.ts                 injectable now() for tests
    handTopology.ts          the 21 hand landmarks: names, bones, wand tips (perception and presentation)
    rollingStats.ts          mean and p95 over recent samples (detection time)
  core/settingsTypes.ts      the Settings shape + PREVIEW_FRAMES (core, so settings:changed can carry it)
  settings/settings.ts       persisted user settings (versioned)
  settings/settingsStore.ts  the session's settings: update → save → settings:changed; ui:action → setting
  input/
    camera.ts                getUserMedia + Permissions API (browser-only, thin); owns the one <video>
    cameraErrors.ts          pure: getUserMedia error + permission state → failure kind
    cameraFlow.ts            pure: camera recovery state machine (retry, auto-start, ended, mouse)
    cameraController.ts      bus ↔ cameraFlow ↔ camera; emits camera:status
    wandSource.ts            WandSource interface
    mouseWandSource.ts       mouse fallback (same events as the hand)
    keyboardActions.ts       shortcut keys → ui:action (P now; M in T5, S in T13)
  perception/
    handTracker.ts           HandLandmarker wrapper (browser-only, thin; the only file that imports MediaPipe)
    videoFrameLoop.ts        requestVideoFrameCallback, with a rAF fallback (browser-only, thin)
    detectScheduler.ts       pure: one detection per new frame, never two at once, increasing timestamps
    delegateFallback.ts      pure: GPU then CPU, at start and mid-session; `?delegate=` override
    landmarks.ts             pure: MediaPipe result → plain HandFrame, mirrored to selfie space
    slowTrackingWatch.ts     pure: the low-tracking-fps hysteresis (FR-2 tip)
    oneEuroFilter.ts         pure
    pinchDetector.ts         pure, hysteresis
    calibration.ts           pure raw → calibrated mapping
    handWandSource.ts        tracker + filter + pinch + calibration → wand events
    speechListener.ts        SpeechRecognition wrapper (browser-only, thin)
  recognition/
    traceCollector.ts        builds a trace between pinchStart and pinchEnd
    traceValidator.ts        pure: length / duration / point-count rules
    gestureRecognizer.ts     GestureRecognizer interface + shared accept rule (threshold + margin)
    protractor.ts            pure: Protractor, orientation-sensitive (primary)
    dollarOne.ts             pure: $1, orientation-sensitive (baseline)
    defaultTemplates.ts      pure: template generators per spell
    templateStore.ts         user templates (localStorage + JSON import/export)
    gestureDataset.ts        pure: fixture format for templates / test samples / negatives
    voiceMatcher.ts          pure: fuzzy incantation matching
    castFusion.ts            pure state machine: gesture + voice → cast / miscast
    quality.ts               pure: scores → quality + tier
  spells/
    spellTypes.ts            SpellDef schema
    spells.ts                the spell data (3 spells in Phase 0)
    spellRegistry.ts         lookup + validation
    effectRegistry.ts        effectId → EffectHandler
  scenes/
    scene.ts                 Scene interface
    practiceStage.ts         Phase 0 scene
    props.ts                 Prop type + tag helpers
  presentation/
    canvasStage.ts           canvas, DPR, resize, render loop
    trailRenderer.ts
    particles.ts             pooled particle system
    effects/                 fizzle.ts, lumos.ts, leviosa.ts, incendio.ts
    hud/                     resultCard.ts, micIndicator.ts, webcamPip.ts, spellCards.ts, toasts.ts (HTML/CSS over the canvas)
                             cameraCard.ts, mountHud.ts, hud.css, handSkeleton.ts (the skeleton over the preview);
                             pure: cameraCopy.ts (all camera wording), trackingCopy.ts (tracker wording),
                             toastQueue.ts, platform.ts, previewState.ts, coverFit.ts
    audio/sfx.ts             Web Audio synthesized sounds
  ui/                        the UI kit (part of presentation; docs/ART_DIRECTION.md)
    theme.css                design tokens and @font-face
    materials.css            procedural textures
    filters.ts, ornaments.ts SVG filters; original flourishes and seal marks
    kit/                     parchment, wax seal, ink note, picture frame (styles: minimal, portrait), status tag, spellbook page, grade badge
    grades.ts, contrast.ts   pure: tier → grade; WCAG contrast (theme is checked in tests)
    brand.ts                 GAME_TITLE placeholder (T13)
  dev/
    debugOverlay.ts
    templateRecorder.ts
    settingsPanel.ts
    uiGallery.ts             ?dev=ui: every kit component in every state
    cameraSim.ts             ?dev=camera: render any camera state (fail=<kind>, simulate=ended, enable=1)
public/
  fonts/                     self-hosted woff2 + OFL licences (NFR-8)
  models/hand_landmarker.task  committed to git, so deploys never download it
  mediapipe/wasm/            copied from node_modules by scripts/copy-mediapipe.mjs
scripts/
  copy-mediapipe.mjs         postinstall and prebuild: copy the wasm runtime into public/
  fetch-model.mjs            downloads the hand model once (the file is then committed)
  measure-fps.mjs            render and tracking measurement in a real Chrome (fps-report.mjs: tables)
local/                       git-ignored private media (the hand-only test clip); never committed
bench/
  gestures.bench.test.ts     recognizer benchmark (npm run bench:gestures, not part of npm test)
tests/fixtures/gestures/     recorded real webcam samples (committed)
```
Tests are colocated as `*.test.ts`.

## Core types
```ts
export type Vec2 = { x: number; y: number };          // normalized [0,1], top-left origin, mirrored
export type TracePoint = Vec2 & { t: number };         // t = performance.now() ms
export type SpellId = string;                          // 'lumos' | 'leviosa' | 'incendio' ...
export type Tier = 'weak' | 'normal' | 'strong';
```

### Normalized vs square units
Normalized coordinates are stretched: x is a fraction of the stage width and y a fraction of the stage height, so a circle that looks round on a 16:9 screen is an ellipse 0.56 as wide as it is tall. Anything that measures a shape, a distance or a speed converts to **square units** first: x × aspect, y unchanged, where aspect = stage width / stage height. One square unit is the stage height. `trace:complete` carries `aspect`, so recognition never needs the screen and recorded traces replay correctly. Other modules that measure distances (wand velocity, prop hit tests) get the aspect passed in; only presentation reads it from the canvas.

## Event contracts
Payloads must be **plain JSON-serializable data** (no DOM objects, no functions). This is what lets multiplayer send `spell:cast` over the network later without changes.

```ts
export interface EventMap {
  'camera:status':       { state: 'idle' | 'starting' | 'live' | 'off' | 'failed';
                           failure?: CameraFailureKind; detail?: string; auto?: boolean;
                           actual?: { width: number; height: number; frameRate: number | null; label: string };
                           retriedUnconstrained?: boolean; t: number };   // idle = not asked yet; off = mouse chosen
  'tracker:status':      { state: 'loading' | 'ready' | 'failed'; delegate?: 'GPU' | 'CPU';
                           gpuError?: string; failure?: TrackerFailureKind; detail?: string; t: number };
  'tracker:slow':        { slow: boolean; fps: number; t: number };  // FR-2 tip: below 20 fps for 3 s, or recovered
  'hand:found':          { t: number };
  'hand:lost':           { t: number };
  'hand:landmarks':      { points: Vec2[]; t: number };              // debug + PiP skeleton only; every analysed frame, [] = no hand
  'wand:move':           { p: Vec2; t: number; source: 'hand' | 'mouse' };
  'wand:pinchStart':     { p: Vec2; t: number };
  'wand:pinchEnd':       { p: Vec2; t: number };
  'trace:complete':      { trace: TracePoint[]; aspect: number; durationMs: number; t: number }; // aspect = stage width / height
  'trace:cancelled':     { reason: 'too-short' | 'too-long' | 'hand-lost'; t: number };
  'gesture:recognized':  { spellId: SpellId | null; score: number;
                           ranked: { spellId: SpellId; score: number }[];
                           durationMs: number; endPoint: Vec2; t: number };
  'voice:status':        { state: 'listening' | 'paused' | 'unsupported' | 'denied' | 'offline' | 'error';
                           message?: string };
  'voice:transcript':    { alternatives: { text: string; confidence: number }[]; isFinal: boolean; t: number };
  'voice:matched':       { spellId: SpellId | null; score: number; heard: string; isFinal: boolean; t: number };
  'spell:cast':          { spellId: SpellId; quality: number; tier: Tier; target: Vec2;
                           breakdown: { shape: number; voice: number | null; speed: number }; t: number };
  'spell:miscast':       { reason: 'unrecognized-shape' | 'voice-mismatch' | 'no-voice';
                           target: Vec2; heard?: string; spellId?: SpellId; t: number };
  'spell:miscastHeard':  { spellId: SpellId; heard: string; t: number }; // heard after an unrecognized-shape fizzle: updates the hint only
  'spell:ended':         { spellId: SpellId; t: number };            // sustained spells
  'system:message':      { level: 'info' | 'warn' | 'error'; text: string;
                           action?: { id: UiActionId; label: string } };
  'ui:action':           { id: UiActionId; t: number };  // a HUD button or key: 'camera.enable' | 'camera.retry' | 'camera.useMouse' | 'preview.toggle'
  'settings:changed':    { settings: Settings; changed: (keyof Settings)[]; t: number };
}
```
Input reports camera failures as a `CameraFailureKind` (data); presentation alone turns a kind into words. HUD buttons talk back through `ui:action`, never through callbacks. DOM objects that can't travel on the bus (the camera's `<video>`) are handed out by `main.ts`: the preview shows the same element the hand tracker reads.

The bus has `on(type, handler) → unsubscribe` and `emit(type, payload)`. Dispatch is synchronous. A throwing handler is caught and logged so it can't break the others.

## Spell data
```ts
export interface SpellDef {
  id: SpellId;                     // 'lumos'
  displayName: string;             // 'Lumos'
  incantation: string;             // canonical spoken form: 'lumos'
  aliases: string[];               // common mis-hearings, e.g. 'loomis'
  pronunciation: string;           // shown on the spell card: 'LOO-mos'
  templateIds: string[];           // default gesture templates
  rotationToleranceDeg: number;    // how far a trace may be rotated to match: 30 for most, 180 for a circle
  kind: 'instant' | 'sustained';
  tags: string[];                  // 'light' | 'fire' | 'levitate' ...
  effectId: string;                // key into the effect registry
  idealDurationMs: [number, number]; // trace duration that scores full speed marks
  power: PowerRule;                // how this spell turns signals into quality
}

export type PowerSignal = 'shape' | 'voice' | 'speed';   // later: 'velocity' | 'volume' | 'hold'
export interface PowerRule {
  weights: Partial<Record<PowerSignal, number>>;            // with voice
  gestureOnlyWeights: Partial<Record<PowerSignal, number>>; // without voice
}
```
Quality is a weighted sum of whichever signals a spell lists. A new signal is a new producer plus a weight; the quality module's logic doesn't change. This is how a later Alohomora can reward pure precision while a duel spell rewards controlled speed.

## Effects and scenes
```ts
export interface EffectHandler {
  start(cast: EventMap['spell:cast'], ctx: EffectContext): ActiveEffect;
}
export interface ActiveEffect {
  update(dtMs: number): boolean;                     // false = finished
  render(g: CanvasRenderingContext2D, view: View): void;
  end(): void;
}
export interface EffectContext {
  stage: StageApi;                                   // findPropAt(p, tag), getProp(id), setPropState(id, state)
  sfx: SfxApi;
  wand: () => Vec2;                                  // live wand point, for sustained effects
  bus: EventBus;
}
export interface Scene {
  load(ctx: SceneContext): Promise<void>;
  update(dtMs: number): void;
  render(g: CanvasRenderingContext2D, view: View): void;
  unload(): void;
}
export interface Prop { id: string; tags: string[]; bounds: { x: number; y: number; w: number; h: number }; state: string }
```
`View` converts normalized coordinates to screen pixels. It is the only place pixels appear.

HUD and debug text is HTML/CSS layered over the canvas, never canvas text, so the DPR cap never blurs it (D-023). Only world text, such as the notice board's message, is drawn on the canvas.

## Extension points (how the game grows without rewrites)
| To add... | You add | You do NOT touch |
|---|---|---|
| A spell | A `SpellDef` in `spells.ts`, a template generator, an effect file, one line in the effect registry | Recognition, fusion, quality |
| A gesture recognizer ($P, ML model...) | A new `GestureRecognizer`; the benchmark decides if it wins | Accept rule, fusion, everything downstream |
| A power signal (velocity, mic volume, hold time) | A signal producer + weights in the spells that use it | Quality logic, other spells |
| An input device (phone, VR, controller) | A new `WandSource` emitting the same `wand:*` events | Anything downstream |
| A webcam preview frame style | One `.wg-frame--<name>` block in `src/ui/kit/frame.css` and its name in `PREVIEW_FRAMES` | The preview, settings logic |
| A shortcut key | One entry in `input/keyboardActions.ts` mapping it to a `UiActionId` | Whatever handles that action |
| A scene, room, or class | A new `Scene` file | Engine, recognition |
| A prop interaction | Tags on props; effects query by tag | Other effects |
| 3D rendering (Phase 1) | New presentation + `View` that ray-casts from the wand point | Perception, recognition, spells data |
| AI characters (later) | A `Speaker` interface (scripted first, LLM later) | Callers |
| Multiplayer (later) | Send and receive `spell:cast` events over a socket | Game logic |

## Persistence
All `localStorage` keys are versioned: `wg.settings.v1`, `wg.calibration.v1`, `wg.templates.v1`. Bad or old data is discarded, never crashes the app.

## Main loop
- **Rendering:** one `requestAnimationFrame` loop drives scene update, effects, trail, HUD and debug overlay.
- **Hand tracking:** runs per new video frame (`requestVideoFrameCallback`), on its own schedule rather than the render loop's. It loads when the camera is asked for, not on page load. On the main thread, detection still takes time from rendering: each `detectForVideo` call blocks until it is done (T4 measured 19–31 ms on this laptop with no hand in view). Whether to throttle detection while no hand is seen, or to move it to a Web Worker, is decided from T4's measurements (FR-2; `docs/LATER.md` has the worker constraint). The renderer interpolates between tracking samples.
- **Measuring jank honestly:** `?reportFps=1` logs both rAF-timestamp gaps and real (wall-clock) gaps between frames. rAF timestamps are aligned to vsync, so they hide a frame that ran late because a long task ran just before it; the real gap and the late-frame count show it (T4).
- **Time:** comes from the injectable clock (`performance.now()` in the browser, fake in tests).

## Deployment
A static build (`npm run build` → `dist/`) served over HTTPS from T1 on by Vercel, connected to the GitHub repo (each push to the main branch updates the production link). Nothing is downloaded at build time: the hand model is committed and the wasm files come from `node_modules`. Asset URLs are built from Vite's `import.meta.env.BASE_URL`, so the build also works from a sub-path. Supported browsers: Chrome on Windows and on macOS (Retina, DPR 2); Edge on Windows second.
