import { RENDER } from './config/tuning';
import { createEventBus, type EventBus } from './core/eventBus';
import type { EventMap } from './core/events';
import { createDebugOverlay } from './dev/debugOverlay';
import { parseDprCapOverride } from './presentation/canvasSize';
import { createCanvasStage } from './presentation/canvasStage';
import { createPracticeStage } from './scenes/practiceStage';
import { browserStore, loadSettings, type Settings } from './settings/settings';

/** What the running game is built from. Later tasks add sources and recognition. */
export interface App {
  bus: EventBus<EventMap>;
  settings: Settings;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`index.html is missing #${id}.`);
  return element;
}

/** Builds the app: bus, settings, stage, scene, debug overlay and the render loop. */
export async function bootstrap(): Promise<App> {
  const bus = createEventBus<EventMap>();
  const settings = loadSettings(browserStore());

  // `?dprCap=` lets us measure frame rate at different caps without rebuilding (D-028).
  const capOverride = parseDprCapOverride(window.location.search);
  const dprCap = capOverride ?? RENDER.maxDevicePixelRatio;
  const stage = createCanvasStage(requireElement('stage'), dprCap);

  const scene = createPracticeStage();
  await scene.load({ bus });

  const overlay = createDebugOverlay(requireElement('hud'), () => {
    const view = stage.view();
    return {
      width: view.width,
      height: view.height,
      dpr: view.pixelRatio,
      deviceDpr: window.devicePixelRatio,
      dprCap,
      capOverridden: capOverride !== null,
    };
  });
  stage.start(scene, (t) => overlay.frame(t));

  return { bus, settings };
}

bootstrap().catch((error: unknown) => {
  console.error('The game failed to start:', error);
});
