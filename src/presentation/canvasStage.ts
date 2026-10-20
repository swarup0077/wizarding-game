import { RENDER } from '../config/tuning';
import type { Scene } from '../scenes/scene';
import { backingSize, effectiveDpr } from './canvasSize';
import type { Layer } from './layer';
import { createView, type View } from './view';

/** Maps the browser's frame timestamp to the frame's game time. Real: unchanged. */
export type FrameTime = (rafTime: number) => number;

/** The full-window canvas and the single render loop (FR-17). */
export interface CanvasStage {
  /** The current view (replaced on resize). */
  view(): View;
  /** Milliseconds our code spent on the last frame (update + draw calls), out of a ~16.7 ms budget. */
  frameWorkMs: () => number;
  /** Adds a layer drawn over the scene, in the order added. */
  addLayer(layer: Layer): void;
  /** Starts the loop. `onFrame` runs after each render with the browser's frame time (ms). */
  start(scene: Scene, onFrame?: (rafTime: number) => void): void;
  /** Stops the loop and removes listeners. */
  stop(): void;
}

/**
 * Creates the canvas inside `parent`, rendering at most at `dprCap` device pixels per
 * CSS pixel. `frameTime` lets a dev tool run the game on a stepped clock.
 */
export function createCanvasStage(
  parent: HTMLElement,
  dprCap: number,
  frameTime: FrameTime = (t) => t,
): CanvasStage {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  parent.appendChild(canvas);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is not available in this browser.');
  const g: CanvasRenderingContext2D = context;

  const layers: Layer[] = [];
  let view = createView(1, 1);
  let frameId = 0;
  let lastT: number | null = null;
  let workMs = 0;
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
    frameWorkMs: () => workMs,

    addLayer(layer) {
      layers.push(layer);
    },

    start(scene, onFrame) {
      const frame = (rafTime: number): void => {
        const workStart = performance.now();
        const t = frameTime(rafTime);
        // Clamp the step so a hidden tab or a stall doesn't make animations jump.
        const dt = lastT === null ? 0 : Math.min(Math.max(0, t - lastT), RENDER.maxFrameDtMs);
        lastT = t;
        scene.update(dt);
        for (const layer of layers) layer.update(dt, t, view);
        g.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
        scene.render(g, view);
        for (const layer of layers) layer.render(g, view);
        workMs = performance.now() - workStart;
        onFrame?.(rafTime);
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
