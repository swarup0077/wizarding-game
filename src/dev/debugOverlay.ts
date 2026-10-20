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

/** The D-key debug overlay (FR-23). Other modules add their own rows and controls. */
export interface DebugOverlay {
  /** Call once per rendered frame with its timestamp (ms). */
  frame(t: number): void;
  /** Adds a read-only row, refreshed a few times per second while visible. */
  addStat(label: string, read: () => string): void;
  /** Adds a checkbox. */
  addToggle(label: string, initial: boolean, onChange: (on: boolean) => void): void;
  /** Adds a drop-down list. */
  addChoice<T extends string>(
    label: string,
    options: readonly T[],
    initial: T,
    onChange: (value: T) => void,
  ): void;
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
  parent.appendChild(panel);

  const stats: { value: HTMLElement; read: () => string }[] = [];
  const meter = createFpsMeter(DEBUG.fpsWindowMs);
  const refreshMs = 1000 / DEBUG.textRefreshHz;
  let lastRefresh = -Infinity;
  let fps = 0;

  const fpsValue = addRow(panel, 'Render fps');
  const addStat = (label: string, read: () => string): void => {
    stats.push({ value: addRow(panel, label), read });
  };
  addStat('Canvas', () => {
    const r = info();
    return `${r.width}×${r.height} CSS px`;
  });
  addStat('Pixel ratio', () => {
    const r = info();
    const source = r.capOverridden ? 'URL override' : 'tuning.ts';
    return `${r.dpr} (device ${r.deviceDpr}, cap ${r.dprCap} from ${source})`;
  });

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'd' && event.key !== 'D') return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    panel.hidden = !panel.hidden;
    lastRefresh = -Infinity;
  };
  window.addEventListener('keydown', onKey);

  function refresh(t: number): void {
    fps = meter.read(t);
    fpsValue.textContent = fps.toFixed(0);
    fpsValue.dataset['ok'] = String(fps >= PERFORMANCE.renderFpsTarget);
    for (const stat of stats) stat.value.textContent = stat.read();
  }

  return {
    frame(t) {
      // While hidden, the only cost is recording the timestamp.
      meter.tick(t);
      if (panel.hidden || t - lastRefresh < refreshMs) return;
      lastRefresh = t;
      refresh(t);
    },

    addStat,

    addToggle(label, initial, onChange) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = initial;
      input.addEventListener('change', () => onChange(input.checked));
      addControlRow(panel, label, input);
    },

    addChoice(label, options, initial, onChange) {
      const select = document.createElement('select');
      for (const option of options) {
        const el = document.createElement('option');
        el.value = option;
        el.textContent = option;
        select.appendChild(el);
      }
      select.value = initial;
      select.addEventListener('change', () => {
        const chosen = options.find((o) => o === select.value);
        if (chosen !== undefined) onChange(chosen);
      });
      addControlRow(panel, label, select);
    },

    dispose() {
      window.removeEventListener('keydown', onKey);
      panel.remove();
    },
  };
}

function addRow(panel: HTMLElement, label: string): HTMLElement {
  const value = document.createElement('span');
  value.className = 'debug-value';
  addControlRow(panel, label, value);
  return value;
}

function addControlRow(panel: HTMLElement, label: string, control: HTMLElement): void {
  const row = document.createElement('label');
  row.className = 'debug-row';
  const name = document.createElement('span');
  name.className = 'debug-label';
  name.textContent = label;
  row.append(name, control);
  panel.appendChild(row);
}
