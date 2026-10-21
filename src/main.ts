import { CAMERA, RENDER } from './config/tuning';
import { systemClock } from './core/clock';
import { createEventBus, type EventBus } from './core/eventBus';
import type { EventMap } from './core/events';
import { createDebugOverlay, type DebugOverlay } from './dev/debugOverlay';
import { createFpsReporter } from './dev/fpsReporter';
import { addTrackerStats } from './dev/trackerStats';
import type { StrokeDemo } from './dev/strokeDemo';
import { createBrowserCamera } from './input/camera';
import { createCameraController } from './input/cameraController';
import { startKeyboardActions } from './input/keyboardActions';
import { createMouseWandSource, type HandRatePreview } from './input/mouseWandSource';
import { delegateOrdersFromQuery } from './perception/delegateFallback';
import { createHandTracker } from './perception/handTracker';
import { detectorFromQuery, trackerSimulationFromQuery } from './perception/trackerPolicy';
import { parseDprCapOverride } from './presentation/canvasSize';
import { createCanvasStage, type CanvasStage } from './presentation/canvasStage';
import { mountHud } from './presentation/hud/mountHud';
import { detectPlatform, parsePlatformOverride } from './presentation/hud/platform';
import type { ReleaseOutcome } from './presentation/trailColors';
import { createTrailLayer, type TrailLayer } from './presentation/trailLayer';
import { createPracticeStage } from './scenes/practiceStage';
import { browserStore, type Settings } from './settings/settings';
import { connectSettingsActions, createSettingsStore } from './settings/settingsStore';
import { ensureUiFilters } from './ui';
import { HAND_WORKER_URL } from 'virtual:hand-worker';

/** What the running game is built from. Later tasks add sources and recognition. */
export interface App {
  bus: EventBus<EventMap>;
  settings: Settings;
}

const RELEASE_PREVIEWS: readonly ReleaseOutcome[] = ['fade', 'gold', 'grey'];

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`index.html is missing #${id}.`);
  return element;
}

/** Builds the app: bus, settings, stage, scene, wand input, trail, debug tools and the loop. */
export async function bootstrap(): Promise<App> {
  const params = new URLSearchParams(window.location.search);
  const bus = createEventBus<EventMap>();
  const settingsStore = createSettingsStore(browserStore(), bus, systemClock);
  connectSettingsActions(bus, settingsStore);
  startKeyboardActions(bus, systemClock);
  const handRate: HandRatePreview = { enabled: params.get('handRate') === '1' };
  const trail = createTrailLayer(bus);
  ensureUiFilters();

  // The stroke demo is a dev tool: its code is only downloaded when `?demo=` is present.
  let demo: StrokeDemo | null = null;
  if (params.has('demo')) {
    const { createStrokeDemo } = await import('./dev/strokeDemo');
    demo = createStrokeDemo(params, bus, handRate, trail.setReleasePreview);
  }

  // `?dprCap=` lets us measure frame rate at different caps without rebuilding (D-028).
  const capOverride = parseDprCapOverride(window.location.search);
  const dprCap = capOverride ?? RENDER.maxDevicePixelRatio;
  const stageElement = requireElement('stage');
  const stage = createCanvasStage(stageElement, dprCap, demo?.frameTime);
  if (demo) stage.addLayer(demo.layer);
  stage.addLayer(trail);

  if (!demo) {
    createMouseWandSource({
      target: stageElement,
      bus,
      handRate,
      toNormalized: (clientX, clientY) => {
        const rect = stageElement.getBoundingClientRect();
        return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
      },
      onDrawingChange: (drawing) => document.body.classList.toggle('drawing', drawing),
    }).start();
  }

  const scene = createPracticeStage();
  await scene.load({ bus });

  // The camera (T3): the HUD subscribes first, then the controller reports `idle`, which
  // shows the "Enable camera" card. Nothing is requested until the player clicks.
  const hud = requireElement('hud');
  const camera = createBrowserCamera();
  const cameraState = watchCameraStatus(bus);
  const platform = parsePlatformOverride(params.get('platform')) ?? detectPlatform();
  mountHud({
    parent: hud,
    bus,
    video: camera.video,
    platform,
    settings: settingsStore.get(),
    now: () => systemClock.now(),
  });
  // Hand tracking (T4) reads the same <video> the preview shows, and detects in the hand
  // worker. It loads when the camera is asked for. Dev overrides, for measuring and
  // rehearsing failures: `?delegate=cpu|gpu`, `?detector=main`, `?simulateTracker=<failure>`.
  const search = window.location.search;
  const tracker = createHandTracker({
    bus,
    video: camera.video,
    clock: systemClock,
    assetBase: import.meta.env.BASE_URL,
    delegates: delegateOrdersFromQuery(search),
    workerUrl: detectorFromQuery(search) === 'main' ? null : HAND_WORKER_URL,
    simulate: trackerSimulationFromQuery(search),
  });
  // The UI gallery shows the camera card itself; the live one would cover it.
  if (params.get('dev') !== 'ui')
    createCameraController({ bus, camera, clock: systemClock }).start();
  if (params.get('dev') === 'camera') {
    const { startCameraSim } = await import('./dev/cameraSim');
    startCameraSim(params, bus, camera.video);
  }

  // The UI kit gallery is a dev tool, downloaded only for `?dev=ui` (T2b).
  if (params.get('dev') === 'ui') {
    const { mountUiGallery } = await import('./dev/uiGallery');
    mountUiGallery(hud);
  }

  const overlay = buildOverlay(stage, dprCap, capOverride !== null, handRate, trail);
  addCameraStats(overlay, cameraState);
  addTrackerStats(overlay, tracker.stats);
  const report =
    params.get('reportFps') === '1' ? createFpsReporter(stage.frameWorkMs, tracker.stats) : null;
  stage.start(scene, (t) => {
    overlay.frame(t);
    report?.(t);
  });

  return { bus, settings: settingsStore.get() };
}

