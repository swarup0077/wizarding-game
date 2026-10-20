import { DEBUG, PERFORMANCE } from '../config/tuning';
import { createFpsMeter } from '../core/fpsMeter';
import './debugOverlay.css';

/** Facts about the render setup the overlay shows, read each refresh. */
export interface RenderInfo {
  width: number;
  height: number;
  /** Pixel ratio actually rendered at. */
  dpr: number;
  /** The device's own pixel ratio. */
  deviceDpr: number;
  dprCap: number;
  /** True when the cap came from the `?dprCap=` URL override. */
  capOverridden: boolean;
}

/** The D-key debug overlay (FR-23). T1: render fps and render size. */
export interface DebugOverlay {
  /** Call once per rendered frame with its timestamp (ms). */
  frame(t: number): void;
  dispose(): void;
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Creates the overlay inside `parent` (the HUD layer). Hidden until D is pressed. */
export function createDebugOverlay(parent: HTMLElement, info: () => RenderInfo): DebugOverlay {
  const panel = document.createElement('div');
  panel.className = 'debug-overlay';
  panel.hidden = true;
  const fpsValue = addRow(panel, 'Render fps');
  const sizeValue = addRow(panel, 'Canvas');
  const dprValue = addRow(panel, 'Pixel ratio');
  parent.appendChild(panel);

  const meter = createFpsMeter(DEBUG.fpsWindowMs);
  const refreshMs = 1000 / DEBUG.textRefreshHz;
  let lastRefresh = -Infinity;

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'd' && event.key !== 'D') return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    panel.hidden = !panel.hidden;
    lastRefresh = -Infinity;
  };
  window.addEventListener('keydown', onKey);

  function refresh(t: number): void {
    const fps = meter.read(t);
    fpsValue.textContent = fps.toFixed(0);
    fpsValue.dataset['ok'] = String(fps >= PERFORMANCE.renderFpsTarget);
    const r = info();
    sizeValue.textContent = `${r.width}×${r.height} CSS px`;
    const source = r.capOverridden ? 'URL override' : 'tuning.ts';
    dprValue.textContent = `${r.dpr} (device ${r.deviceDpr}, cap ${r.dprCap} from ${source})`;
  }

  return {
    frame(t) {
      // While hidden, the only cost is recording the timestamp.
      meter.tick(t);
      if (panel.hidden || t - lastRefresh < refreshMs) return;
      lastRefresh = t;
      refresh(t);
    },
    dispose() {
      window.removeEventListener('keydown', onKey);
      panel.remove();
    },
  };
}

function addRow(panel: HTMLElement, label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'debug-row';
  const name = document.createElement('span');
  name.className = 'debug-label';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'debug-value';
  row.append(name, value);
  panel.appendChild(row);
  return value;
}
