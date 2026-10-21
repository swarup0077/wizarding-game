import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { TRACKING } from '../config/tuning';
import type { TrackerDelegate } from '../core/types';
import { createWithFallback, errorText, nextDelegate } from './delegateFallback';

// Creates MediaPipe's HandLandmarker (FR-2): the only file that imports MediaPipe (lint
// enforces it). Used in the hand worker and, as the fallback, on the main thread, so both
// load, choose a delegate, warm up and fall back the same way. Works in a window and in a
// worker.
//
// A delegate counts as working only once it has also run the warm-up detection: on some
// machines the GPU creates fine and fails at its first detection, and then the CPU is tried.

/** MediaPipe's landmarker, as the rest of perception refers to it. */
export type Landmarker = HandLandmarker;
/** One detection's raw result. */
export type LandmarkerResult = ReturnType<HandLandmarker['detectForVideo']>;

/** The landmarker in use, and what it cost to start. */
export interface ActiveLandmarker {
  landmarker: Landmarker;
  delegate: TrackerDelegate;
  /** Why the GPU isn't in use, when it was tried and failed. */
  gpuError: string | null;
  /** Loading the runtime and model and creating the landmarker. */
  loadMs: number;
  /** The warm-up detection (first-use cost: GPU shader compiles). */
  warmupMs: number;
}

/** Owns the landmarker: the active one, and the switch to the next delegate. */
export interface LandmarkerHost {
  active(): ActiveLandmarker;
  /** The active delegate failed mid-session: start the next one. Null when none is left. */
  fallBack(error: unknown): Promise<ActiveLandmarker | null>;
  close(): void;
}

/** Loads the runtime and model from `assetBase`, then starts the first delegate that works. */
export async function startLandmarker(
  assetBase: string,
  delegates: readonly TrackerDelegate[],
): Promise<LandmarkerHost> {
  const start = performance.now();
  if (typeof WebAssembly === 'undefined') throw new Error('This browser has no WebAssembly.');
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(`${assetBase}mediapipe/wasm`);

  const begin = async (delegate: TrackerDelegate): Promise<Omit<ActiveLandmarker, 'gpuError'>> => {
    const created = performance.now();
    const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${assetBase}models/hand_landmarker.task`, delegate },
      runningMode: 'VIDEO',
      numHands: TRACKING.numHands,
    });
    try {
      const warmupMs = warmUp(landmarker);
      return { landmarker, delegate, loadMs: performance.now() - created - warmupMs, warmupMs };
    } catch (error) {
      landmarker.close();
      throw error;
    }
  };

  const choice = await createWithFallback(delegates, begin);
  let active: ActiveLandmarker = {
    ...choice.value,
    loadMs: performance.now() - start - choice.value.warmupMs,
    gpuError: choice.failed.find((f) => f.delegate === 'GPU')?.error ?? null,
  };

  return {
    active: () => active,
    async fallBack(error) {
      const failed = active.delegate;
      active.landmarker.close();
      const next = nextDelegate(delegates, failed);
      if (!next) return null;
      const started = await begin(next);
      active = { ...started, gpuError: failed === 'GPU' ? errorText(error) : active.gpuError };
      return active;
    },
    close: () => active.landmarker.close(),
  };
}

/**
 * Runs one detection on a blank frame, so the first-use cost (on the GPU, compiling shaders:
 * about 3 s in a fresh Chrome profile on Iris Xe) is paid while the tracker is still
 * "readying", not on the first real frame. Uses timestamp 0, below any real frame's.
 * A blank frame runs palm detection only; the landmark model's own first use comes with the
 * first hand. Returns how long it took (ms).
 */
function warmUp(landmarker: Landmarker): number {
  const canvas = new OffscreenCanvas(TRACKING.warmupWidthPx, TRACKING.warmupHeightPx);
  const g = canvas.getContext('2d');
  if (g) g.fillRect(0, 0, canvas.width, canvas.height);
  const start = performance.now();
  landmarker.detectForVideo(canvas, 0);
  return performance.now() - start;
}
