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
  settings/settings.ts       persisted user settings (versioned)
  input/
    camera.ts                getUserMedia + permission/device errors
    wandSource.ts            WandSource interface
    mouseWandSource.ts       mouse fallback (same events as the hand)
  perception/
    handTracker.ts           HandLandmarker wrapper (browser-only, thin)
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
    audio/sfx.ts             Web Audio synthesized sounds
  dev/
    debugOverlay.ts
    templateRecorder.ts
    settingsPanel.ts
public/
  models/hand_landmarker.task  committed to git, so deploys never download it
  mediapipe/wasm/            copied from node_modules by scripts/copy-mediapipe.mjs
scripts/
  copy-mediapipe.mjs         postinstall: copy wasm files into public/
  fetch-model.mjs            downloads the hand model once (the file is then committed)
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
  'hand:found':          { t: number };
  'hand:lost':           { t: number };
  'hand:landmarks':      { points: Vec2[]; t: number };              // debug + PiP skeleton only
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
                           action?: { id: string; label: string } };
}
```
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
| A scene, room, or class | A new `Scene` file | Engine, recognition |
| A prop interaction | Tags on props; effects query by tag | Other effects |
| 3D rendering (Phase 1) | New presentation + `View` that ray-casts from the wand point | Perception, recognition, spells data |
| AI characters (later) | A `Speaker` interface (scripted first, LLM later) | Callers |
| Multiplayer (later) | Send and receive `spell:cast` events over a socket | Game logic |

## Persistence
All `localStorage` keys are versioned: `wg.settings.v1`, `wg.calibration.v1`, `wg.templates.v1`. Bad or old data is discarded, never crashes the app.

## Main loop
- **Rendering:** one `requestAnimationFrame` loop drives scene update, effects, trail, HUD and debug overlay.
- **Hand tracking:** runs per new video frame (`requestVideoFrameCallback`), on its own schedule rather than the render loop's. On the main thread, detection still takes CPU time from rendering; if that pulls render fps below 55, detection moves to a Web Worker (FR-2). The renderer interpolates between tracking samples.
- **Time:** comes from the injectable clock (`performance.now()` in the browser, fake in tests).

## Deployment
A static build (`npm run build` → `dist/`) served over HTTPS from T1 on by Vercel, connected to the GitHub repo (each push to the main branch updates the production link). Nothing is downloaded at build time: the hand model is committed and the wasm files come from `node_modules`. Asset URLs are built from Vite's `import.meta.env.BASE_URL`, so the build also works from a sub-path. Supported browsers: Chrome on Windows and on macOS (Retina, DPR 2); Edge on Windows second.