function buildOverlay(
  stage: CanvasStage,
  dprCap: number,
  capOverridden: boolean,
  handRate: HandRatePreview,
  trail: TrailLayer,
): DebugOverlay {
  const overlay = createDebugOverlay(requireElement('hud'), () => {
    const view = stage.view();
    return {
      width: view.width,
      height: view.height,
      dpr: view.pixelRatio,
      deviceDpr: window.devicePixelRatio,
      dprCap,
      capOverridden,
    };
  });
  overlay.addStat('Frame work', () => `${stage.frameWorkMs().toFixed(2)} ms`);
  overlay.addStat('Input rate', () => `${trail.stats().inputHz.toFixed(0)} Hz`);
  overlay.addStat('Render delay', () => `${trail.stats().delayMs.toFixed(0)} ms`);
  overlay.addStat('Trail points', () => String(trail.stats().trailPoints));
  overlay.addStat('Sparkles', () => String(trail.stats().particles));
  overlay.addStat('Glow sprites', () => String(trail.stats().sprites));
  overlay.addToggle('Hand-rate preview (30 Hz)', handRate.enabled, (on) => {
    handRate.enabled = on;
  });
  overlay.addChoice('Release preview', RELEASE_PREVIEWS, 'fade', trail.setReleasePreview);
  return overlay;
}

/** Keeps the latest camera status, for the debug overlay. */
function watchCameraStatus(bus: EventBus<EventMap>): () => EventMap['camera:status'] | null {
  let latest: EventMap['camera:status'] | null = null;
  bus.on('camera:status', (status) => {
    latest = status;
  });
  return () => latest;
}

/** Debug rows for the camera: state, and what it actually delivers (often less than asked). */
function addCameraStats(
  overlay: DebugOverlay,
  status: () => EventMap['camera:status'] | null,
): void {
  const asked = `${CAMERA.idealWidth}×${CAMERA.idealHeight} @ ${CAMERA.idealFps}`;
  overlay.addStat('Camera', () => {
    const s = status();
    return s ? (s.failure ?? s.state) : '–';
  });
  overlay.addStat('Camera actual', () => {
    const a = status()?.actual;
    if (!a) return '–';
    const fps = a.frameRate === null ? '?' : a.frameRate.toFixed(0);
    const got = `${a.width}×${a.height} @ ${fps}`;
    if (status()?.retriedUnconstrained) return `${got} fps (defaults)`;
    return got === asked ? `${got} fps` : `${got} fps (asked ${asked})`;
  });
  overlay.addStat('Camera device', () => status()?.actual?.label || '–');
}

bootstrap().catch((error: unknown) => {
  console.error('The game failed to start:', error);
});
