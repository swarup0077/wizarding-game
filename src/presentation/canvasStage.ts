import { RENDER } from '../config/tuning';
import type { Scene } from '../scenes/scene';
import { backingSize, effectiveDpr } from './canvasSize';
import { createView, type View } from './view';

/** The full-window canvas and the single render loop (FR-17). */
export interface CanvasStage {
  /** The current view (replaced on resize). */
  view(): View;
  /** Starts the loop. `onFrame` runs after each render with the frame time (ms). */
  start(scene: Scene, onFrame?: (t: number) => void): void;
  /** Stops the loop and removes listeners. */
  stop(): void;
}

/** Creates the canvas inside `parent`, rendering at most at `dprCap` device pixels per CSS pixel. */
export function createCanvasStage(parent: HTMLElement, dprCap: number): CanvasStage {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  parent.appendChild(canvas);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is not available in this browser.');
  const g: CanvasRenderingContext2D = context;

  let view = createView(1, 1);
  let frameId = 0;
  let lastT: number | null = null;
  let stopDprWatch = (): void => undefined;

  function resize(): void {
    const dpr = effectiveDpr(window.devicePixelRatio, dprCap);
    const size = backingSize(parent.clientWidth, parent.clientHeight, dpr);
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    view = createView(parent.clientWidth, parent.clientHeight, dpr);
  }

  // devicePixelRatio changes without a resize event when the window moves to another
  // monitor or the browser zoom changes. A media query on the current ratio catches it.
  function watchDpr(): void {
    stopDprWatch();
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onChange = (): void => {
      resize();
      watchDpr();
    };
    query.addEventListener('change', onChange, { once: true });
    stopDprWatch = () => query.removeEventListener('change', onChange);
  }

  resize();
  watchDpr();
  window.addEventListener('resize', resize);

  return {
    view: () => view,

    start(scene, onFrame) {
      const frame = (t: number): void => {
        // Clamp the step so a hidden tab or a stall doesn't make animations jump.
        const dt = lastT === null ? 0 : Math.min(t - lastT, RENDER.maxFrameDtMs);
        lastT = t;
        scene.update(dt);
        g.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
        scene.render(g, view);
        onFrame?.(t);
        frameId = requestAnimationFrame(frame);
      };
      frameId = requestAnimationFrame(frame);
    },

    stop() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      stopDprWatch();
    },
  };
}
