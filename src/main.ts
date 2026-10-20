import { RENDER } from './config/tuning';
import { createEventBus, type EventBus } from './core/eventBus';
import type { EventMap } from './core/events';
import { createDebugOverlay, type DebugOverlay } from './dev/debugOverlay';
import { createFpsReporter } from './dev/fpsReporter';
import type { StrokeDemo } from './dev/strokeDemo';
import { createMouseWandSource, type HandRatePreview } from './input/mouseWandSource';
import { parseDprCapOverride } from './presentation/canvasSize';
import { createCanvasStage, type CanvasStage } from './presentation/canvasStage';
import type { ReleaseOutcome } from './presentation/trailColors';
import { createTrailLayer, type TrailLayer } from './presentation/trailLayer';
import { createPracticeStage } from './scenes/practiceStage';
import { browserStore, loadSettings, type Settings } from './settings/settings';

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
  const settings = loadSettings(browserStore());
  const handRate: HandRatePreview = { enabled: params.get('handRate') === '1' };
  const trail = createTrailLayer(bus);

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

  const overlay = buildOverlay(stage, dprCap, capOverride !== null, handRate, trail);
  const report = params.get('reportFps') === '1' ? createFpsReporter(stage.frameWorkMs) : null;
  stage.start(scene, (t) => {
    overlay.frame(t);
    report?.(t);
  });

  return { bus, settings };
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

bootstrap().catch((error: unknown) => {
  console.error('The game failed to start:', error);
});
